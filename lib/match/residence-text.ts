import { extractSchedule } from './text.ts';
import { parseResidenceLabel } from './constraints.ts';

/** Only explicitly year-qualified endpoints; no inferred semester calendar. */
export function residenceDateRange(text: string): { found: boolean; term?: string } {
  const month = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const date = `(?:20\\d{2}[-/]\\d{1,2}[-/]\\d{1,2}|20\\d{2}年\\d{1,2}月\\d{1,2}[日号號]|\\d{1,2}\\s+${month}\\s+20\\d{2}|${month}\\s+\\d{1,2},?\\s+20\\d{2})`;
  const ranges = [...text.matchAll(new RegExp(`(?<![\\d])(${date})\\s*(?:[–—-]|to|until|至|到)\\s*(${date})(?![\\d])`, 'gi'))];
  if (!ranges.length) return { found: false };
  const labels: string[] = [];
  for (const match of ranges) {
    const before=text.slice(Math.max(0,match.index! - 30),match.index);
    if (/(?:not|except|excluding|不是|不含|不包括)\s*$/.test(before)) return {found:true};
    const endpoints = [match[1], match[2]].map(body => extractSchedule({id:'residence-range',title:'',body,category:'hall',createdAt:'2000-01-01T00:00:00Z'}));
    if (endpoints.some(p=>p.ambiguous || !p.date)) return {found:true};
    const label=`dates:${endpoints[0].date}/${endpoints[1].date}`;
    if (!parseResidenceLabel(label)) return {found:true};
    labels.push(label);
  }
  return {found:true,term:new Set(labels).size===1 ? labels[0] : undefined};
}

/** Month precision is retained; never fabricate a check-in or check-out day. */
export function residenceMonthRange(text: string): {found:boolean;term?:string} {
  const names=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month=`(?:${names.join('|')})`;
  const endpoint=`(?:20\\d{2}年\\d{1,2}月|${month}\\s+20\\d{2})`;
  const found=[...text.matchAll(new RegExp(`(${endpoint})\\s*(?:through|to|until|至|到|[–—-])\\s*(${endpoint})(?![\\d])`,'gi'))];
  if(!found.length)return {found:false};
  const labels=[];
  for(const match of found){
    if(/(?:not|except|不是|不含|\d)\s*$/.test(text.slice(Math.max(0,match.index-20),match.index)))return {found:true};
    const ends=[match[1],match[2]].map(raw=>{
      const cn=/(20\d{2})年(\d{1,2})月/.exec(raw);
      if(cn)return `${cn[1]}-${cn[2].padStart(2,'0')}`;
      const [name,year]=raw.toLowerCase().split(/\s+/);
      return `${year}-${String(names.indexOf(name)+1).padStart(2,'0')}`;
    });
    const term=`months:${ends[0]}/${ends[1]}`;
    if(!parseResidenceLabel(term))return {found:true};
    labels.push(term);
  }
  return {found:true,term:new Set(labels).size===1?labels[0]:undefined};
}
