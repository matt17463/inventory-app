#!/usr/bin/env node
/** Manual readiness only: does not merge, deploy or alter a database. */
import {readFileSync} from "node:fs";
import {evaluateMarketingReleaseEvidence} from "../src/lib/marketingReleaseGate.js";
const [path,commit]=process.argv.slice(2);
if(!path||!commit){
 console.error("Usage: node scripts/marketing-release-gate.mjs <reviewed-evidence.json> <validated-40-character-commit>");
 process.exitCode=2;
}else{
 try{
  const dossier=JSON.parse(readFileSync(path,"utf8"));
  const result=evaluateMarketingReleaseEvidence(dossier,commit);
  if(!result.ready){console.error("BLOCKED: "+result.errors.join("\nBLOCKED: "));process.exitCode=1;}
  else console.log("ACCEPTANCE READY for commit "+commit+" — this command does NOT deploy or merge.");
 }catch(error){console.error("BLOCKED: could not load release dossier ("+(error?.code||"invalid JSON")+").");process.exitCode=2;}
}
