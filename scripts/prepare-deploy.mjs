/**
 * 배포 전 실행: APP_VERSION · BUILD_TIME · version.json · asset cache bust
 * 사용: node scripts/prepare-deploy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const versionFile = path.join(root, 'js', 'app', 'version.js');
const versionJsonFile = path.join(root, 'version.json');
const swFile = path.join(root, 'service-worker.js');
const appHtmlFile = path.join(root, 'app.html');
const mainFile = path.join(root, 'js', 'app', 'main.js');
const manifestFile = path.join(root, 'manifest.json');

function kstParts() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
}

function part(parts, type) {
  return (parts.find(function (p) { return p.type === type; }) || {}).value || '';
}

function kstBuildTime() {
  var parts = kstParts();
  return part(parts, 'year') + '-' + part(parts, 'month') + '-' + part(parts, 'day') +
    ' ' + part(parts, 'hour') + ':' + part(parts, 'minute');
}

function kstDatePrefix() {
  var parts = kstParts();
  return part(parts, 'year') + '.' + part(parts, 'month') + '.' + part(parts, 'day');
}

function nextAppVersion(current) {
  var prefix = kstDatePrefix();
  var match = /^(\d{4}\.\d{2}\.\d{2})\.(\d{2})$/.exec(String(current || '').trim());
  var seq = 1;
  if (match && match[1] === prefix) {
    seq = Math.min(parseInt(match[2], 10) + 1, 99);
  }
  return prefix + '.' + String(seq).padStart(2, '0');
}

function readCurrentVersion(content) {
  return (content.match(/export const APP_VERSION='([^']*)';/) || [])[1] || '';
}

function bumpAssetQuery(content, appVersion) {
  // 버전 캐시 버스트만 치환 (?v=2026.06.26.10). 유튜브 URL 파싱 등 ?v=(...) 패턴은 건드리지 않음
  return content.replace(/\?v=\d{4}\.\d{2}\.\d{2}\.\d{2}/g, '?v=' + appVersion);
}

function syncLocalImports(content, appVersion) {
  return content.replace(
    /from\s+(['"])(\.\/[^'"]+?\.js)(\?v=[^'"]*)?(\1)/g,
    function (_, q, modPath, _oldV, q2) {
      return 'from ' + q + modPath + '?v=' + appVersion + q2;
    }
  );
}

var versionContent = fs.readFileSync(versionFile, 'utf8');
var currentVersion = readCurrentVersion(versionContent);
var appVersion = nextAppVersion(currentVersion);
var buildTime = kstBuildTime();

var nextVersionJs = versionContent
  .replace(/export const APP_VERSION='[^'\r\n]*';?\r?\n/, "export const APP_VERSION='" + appVersion + "';\n")
  .replace(/export const BUILD_TIME='[^'\r\n]*';?\r?\n/, "export const BUILD_TIME='" + buildTime + "';\n");

if (nextVersionJs === versionContent) {
  console.error('version.js format not recognized');
  process.exit(1);
}
fs.writeFileSync(versionFile, nextVersionJs, 'utf8');

fs.writeFileSync(versionJsonFile, JSON.stringify({
  appVersion: appVersion,
  buildTime: buildTime,
  swVersion: appVersion
}, null, 2) + '\n', 'utf8');

var swContent = fs.readFileSync(swFile, 'utf8');
var nextSw = swContent.replace(/var SW_VERSION = '[^']*';/, "var SW_VERSION = '" + appVersion + "';");
if (nextSw === swContent) {
  console.error('SW_VERSION line not found in service-worker.js');
  process.exit(1);
}
fs.writeFileSync(swFile, nextSw, 'utf8');

var appHtmlContent = fs.readFileSync(appHtmlFile, 'utf8');
fs.writeFileSync(appHtmlFile, bumpAssetQuery(appHtmlContent, appVersion), 'utf8');

function bumpJsAppModules(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    var full = path.join(dir, ent.name);
    if (ent.isDirectory()) bumpJsAppModules(full);
    else if (ent.isFile() && ent.name.endsWith('.js')) {
      var c = fs.readFileSync(full, 'utf8');
      var next = syncLocalImports(bumpAssetQuery(c, appVersion), appVersion);
      if (next !== c) fs.writeFileSync(full, next, 'utf8');
    }
  });
}
bumpJsAppModules(path.join(root, 'js', 'app'));

var mainContent = fs.readFileSync(mainFile, 'utf8');
var nextMain = mainContent.replace(
  /from'\.\/version\.js(?:\?v=[^']*)?'/,
  "from'./version.js?v=" + appVersion + "'"
);
if (nextMain !== mainContent) {
  fs.writeFileSync(mainFile, nextMain, 'utf8');
}

var manifestContent = fs.readFileSync(manifestFile, 'utf8');
var nextManifest = manifestContent.replace(
  /"start_url"\s*:\s*"[^"]*"/,
  '"start_url": "./?v=' + appVersion + '"'
);
fs.writeFileSync(manifestFile, nextManifest, 'utf8');

console.log('Prepared deploy: v' + appVersion + ' · ' + buildTime);
