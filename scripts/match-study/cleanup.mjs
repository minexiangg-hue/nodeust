// Drops ONLY the database/user recorded by this study's isolated setup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import net from 'node:net';
const path='/tmp/nodeust-matchstudy-test-state.json';const state=JSON.parse(readFileSync(path,'utf8'));
assert.match(state.schema,/^nodeust_matchstudy_[a-f0-9]{8}$/);assert.match(state.user,/^nodematch_[a-f0-9]{8}$/);
assert.equal(state.schema.slice(-8),state.user.slice(-8));assert.equal(state.envPath,'/tmp/nodeust-matchstudy-test.env');
assert.match(state.migrationsFolder,/^\/tmp\/nodeust-matchstudy-migrations-[a-f0-9]{8}$/);
const listening=await new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:3102});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
assert.equal(listening,false,'Stop the isolated preview on port 3102 before cleanup.');
const r=spawnSync('sudo',['-n','mysql','--batch','--skip-column-names'],{input:`DROP DATABASE IF EXISTS \`${state.schema}\`; DROP USER IF EXISTS '${state.user}'@'127.0.0.1';`,encoding:'utf8'});
assert.equal(r.status,0,'Isolated database cleanup failed; credentials omitted.');
rmSync(state.envPath,{force:true});rmSync(state.migrationsFolder,{recursive:true,force:true});rmSync(path);
writeFileSync('/tmp/nodeust-matchstudy-cleanup.json',JSON.stringify({at:new Date().toISOString(),databaseRemoved:state.schema,userRemoved:state.user,previewStopped:true,privateEnvironmentRemoved:true},null,2),{mode:0o600});
console.log('Isolated study database, database account and private environment removed; logs retained.');
