import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyExistingOllama} from '../lib/workshopMacServiceChecks.mjs';

function fixture({address='127.0.0.1:11434',owner=501,command='/Applications/Ollama.app/Contents/Resources/ollama serve',disabled=false,loaded=true}={}){
 const calls=[];
 const run=(program,args)=>{
  calls.push([program,args]);
  if(program==='/bin/launchctl'&&args[0]==='print')return {status:loaded?0:1,stdout:''};
  if(program==='/bin/launchctl'&&args[0]==='print-disabled')return {status:0,stdout:`"com.ollama.ollama" => ${disabled}`};
  if(program==='/usr/sbin/lsof')return {status:0,stdout:`p96367\nn${address}\n`};
  if(program==='/bin/ps')return {status:0,stdout:`  ${owner} ${command}\n`};
  throw Error('Unexpected command');
 };
 return {run,calls};
}
test('official Ollama reuse verifies startup, owner, executable and loopback without mutations',()=>{
 const f=fixture();assert.equal(verifyExistingOllama({domain:'gui/501',uid:501,run:f.run}),'com.ollama.ollama');
 assert(f.calls.every(([program,args])=>['/usr/sbin/lsof','/bin/ps'].includes(program)||program==='/bin/launchctl'&&['print','print-disabled'].includes(args[0])));
});
test('existing network-exposed daemon cannot be reused',()=>{
 for(const address of ['*:11434','0.0.0.0:11434','192.168.1.169:11434']){
  const f=fixture({address});assert.throws(()=>verifyExistingOllama({domain:'gui/501',uid:501,run:f.run}),/only on loopback/);
 }
});
test('foreign owner or executable cannot be reused',()=>{
 for(const options of [{owner:502},{command:'/tmp/other-program serve'}]){
  const f=fixture(options);assert.throws(()=>verifyExistingOllama({domain:'gui/501',uid:501,run:f.run}),/not the current user/);
 }
});
test('disabled or unloaded official service cannot be reused',()=>{
 for(const options of [{disabled:true},{loaded:false}]){
  const f=fixture(options);assert.throws(()=>verifyExistingOllama({domain:'gui/501',uid:501,run:f.run}),/disabled|not loaded/);
 }
});
