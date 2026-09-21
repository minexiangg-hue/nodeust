import type { ParsedPost } from './types.ts';
import { TextCandidateIndex } from './retrieval.ts';
import { comparePosts, isExpired } from './engine.ts';
import { isCancelled } from './text.ts';
export type RelatedPost = { post: ParsedPost['post']; ownPostId: string; score: number };
/** Discovery only: never emits a match confidence or compatibility claim. */
export function rankRelatedPosts(own: readonly ParsedPost[], candidates: readonly ParsedPost[], matchedIds: ReadonlySet<string>, now: Date, limit=10): RelatedPost[] {
  const live=(p:ParsedPost)=>(!p.post.status||p.post.status==='active')&&!isCancelled(`${p.post.title}\n${p.post.body}`)&&(!p.intents.length||p.intents.some(i=>!isExpired(i,now)));
  const pool=candidates.filter(p=>live(p)&&!matchedIds.has(p.post.id));
  const byId=new Map(pool.map(p=>[p.post.id,p]));
  const index=new TextCandidateIndex(pool.map(p=>p.post)),best=new Map<string,RelatedPost>();
  for(const source of own.filter(live))for(const hit of index.search(source.post,{limit:100})){
    const candidate=byId.get(hit.id)!;
    // A known same-subject pair rejected by the matcher must not reappear as a lead.
    const comparable=source.intents.some(a=>candidate.intents.some(b=>a.kind===b.kind&&(a.entity===b.entity||a.kind==='hall'||a.kind==='transport')));
    if(comparable&&!comparePosts(source,candidate,now))continue;
    if(!best.has(hit.id)||best.get(hit.id)!.score<hit.score)best.set(hit.id,{post:candidate.post,ownPostId:source.post.id,score:hit.score});
  }
  return [...best.values()].sort((a,b)=>b.score-a.score||a.post.id.localeCompare(b.post.id)).slice(0,limit);
}
