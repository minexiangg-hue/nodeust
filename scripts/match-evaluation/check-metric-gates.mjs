// Fixed numeric gates from reports/match-iteration-2026-09-11/plan.md.
// A passing metric check is NOT release approval or proof of independent validation.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function checkMetricGates(result) {
  const checks = [];
  const add = (name, actual, minimum, maximum = Infinity) => checks.push({
    name, actual: actual ?? null, minimum, maximum: Number.isFinite(maximum) ? maximum : null,
    pass: Number.isFinite(actual) && actual >= minimum && actual <= maximum,
  });
  for (const kind of ['hall', 'goods', 'study', 'transport', 'other']) {
    const corpus = result?.corpus?.byKind?.[kind];
    const pairs = result?.development?.byKind?.[kind];
    add(`corpus.${kind}.top5Precision`, corpus?.top5Precision, .9, 1);
    add(`corpus.${kind}.recall`, corpus?.recall, .6, 1);
    add(`corpus.${kind}.hitRate`, corpus?.hitRate, .7, 1);
    add(`pairs.${kind}.precision`, pairs?.precision, .9, 1);
    add(`pairs.${kind}.recall`, pairs?.recall, .75, 1);
  }
  add('pairs.falsePositiveRate', result?.development?.falsePositiveRate, 0, .05);
  return { metricsPass: checks.every(check => check.pass),
    scope: 'Numeric metrics only; exposed development pairs do not satisfy independent validation.',
    checks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkMetricGates(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.metricsPass ? 0 : 1;
}
