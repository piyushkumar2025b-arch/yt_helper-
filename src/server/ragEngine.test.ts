import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeText,
  extractNGrams,
  buildTranscriptChunks,
  createTranscriptIndex,
  retrieveRelevantChunks,
  formatRetrievedContextForPrompt,
  buildGroundedExtractiveAnswer,
  buildGroundedDeepDive,
} from './ragEngine.ts';

describe('RAG Subsystem (ragEngine)', () => {
  const sampleSegments = [
    { start: 0, duration: 15, formattedTime: '00:00', text: 'Welcome to this Stanford commencement speech where I share three stories.' },
    { start: 15, duration: 30, formattedTime: '00:15', text: 'The first story is about connecting the dots in life.' },
    { start: 45, duration: 45, formattedTime: '00:45', text: 'I dropped out of Reed College after six months, but stayed as a drop-in.' },
    { start: 90, duration: 60, formattedTime: '01:30', text: 'I decided to take a calligraphy class to learn about serif and sans serif typefaces.' },
    { start: 150, duration: 40, formattedTime: '02:30', text: 'Ten years later, we designed the first Macintosh computer with beautiful typography.' },
    { start: 190, duration: 50, formattedTime: '03:10', text: 'My second story is about love and loss. I got fired from Apple at age thirty.' },
    { start: 240, duration: 40, formattedTime: '04:00', text: 'Getting fired from Apple was the best thing that could have happened to me. I started NeXT and Pixar.' },
    { start: 280, duration: 50, formattedTime: '04:40', text: 'My third story is about death. If you live each day as if it was your last, you will be right.' },
  ];

  it('tokenizes text and filters out common stop words', () => {
    const tokens = tokenizeText('Why did he take a calligraphy class at Reed College?');
    assert.ok(tokens.includes('calligraphy'));
    assert.ok(tokens.includes('class'));
    assert.ok(tokens.includes('reed'));
    assert.ok(tokens.includes('college'));
    assert.equal(tokens.includes('why'), false);
    assert.equal(tokens.includes('did'), false);
    assert.equal(tokens.includes('at'), false);
  });

  it('extracts bigrams and trigrams for exact phrase matching', () => {
    const tokens = ['reed', 'college', 'calligraphy', 'class'];
    const bigrams = extractNGrams(tokens, 2);
    assert.deepEqual(bigrams, ['reed college', 'college calligraphy', 'calligraphy class']);
  });

  it('builds transcript chunks with timestamps and segment references', () => {
    const { chunks, allSegments } = buildTranscriptChunks('', sampleSegments, 40, 10);
    assert.ok(chunks.length > 0);
    assert.equal(allSegments.length, sampleSegments.length);

    for (const chunk of chunks) {
      assert.ok(typeof chunk.startSec === 'number');
      assert.ok(typeof chunk.endSec === 'number');
      assert.ok(chunk.formattedStart);
      assert.ok(chunk.formattedEnd);
      assert.ok(chunk.text.length > 0);
    }
  });

  it('creates inverted index with IDF scores', () => {
    const index = createTranscriptIndex('', sampleSegments);
    assert.ok(index.totalChunks > 0);
    assert.ok(index.invertedIndex.has('calligraphy'));
    assert.ok(index.idf.has('calligraphy'));
  });

  it('retrieves relevant chunks with high precision and expanded context windows', () => {
    const index = createTranscriptIndex('', sampleSegments);
    const retrieved = retrieveRelevantChunks(index, 'What calligraphy class did he take?', 2, 1);

    assert.ok(retrieved.length > 0);
    const top = retrieved[0];
    assert.ok(top.chunk.text.toLowerCase().includes('calligraphy'));
    // Context window expansion includes adjacent context
    assert.ok(top.expandedText.length >= top.chunk.text.length);
    assert.ok(top.formattedRange.includes('-'));
  });

  it('formats retrieved context cleanly for prompt injection', () => {
    const index = createTranscriptIndex('', sampleSegments);
    const retrieved = retrieveRelevantChunks(index, 'Pixar and NeXT', 2, 1);
    const contextPrompt = formatRetrievedContextForPrompt(retrieved);

    assert.ok(contextPrompt.includes('=== RETRIEVED GROUNDED VIDEO PASSAGES'));
    assert.ok(contextPrompt.includes('Passage 1'));
    assert.ok(contextPrompt.includes('Pixar') || contextPrompt.includes('Apple'));
  });

  it('builds grounded extractive answer when external APIs are unavailable', () => {
    const index = createTranscriptIndex('', sampleSegments);
    const retrieved = retrieveRelevantChunks(index, 'Getting fired from Apple', 2, 1);
    const answer = buildGroundedExtractiveAnswer('Getting fired from Apple', 'Steve Jobs Stanford Speech', retrieved);

    assert.ok(answer.includes('Steve Jobs Stanford Speech'));
    assert.ok(answer.includes('Apple'));
    assert.ok(/\[\d{2}:\d{2}\]/.test(answer));
  });

  it('builds grounded deep dive topic breakdown', () => {
    const index = createTranscriptIndex('', sampleSegments);
    const retrieved = retrieveRelevantChunks(index, 'typography Macintosh', 2, 1);
    const deepDive = buildGroundedDeepDive('Typography and Fonts', 'Steve Jobs Stanford Speech', retrieved);

    assert.ok(deepDive.includes('Typography and Fonts'));
    assert.ok(deepDive.includes('Key Context'));
    assert.ok(/\[\d{2}:\d{2}\]/.test(deepDive));
  });
});
