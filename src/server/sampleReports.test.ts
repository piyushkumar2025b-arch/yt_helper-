import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSampleFallbackReport, SAMPLE_FALLBACK_REPORTS } from './sampleReports.ts';

describe('sampleReports (BUG-010)', () => {
  it('has curated fallback reports for Steve Jobs, 3Blue1Brown, and Veritasium', () => {
    assert.ok(SAMPLE_FALLBACK_REPORTS['UF8uR6Z6KLc']);
    assert.ok(SAMPLE_FALLBACK_REPORTS['aircAruvnKk']);
    assert.ok(SAMPLE_FALLBACK_REPORTS['094y1Z2wpJg']);
  });

  it('renders report with specified video title', () => {
    const report = getSampleFallbackReport('UF8uR6Z6KLc', 'Steve Jobs Stanford Speech');
    assert.ok(report);
    assert.ok(report.includes('# Steve Jobs Stanford Speech'));
    assert.ok(report.includes('Stay Hungry. Stay Foolish.'));
  });

  it('returns null for uncurated video IDs', () => {
    assert.equal(getSampleFallbackReport('unknown-id-123'), null);
    assert.equal(getSampleFallbackReport(undefined), null);
  });
});
