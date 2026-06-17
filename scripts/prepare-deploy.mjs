/**
 * 배포 전 실행: BUILD_TIME을 KST 기준 현재 시각으로 갱신
 * 사용: node scripts/prepare-deploy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFile = path.join(__dirname, '..', 'js', 'app', 'version.js');

function kstBuildTime(){
  var parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(new Date());
  var get=function(t){return(parts.find(function(p){return p.type===t;})||{}).value||'';};
  return get('year')+'-'+get('month')+'-'+get('day')+' '+get('hour')+':'+get('minute');
}

var content=fs.readFileSync(versionFile,'utf8');
var buildTime=kstBuildTime();
var next=content.replace(
  /export const BUILD_TIME='[^'\r\n]*';?\r?\n/,
  "export const BUILD_TIME='"+buildTime+"';\n"
);
if(next===content){
  console.error('BUILD_TIME line not found in version.js');
  process.exit(1);
}
fs.writeFileSync(versionFile,next,'utf8');
var ver=(content.match(/export const APP_VERSION='([^']*)';/)||[])[1]||'?';
console.log('Prepared deploy: v'+ver+' · '+buildTime);
