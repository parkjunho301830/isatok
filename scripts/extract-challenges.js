const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '../js/app/main.js');
const lines = fs.readFileSync(mainPath, 'utf8').split(/\r?\n/);

const ranges = [
  [162, 169],
  [209, 267],
  [300, 356],
  [462, 498],
  [516, 522],
  [609, 644],
  [672, 782],
  [788, 820],
  [1078, 1423],
  [1457, 1735],
  [1806, 3068],
  [3173, 3557],
  [3569, 3702]
];

const stateBlock = lines.slice(108, 132).join('\n');

const body = [];
for (const [a, b] of ranges) {
  for (let i = a - 1; i < b; i++) body.push(lines[i]);
}

const header = `/**
 * 대결 탭·바텀시트·결과 입력·내기·카카오 공유
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SITE_ORIGIN, KAKAO_JS_KEY } from './version.js';
import {
  COL_CHALLENGES, COL_MEMBERS,
  PT_INDIVIDUAL_WIN, PT_INDIVIDUAL_LOSS, PT_DOUBLE_WIN, PT_DOUBLE_LOSS,
  OPEN_CHALLENGE_EXPIRE_MS,
  DEEPLINK_PARAM, DEEPLINK_TAB_DELAY_PC, DEEPLINK_TAB_DELAY_MOBILE,
  DEEPLINK_MAX_WAIT_PC, DEEPLINK_MAX_WAIT_MOBILE,
  HIGHLIGHT_REMOVE_MS,
  TOAST_DURATION_MS, BS_ANIM_MS,
  DRUM_ITEM_H,
  COLOR_DANGER, COLOR_WARNING, COLOR_GRAY
} from './constants.js';
import { isKakaoInApp } from './pwa.js';
import {
  renderChHomeShortcuts,
  wizResetFlow, wizRenderStep, wizValidateStep, saveWizRecentCombos, wizPrefillEdit,
  requireMyPlayer, validateMyPlayer, buildCreatorFields, formatChallengeCreatorHtml
} from './wizard.js';
import { _isDoublesType, _memberPt, _calcGrade } from './memberCore.js';
import { _memberGrade } from './memberUtils.js';
import { _matchMemberSearch, _getRecentPlayers, _saveRecentPlayers } from './membersTab.js';

let C = null;

export const TM = {
  ms:{lb:'🏓 남단식', badge:'bg', cls:'ms', maxM:1,maxO:1, gM:'남성',gO:'남성'},
  md:{lb:'🏓 남복식', badge:'bb', cls:'md', maxM:2,maxO:2, gM:'남성',gO:'남성'},
  fs:{lb:'🎀 여단식', badge:'br', cls:'fs', maxM:1,maxO:1, gM:'여성',gO:'여성'},
  fd:{lb:'🎀 여복식', badge:'bp', cls:'fd', maxM:2,maxO:2, gM:'여성',gO:'여성'},
  mx:{lb:'🤝 혼합복식',badge:'ba', cls:'mx', maxM:2,maxO:2, mix:true},
  singles:{lb:'🏓 단식', badge:'bg', cls:'singles', maxM:1,maxO:1},
  doubles:{lb:'🤝 복식', badge:'bp', cls:'doubles', maxM:2,maxO:2},
};
export const GM = {
  bo1:{max:1,wins:1,lb:'단판 승부',short:'1판 1선승'},
  bo3:{max:3,wins:2,lb:'3판 2선승',short:'3판 2선승'},
  bo5:{max:5,wins:3,lb:'5판 3선승',short:'5판 3선승'},
  bo7:{max:7,wins:4,lb:'7판 4선승',short:'7판 4선승'}
};
const PT = {
  individual:{win:PT_INDIVIDUAL_WIN,loss:PT_INDIVIDUAL_LOSS},
  double:{win:PT_DOUBLE_WIN,loss:PT_DOUBLE_LOSS}
};
const INSTANT_CREATE_ALLOWED = true;

`;

const footer = `
function g(id) { return C.g(id); }
function toast(msg, opts) { return C.toast(msg, opts); }
function db() { return C.getDb(); }
function chal() { return C.getChal(); }
function members() { return C.getMembers(); }
function isAdmin() { return C.isAdmin(); }
function requireAdmin(fn) { return C.requireAdmin(fn); }
function openMo(id) { return C.openMo(id); }
function closeMo(id) { return C.closeMo(id); }
function findMemberByName(name) { return C.findMemberByName(name); }
function lockBodyScroll() { return C.lockBodyScroll(); }
function unlockBodyScroll() { return C.unlockBodyScroll(); }
function scrollToElement(el) { return C.scrollToElement(el); }
function waitForElement(sel, cb, max, onTimeout) { return C.waitForElement(sel, cb, max, onTimeout); }
function isMobileUa() { return C.isMobileUa(); }
function cssEscape(value) { return C.cssEscape(value); }
function getCurrentPage() { return C.getCurrentPage(); }
function isScrolling() { return C.isScrolling(); }
function renderR() { return C.renderR(); }
function renderM() { return C.renderM(); }
function renderHall() { return C.renderHall(); }
function renderMyRecordHome() { return C.renderMyRecordHome(); }
function renderMyPage() { return C.renderMyPage(); }
function refreshPlayerProfileIfOpen() { return C.refreshPlayerProfileIfOpen(); }
function nav(id) { return C.nav(id); }
function myPointDeltaForResult(c, w) { return C.myPointDeltaForResult(c, w); }
function buildPostMatchCoachComment(won, d, c) { return C.buildPostMatchCoachComment(won, d, c); }
function showResultFeedback(won, d, msg, c) { return C.showResultFeedback(won, d, msg, c); }
function showInstantRegisterSuccess(won, d, msg, c) { return C.showInstantRegisterSuccess(won, d, msg, c); }
function markPendingChallengeRender() { return C.markPendingChallengeRender(); }
function markPendingDeepLink() { return C.markPendingDeepLink(); }
function getDeepLinkCh() { return C.getDeepLinkCh(); }
function setDeepLinkCh(v) { return C.setDeepLinkCh(v); }
function getPendingDeepLinkFilter() { return C.getPendingDeepLinkFilter(); }
function setPendingDeepLinkFilter(v) { return C.setPendingDeepLinkFilter(v); }
function peekDeepLinkMatchId() { return C.peekDeepLinkMatchId(); }
function stashDeepLinkMatchId(id) { return C.stashDeepLinkMatchId(id); }
function clearDeepLinkMatchId() { return C.clearDeepLinkMatchId(); }
function isDeepLinkHandled() { return C.isDeepLinkHandled(); }
function setDeepLinkHandled(v) { return C.setDeepLinkHandled(v); }
function isDeepLinkInFlight() { return C.isDeepLinkInFlight(); }
function setDeepLinkInFlight(v) { return C.setDeepLinkInFlight(v); }
function removeChallengeLocal(id) { return C.removeChallengeLocal(id); }
function unshiftChallengeLocal(c) { return C.unshiftChallengeLocal(c); }
function updateChallengeLocal(id, patch) { return C.updateChallengeLocal(id, patch); }
function $ko(d) { return C.$ko(d); }

export function getChallengeFilter() { return _cf; }
export function getWizardChallengeState() { return { _my, _opp, _type, _bet }; }
export function setMy(v) { _my = v; }
export function setOpp(v) { _opp = v; }
export function setChallengeType(tp) { _type = tp; }
export function getEditChId() { return _editChId; }
export function getBsGameMode() { return _bsGameMode; }
export function isInstantCreateMode() { return _isInstantCreateMode(); }
export function mountInstantResultForm() { return _mountInstantResultForm(); }
export function unmountInstantResultForm() { return _unmountInstantResultForm(); }
export function scrollBsStep(n) { return _scrollBsStep(n); }
export function initResultForm(opts) { return _initResultForm(opts); }
export function updateChSubmitBtn() { return _updateChSubmitBtn(); }
export function nowDateTimeFields() { return _nowDateTimeFields(); }

export function initChallenges(ctx) {
  C = ctx;
  window.selectBet = selectBet;
  window.onBsPlayerSearch = onBsPlayerSearch;
  window.openBS = openBS;
  window.openInstantBS = openInstantBS;
  window.setBsGameMode = setBsGameMode;
  window.setChCreateMode = setChCreateMode;
  window.bsStepNextFrom2 = bsStepNextFrom2;
  window.bsStepPrevFrom4 = bsStepPrevFrom4;
  window.openResultPicker = openResultPicker;
  window.closeBS = closeBS;
  window.bsStepInstantBack = bsStepInstantBack;
  window.bsStep = bsStep;
  window.updateChSubmitBtn = _updateChSubmitBtn;
  window.submitChBS = submitChBS;
  window.setF = setF;
  window.toggleOC = toggleOC;
  window.setType = setType;
  window.tgl = tgl;
  window.openAcceptOpen = openAcceptOpen;
  window.tglAccept = tglAccept;
  window.submitAcceptOpen = submitAcceptOpen;
  window.acceptC = acceptC;
  window.rejectC = rejectC;
  window.delC = delC;
  window.pickSetWin = pickSetWin;
  window.setSetWinsPreset = setSetWinsPreset;
  window.onSetScoreInput = onSetScoreInput;
  window.addSetRow = addSetRow;
  window.removeSetRow = removeSetRow;
  window.setResMode = setResMode;
  window.openRes = openRes;
  window.setW = setW;
  window.stepScore = stepScore;
  window.addSet = addSet;
  window.removeSet = removeSet;
  window.setGameMode = setGameMode;
  window.submitResult = submitResult;
  window.setShareTemplate = setShareTemplate;
  window.openShareModal = openShareModal;
  window.shareKakao = shareKakao;
  window.doKakaoShare = doKakaoShare;
  window.doNativeShare = doNativeShare;
  window.copyShareMsg = copyShareMsg;
  window.openBetPick = openBetPick;
  window.setBetPick = setBetPick;
  window.submitBetPick = submitBetPick;
  window.openEditCh = openEditCh;
}

export {
  renderC,
  renderGridsBS,
  isBSOpen,
  isBSFocused,
  isBsPlayerSearchActive,
  isBsFormInputFocused,
  deferBsGridRefresh,
  flushBsGridIfPending,
  applyChallengesSnapshotRender,
  handleDeepLink,
  shareFilterFor,
  scrollToChallenge,
  initBsPlayerSearchInputs,
  getRemainingTime
};
`;

// Replace main.js references in body
let code = body.join('\n');

// Remove duplicate TM/GM/SL/SB blocks (we export TM/GM in header)
code = code.replace(/^const TM=\{[\s\S]*?\};\r?\nconst SL=.*?;\r?\nconst SB=.*?;\r?\n/m, '');

// Remove duplicate GM at old location if any
code = code.replace(/^const GM=\{[\s\S]*?\};\r?\nlet _bsGameMode/m, 'let _bsGameMode');

// Remove INSTANT_CREATE_ALLOWED duplicate
code = code.replace(/^const INSTANT_CREATE_ALLOWED=true;\r?\n/, '');

// Replace identifiers
const replacements = [
  [/\bMEMBERS\b/g, 'members()'],
  [/\bCHAL\b/g, 'chal()'],
  [/\bdb\b(?=\s*[,;)\]}\?]|$|\s*&&|\s*\|\||\s*;|\s*\?)/g, 'db()'],
  [/\b_findMemberByName\b/g, 'findMemberByName'],
  [/\b_isAdmin\b/g, 'isAdmin'],
  [/\b_requireAdmin\b/g, 'requireAdmin'],
  [/\b_scrollToChallenge\b/g, 'scrollToChallenge'],
  [/\b_shareFilterFor\b/g, 'shareFilterFor'],
  [/\b_applyDeepLinkFilter\b/g, 'applyDeepLinkFilter'],
  [/\b_peekDeepLinkMatchId\b/g, 'peekDeepLinkMatchId'],
  [/\b_stashDeepLinkMatchId\b/g, 'stashDeepLinkMatchId'],
  [/\b_clearDeepLinkMatchId\b/g, 'clearDeepLinkMatchId'],
  [/\b_cssEscape\b/g, 'cssEscape'],
  [/\b_isMobileUa\b/g, 'isMobileUa'],
  [/\b_scrollToElement\b/g, 'scrollToElement'],
  [/\b_waitForElement\b/g, 'waitForElement'],
  [/\b_lockBodyScroll\b/g, 'lockBodyScroll'],
  [/\b_unlockBodyScroll\b/g, 'unlockBodyScroll'],
  [/\b_refreshPlayerProfileIfOpen\b/g, 'refreshPlayerProfileIfOpen'],
  [/\b_myPointDeltaForResult\b/g, 'myPointDeltaForResult'],
  [/\b_buildPostMatchCoachComment\b/g, 'buildPostMatchCoachComment'],
  [/\b_showResultFeedback\b/g, 'showResultFeedback'],
  [/\b_showInstantRegisterSuccess\b/g, 'showInstantRegisterSuccess'],
  [/\b_renderMyRecordHome\b/g, 'renderMyRecordHome'],
  [/\b_renderMyPage\b/g, 'renderMyPage'],
  [/\b_renderHall\b/g, 'renderHall'],
  [/\b_renderR\b/g, 'renderR'],
  [/\b_renderM\b/g, 'renderM'],
  [/\b\$ko\b/g, '$ko'],
  [/\btoast\b/g, 'toast'],
  [/\bopenMo\b/g, 'openMo'],
  [/\bcloseMo\b/g, 'closeMo'],
  [/\bnav\b/g, 'nav'],
  [/\bwindow\.nav\b/g, 'nav'],
  [/\bwindow\.toast\b/g, 'toast'],
  [/\bwindow\.setF\b/g, 'setF'],
  [/\bwindow\.openInstantBS\b/g, 'openInstantBS'],
  [/\bwindow\.openBS\b/g, 'openBS'],
  [/\bwindow\.closeBS\b/g, 'closeBS'],
  [/\bwindow\.onBsPlayerSearch\b/g, 'onBsPlayerSearch'],
  [/\bwindow\.selectBet\b/g, 'selectBet'],
];

// Fix CHAL assignments
code = code.replace(/chal\(\)=chal\(\)\.filter/g, 'REMOVE_CHAL_FILTER');
code = code.replace(/chal\(\)\.unshift/g, 'UNSHIFT_CHAL');
code = code.replace(/else \{ chal\(\)\.unshift/g, 'else { unshiftChallengeLocal');

// State from main - insert after INSTANT_CREATE_ALLOWED in header area
const stateInsert = stateBlock
  .replace(/let _delId=null,_cf='all',_rid=null,_rw=null;/, "let _cf='all',_rid=null,_rw=null;")
  .replace(/const GM=\{[\s\S]*?\};\r?\n/, '')
  .replace(/const INSTANT_CREATE_ALLOWED=true;\r?\n/, '');

const out = header + '\n' + stateInsert + '\n' + code + footer;
fs.writeFileSync(path.join(__dirname, '../js/app/challenges.js'), out);
console.log('Wrote challenges.js, lines:', out.split('\n').length);
