/** Facts describe this intent; requirements constrain the counterpart intent.
 * Keys are inert data, never expressions or object paths. Extractors own their
 * vocabulary/normalization. Unknown vocabulary is preserved, not discarded.
 */
export type RequirementValue = string | number | boolean;
export type MatchClaim = {
  key: string;
  value: RequirementValue | null;
  unit?: string;
  evidence: string[];
};
export type MatchRequirement = {
  key: string;
  op: 'eq' | 'neq' | 'in' | 'gte' | 'lte';
  value: RequirementValue | RequirementValue[];
  unit?: string;
  evidence: string[];
};
export type RequirementResult = {
  key: string;
  status: 'compatible' | 'conflict' | 'unknown';
};
const scalar = (value: unknown): value is RequirementValue =>
  typeof value === 'boolean' ||
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value));
const supported = (evidence: string[]) =>
  Array.isArray(evidence) && evidence.length > 0 &&
  evidence.every(value => typeof value === 'string' && value.trim().length > 0);

/** No missing-value defaults, numeric/string coercion, or implicit unit conversion.
 * Literal evidence presence is a structural check, not proof of correct extraction.
 * Contradictory claims remain unknown instead of choosing a convenient assertion.
 */
export function compareRequirements(
  requirements: readonly MatchRequirement[] = [],
  claims: readonly MatchClaim[] = [],
): RequirementResult[] {
  return requirements.map(requirement => {
    const unknown: RequirementResult = {key: requirement.key, status: 'unknown'};
    if (!requirement.key?.trim() || !supported(requirement.evidence)) return unknown;
    const matching = claims.filter(claim => claim.key === requirement.key);
    if (!matching.length || matching.some(claim =>
      !supported(claim.evidence) || !scalar(claim.value) || claim.unit !== requirement.unit,
    )) return unknown;
    const actual = matching[0].value;
    if (!scalar(actual) || matching.some(claim => claim.value !== actual)) return unknown;
    const expected = requirement.value;
    let fits: boolean;
    if (requirement.op === 'in') {
      if (!Array.isArray(expected) || !expected.length ||
          expected.some(value => !scalar(value) || typeof value !== typeof actual)) return unknown;
      fits = expected.includes(actual);
    } else {
      if (!scalar(expected) || typeof expected !== typeof actual) return unknown;
      if (requirement.op === 'eq') fits = actual === expected;
      else if (requirement.op === 'neq') fits = actual !== expected;
      else if (requirement.op === 'gte' || requirement.op === 'lte') {
        if (typeof actual !== 'number' || typeof expected !== 'number') return unknown;
        fits = requirement.op === 'gte' ? actual >= expected : actual <= expected;
      } else return unknown;
    }
    return {key: requirement.key, status: fits ? 'compatible' : 'conflict'};
  });
}
