import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCombinedTechAndVideoWords,
  searchTechWordsHighGrade,
  TECH_WORDS_ENCYCLOPEDIA,
} from './techDictionaryService.ts';
import { ParsedSegment } from '../types.ts';

describe('techDictionaryService extraction & ranking', () => {
  it('returns ZERO default words when video text is empty', () => {
    const { videoMatchedWords } = getCombinedTechAndVideoWords('', '', []);
    assert.equal(videoMatchedWords.length, 0, 'Must have zero video matched words when empty');
  });

  it('does NOT include unmentioned encyclopedia words in videoMatchedWords', () => {
    // Text that only talks about cooking
    const summary = 'Today we will bake chocolate cookies with flour, butter, and sugar in the oven.';
    const segments: ParsedSegment[] = [
      { start: 0, duration: 10, text: 'Mix the flour and butter together.', formattedTime: '00:00' },
      { start: 10, duration: 10, text: 'Bake for 15 minutes at 350 degrees.', formattedTime: '00:10' },
    ];
    const { videoMatchedWords } = getCombinedTechAndVideoWords(summary, 'Baking Cookies', segments);

    // Neural Network, Transformer, Kubernetes, etc. should NEVER appear
    const hasNeuralNet = videoMatchedWords.some((w) => w.term.toLowerCase().includes('neural'));
    const hasTransformer = videoMatchedWords.some((w) => w.term.toLowerCase().includes('transformer'));
    const hasK8s = videoMatchedWords.some((w) => w.term.toLowerCase().includes('kubernetes'));

    assert.equal(hasNeuralNet, false, 'Neural Network should not be in cookie video');
    assert.equal(hasTransformer, false, 'Transformer should not be in cookie video');
    assert.equal(hasK8s, false, 'Kubernetes should not be in cookie video');
  });

  it('extracts AI & Machine Learning terms with exact timestamps when present', () => {
    const summary = 'We will train a neural network using backpropagation and gradient descent to minimize cross-entropy loss.';
    const segments: ParsedSegment[] = [
      { start: 12, duration: 13, text: 'First, each neuron computes a weighted sum and applies an activation function like ReLU.', formattedTime: '00:12' },
      { start: 30, duration: 15, text: 'Then backpropagation calculates the gradients for every weight and bias.', formattedTime: '00:30' },
      { start: 50, duration: 15, text: 'We use gradient descent with learning rate 0.001 to reduce the loss function.', formattedTime: '00:50' },
    ];

    const { videoMatchedWords } = getCombinedTechAndVideoWords(summary, 'Deep Learning 101', segments);

    const termNames = videoMatchedWords.map((w) => w.term);
    assert.ok(termNames.includes('Neural Network'), 'Extracted Neural Network');
    assert.ok(termNames.includes('Neuron'), 'Extracted Neuron');
    assert.ok(termNames.includes('Backpropagation'), 'Extracted Backpropagation');
    assert.ok(termNames.includes('Gradient Descent'), 'Extracted Gradient Descent');
    assert.ok(termNames.includes('Activation Function') || termNames.includes('ReLU'), 'Extracted Activation/ReLU');

    // Check exact timestamp linking
    const neuronEntry = videoMatchedWords.find((w) => w.term === 'Neuron');
    assert.ok(neuronEntry, 'Neuron entry exists');
    assert.equal(neuronEntry.timestampSeconds, 12, 'Timestamp is 12s');
    assert.equal(neuronEntry.formattedTime, '00:12', 'Formatted time is 00:12');
  });

  it('extracts Networking & Protocol terms accurately', () => {
    const summary = 'Exploring network performance, DNS lookups, TCP handshakes, and UDP streaming.';
    const segments: ParsedSegment[] = [
      { start: 5, duration: 10, text: 'When you open a website, DNS resolves the domain name into an IP address.', formattedTime: '00:05' },
      { start: 20, duration: 15, text: 'TCP performs a three-way handshake with SYN and ACK packets.', formattedTime: '00:20' },
      { start: 40, duration: 15, text: 'For real-time voice, UDP is used to minimize latency and avoid head-of-line blocking.', formattedTime: '00:40' },
    ];

    const { videoMatchedWords } = getCombinedTechAndVideoWords(summary, 'Computer Networking', segments);

    const termNames = videoMatchedWords.map((w) => w.term);
    assert.ok(termNames.includes('TCP'), 'Extracted TCP');
    assert.ok(termNames.includes('UDP'), 'Extracted UDP');
    assert.ok(termNames.includes('DNS'), 'Extracted DNS');
    assert.ok(termNames.includes('Three-Way Handshake'), 'Extracted Three-Way Handshake');

    const tcpEntry = videoMatchedWords.find((w) => w.term === 'TCP');
    assert.ok(tcpEntry, 'TCP entry exists');
    assert.equal(tcpEntry.domain, 'Networking & Protocols');
    assert.equal(tcpEntry.timestampSeconds, 20);
  });

  it('extracts System Design & CSE Core terms', () => {
    const summary = 'Designing scalable architectures with database sharding, caching, and mutex locks.';
    const segments: ParsedSegment[] = [
      { start: 8, duration: 12, text: 'We use database sharding and Redis caching to handle horizontal scaling.', formattedTime: '00:08' },
      { start: 25, duration: 15, text: 'Multi-threaded workers synchronize using a mutex to prevent race conditions and deadlock.', formattedTime: '00:25' },
      { start: 45, duration: 15, text: 'All transactions respect ACID properties with Write-Ahead Logging.', formattedTime: '00:45' },
    ];

    const { videoMatchedWords } = getCombinedTechAndVideoWords(summary, 'System Design Lecture', segments);

    const termNames = videoMatchedWords.map((w) => w.term);
    assert.ok(termNames.includes('Database Sharding'), 'Extracted Database Sharding');
    assert.ok(termNames.includes('Caching & Redis') || termNames.includes('Redis'), 'Extracted Redis/Caching');
    assert.ok(termNames.includes('Mutex & Semaphore'), 'Extracted Mutex & Semaphore');
    assert.ok(termNames.includes('Deadlock'), 'Extracted Deadlock');
    assert.ok(termNames.includes('ACID Properties'), 'Extracted ACID Properties');
  });

  it('searches and ranks words properly via searchTechWordsHighGrade', () => {
    const results = searchTechWordsHighGrade('transformer', TECH_WORDS_ENCYCLOPEDIA);
    assert.ok(results.length > 0, 'Found transformer');
    assert.equal(results[0].term, 'Transformer', 'Transformer is top ranked');

    const domainFiltered = searchTechWordsHighGrade('', TECH_WORDS_ENCYCLOPEDIA, 'AI & Machine Learning');
    assert.ok(domainFiltered.every((w) => w.domain === 'AI & Machine Learning'), 'All are AI & ML');
  });
});
