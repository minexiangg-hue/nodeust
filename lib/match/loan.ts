import type { MatchPost } from './types.ts';
import { extractSchedule } from './text.ts';

/** Two independently stated handover times; never treat a return as a second pickup. */
export function loanPeriod(text: string, post: MatchPost): { loanStart?: string; loanEnd?: string; loanPickupPlace?: string; loanReturnPlace?: string } {
  const parts = text.split(/\b(?:return(?:ing)?(?: it)?(?: there)?|until)\b|至|[;；，,]\s*(?=[^;；，,]*\d[^;；，,]*(?:归还|歸還|還|还))/i);
  if (parts.length !== 2) return {};
  const place = (value: string): string | undefined => {
    const names = [
      ['hkust-library', /\blibrary(?: entrance)?\b|图书馆|圖書館/],
      ['hkust-north-bus-stop', /\bnorth bus stop\b|北巴士站/],
      ['hkust-north-gate', /\bnorth gate\b|北门|北門/],
      ['hkust-south-gate', /\bsouth gate\b|南门|南門/],
      ['hang-hau', /\bhang hau\b|坑口/],
    ] as const;
    const found = names.filter(([,pattern]) => pattern.test(value));
    return found.length === 1 ? found[0][0] : undefined;
  };
  const bothHandovers = /\bboth handovers\b|取[还還]|取[归歸][还還]/.test(text);
  const sharedPlace = bothHandovers ? place(text) : undefined;
  const loanPickupPlace = place(parts[0]) ?? sharedPlace;
  const explicitReturn = place(parts[1]);
  const samePlace = /\breturn(?:ing)?(?: it)? there\b|\b(?:same place|same location|both handovers)\b|原地(?:归还|歸還|還|还)|原地還|原地还|同一地点|同一地點/.test(text);
  // Only a stated reference back to pickup can supply the return location.
  const loanReturnPlace = explicitReturn ?? sharedPlace ?? (samePlace ? loanPickupPlace : undefined);
  const stamps = parts.map(body => {
    const schedule = extractSchedule({ ...post, title: '', body });
    if (schedule.ambiguous || !schedule.date || schedule.minute === undefined || schedule.endMinute !== undefined) return undefined;
    const hours = String(Math.floor(schedule.minute / 60)).padStart(2, '0');
    const minutes = String(schedule.minute % 60).padStart(2, '0');
    return `${schedule.date}T${hours}:${minutes}:00+08:00`;
  });
  if (!stamps[0] || !stamps[1] || Date.parse(stamps[0]) >= Date.parse(stamps[1])) return {};
  return { loanStart: stamps[0], loanEnd: stamps[1], loanPickupPlace, loanReturnPlace };
}

/** Exact declared handovers only; availability ranges need a separate representation. */
export function compareLoanPeriods(a: {loanStart?: string;loanEnd?: string}, b: {loanStart?: string;loanEnd?: string}): 'compatible' | 'conflict' | 'unknown' {
  const valid = (p: typeof a) => {
    const values=[p.loanStart,p.loanEnd];
    if(values.some(v=>!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(v))) return false;
    const [start,end]=values.map(v=>Date.parse(v!));
    return Number.isFinite(start)&&Number.isFinite(end)&&start<end
      && values.every(v=>new Date(Date.parse(v!) + 8 * 3600000).toISOString().slice(0,19) === v!.slice(0,19));
  };
  if(!valid(a)||!valid(b)) return 'unknown';
  return a.loanStart===b.loanStart&&a.loanEnd===b.loanEnd?'compatible':'conflict';
}
