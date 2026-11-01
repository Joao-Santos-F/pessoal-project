'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const discovery = require('../src/main/application-discovery');
const direct = require('../src/main/direct');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-apps-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
test('discovery finds portable executables and shortcuts without entering linked directories', async t => {
  const root=fixture(t); fs.mkdirSync(path.join(root,'Editor'));
  fs.writeFileSync(path.join(root,'Editor','Studio.exe'),'fixture');
  fs.writeFileSync(path.join(root,'Launch.lnk'),'fixture');
  fs.writeFileSync(path.join(root,'Uninstall.exe'),'fixture');
  const external=fixture(t); fs.writeFileSync(path.join(external,'Outside.exe'),'fixture');
  fs.symlinkSync(external,path.join(root,'linked'),'junction');
  const items=await discovery.scan([{directory:root,depth:2}]);
  assert.deepEqual(items.map(i=>i.name).sort(),['Launch','Studio']);
  assert.ok((await discovery.scan([{directory:root,depth:2}],{maxEntries:1})).length <=1);
});
test('candidate matching prefers exact names and preserves genuine ambiguity', () => {
  const a={name:'Studio',kind:'executable',id:'C:/A/Studio.exe'};
  const b={name:'Studio',kind:'executable',id:'C:/B/Studio.exe'};
  const c={name:'Studio Tools',kind:'app',id:'tools'};
  assert.deepEqual(discovery.candidates([a,b,c,a],'studio.exe'),[a,b]);
  assert.deepEqual(discovery.candidates([a,b,c],'Studio Tools'),[c]);
  assert.deepEqual(discovery.candidates([a,b,c],'Stud'),[a,b,c]);
  assert.deepEqual(discovery.candidates([a,b,c],'Unknown'),[]);
});
test('ambiguous open waits for a choice and then respects execution approval', async () => {
  const items=[{name:'Editor',kind:'executable',id:'one'},{name:'Editor',kind:'executable',id:'two'}];
  const calls=[];
  const options={signal:new AbortController().signal,launch:{findCandidates:async()=>items,risky:()=>true,launch:async item=>calls.push(item.id)},chooseApp:async()=>null,approve:async()=>true};
  assert.match(await direct.handle('/open Editor',options),/cancelada/); assert.deepEqual(calls,[]);
  options.chooseApp=async()=>items[1]; options.approve=async()=>false;
  assert.match(await direct.handle('/open Editor',options),/cancelada/); assert.deepEqual(calls,[]);
  options.approve=async()=>true;
  await direct.handle('/open Editor',options); assert.deepEqual(calls,['two']);
});
test('missing app can be selected and remembered only after successful opening', async t => {
  const root=fixture(t), file=path.join(root,'Portable.exe'); fs.writeFileSync(file,'fixture');
  let saved, opened;
  const options={signal:new AbortController().signal,launch:{findCandidates:async()=>[],risky:()=>true},
    chooseFile:async()=>file,approve:async()=>true,shell:{openPath:async p=>{opened=p;return '';}},rememberApp:async(...args)=>{saved=args;}};
  await direct.handle('/open Meu Editor',options);
  assert.equal(opened,file); assert.deepEqual(saved,['meu editor',file]);
  options.aliases={'meu editor':file}; options.chooseFile=async()=>{throw Error('Should use remembered choice');};
  await direct.handle('/open Meu Editor',options); assert.equal(opened,file);
  saved=null; options.aliases={}; options.chooseFile=async()=>file; options.shell.openPath=async()=> 'Falha';
  await assert.rejects(direct.handle('/open Outro',options),/Falha/); assert.equal(saved,null);
});
test('cancelling the fallback picker never opens or remembers anything', async () => {
  const options={signal:new AbortController().signal,launch:{findCandidates:async()=>[]},chooseFile:async()=>null,
    shell:{openPath:()=>assert.fail('must not open')},rememberApp:()=>assert.fail('must not remember')};
  assert.match(await direct.handle('/open Missing',options),/cancelada/);
});
test('conversation guidance follows latest listening request and avoids repeated interrogations', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/js/conversation.js'),'utf8');
  const {conversationGuide}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const history=[{role:'user',content:'Só quero desabafar'},{role:'assistant',content:'Como foi?'},{role:'user',content:'Difícil'},{role:'assistant',content:'E agora?'},{role:'user',content:'Não quero conselhos, só quero desabafar.'}];
  const before=JSON.stringify(history), guide=conversationGuide(history);
  assert.match(guide,/CURRENT TURN/); assert.match(guide,/RECENT RHYTHM/);
  assert.match(guide,/accept corrections immediately/); assert.match(guide,/Do not claim to know hidden feelings/);
  assert.equal(JSON.stringify(history),before);
  history.push({role:'user',content:'Agora quero um plano prático.'});
  assert.doesNotMatch(conversationGuide(history),/CURRENT TURN/);
});
