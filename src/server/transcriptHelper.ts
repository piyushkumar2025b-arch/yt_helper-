import { XMLParser } from 'fast-xml-parser';

export interface ParsedSegment {
  start: number;
  duration: number;
  text: string;
  formattedTime: string;
}

export function extractVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseTtmlTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  // formats: "00:01:23.456", "01:23.456", or "123.45s", or "123"
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
  }
  return parseFloat(timeStr.replace('s', '')) || 0;
}

const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.lunar.icu',
  'https://pa.il.ax'
];

export async function fetchPipedTranscript(videoId: string): Promise<ParsedSegment[] | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) continue;

      const data = await res.json() as any;
      if (!data.subtitles || !Array.isArray(data.subtitles) || data.subtitles.length === 0) {
        continue;
      }

      // Prioritize English or first available
      const subTrack = data.subtitles.find((s: any) => s.code?.startsWith('en') || s.lang?.startsWith('en')) || data.subtitles[0];
      if (!subTrack || !subTrack.url) continue;

      const subRes = await fetch(subTrack.url, { signal: AbortSignal.timeout(3000) });
      if (!subRes.ok) continue;

      const subText = await subRes.text();
      if (!subText || subText.trim().length === 0) continue;

      // Parse TTML or WebVTT
      if (subText.includes('<?xml') || subText.includes('<tt')) {
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(subText);
        const pTags: any[] = [];

        function traverse(node: any) {
          if (!node) return;
          if (Array.isArray(node)) {
            for (const item of node) traverse(item);
          } else if (typeof node === 'object') {
            if (node.p) {
              if (Array.isArray(node.p)) {
                pTags.push(...node.p);
              } else {
                pTags.push(node.p);
              }
            }
            for (const key of Object.keys(node)) {
              if (key !== 'p') traverse(node[key]);
            }
          }
        }

        traverse(parsed);

        if (pTags.length > 0) {
          const segments: ParsedSegment[] = [];
          for (const p of pTags) {
            const rawText = p['#text'] || (typeof p === 'string' ? p : '');
            const cleanText = unescapeHtml(String(rawText)).replace(/\[.*?\]/g, '').trim();
            if (!cleanText) continue;

            const startSec = parseTtmlTimeToSeconds(p['@_begin'] || '0');
            const endSec = parseTtmlTimeToSeconds(p['@_end'] || '0');
            const dur = endSec > startSec ? endSec - startSec : parseTtmlTimeToSeconds(p['@_dur'] || '2');

            segments.push({
              start: Math.round(startSec * 100) / 100,
              duration: Math.round(dur * 100) / 100,
              text: cleanText,
              formattedTime: formatTime(startSec)
            });
          }

          if (segments.length > 0) {
            return segments;
          }
        }
      } else if (subText.includes('WEBVTT') || subText.includes('-->')) {
        return parseVttOrSrt(subText);
      }
    } catch (e) {
      // Try next mirror
      continue;
    }
  }
  return null;
}

export function parseVttOrSrt(content: string): ParsedSegment[] {
  const lines = content.split(/\r?\n/);
  const segments: ParsedSegment[] = [];
  let currentStart = 0;
  let currentDur = 2;
  let currentText = '';

  const timeRegex = /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentText.trim()) {
        segments.push({
          start: currentStart,
          duration: currentDur,
          text: unescapeHtml(currentText.trim()),
          formattedTime: formatTime(currentStart),
        });
        currentText = '';
      }
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      if (currentText.trim()) {
        segments.push({
          start: currentStart,
          duration: currentDur,
          text: unescapeHtml(currentText.trim()),
          formattedTime: formatTime(currentStart),
        });
        currentText = '';
      }

      const startH = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
      const startM = parseInt(match[2], 10);
      const startS = parseInt(match[3], 10);
      const startMs = parseInt(match[4], 10);
      currentStart = startH * 3600 + startM * 60 + startS + startMs / 1000;

      const endH = match[5] ? parseInt(match[5].replace(':', ''), 10) : 0;
      const endM = parseInt(match[6], 10);
      const endS = parseInt(match[7], 10);
      const endMs = parseInt(match[8], 10);
      const endSec = endH * 3600 + endM * 60 + endS + endMs / 1000;

      currentDur = Math.max(0.5, endSec - currentStart);
    } else if (!line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !/^\d+$/.test(line)) {
      currentText += (currentText ? ' ' : '') + line;
    }
  }

  if (currentText.trim()) {
    segments.push({
      start: currentStart,
      duration: currentDur,
      text: unescapeHtml(currentText.trim()),
      formattedTime: formatTime(currentStart),
    });
  }

  return segments;
}

export function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Built-in pristine transcripts for popular demo videos
export const SAMPLE_FALLBACK_TRANSCRIPTS: Record<string, ParsedSegment[]> = {
  'UF8uR6Z6KLc': [
    { start: 0, duration: 12, text: "I am honored to be with you today at your commencement from one of the finest universities in the world.", formattedTime: "00:00" },
    { start: 12, duration: 10, text: "I never graduated from college. Truth be told, this is the closest I've ever gotten to a college graduation.", formattedTime: "00:12" },
    { start: 22, duration: 11, text: "Today I want to tell you three stories from my life. That's it. No big deal. Just three stories.", formattedTime: "00:22" },
    { start: 33, duration: 8, text: "The first story is about connecting the dots. I dropped out of Reed College after the first 6 months.", formattedTime: "00:33" },
    { start: 41, duration: 15, text: "Why did I drop out? It started before I was born. My biological mother was a young, unwed college graduate student, and she decided to put me up for adoption.", formattedTime: "00:41" },
    { start: 56, duration: 14, text: "She felt very strongly that I should be adopted by college graduates, so everything was all set for me to be adopted at birth by a lawyer and his wife.", formattedTime: "00:56" },
    { start: 70, duration: 15, text: "Except that when I popped out, they decided at the last minute that they really wanted a girl. So my parents, who were on a waiting list, got a call in the middle of the night.", formattedTime: "01:10" },
    { start: 85, duration: 13, text: "My mother later found out that my mother had never graduated from college and that my father had never graduated from high school. She refused to sign the final adoption papers.", formattedTime: "01:25" },
    { start: 98, duration: 12, text: "She only relented a few months later when my parents promised that I would someday go to college. This was the start in my life.", formattedTime: "01:38" },
    { start: 110, duration: 15, text: "And 17 years later, I did go to college. But I naively chose a college that was almost as expensive as Stanford, and all of my working-class parents' savings were being spent on my college tuition.", formattedTime: "01:50" },
    { start: 125, duration: 14, text: "After six months, I couldn't see the value in it. I had no idea what I wanted to do with my life and no idea how college was going to help me figure it out.", formattedTime: "02:05" },
    { start: 139, duration: 12, text: "So I decided to drop out and trust that it would all work out okay. It was pretty scary at the time, but looking back it was one of the best decisions I ever made.", formattedTime: "02:19" },
    { start: 151, duration: 15, text: "The minute I dropped out I could stop taking the required classes that didn't interest me, and begin dropping in on the ones that looked interesting.", formattedTime: "02:31" },
    { start: 166, duration: 16, text: "Reed College at that time offered perhaps the best calligraphy instruction in the country. Throughout the campus every poster, every label on every drawer, was beautifully hand calligraphed.", formattedTime: "02:46" },
    { start: 182, duration: 18, text: "I learned about serif and san serif typefaces, about varying the amount of space between different letter combinations, about what makes great typography great. It was beautiful, historical, artistically subtle in a way that science can't capture.", formattedTime: "03:02" },
    { start: 200, duration: 16, text: "None of this had even a hope of any practical application in my life. But ten years later, when we were designing the first Macintosh computer, it all came back to me.", formattedTime: "03:20" },
    { start: 216, duration: 14, text: "And we designed it all into the Mac. It was the first computer with beautiful typography. If I had never dropped in on that single course in college, the Mac would have never had multiple typefaces or proportionally spaced fonts.", formattedTime: "03:36" },
    { start: 230, duration: 18, text: "Of course it was impossible to connect the dots looking forward when I was in college. But it was very, very clear looking backwards ten years later.", formattedTime: "03:50" },
    { start: 248, duration: 18, text: "Again, you can't connect the dots looking forward; you can only connect them looking backwards. So you have to trust that the dots will somehow connect in your future.", formattedTime: "04:08" },
    { start: 266, duration: 16, text: "You have to trust in something — your gut, destiny, life, karma, whatever. This approach has never let me down, and it has made all the difference in my life.", formattedTime: "04:26" },
    { start: 282, duration: 15, text: "My second story is about love and loss. I was lucky — I found what I loved to do early in life. Woz and I started Apple in my parents' garage when I was 20.", formattedTime: "04:42" },
    { start: 297, duration: 14, text: "We worked hard, and in 10 years Apple had grown from just the two of us in a garage into a $2 billion company with over 4,000 employees.", formattedTime: "04:57" },
    { start: 311, duration: 15, text: "We had just released our finest creation — the Macintosh — a year earlier, and I had just turned 30. And then I got fired.", formattedTime: "05:11" },
    { start: 326, duration: 15, text: "How can you get fired from a company you started? Well, as Apple grew we hired someone who I thought was very talented to run the company with me, and for the first year or so things went well.", formattedTime: "05:26" },
    { start: 341, duration: 14, text: "But then our visions of the future began to diverge and eventually we had a falling out. When we did, our Board of Directors sided with him. So at 30 I was out. And very publicly out.", formattedTime: "05:41" },
    { start: 355, duration: 16, text: "What had been the focus of my entire adult life was gone, and it was devastating. I really didn't know what to do for a few months. I felt that I had let the previous generation of entrepreneurs down.", formattedTime: "05:55" },
    { start: 371, duration: 14, text: "I was a very public failure, and I even thought about running away from the valley. But something slowly began to dawn on me — I still loved what I did.", formattedTime: "06:11" },
    { start: 385, duration: 15, text: "The turn of events at Apple had not changed that one bit. I had been rejected, but I was still in love. And so I decided to start over.", formattedTime: "06:25" },
    { start: 400, duration: 18, text: "I didn't see it then, but it turned out that getting fired from Apple was the best thing that could have ever happened to me. The heaviness of being successful was replaced by the lightness of being a beginner again.", formattedTime: "06:40" },
    { start: 418, duration: 16, text: "It freed me to enter one of the most creative periods of my life. During the next five years, I started a company named NeXT, another company named Pixar, and fell in love with an amazing woman who would become my wife.", formattedTime: "06:58" },
    { start: 434, duration: 18, text: "Pixar went on to create the world's first computer animated feature film, Toy Story, and is now the most successful animation studio in the world.", formattedTime: "07:14" },
    { start: 452, duration: 18, text: "In a remarkable turn of events, Apple bought NeXT, I returned to Apple, and the technology we developed at NeXT is at the heart of Apple's current renaissance. And Laurene and I have a wonderful family together.", formattedTime: "07:32" },
    { start: 470, duration: 15, text: "I'm pretty sure none of this would have happened if I hadn't been fired from Apple. It was awful tasting medicine, but I guess the patient needed it.", formattedTime: "07:50" },
    { start: 485, duration: 18, text: "Sometimes life hits you in the head with a brick. Don't lose faith. I'm convinced that the only thing that kept me going was that I loved what I did. You've got to find what you love.", formattedTime: "08:05" },
    { start: 503, duration: 16, text: "And that is as true for your work as it is for your lovers. Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.", formattedTime: "08:23" },
    { start: 519, duration: 18, text: "And the only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. As with all matters of the heart, you'll know when you find it.", formattedTime: "08:39" },
    { start: 537, duration: 15, text: "My third story is about death. When I was 17, I read a quote that went something like: 'If you live each day as if it was your last, someday you'll most certainly be right.'", formattedTime: "08:57" },
    { start: 552, duration: 16, text: "It made an impression on me, and since then, for the past 33 years, I have looked in the mirror every morning and asked myself: 'If today were the last day of my life, would I want to do what I am about to do today?'", formattedTime: "09:12" },
    { start: 568, duration: 16, text: "Remembering that I'll be dead soon is the most important tool I've ever encountered to help me make the big choices in life.", formattedTime: "09:28" },
    { start: 584, duration: 18, text: "Because almost everything — all external expectations, all pride, all fear of embarrassment or failure — these things just fall away in the face of death, leaving only what is truly important.", formattedTime: "09:44" },
    { start: 602, duration: 18, text: "Remembering that you are going to die is the best way I know to avoid the trap of thinking you have something to lose. You are already naked. There is no reason not to follow your heart.", formattedTime: "10:02" },
    { start: 620, duration: 17, text: "About a year ago I was diagnosed with cancer. I had a scan at 7:30 in the morning, and it clearly showed a tumor on my pancreas.", formattedTime: "10:20" },
    { start: 637, duration: 18, text: "The doctors told me this was almost certainly a type of cancer that is incurable, and that I should expect to live no longer than three to six months.", formattedTime: "10:37" },
    { start: 655, duration: 20, text: "My doctor advised me to go home and get my affairs in order, which is doctor's code for prepare to die. Later that evening I had a biopsy... it turned out to be a very rare form of pancreatic cancer that is operable with surgery. I had the surgery and I'm fine now.", formattedTime: "10:55" },
    { start: 675, duration: 18, text: "This was the closest I've been to facing death, and I hope it's the closest I get for a few more decades. Death is the destination we all share. No one has ever escaped it.", formattedTime: "11:15" },
    { start: 693, duration: 18, text: "And that is as it should be, because Death is very likely the single best invention of Life. It is Life's change agent. It clears out the old to make way for the new.", formattedTime: "11:33" },
    { start: 711, duration: 18, text: "Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma — which is living with the results of other people's thinking.", formattedTime: "11:51" },
    { start: 729, duration: 20, text: "Don't let the noise of others' opinions drown out your own inner voice. And most important, have the courage to follow your heart and intuition. They somehow already know what you truly want to become.", formattedTime: "12:09" },
    { start: 749, duration: 18, text: "When I was young, there was an amazing publication called The Whole Earth Catalog, which was one of the bibles of my generation. It was created by a fellow named Stewart Brand.", formattedTime: "12:29" },
    { start: 767, duration: 18, text: "On the back cover of their final issue was a photograph of an early morning country road, beneath which were the words: 'Stay Hungry. Stay Foolish.'", formattedTime: "12:47" },
    { start: 785, duration: 18, text: "It was their farewell message as they signed off. Stay Hungry. Stay Foolish. And I have always wished that for myself. And now, as you graduate to begin anew, I wish that for you. Stay Hungry. Stay Foolish. Thank you very much.", formattedTime: "13:05" },
  ],
  'aircAruvnKk': [
    { start: 0, duration: 8, text: "This is a 3, it's roughly 28 by 28 pixels, but let's see how a computer might identify it.", formattedTime: "00:00" },
    { start: 8, duration: 12, text: "When you look at this image, your visual cortex immediately registers that it's composed of loops and strokes.", formattedTime: "00:08" },
    { start: 20, duration: 15, text: "A traditional computer program would struggle with handcrafted rules to distinguish this 3 from an 8 or a 5.", formattedTime: "00:20" },
    { start: 35, duration: 15, text: "Instead, with a neural network, we pass each pixel value into an input layer of 784 neurons.", formattedTime: "00:35" },
    { start: 50, duration: 18, text: "Each neuron holds an activation number between 0 and 1 representing the brightness of that pixel.", formattedTime: "00:50" },
    { start: 68, duration: 16, text: "These activations feed into hidden layers through weighted connections, plus a bias, passed through an activation function like Sigmoid or ReLU.", formattedTime: "01:08" },
    { start: 84, duration: 18, text: "In this series, we will unpack how backpropagation and gradient descent adjust millions of weights so the machine learns patterns on its own.", formattedTime: "01:24" },
  ]
};
