// Run as the logged-in workshop user, after private configuration and model setup.
// Creates only these two dedicated user LaunchAgents; preserves other services.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

if(process.platform!=='darwin'||process.getuid()===0)throw Error('Run as the logged-in macOS user, without sudo.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=path.join(os.homedir(),'.config/skilled-crafting/local-ai.env');
const settings=fs.lstatSync(config);
if(settings.isSymbolicLink()||!settings.isFile()||settings.uid!==process.getuid()||(settings.mode&0o777)!==0o600)
 throw Error('Private local-ai.env must be a regular file owned by this user with mode 600.');
const ollama='/Applications/Ollama.app/Contents/Resources/ollama';
fs.accessSync(ollama,fs.constants.X_OK);
const setup=path.join(root,'scripts/setup-workshop-ai.sh');
const serviceDirectory=path.join(os.homedir(),'Library/LaunchAgents');
const logDirectory=path.join(os.homedir(),'Library/Logs/SkilledCrafting');
for(const directory of [serviceDirectory,logDirectory]){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const stat=fs.lstatSync(directory);
 if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid())throw Error('Service paths must be directories owned by this user.');
}
const domain='gui/'+process.getuid();
const envPath=[path.dirname(process.execPath),path.dirname(ollama),'/usr/local/bin','/opt/homebrew/bin','/usr/bin','/bin'].join(':');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const string=value=>'<string>'+escape(value)+'</string>';
const services=[
 {label:'com.skilledcrafting.ollama',args:[ollama,'serve'],port:11434,
  environment:{PATH:envPath,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_CONTEXT_LENGTH:'8192'}},
 {label:'com.skilledcrafting.local-ai',args:['/bin/bash',setup,'--run'],port:8788,environment:{PATH:envPath}}
];
const loaded=label=>spawnSync('/bin/launchctl',['print',domain+'/'+label],{stdio:'ignore'}).status===0;
const plans=services.map(service=>{
 const file=path.join(serviceDirectory,service.label+'.plist');
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n'
  +'<key>Label</key>'+string(service.label)+'\n<key>ProgramArguments</key><array>'+service.args.map(string).join('')+'</array>\n'
  +'<key>WorkingDirectory</key>'+string(root)+'\n<key>EnvironmentVariables</key><dict>'
  +Object.entries(service.environment).map(([key,value])=>'<key>'+escape(key)+'</key>'+string(value)).join('')+'</dict>\n'
  +'<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>\n'
  +'<key>StandardOutPath</key>'+string(path.join(logDirectory,service.label+'.log'))
  +'<key>StandardErrorPath</key>'+string(path.join(logDirectory,service.label+'.error.log'))+'\n</dict></plist>\n';
 if(fs.existsSync(file)){
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.uid!==process.getuid()||fs.readFileSync(file,'utf8')!==xml)
   throw Error('Existing service configuration preserved; review manually: '+file);
 }
 const isLoaded=loaded(service.label);
 if(isLoaded&&!fs.existsSync(file))throw Error('An existing service with this label is loaded; review it before installation: '+service.label);
 if(!isLoaded){
  const listeners=spawnSync('/usr/sbin/lsof',['-nP',`-iTCP:${service.port}`,'-sTCP:LISTEN'],{encoding:'utf8'});
  if(listeners.error||![0,1].includes(listeners.status))throw Error('Could not check local listeners.');
  if(listeners.status===0)throw Error(`Port ${service.port} is already in use. ${service.port===11434?'Quit the Ollama app after its model download finishes, then rerun.':'Review the existing gateway before rerunning.'} No service has been changed.`);
 }
 return {...service,file,xml,isLoaded};
});
for(const service of plans){
 if(!fs.existsSync(service.file))fs.writeFileSync(service.file,service.xml,{flag:'wx',mode:0o600});
 for(const args of [['enable',domain+'/'+service.label],...(!service.isLoaded?[['bootstrap',domain,service.file]]:[])]){
  const command=spawnSync('/bin/launchctl',args,{encoding:'utf8'});
  if(command.status!==0)throw Error('Could not enable/load '+service.label+': '+String(command.stderr||command.error||'launchctl error'));
 }
 console.log(service.label+': loaded='+loaded(service.label));
}
console.log('User LaunchAgents start when this user signs in; they do not run before login or while the Mac sleeps.');
console.log('Keep the Mac powered and available. No Tailscale Serve or network policy was changed.');
