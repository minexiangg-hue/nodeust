import { SUPPORTED_MONEY_CURRENCIES } from './constraints.ts';
import type { Money } from './constraints.ts';
import { normalizeText } from './text.ts';

/** Tutoring charges only: being free at 4pm is availability, not a zero price. */
export function studyFee(source: string, side: string): { fee?: Money; missing: string[] } {
  const normalized=normalizeText(source);
  // In a peer-study request, a standalone rejection of paid tutoring is not a fee quote.
  // Keep every other clause, including any actual charge or contradictory amount.
  const text=side === 'peer'
    ? normalized.replace(/(^|[.!。;；]\s*)no paid (?:tutoring|tuition)(?=\s*(?:[.!。;；]|$))/g, '$1')
    : normalized;
  const free=/\b(?:for free|free (?:help|tutoring|tuition|coaching|lesson)|no charge|no fee)\b|免費(?:教|幫|指導|辅导|輔導)|免费(?:教|帮|指导|辅导)|不收費|不收费|不是收費補習|不是收费补习/.test(text);
  const notFree=/\b(?:not free|not for free)\b|不免费|不免費|不是免费|不是免費/.test(text);
  const amounts=[...text.matchAll(/\b(hkd|usd|cny)\s*\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?!\d|\.\d|,\d)|\b(hk|us)\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?!\d|\.\d|,\d)/g)]
    .map(m=>({currency:m[1]?.toUpperCase() ?? (m[3]==='hk'?'HKD':'USD'),amount:Number((m[2]||m[4]).replaceAll(',',''))}));
  const scope=side==='offer'?'asking' as const:'maximum' as const;
  const moneyMention = new RegExp(`\\b(?:${SUPPORTED_MONEY_CURRENCIES.join('|')})\\s*\\$?\\s*\\d`, 'i').test(text) || /[$€£¥]\s*\d/.test(text);
  const unresolved = /(?:hkd|usd|cny|hk\$|us\$)\s*[\d,.]+\s*[-–—~至到]\s*(?:(?:hkd|usd|cny|hk\$|us\$)\s*)?\d/.test(text)
    || /\b(?:not|except|excluding)\s+(?:hkd|usd|cny|hk\$|us\$)|不是\s*(?:hkd|hk\$)/.test(text)
    || /\b(?:plus|extra|additional|deposit|travel expenses|minimum purchase)\b|另加|额外|額外|押金|最低消费|最低消費/.test(text)
    || (side === 'offer' && /\b(?:at least|from|starting at|minimum|no less than)\s*(?:hkd|usd|cny|hk\$|us\$)|至少|起价|起價/.test(text));
  if (unresolved) return {missing:['study-fee']};
  if(free&&!notFree&&!moneyMention&&!amounts.length)return {fee:{amount:0,scope},missing:[]};
  if(amounts.length===1 && !(free&&!notFree)) {
    const hourly=/\bper hour\b|\/\s*h(?:ou)?r?\b|每小[时時]/.test(text);
    const session=/\bper (?:session|lesson)\b|每(?:堂|节|節)|整堂|整节|整節/.test(text) || (/\btotal\b|總費用|总费用/.test(text) && /\bone[ -]hour|\bone (?:session|lesson)\b|一堂|一节|一節/.test(text));
    return {fee:{...amounts[0],basis:hourly!==session?(hourly?'hour':'session'):undefined,scope},missing:hourly&&session?['study-fee']:[]};
  }
  const financial=moneyMention||amounts.length>0||notFree||/\b(?:paid|payment|fee|budget|charge|cost)\b|收[费費]|[预預]算/.test(text);
  return {missing:financial?['study-fee']:[]};
}
