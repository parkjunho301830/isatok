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
const indexFile = path.join(root, 'index.html');
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
  return content.replace(/\?v=[^"'?#\s]+/g, '?v=' + appVersion);
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

var indexContent = fs.readFileSync(indexFile, 'utf8');
fs.writeFileSync(indexFile, bumpAssetQuery(indexContent, appVersion), 'utf8');

var manifestContent = fs.readFileSync(manifestFile, 'utf8');
var nextManifest = manifestContent.replace(
  /"start_url"\s*:\s*"[^"]*"/,
  '"start_url": "./?v=' + appVersion + '"'
);
fs.writeFileSync(manifestFile, nextManifest, 'utf8');

console.log('Prepared deploy: v' + appVersion + ' · ' + buildTime);
