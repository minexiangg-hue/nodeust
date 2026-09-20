// Local reproducibility bundle. Only explicit public-source directories are copied.
import {mkdirSync,readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const output=resolve(process.argv[2]||`work/match-snapshots/${new Date().toISOString().replaceAll(':','-')}`);
const inputs=['lib/match','scripts/match-evaluation','scripts/match-study'];
const files=[];
function collect(path){
 for(const item of readdirSync(path,{withFileTypes:true})){
  const child=join(path,item.name);
  if(item.isDirectory())collect(child);
  else if(item.isFile()&&/\.(?:ts|mjs|json|md)$/.test(item.name))files.push(child);
 }
}
for(const path of inputs)collect(path);
files.push('lib/match-copy.ts','package.json','package-lock.json',
  'app/api/matches/route.ts',
  'components/community/request-cards.tsx','scripts/email-auth/integration.mjs');
const corpus='reports/match-study-2026-09-11/artifacts/posts.jsonl';
files.push(corpus);
// Refuse reuse: an existing snapshot must never be silently rewritten.
mkdirSync(resolve(output,'..'),{recursive:true});
mkdirSync(output);
const manifest={createdAt:new Date().toISOString(),gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 note:'Contains uncommitted matching source and synthetic input, not production data or credentials. Hashes identify actual bytes; gitHead alone does not identify this candidate.',files:[]};
for(const path of files.sort()){
 const bytes=readFileSync(path);const target=join(output,path);
 mkdirSync(resolve(target,'..'),{recursive:true});copyFileSync(path,target);
 manifest.files.push({path:relative(process.cwd(),resolve(path)),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const item of manifest.files){
 if(createHash('sha256').update(readFileSync(join(output,item.path))).digest('hex')!==item.sha256)throw new Error(`Snapshot verification failed: ${item.path}`);
}
console.log(JSON.stringify({output,files:manifest.files.length,verified:true}));
