import {spawnSync} from 'node:child_process';

// Read-only verification before reusing the official user-managed Ollama daemon.
export function verifyExistingOllama({domain,uid,run=spawnSync}){
 const official='com.ollama.ollama';
 if(run('/bin/launchctl',['print',domain+'/'+official],{encoding:'utf8'}).status!==0)
  throw Error('The official Ollama user service is not loaded; review its startup before reuse.');
 const disabled=run('/bin/launchctl',['print-disabled',domain],{encoding:'utf8'});
 if(disabled.status!==0||/"com\.ollama\.ollama"\s*=>\s*true/.test(disabled.stdout||''))
  throw Error('The official Ollama user service is disabled or its enabled state cannot be checked.');
 const listeners=run('/usr/sbin/lsof',['-nP','-Fpn','-iTCP:11434','-sTCP:LISTEN'],{encoding:'utf8'});
 if(listeners.status!==0)throw Error('No running Ollama listener could be verified.');
 const lines=String(listeners.stdout||'').split('\n');
 const addresses=lines.filter(line=>line.startsWith('n')).map(line=>line.slice(1));
 if(!addresses.length||addresses.some(value=>!['127.0.0.1:11434','[::1]:11434'].includes(value)))
  throw Error('Existing Ollama must listen only on loopback; no network settings were changed.');
 const pids=[...new Set(lines.filter(line=>/^p\d+$/.test(line)).map(line=>line.slice(1)))];
 if(!pids.length)throw Error('Could not identify the Ollama listener.');
 for(const pid of pids){
  const process=run('/bin/ps',['-p',pid,'-o','uid=,command='],{encoding:'utf8'});
  const match=String(process.stdout||'').trim().match(/^(\d+)\s+(.+)$/);
  if(process.status!==0||!match||Number(match[1])!==uid||match[2]!=='/Applications/Ollama.app/Contents/Resources/ollama serve')
   throw Error('The listener is not the current user’s official Ollama server; existing services were preserved.');
 }
 return official;
}
