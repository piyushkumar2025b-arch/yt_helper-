import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMediaSourceType,
  fetchVimeoMetadataAndTranscript,
  fetchTedTalkMetadataAndTranscript,
  fetchPodcastRssMetadataAndTranscript,
  fetchDirectMediaMetadataAndTranscript,
} from './mediaExtractor.ts';

describe('mediaExtractor multi-platform support', () => {
  describe('detectMediaSourceType', () => {
    it('detects YouTube URLs and bare IDs', () => {
      const yt1 = detectMediaSourceType('https://www.youtube.com/watch?v=UF8uR6Z6KLc');
      assert.equal(yt1.type, 'youtube');
      assert.equal(yt1.id, 'UF8uR6Z6KLc');

      const yt2 = detectMediaSourceType('https://youtu.be/UF8uR6Z6KLc');
      assert.equal(yt2.type, 'youtube');
      assert.equal(yt2.id, 'UF8uR6Z6KLc');

      const yt3 = detectMediaSourceType('UF8uR6Z6KLc');
      assert.equal(yt3.type, 'youtube');
      assert.equal(yt3.id, 'UF8uR6Z6KLc');
    });

    it('detects Vimeo URLs and IDs', () => {
      const vimeo = detectMediaSourceType('https://vimeo.com/76979871');
      assert.equal(vimeo.type, 'vimeo');
      assert.equal(vimeo.id, '76979871');
    });

    it('detects Dailymotion URLs and IDs', () => {
      const dm1 = detectMediaSourceType('https://www.dailymotion.com/video/x7tgad0');
      assert.equal(dm1.type, 'dailymotion');
      assert.equal(dm1.id, 'x7tgad0');

      const dm2 = detectMediaSourceType('https://dai.ly/x7tgad0');
      assert.equal(dm2.type, 'dailymotion');
      assert.equal(dm2.id, 'x7tgad0');
    });

    it('detects TED Talk URLs', () => {
      const ted = detectMediaSourceType('https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity');
      assert.equal(ted.type, 'ted');
      assert.equal(ted.id, 'sir_ken_robinson_do_schools_kill_creativity');
    });

    it('detects Loom URLs', () => {
      const loom = detectMediaSourceType('https://www.loom.com/share/abc123xyz');
      assert.equal(loom.type, 'loom');
      assert.equal(loom.id, 'abc123xyz');
    });

    it('detects Podcast RSS feeds', () => {
      const pod1 = detectMediaSourceType('https://feeds.megaphone.fm/hubermanlab');
      assert.equal(pod1.type, 'podcast_rss');

      const pod2 = detectMediaSourceType('https://example.com/show/podcast.xml');
      assert.equal(pod2.type, 'podcast_rss');
    });

    it('detects Direct Audio and Video URLs', () => {
      const audio = detectMediaSourceType('https://archive.org/download/audio/sample.mp3');
      assert.equal(audio.type, 'direct_audio');

      const video = detectMediaSourceType('https://example.com/media/clip.mp4');
      assert.equal(video.type, 'direct_video');
    });

    it('detects Web Articles and direct text', () => {
      const article = detectMediaSourceType('https://techcrunch.com/2026/01/ai-news');
      assert.equal(article.type, 'web_article');

      const text = detectMediaSourceType('Just some copied text with no protocol');
      assert.equal(text.type, 'direct_text');
    });
  });

  describe('Showcase Fallback Media Extraction', () => {
    it('extracts Vimeo showcase: The Maker (76979871)', async () => {
      const res = await fetchVimeoMetadataAndTranscript('https://vimeo.com/76979871', '76979871');
      assert.equal(res.metadata.sourceType, 'vimeo');
      assert.equal(res.metadata.videoId, '76979871');
      assert.ok(res.segments.length > 5);
      assert.ok(res.fullText.includes('velvet'));
      assert.ok(res.metadata.embedUrl?.includes('player.vimeo.com'));
    });

    it('extracts TED Talk showcase: Sir Ken Robinson', async () => {
      const res = await fetchTedTalkMetadataAndTranscript(
        'https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity',
        'sir_ken_robinson_do_schools_kill_creativity'
      );
      assert.equal(res.metadata.sourceType, 'ted');
      assert.ok(res.segments.length > 5);
      assert.ok(res.fullText.includes('creativity'));
      assert.ok(res.metadata.embedUrl?.includes('embed.ted.com'));
    });

    it('extracts Podcast RSS showcase: Huberman Lab', async () => {
      const res = await fetchPodcastRssMetadataAndTranscript('https://feeds.megaphone.fm/hubermanlab');
      assert.equal(res.metadata.sourceType, 'podcast_rss');
      assert.ok(res.segments.length > 5);
      assert.ok(res.metadata.mediaUrl?.endsWith('.mp3'));
      assert.ok(res.fullText.includes('Focus'));
    });

    it('extracts Direct Audio showcase: Apollo 11 Lunar Landing', async () => {
      const res = await fetchDirectMediaMetadataAndTranscript(
        'https://archive.org/download/Apollo11Audio/11_04_06_45_EagleLanded.mp3',
        'Apollo 11: "The Eagle Has Landed"'
      );
      assert.equal(res.metadata.sourceType, 'direct_audio');
      assert.ok(res.segments.length > 5);
      assert.ok(res.fullText.includes('Eagle has landed'));
    });
  });
});
