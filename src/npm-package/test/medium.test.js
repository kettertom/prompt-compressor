import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compress, fuzzyDeduplicate, levenshteinDeduplicate, ngramDeduplicate, textRankCompress, tfidfCompress, extractiveCompress } from '../index.js';

const PROSE = [
  'The weather was pleasant and the team enjoyed a relaxed afternoon together.',
  'Everyone agreed that the coffee in the new office tastes considerably better.',
  'Several people mentioned that the plants make the space feel much more welcoming.',
  'The quarterly offsite is scheduled for March 3 in Tel Aviv.',
  'Attendance is required for all team leads.',
  'Lunch conversations covered movies, travel plans and weekend hobbies.',
  'A few colleagues talked about learning to play the guitar this winter.',
].join(' ');

test('dedup steps never delete short lines and keep line breaks', () => {
  const t = 'Rules:\n- Be kind\n- Be brief\n\nOK.\nDone.';
  for (const fn of [fuzzyDeduplicate, ngramDeduplicate, levenshteinDeduplicate]) assert.equal(fn(t), t, fn.name);
});

test('near-duplicates that differ in numbers/IDs are kept', () => {
  const t = 'Retrying payment for order ORD-1 (attempt 2/3) now.\nRetrying payment for order ORD-1 (attempt 3/3) now.';
  assert.equal(fuzzyDeduplicate(t), t);
  assert.equal(levenshteinDeduplicate(t), t);
});

test('real near-duplicates are removed', () => {
  const t = 'Always answer in a friendly and professional tone please.\nAlways answer in a friendly and professional tone, please!';
  assert.equal(levenshteinDeduplicate(t).split('\n').length, 1);
});

test('summarizers never touch fenced code / JSON', () => {
  const t = PROSE + '\n\n```json\n{"a": 1, "b": 2}\n{"a": 1, "b": 2}\n```';
  for (const fn of [textRankCompress, tfidfCompress, extractiveCompress]) assert.match(fn(t), /```json\n\{"a": 1, "b": 2\}\n\{"a": 1, "b": 2\}\n```/, fn.name);
});

test('summarizers keep critical sentences and drop only soft prose', () => {
  for (const fn of [textRankCompress, tfidfCompress, extractiveCompress]) {
    const out = fn(PROSE);
    assert.match(out, /March 3/, fn.name);
    assert.match(out, /required for all team leads/, fn.name);
    assert.ok(out.length < PROSE.length, fn.name + ' should drop something');
  }
});

test("medium keeps structure, rules, IDs and variables", () => {
  const t = 'You are a bot for {{company}}.\nPlease note that you must never share data.\n\n- Refunds within 30 days\n- Code SORRY20\n\n```json\n{"id": "ORD-1", "total": 89}\n```';
  const { output } = compress(t, 'medium');
  for (const must of ['{{company}}', 'never share data', '30 days', 'SORRY20', '"id":"ORD-1"', '"total":89']) assert.ok(output.includes(must), must);
  assert.match(output, /\n- Refunds within 30 days\n- Code SORRY20\n/);
});

test('questions, requests and word-based deadlines are never summarized away', () => {
  const t = [
    'The team discussed many things during the long meeting yesterday afternoon.',
    'Several ideas came up about the office layout and the kitchen schedule.',
    'People also chatted about the upcoming holidays and travel plans in general.',
    'What is the most likely root cause of the outage?',
    'Could you send the summary to the whole group when you get a chance.',
    'Please share your opinion on the billing page by the end of the week.',
    'Everyone seemed generally happy with how the discussion went overall.',
  ].join(' ');
  for (const fn of [textRankCompress, tfidfCompress, extractiveCompress]) {
    const out = fn(t, 0.3);
    for (const must of ['root cause', 'Could you send', 'end of the week']) assert.ok(out.includes(must), `${fn.name}: ${must}`);
  }
});

test('low keeps JSON valid and identical (minus null/empty fields), and code with repeated lines intact', () => {
  const data = { orders: [
    { id: 'A', status: 'processing', qty: 1, currency: 'USD', note: null },
    { id: 'B', status: 'processing', qty: 1, currency: 'USD', note: '' },
  ] };
  const t = 'Summarize:\n\n```json\n' + JSON.stringify(data, null, 2) + '\n```\n\n```js\nif (a) {\n  return 1;\n}\nif (b) {\n  return 1;\n}\n```';
  for (const level of ['very-low', 'low', 'medium']) {
    const out = compress(t, level).output;
    const json = out.match(/```json\s*([\s\S]*?)```/)[1];
    const strip = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x === null || x === '' ? undefined : x)));
    assert.deepEqual(strip(JSON.parse(json)), strip(data), level);
    assert.equal((out.match(/return 1;/g) || []).length, 2, level);
  }
});

test('unfenced JSON-like lines are never deduplicated', () => {
  const t = '{\n  "qty": 1,\n  "currency": "USD"\n},\n{\n  "qty": 1,\n  "currency": "USD"\n}';
  assert.equal(compress(t, 'low').output.match(/"qty": 1/g).length, 2);
});
