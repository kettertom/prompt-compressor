import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeFiller, compress } from '../index.js';

test('keeps the instruction after a lead-in phrase', () => {
  assert.equal(removeFiller('Please note that you must never share PII.'), 'You must never share PII.');
  assert.equal(removeFiller('Be brief. It is important to note that answers must cite sources.'), 'Be brief. Answers must cite sources.');
  assert.equal(removeFiller('Note: always reply in JSON.'), 'Always reply in JSON.');
  assert.equal(removeFiller('It goes without saying that safety comes first.'), 'Safety comes first.');
});

test('keeps examples and clarifications', () => {
  const t = 'Use ISO dates, e.g. 2026-01-31. For example, write "Jan 31" as 2026-01-31.';
  assert.equal(removeFiller(t), t);
});

test('mid-sentence lead-in is removed without capitalizing', () => {
  assert.equal(removeFiller('Answer, and please note that tone matters.'), 'Answer, and tone matters.');
});

test('does not touch words that merely contain "note:"', () => {
  assert.equal(removeFiller('See footnote: 3.'), 'See footnote: 3.');
});

test('preserves paragraphs and lists', () => {
  const t = 'Rules:\n\n- Be kind\n- Be brief\n\nKindly answer in English.';
  assert.equal(removeFiller(t), 'Rules:\n\n- Be kind\n- Be brief\n\nAnswer in English.');
});

test('compress never wipes a prompt made of instructions', () => {
  const t = 'Please note that you should always respond to {{name}}. It is important to note that you think step by step.';
  for (const level of ['none', 'very-low', 'low']) {
    const { output } = compress(t, level);
    assert.match(output, /respond to \{\{name\}\}/, level);
    assert.match(output, /step by step/, level);
  }
});
