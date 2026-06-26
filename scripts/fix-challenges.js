const fs = require('fs');
const path = require('path');
let code = fs.readFileSync(path.join(__dirname, '../js/app/challenges.js'), 'utf8');

const stateInsert = `
let _cf='all',_rid=null,_rw=null;
let _resInputMode='winner';
let _setWinsA=0,_setWinsB=0;
let _setRowCount=3;
let _setWinPick=[];
let _scLblA='A팀',_scLblB='B팀';
let _instantCreate=false;
let _acceptOpenId=null;
let _acceptTeam=[];
let _resultFormMountedInWizard=false;
var _drumsInited=false;
let _deepLinkCh=null;
let _pendingDeepLinkFilter=null;
let _deepLinkHandled=false;
let _deepLinkInFlight=false;
let _deepLinkTargetId=null;
const LS_DEEPLINK_MATCH='isatok_deeplink_match';
`;

code = code.replace(
  'let _bsLockTimer=null;\nfunction _isBSOpen',
  'let _bsLockTimer=null;\n' + stateInsert + '\nfunction _isBSOpen'
);

const renames = [
  ['function _applyChallengesSnapshotRender', 'export function applyChallengesSnapshotRender'],
  ['function _flushBsGridIfPending', 'export function flushBsGridIfPending'],
  ['function _deferBsGridRefresh', 'export function deferBsGridRefresh'],
  ['function _isBSOpen', 'export function isBSOpen'],
  ['function _isBSFocused', 'export function isBSFocused'],
  ['function _isBsPlayerSearchActive', 'export function isBsPlayerSearchActive'],
  ['function _isBsFormInputFocused', 'export function isBsFormInputFocused'],
  ['function _scrollToChallenge', 'export function scrollToChallenge'],
  ['function _shareFilterFor', 'export function shareFilterFor'],
  ['function _applyDeepLinkFilter', 'function applyDeepLinkFilter'],
  ['function _peekDeepLinkMatchId', 'function peekDeepLinkMatchIdLocal'],
  ['function _stashDeepLinkMatchId', 'function stashDeepLinkMatchIdLocal'],
  ['function _clearDeepLinkMatchId', 'function clearDeepLinkMatchIdLocal'],
  ['function _unlockBodyScroll', 'function unlockBodyScrollLocal'],
  ['function _lockBodyScroll', 'function lockBodyScrollLocal'],
];

for (const [a, b] of renames) code = code.split(a).join(b);

code = code.replace(/\bCHAL\b/g, 'chal()');
code = code.replace(/\bMEMBERS\b/g, 'members()');
code = code.replace(/\b_findMemberByName\b/g, 'findMemberByName');
code = code.replace(/\b_isAdmin\b/g, 'isAdmin');
code = code.replace(/\b_requireAdmin\b/g, 'requireAdmin');
code = code.replace(/\b_cssEscape\b/g, 'cssEscape');
code = code.replace(/\b_isMobileUa\b/g, 'isMobileUa');
code = code.replace(/\b_refreshPlayerProfileIfOpen\b/g, 'refreshPlayerProfileIfOpen');
code = code.replace(/\b_myPointDeltaForResult\b/g, 'myPointDeltaForResult');
code = code.replace(/\b_buildPostMatchCoachComment\b/g, 'buildPostMatchCoachComment');
code = code.replace(/\b_showResultFeedback\b/g, 'showResultFeedback');
code = code.replace(/\b_showInstantRegisterSuccess\b/g, 'showInstantRegisterSuccess');
code = code.replace(/\b_renderMyRecordHome\b/g, 'renderMyRecordHome');
code = code.replace(/\b_renderMyPage\b/g, 'renderMyPage');
code = code.replace(/\b_renderHall\b/g, 'renderHall');
code = code.replace(/\b_renderR\b/g, 'renderR');
code = code.replace(/\b_renderM\b/g, 'renderM');
code = code.replace(/\b_shareFilterFor\b/g, 'shareFilterFor');
code = code.replace(/\b_applyDeepLinkFilter\b/g, 'applyDeepLinkFilter');
code = code.replace(/\b_peekDeepLinkMatchId\b/g, 'peekDeepLinkMatchIdLocal');
code = code.replace(/\b_stashDeepLinkMatchId\b/g, 'stashDeepLinkMatchIdLocal');
code = code.replace(/\b_clearDeepLinkMatchId\b/g, 'clearDeepLinkMatchIdLocal');
code = code.replace(/\b_scrollToChallenge\b/g, 'scrollToChallenge');
code = code.replace(/\b_currentPage\b/g, 'getCurrentPage()');
code = code.replace(/\b_isScrolling\b/g, 'isScrolling()');
code = code.replace(/\b_isBSFocused\(\)/g, 'isBSFocused()');

// snapshot render pending flags
code = code.replace(
  /if\(isScrolling\(\)\)\{_pendingRender\.c=true;_pendingDeepLink=true;return;\}/,
  'if(isScrolling()){markPendingChallengeRender();markPendingDeepLink();return;}'
);

// body scroll lock
code = code.replace(/if\(_bodyScrollLock>0/g, 'if(C.getBodyScrollLock()>0');
code = code.replace(/unlockBodyScrollLocal\(\)/g, 'unlockBodyScroll()');
code = code.replace(/lockBodyScrollLocal\(\)/g, 'lockBodyScroll()');

// delC local
code = code.replace(
  /else\{chal\(\)=chal\(\)\.filter\(c=>c\.id!==id\);renderC\(\);\}/g,
  'else{removeChallengeLocal(id);renderC();}'
);
code = code.replace(/chal\(\)\.unshift\(/g, 'unshiftChallengeLocal(');

// db() - fix double parens from bad replace
code = code.replace(/db\(\)\(\)/g, 'db()');

// Fix db in import contexts - getDb function name
code = code.replace(/if\(db\(\)\)/g, 'if(db())');
code = code.replace(/await updateDoc\(doc\(db\(\),/g, 'await updateDoc(doc(db(),');
code = code.replace(/await addDoc\(collection\(db\(\),/g, 'await addDoc(collection(db(),');
code = code.replace(/await deleteDoc\(doc\(db\(\),/g, 'await deleteDoc(doc(db(),');

// handleDeepLink deep link state
code = code.replace(/\b_deepLinkHandled\b/g, 'isDeepLinkHandled()');
code = code.replace(/\b_deepLinkInFlight\b/g, 'isDeepLinkInFlight()');
// fix assignments
code = code.replace(/isDeepLinkHandled\(\)=true/g, 'setDeepLinkHandled(true)');
code = code.replace(/isDeepLinkInFlight\(\)=true/g, 'setDeepLinkInFlight(true)');
code = code.replace(/if\(isDeepLinkHandled\(\)\|\|isDeepLinkInFlight\(\)\)/g, 'if(isDeepLinkHandled()||isDeepLinkInFlight())');

// deep link ch in snapshot
code = code.replace(/\b_deepLinkCh\b/g, 'getDeepLinkCh()');
code = code.replace(/getDeepLinkCh\(\)=null/g, 'setDeepLinkCh(null)');
code = code.replace(/var targetId=getDeepLinkCh\(\)/g, 'var targetId=getDeepLinkCh()');
code = code.replace(/if\(getDeepLinkCh\(\)\)/g, 'if(getDeepLinkCh())');

code = code.replace(/\b_pendingDeepLinkFilter\b/g, 'getPendingDeepLinkFilter()');
code = code.replace(/getPendingDeepLinkFilter\(\)=null/g, 'setPendingDeepLinkFilter(null)');
code = code.replace(/if\(getPendingDeepLinkFilter\(\)\)/g, 'if(getPendingDeepLinkFilter())');

// applyDeepLinkFilter body
code = code.replace(
  /function applyDeepLinkFilter\(chId\)\{[\s\S]*?\}/,
  `function applyDeepLinkFilter(chId){
  var c=chal().find(function(x){return x.id===chId;});
  if(c) setF(shareFilterFor(c));
}`
);

// peek uses local _deepLinkTargetId - keep local functions
code = code.replace(/function peekDeepLinkMatchIdLocal\(\)/g, 'function peekDeepLinkMatchIdLocal()');
code = code.replace(/C\.peekDeepLinkMatchId/g, 'peekDeepLinkMatchIdLocal');

// handleDeepLink set flags at end
code = code.replace(
  /setDeepLinkInFlight\(true\);\s+stashDeepLinkMatchIdLocal\(matchId\);/,
  'setDeepLinkInFlight(true);\n  stashDeepLinkMatchIdLocal(matchId);'
);

// window.nav -> nav
code = code.replace(/window\.nav\(/g, 'nav(');

// selectBet for init - add function declaration
if (!code.includes('function selectBet(')) {
  code = code.replace(
    'window.selectBet = function(btn){',
    'function selectBet(btn){'
  );
}
code = code.replace(
  'window.onBsPlayerSearch=function(){',
  'function onBsPlayerSearch(){'
);

// Remove duplicate export block at end - keep single exports
code = code.replace(
  /export \{\s*renderC,[\s\S]*?getRemainingTime\s*\};\s*$/,
  `export {
  renderC,
  renderGridsBS,
  getRemainingTime
};
`
);

// Remove duplicate exports of renamed functions from broken export block - already export function

fs.writeFileSync(path.join(__dirname, '../js/app/challenges.js'), code);
console.log('fixed');
