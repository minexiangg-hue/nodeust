import type { MatchClaim, MatchRequirement } from './requirements.ts';

/** Narrow extractor into the general requirement representation. Public claims
 * establish what a seller says, not independently verified authenticity.
 */
export function goodsAuthenticity(
  text: string, side: 'offer' | 'seek', evidence: string[],
): { claims?: MatchClaim[]; requirements?: MatchRequirement[]; missing?: string[] } {
  const key = 'item-authenticity';
  const genuine = /\b(?:genuine|authentic)\b|正品|真品/.test(text);
  const replica = /\b(?:replica|counterfeit|fake)s?\b|仿品|假貨|假货|山寨/.test(text);
  const deniedGenuine = /\b(?:not|isn't|is not|cannot guarantee|can't guarantee)\s+(?:a\s+)?(?:genuine|authentic)\b|(?:不是|非|唔係|不保證|不保证)(?:正品|真品)/.test(text);
  const deniedReplica = /\b(?:no|not|without)\s+(?:a\s+)?(?:replica|counterfeit|fake)s?\b|(?:不要|不收|唔要|不是|非)(?:仿品|假貨|假货|山寨)/.test(text);
  const unsure = /\b(?:not sure|unsure|uncertain|unverified|cannot confirm|can't confirm|cannot guarantee|can't guarantee|might|maybe|possibly)\b|真偽.*(?:不明|不清|唔清|未知)|真伪.*(?:不明|不清|未知)|(?:不確定|不确定|唔肯定|可能|未驗證|未验证|不保證|不保证)/.test(text);
  if (side === 'seek') {
    const permissive = /\b(?:replicas? (?:are )?(?:ok|okay|welcome)|genuine or|authentic or|don't care|do not care)\b|真偽不限|真伪不限|真假都|不介意/.test(text);
    if (permissive) return {};
    if ((genuine && !deniedGenuine) || deniedReplica) {
      if (unsure || (replica && !deniedReplica)) return {missing: ['requirement:item-authenticity']};
      return {requirements: [{key, op: 'eq', value: true, evidence}]};
    }
    return {};
  }
  if (!genuine && !replica && !/真偽|真伪/.test(text)) return {};
  const positive = (genuine && !deniedGenuine) || deniedReplica;
  const negative = deniedGenuine || (replica && !deniedReplica);
  const value = unsure || positive === negative ? null : positive;
  return {claims: [{key, value, evidence}]};
}
