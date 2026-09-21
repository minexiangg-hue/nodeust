import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost} from '../../lib/match/engine.ts';
import {rankRelatedPosts} from '../../lib/match/related.ts';
const now=new Date('2026-09-21T04:00:00Z');
const p=(id,body,extra={})=>parseMatchPost({id,ownerId:id,title:'',body,category:'other',createdAt:now,status:'active',...extra});
test('related discovery is separate, deduplicated and excludes own/withdrawn/matched posts',()=>{
 const own=p('a','Looking for an astrolabe');
 const rows=rankRelatedPosts([own],[own,p('b','Astrolabe workshop'),p('c','Astrolabe workshop cancelled'),p('d','Astrolabe guide'),p('e','Astrolabe notes',{status:'removed'})],new Set(['d']),now);
 assert.deepEqual(rows.map(r=>r.post.id),['b']);assert.ok(!Object.hasOwn(rows[0],'confidence'));
});
test('known incompatible same-item roles cannot reappear as related leads',()=>{
 const a=p('a','Looking to buy a monitor, budget HKD 100.');
 const b=p('b','Looking to buy a monitor, budget HKD 100.');
 assert.equal(rankRelatedPosts([a],[b],new Set(),now).length,0);
});
