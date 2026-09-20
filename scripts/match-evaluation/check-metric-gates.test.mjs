import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMetricGates } from './check-metric-gates.mjs';
const passing = () => ({
  corpus: { byKind: Object.fromEntries(['hall','goods','study','transport','other'].map(k => [k, {top5Precision:.9, recall:.6, hitRate:.7}])) },
  development: { byKind: Object.fromEntries(['hall','goods','study','transport','other'].map(k => [k, {precision:.9, recall:.75}])), falsePositiveRate:.05 },
});
test('fixed metric boundaries pass; each category and missing/non-finite values fail closed', () => {
  assert.equal(checkMetricGates(passing()).metricsPass, true);
  for (const value of [.599, undefined, NaN, Infinity, 1.01]) {
    const data = passing(); data.corpus.byKind.goods.recall = value;
    assert.equal(checkMetricGates(data).metricsPass, false);
  }
  const data = passing(); delete data.development.byKind.other;
  assert.equal(checkMetricGates(data).metricsPass, false);
  assert.equal(checkMetricGates({}).metricsPass, false);
});
test('overall negative-case gate is enforced independently of positive recall', () => {
  const data = passing(); data.development.falsePositiveRate = .051;
  assert.equal(checkMetricGates(data).metricsPass, false);
});
