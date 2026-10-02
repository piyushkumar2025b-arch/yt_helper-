/**
 * Sample deterministic fallback reports for showcase videos
 * Extracted from server.ts to improve modularity and maintainability (BUG-010).
 */

export const SAMPLE_FALLBACK_REPORTS: Record<string, (title: string) => string> = {
  // Steve Jobs Stanford 2005 Commencement Address
  'UF8uR6Z6KLc': (title: string) => `# ${title}

## What This Talk Is Really About
In this famous 2005 graduation speech at Stanford, Steve Jobs skips the usual stiff career advice and instead shares **three personal stories from his own life**. He talks honestly about dropping out of college, getting fired from the company he started in his parents' garage, and coming face-to-face with cancer.

His core message is simple and deeply human: **life rarely goes according to a neat plan, so don't waste your limited time trying to live someone else's life.** Trust your curiosity, find work you genuinely love, and remember that life is short enough that you have nothing to lose by following your heart.

---

## Step-by-Step Story Walkthrough

- **[00:00] Why He's Sharing Three Simple Stories**:
  Steve opens by admitting he never actually graduated from college, making this the closest he's ever gotten to a college graduation. Instead of giving a grand philosophical lecture, he decides to just tell three real stories from his life.

- **[00:52] Story 1: Connecting the Dots (Dropping Out & Calligraphy)**:
  Steve explains how his biological mother, an unwed graduate student, put him up for adoption on the condition that his adoptive parents would send him to college. At 17, he went to Reed College, an expensive school that was eating up all of his working-class parents' savings. Six months in, he couldn't see the point, so he dropped out—but stayed around as a "drop-in" for another 18 months, sleeping on friends' floors and returning Coke bottles for 5 cents just to buy food.
  Because he no longer had to take required classes, he wandered into a calligraphy class simply because every poster on campus was beautifully hand-lettered. At the time, learning about serif and sans-serif typefaces had zero practical use in his life.

- **[03:45] How the Dots Connected 10 Years Later**:
  Ten years later, when Steve and Woz were designing the first Macintosh computer, all of that calligraphy knowledge came rushing back. They built proportional fonts and beautiful typography right into the Mac—and since Windows copied the Mac, every personal computer today has beautiful fonts because of that random class.
  His takeaway: **You can't connect the dots looking forward; you can only connect them looking backward.** You have to trust that following your curiosity will connect down the road.

- **[05:24] Story 2: Love and Loss (Getting Fired from Apple at 30)**:
  Steve started Apple with Woz in his parents' garage when he was just 20. Within ten years, Apple grew into a $2 billion company with 4,000 employees. Then, at age 30, after a falling-out with the board and the CEO he had hired, he was publicly fired from his own company.
  For a few months, he felt completely lost and felt like he had let down the previous generation of entrepreneurs. Slowly, though, something dawned on him: **he still loved what he did.**

- **[07:12] Starting Over: NeXT, Pixar, and Finding Love**:
  Getting fired freed him from the pressure of being successful and gave him the freedom of being a beginner again. Over the next five years, he started a company called NeXT, started another company called Pixar (which made *Toy Story*, the first computer-animated feature film), and fell in love with his wife, Laurene. In a remarkable twist, Apple bought NeXT, bringing Steve right back to the company he loved—and the technology they built at NeXT became the heart of modern Apple.
  His advice here: **Sometimes life hits you in the head with a brick. Don't lose faith.** Keep looking until you find work you truly love, and don't settle.

- **[09:05] Story 3: Death and What Actually Matters**:
  When he was 17, Steve read a quote that stuck with him: *"If you live each day as if it was your last, someday you'll most certainly be right."* Every morning for 33 years, he looked in the mirror and asked himself: if today were my last day, would I want to do what I'm about to do today? Whenever the answer was "No" for too many days in a row, he knew he needed to make a change.

- **[10:30] Facing Cancer & His Final Advice ("Stay Hungry, Stay Foolish")**:
  About a year before this speech, doctors found a tumor on his pancreas and told him he had 3 to 6 months to live, advising him to go home and get his affairs in order. Later that evening, a biopsy showed it was a very rare, curable form of pancreatic cancer, and he survived after surgery.
  Having lived right up against death, he tells the graduates with total certainty: **Your time is limited, so don't waste it living someone else's life.** Don't let the noise of other people's opinions drown out your own inner voice. He closes by recalling *The Whole Earth Catalog* from the 1970s and its farewell message on the back cover: **"Stay Hungry. Stay Foolish."**

---

## Best Quotes to Remember

> "You can't connect the dots looking forward; you can only connect them looking backwards. So you have to trust that the dots will somehow connect in your future." — **[04:35]**

> "The heaviness of being successful was replaced by the lightness of being a beginner again, less sure about everything. It freed me to enter one of the most creative periods of my life." — **[07:05]**

> "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle." — **[08:22]**

> "Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma — which is living with the results of other people's thinking." — **[12:55]**

> "Stay Hungry. Stay Foolish." — **[14:12]**

---

## Practical Takeaways for Everyday Life

1. **Follow your genuine curiosity, even when it looks "useless" right now**: Just like Steve's calligraphy class, the things you explore out of pure interest often end up shaping your most original work years later.
2. **Treat setbacks as a fresh start**: When a job, project, or plan falls apart, let go of the pressure to look successful and enjoy the freedom of experimenting like a beginner again.
3. **Use the morning mirror test**: If you find yourself dreading your daily routine for weeks on end, take it as an honest signal that something needs to change.
4. **Protect your own voice**: Other people always have loud opinions about what you "should" do. Only you have to live your life, so trust your gut.

---

## Exact Resources, Books, Archives & Direct Sources Mentioned

- **[12:48]** [**The Whole Earth Catalog (Stewart Brand, 1968–1974 Final Issue)**](https://archive.org/details/wholeearth) — Counterculture maker catalog described by Steve Jobs as *"one of the bibles of my generation"* with the final back-cover message *"Stay Hungry. Stay Foolish."* ([Wikipedia](https://en.wikipedia.org/wiki/Whole_Earth_Catalog) · [OpenLibrary](https://openlibrary.org/search?q=Whole+Earth+Catalog+Stewart+Brand))
- **[02:15]** [**Reed College Calligraphy Program (Prof. Robert Palladino)**](https://www.reed.edu/reed-magazine/in-memoriam/obituaries/2016/robert-palladino-faculty.html) — The serif/sans-serif calligraphy course Jobs audited after dropping out, which directly inspired Macintosh typography ([Reed College](https://en.wikipedia.org/wiki/Reed_College) · [Fonts on Macintosh](https://en.wikipedia.org/wiki/Fonts_on_Macintosh))
- **[03:45]** [**Apple Macintosh 128K & Original Mac Team Stories (1984)**](https://www.folklore.org/) — First personal computer with proportional bitmap typography and multiple typefaces ([Wikipedia](https://en.wikipedia.org/wiki/Macintosh_128K))
- **[07:05]** [**NeXT Computer & Pixar Animation Studios (Toy Story, 1995)**](https://en.wikipedia.org/wiki/NeXT) — Founded during Jobs's exile from Apple; NeXTSTEP became the foundation of modern macOS/iOS and Pixar created *Toy Story* ([Pixar History](https://en.wikipedia.org/wiki/Pixar))
- **[00:00]** [**Stanford University Official 2005 Commencement Verbatim Text**](https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says) & [**Make Something Wonderful (Steve Jobs Archive Free Book)**](https://stevejobsarchive.com/)`,

  // 3Blue1Brown Neural Networks
  'aircAruvnKk': (title: string) => `# ${title}

## What This Video Is Really About
Grant Sanderson (3Blue1Brown) pulls back the curtain on **neural networks** by stripping away the intimidating math jargon and showing what a neural network actually *is* visually. Using the classic problem of recognizing handwritten digits (like a sloppy "3" on a 28×28 grid of pixels), he shows that a neural network isn't magic—it is simply a series of numbers (neurons) connected by weighted lines that learn to spot edges, loops, and patterns step by step.

---

## Step-by-Step Story Walkthrough

- **[00:00] Why Handwritten Digits Are Harder Than They Look**:
  Your brain effortlessly recognizes a handwritten "3" even when the pixels are completely different from one drawing to the next. If you tried to write traditional if-else code to recognize a "3", you would quickly get stuck. This is where a neural network shines.

- **[01:55] What a "Neuron" Actually Is (Just a Number Between 0 and 1)**:
  Grant asks us to forget biological brains for a moment and picture a neuron as a simple container holding a number between **0** (completely dark) and **1** (brightly lit). The first layer of the network has **784 neurons**—one for each pixel in the 28×28 image.

- **[03:45] Hidden Layers: Spotting Loops, Edges, and Pieces**:
  The final layer has **10 neurons** representing the digits **0** through **9**, and whichever lights up brightest is the network's guess. In between sit the **hidden layers**. Grant walks through the intuition: the first hidden layer might learn to spot tiny short edges, the next layer combines those edges into loops and long lines, and the final layer combines a top loop and bottom loop into an **8** or a **9**.

- **[08:15] Weights, Biases, and Why They Work**:
  How does one layer make the next layer light up? Every connection has a **weight** (a positive or negative number showing whether a pixel helps or hurts that edge), and every neuron has a **bias** (a threshold for how hard it is to turn on). You multiply the brightness of each pixel by its weight, add them all up, add the bias, and squash the result into a clean range using a function like **Sigmoid** or **ReLU**.

- **[13:20] The Whole Network Is Just One Clean Function**:
  In this simple network, there are **13,002 weights and biases**—13,002 little dials and knobs you can turn. Learning simply means finding the right settings for those 13,002 dials so the network gets the right answer on real handwriting.

---

## Best Quotes to Remember

> "Strip away the buzzwords, and a neuron is really just a thing that holds a number." — **[01:58]**

> "Learning just means finding the right weights and biases—tuning those 13,002 dials and knobs so the network actually solves the problem." — **[13:45]**

---

## Practical Takeaways
1. **Demystify AI**: Whenever you hear about a massive AI model with billions of parameters, remember those "parameters" are just the weights and biases (dials and knobs) connecting layers of numbers.
2. **Break big problems into smaller pieces**: Just as the network breaks a full digit into loops, and loops into tiny edges, complex problems become solvable when broken into layered building blocks.

---

## Exact Resources, Books, Papers & Code Mentioned

- **[01:05]** [**MNIST Handwritten Digit Database (Yann LeCun, Corinna Cortes, C.J.C. Burges)**](https://huggingface.co/datasets/ylecun/mnist) — The 70,000-image 28×28 grayscale benchmark dataset used throughout the video ([Wikipedia](https://en.wikipedia.org/wiki/MNIST_database) · [PapersWithCode](https://paperswithcode.com/dataset/mnist))
- **[16:50]** [**Neural Networks and Deep Learning (Michael Nielsen Free Interactive Book & Code)**](http://neuralnetworksanddeeplearning.com/) — The exact free online book and Python code recommended by Grant Sanderson to build this 784→16→16→10 digit classifier ([GitHub: mnielsen/neural-networks-and-deep-learning](https://github.com/mnielsen/neural-networks-and-deep-learning))
- **[03:15]** [**3Blue1Brown Interactive Neural Networks Lesson & Manim Engine**](https://www.3blue1brown.com/lessons/neural-networks) — Official interactive web lesson and open-source Python math animation library ([GitHub: 3b1b/manim](https://github.com/3b1b/manim))
- **[15:25]** [**Deep Sparse Rectifier Neural Networks (Glorot, Bordes, Bengio, 2011 — ReLU Paper)**](https://proceedings.mlr.press/v15/glorot11a.html) — Foundational paper showing why ReLU outperforms Sigmoid in deep networks ([Google Scholar](https://scholar.google.com/scholar?q=Deep+Sparse+Rectifier+Neural+Networks))`,

  // Veritasium Collatz Conjecture (3x + 1)
  '094y1Z2wpJg': (title: string) => `# ${title}

## What This Video Is Really About
Derek Muller (Veritasium) explores the **Collatz Conjecture** (also known as the **3x + 1 problem**)—a math puzzle so simple a first-grader can play it, yet so baffling that the world's sharpest mathematicians still cannot prove it works for every number.

---

## Step-by-Step Story Walkthrough

- **[00:00] A Game Anyone Can Play**:
  Pick any positive whole number. Follow two simple rules: if the number is **odd**, multiply it by 3 and add 1 (**3x + 1**); if the number is **even**, cut it in half (**x / 2**). Repeat over and over.

- **[01:40] Every Number Tested Falls into the 4 → 2 → 1 Loop**:
  No matter what starting number you pick, the sequence bounces up and down like hailstones in a storm (which is why they are called **hailstone numbers**) before eventually hitting **4**, then **2**, then **1**, and looping **4 → 2 → 1** forever.

- **[05:10] The Rollercoaster of Starting with 27**:
  Most small numbers drop to 1 quickly, but if you start at **27**, the number climbs all the way up to **9,232** before finally crashing down to **1** after 111 steps. Computers have checked every number up to 2^68 (nearly 300 quintillion), and every single one eventually reaches 1—yet nobody can prove a runaway number doesn't exist further out.

- **[12:30] Why Probability Says It Should Shrink (But Can't Prove It)**:
  On average, multiplying by 3 and dividing by 2 roughly shrinks numbers over time, which creates beautiful organic "coral tree" graphs when plotted backward from 1. Still, as the legendary mathematician Paul Erdős put it: *"Mathematics may not be ready for such problems."*

---

## Practical Takeaways
1. **Simple rules can create wild complexity**: Just two basic arithmetic rules produce chaotic patterns that push modern mathematics to its limits.
2. **Testing millions of examples is not the same as a proof**: Even 300 quintillion successes in a row doesn't guarantee there isn't an exception hiding further out.

---

## Exact Resources, Papers & Mathematical Datasets Mentioned

- **[16:20]** [**Almost All Orbits of the Collatz Map Attain Almost Bounded Values (Terence Tao, 2019)**](https://arxiv.org/abs/1909.03562) — Terence Tao's breakthrough paper proving logarithmic density bounds on 3x + 1 orbits ([PDF](https://arxiv.org/pdf/1909.03562.pdf))
- **[01:40]** [**The Ultimate Challenge: The 3x + 1 Problem (Jeffrey C. Lagarias Survey)**](https://arxiv.org/abs/math/0309224) — Comprehensive annotated bibliography and history of the Collatz conjecture ([Wikipedia](https://en.wikipedia.org/wiki/Collatz_conjecture))
- **[05:10]** [**OEIS A006577 Hailstone Stopping Times**](https://oeis.org/A006577) & [**2^68 Computational Verification Dataset**](https://pcbarina.fit.vutbr.cz/) — Exact stopping time sequences and distributed supercomputing verification records`,
};

export function getSampleFallbackReport(videoId?: string, title = 'Video Breakdown'): string | null {
  if (!videoId) return null;
  const renderer = SAMPLE_FALLBACK_REPORTS[videoId];
  return renderer ? renderer(title) : null;
}
