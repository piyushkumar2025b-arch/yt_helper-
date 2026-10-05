import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractChaptersFromDescription } from './transcriptHelper.ts';
import { fetchSubtitlesViaYtDlp } from './ytDlpService.ts';

describe('YouTube Transcript Pipeline Enhancements', () => {
  describe('extractChaptersFromDescription', () => {
    it('extracts structured chapters from video descriptions', () => {
      const description = `
Here is a breakdown of the lecture:
00:00 Introduction & Welcome
02:15 Connecting the Dots
08:30 Love and Loss
12:45 Confronting Death
14:30 Stay Hungry, Stay Foolish
      `;

      const segments = extractChaptersFromDescription(description);
      assert.ok(segments, 'Should parse segments from description');
      assert.equal(segments.length, 5);
      assert.equal(segments[0].formattedTime, '00:00');
      assert.equal(segments[0].text, 'Introduction & Welcome');
      assert.equal(segments[1].start, 135); // 02:15 = 135s
      assert.equal(segments[1].text, 'Connecting the Dots');
      assert.equal(segments[0].duration, 135); // duration until next segment
    });

    it('returns null if fewer than 3 chapters are present', () => {
      const description = 'Check out our sponsor at 01:30 for a discount';
      const segments = extractChaptersFromDescription(description);
      assert.equal(segments, null);
    });

    it('handles bracketed and parenthesized timestamps', () => {
      const description = `
[00:00] Opening Remarks
[03:45] - Technical Deep Dive
(10:20) Summary & Q&A
      `;

      const segments = extractChaptersFromDescription(description);
      assert.ok(segments);
      assert.equal(segments.length, 3);
      assert.equal(segments[1].formattedTime, '03:45');
      assert.equal(segments[1].text, 'Technical Deep Dive');
      assert.equal(segments[2].formattedTime, '10:20');
      assert.equal(segments[2].text, 'Summary & Q&A');
    });
  });

  describe('fetchSubtitlesViaYtDlp', () => {
    it('gracefully returns null for invalid video IDs', async () => {
      const res = await fetchSubtitlesViaYtDlp('invalid_id');
      assert.equal(res, null);
    });
  });
});
