import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVideoId,
  formatTime,
  parseVttOrSrt,
  unescapeHtml,
} from './subtitleParser.ts';

describe('subtitleParser utilities', () => {
  describe('extractVideoId', () => {
    it('extracts ID from standard watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      assert.equal(extractVideoId(url), 'dQw4w9WgXcQ');
    });

    it('extracts ID from short youtu.be URL', () => {
      const url = 'https://youtu.be/UF8uR6Z6KLc?si=abc123xyz';
      assert.equal(extractVideoId(url), 'UF8uR6Z6KLc');
    });

    it('extracts ID from shorts URL', () => {
      const url = 'https://www.youtube.com/shorts/aircAruvnKk';
      assert.equal(extractVideoId(url), 'aircAruvnKk');
    });

    it('extracts ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/094y1Z2wpJg';
      assert.equal(extractVideoId(url), '094y1Z2wpJg');
    });

    it('accepts bare 11-character YouTube IDs', () => {
      assert.equal(extractVideoId('UF8uR6Z6KLc'), 'UF8uR6Z6KLc');
      assert.equal(extractVideoId('aircAruvnKk'), 'aircAruvnKk');
      assert.equal(extractVideoId('094y1Z2wpJg'), '094y1Z2wpJg');
    });

    it('rejects invalid or non-YouTube strings', () => {
      assert.equal(extractVideoId('not-a-video-id'), null);
      assert.equal(extractVideoId('https://google.com'), null);
      assert.equal(extractVideoId(''), null);
    });
  });

  describe('formatTime', () => {
    it('formats 0 seconds as 00:00', () => {
      assert.equal(formatTime(0), '00:00');
    });

    it('formats minutes and seconds correctly', () => {
      assert.equal(formatTime(65), '01:05');
      assert.equal(formatTime(599), '09:59');
    });

    it('formats hours correctly when >= 3600 seconds', () => {
      assert.equal(formatTime(3600), '01:00:00');
      assert.equal(formatTime(3665), '01:01:05');
      assert.equal(formatTime(7325), '02:02:05');
    });
  });

  describe('parseVttOrSrt', () => {
    it('parses WebVTT content into segments with timestamps', () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.500
Hello world, welcome to the video.

00:00:05.000 --> 00:00:08.200
In this video we talk about neural networks.`;

      const segments = parseVttOrSrt(vtt);
      assert.equal(segments.length, 2);
      assert.equal(segments[0].start, 1);
      assert.equal(segments[0].formattedTime, '00:01');
      assert.ok(segments[0].text.includes('Hello world'));
      assert.equal(segments[1].start, 5);
      assert.equal(segments[1].formattedTime, '00:05');
      assert.ok(segments[1].text.includes('neural networks'));
    });

    it('parses SubRip SRT content into segments', () => {
      const srt = `1
00:00:02,100 --> 00:00:05,300
First line of the presentation.

2
00:01:10,000 --> 00:01:14,000
Second point discussed later on.`;

      const segments = parseVttOrSrt(srt);
      assert.equal(segments.length, 2);
      assert.equal(segments[0].start, 2.1);
      assert.equal(segments[0].formattedTime, '00:02');
      assert.ok(segments[0].text.includes('First line'));
      assert.equal(segments[1].start, 70);
      assert.equal(segments[1].formattedTime, '01:10');
      assert.ok(segments[1].text.includes('Second point'));
    });
  });

  describe('unescapeHtml', () => {
    it('decodes common HTML entities', () => {
      assert.equal(unescapeHtml('&quot;Hello&quot; &amp; &#39;World&#39;'), '"Hello" & \'World\'');
      assert.equal(unescapeHtml('&lt;tag&gt;'), '<tag>');
    });
  });
});

