import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost} from '../../lib/match/engine.ts';
const wide=s=>s.replace(/[!-~]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0));
const posts=[
 {category:'study',body:'Seeking a COMP1022 study partner for loops. English, Zoom, 26 Sep 2026 from 14:00 to 15:00.'},
 {category:'transport',body:'One person seeking to share a four-passenger taxi from HKUST to airport on 26 Sep 2026 at 07:00.'},
 {category:'other',body:'Inviting classmates for photography walk at campus sundial on 26 Sep 2026, 17:00–18:00. Unlimited places, English.'},
];
test('fullwidth input preserves parsed facts while retaining original display content',()=>{
 for(const item of posts){
  const original={...item,id:'a',title:'Campus request',createdAt:'2026-09-11T04:00:00Z'};
  const full={...original,title:wide(original.title),body:wide(original.body)};
  const normal=parseMatchPost(original),parsed=parseMatchPost(full);
  assert.ok(normal.intents.length);assert.deepEqual(parsed.intents,normal.intents);
  assert.equal(parsed.post,full);assert.equal(parsed.post.body,full.body);
 }
});


test('horizontal spacing is normalized without removing separate-request boundaries',()=>{
 const original={...posts[0],id:'a',title:'Campus request',createdAt:'2026-09-11T04:00:00Z'};
 const expanded={...original,title:original.title.replaceAll(' ','   '),body:original.body.replaceAll(' ','   ')};
 assert.deepEqual(parseMatchPost(expanded).intents,parseMatchPost(original).intents);
 const separate={...original,body:'Cancelled the movie night.\n\nStill inviting two more students to Catan in English at UG Hall III common room on 26 Sep 2026, 19:00–20:30. I can admit guests from other halls.'};
 const crlf={...separate,body:separate.body.replaceAll('\n','\r\n')};
 assert.deepEqual(parseMatchPost(crlf).intents,parseMatchPost(separate).intents);
 assert.ok(parseMatchPost(crlf).intents.some(i=>i.entity==='board-game:catan'));
});
