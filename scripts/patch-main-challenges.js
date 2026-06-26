const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '../js/app/main.js');
const lines = fs.readFileSync(mainPath, 'utf8').split(/\r?\n/);

// 1-based inclusive ranges to DELETE (descending order to preserve indices)
const deleteRanges = [
  [3569, 3702],
  [3173, 3557],
  [1806, 3068],
  [1457, 1735],
  [1078, 1423],
  [788, 820],
  [672, 782],
  [609, 644],
  [516, 522],
  [462, 498],
  [300, 356],
  [209, 267],
  [162, 169],
  [119, 132],
  [113, 118],
  [108, 110],
];

let out = [...lines];
for (const [a, b] of deleteRanges) {
  out.splice(a - 1, b - a + 1);
}

let text = out.join('\n');

// Add challenges import after membersTab import
const importBlock = `import {
  initChallenges, TM, GM,
  renderC, renderGridsBS,
  isBSOpen, isBSFocused, isBsPlayerSearchActive, isBsFormInputFocused,
  deferBsGridRefresh, flushBsGridIfPending,
  applyChallengesSnapshotRender, handleDeepLink, shareFilterFor, scrollToChallenge,
  initBsPlayerSearchInputs, getChallengeFilter,
  getWizardChallengeState, setMy, setOpp, setChallengeType, getEditChId,
  getBsGameMode, isInstantCreateMode, mountInstantResultForm, unmountInstantResultForm,
  scrollBsStep, initResultForm, updateChSubmitBtn, nowDateTimeFields
} from './challenges.js?v=2026.06.25.09';
`;

if (!text.includes('challenges.js')) {
  text = text.replace(
    /from '\.\/membersTab\.js\?v=2026\.06\.25\.08';\n/,
    "from './membersTab.js?v=2026.06.25.08';\n" + importBlock
  );
}

// Fix state line
text = text.replace(
  /let db,_fbApp,MEMBERS=\[\],CHAL=\[\],NOTICES=\[\],BOARDS=\[\];\n/,
  "let db,_fbApp,MEMBERS=[],CHAL=[],NOTICES=[],BOARDS=[];\nlet _delId=null;\n"
);

// Remove OPEN_CHALLENGE from constants import if only used in challenges - keep for now

// Replace snapshot function name
text = text.replace(/_applyChallengesSnapshotRender\(\)/g, 'applyChallengesSnapshotRender()');
text = text.replace(/function _applyChallengesSnapshotRender\(\)\{[\s\S]*?\n\}/m, '');

// Replace BS helpers in flush pending
text = text.replace(/_isBSOpen\(\)/g, 'isBSOpen()');
text = text.replace(/_isBSFocused\(\)/g, 'isBSFocused()');
text = text.replace(/_isBsPlayerSearchActive\(\)/g, 'isBsPlayerSearchActive()');
text = text.replace(/_isBsFormInputFocused\(\)/g, 'isBsFormInputFocused()');
text = text.replace(/_deferBsGridRefresh\(\)/g, 'deferBsGridRefresh()');
text = text.replace(/_flushBsGridIfPending\(\)/g, 'flushBsGridIfPending()');
text = text.replace(/_shareFilterFor\(/g, 'shareFilterFor(');
text = text.replace(/_scrollToChallenge\(/g, 'scrollToChallenge(');
text = text.replace(/_applyDeepLinkFilter\(/g, 'applyDeepLinkFilter(');

// Remove _applyDeepLinkFilter function if still there
text = text.replace(/function _applyDeepLinkFilter\(chId\)\{[\s\S]*?\n\}\n/, '');

// Update header comment
text = text.replace(
  'rankingTab·membersTab·memberUtils 분리 (3차 리팩토링)',
  'challenges 분리 (4차 리팩토링)'
);

// initChallenges before initMembersTab - actually before wizard, after myPage
const initBlock = `  initChallenges({
    g:g,
    toast:window.toast,
    getDb:function(){return db;},
    getMembers:function(){return MEMBERS;},
    getChal:function(){return CHAL;},
    isAdmin:_isAdmin,
    requireAdmin:_requireAdmin,
    openMo:openMo,
    closeMo:closeMo,
    findMemberByName:_findMemberByName,
    lockBodyScroll:_lockBodyScroll,
    unlockBodyScroll:_unlockBodyScroll,
    scrollToElement:scrollToElement,
    waitForElement:waitForElement,
    isMobileUa:_isMobileUa,
    cssEscape:_cssEscape,
    getCurrentPage:function(){return _currentPage;},
    isScrolling:function(){return _isScrolling;},
    renderR:renderR,
    renderM:renderM,
    renderHall:renderHall,
    renderMyRecordHome:renderMyRecordHome,
    renderMyPage:renderMyPage,
    refreshPlayerProfileIfOpen:_refreshPlayerProfileIfOpen,
    nav:window.nav,
    myPointDeltaForResult:_myPointDeltaForResult,
    buildPostMatchCoachComment:_buildPostMatchCoachComment,
    showResultFeedback:showResultFeedback,
    showInstantRegisterSuccess:showInstantRegisterSuccess,
    markPendingChallengeRender:function(){_pendingRender.c=true;},
    markPendingDeepLink:function(){_pendingDeepLink=true;},
    getDeepLinkCh:function(){return _deepLinkCh;},
    setDeepLinkCh:function(v){_deepLinkCh=v;},
    getPendingDeepLinkFilter:function(){return _pendingDeepLinkFilter;},
    setPendingDeepLinkFilter:function(v){_pendingDeepLinkFilter=v;},
    isDeepLinkHandled:function(){return _deepLinkHandled;},
    setDeepLinkHandled:function(v){_deepLinkCh=v;},
    isDeepLinkInFlight:function(){return _deepLinkInFlight;},
    setDeepLinkInFlight:function(v){_deepLinkInFlight=v;},
    removeChallengeLocal:function(id){CHAL=CHAL.filter(function(c){return c.id!==id;});},
    unshiftChallengeLocal:function(c){CHAL.unshift(c);},
    updateChallengeLocal:function(id,patch){var t=CHAL.find(function(c){return c.id===id;});if(t)Object.assign(t,patch);},
    getBodyScrollLock:function(){return _bodyScrollLock;},
    $ko:$ko
  });
`;

if (!text.includes('initChallenges({')) {
  text = text.replace('  initMembersTab({', initBlock + '  initMembersTab({');
}

// Fix setDeepLinkHandled typo
text = text.replace(
  'setDeepLinkHandled:function(v){_deepLinkCh=v;}',
  'setDeepLinkHandled:function(v){_deepLinkHandled=v;}'
);

// Wizard init update
text = text.replace(
  /initWizard\(\{[\s\S]*?onMyPlayerChanged:function\(\)\{renderMyRecordHome\(\);renderMyPage\(\);renderChHomeShortcuts\(\);\},[\s\S]*?\}\);/,
  `initWizard({
    g,
    getMembers:function(){return MEMBERS;},
    getChal:function(){return CHAL;},
    TM,GM,
    toast:window.toast,
    openMo,closeMo,
    nav:window.nav,
    getState:getWizardChallengeState,
    setMy:setMy,
    setOpp:setOpp,
    setType:setChallengeType,
    getEditId:getEditChId,
    isInstantMode:isInstantCreateMode,
    mountInstantResultForm:mountInstantResultForm,
    unmountInstantResultForm:unmountInstantResultForm,
    scrollBsStep:scrollBsStep,
    initResultForm:initResultForm,
    getBsGameMode:getBsGameMode,
    computeDoublesRecord:_computeDoublesRecord,
    computeSinglesRecord:_computeSinglesRecord,
    computeCombinedRecord:_computeCombinedRecord,
    computeMemberBadges:_computeMemberBadges,
    buildMemberBadgesHtml:_buildMemberBadgesHtml,
    getMemberRankPosition:_getMemberRankPosition,
    nowDateTimeFields:nowDateTimeFields,
    updateChSubmitBtn:updateChSubmitBtn,
    renderMyExtrasHtml:_renderMyExtrasHtml,
    renderMyDashboardHtml:_renderMyDashboardHtml,
    hydrateMyWeeklyReport:function(){_hydrateMyWeeklyReport(false);},
    hydrateMyDailyBriefing:function(){_hydrateMyDailyBriefing(false);},
    renderEmptyState:renderEmptyState,
    openInstantBS:function(opts){window.openInstantBS(opts);},
    onMyPlayerChanged:function(){renderMyRecordHome();renderMyPage();renderChHomeShortcuts();},
    memberAvatarHtml:function(name,colorClass,extraClass,inlineStyle){
      return memberAvatarHtml(name,colorClass||'',extraClass||'',inlineStyle||'');
    }
  });`
);

text = text.replace('window.setF(_cf);', 'window.setF(getChallengeFilter());');

// Remove PT constant if orphaned - grep
text = text.replace(
  /const PT=\{individual:\{win:PT_INDIVIDUAL_WIN,loss:PT_INDIVIDUAL_LOSS\},double:\{win:PT_DOUBLE_WIN,loss:PT_DOUBLE_LOSS\}\};\n/,
  ''
);

// Remove unused constant imports from main if possible - skip for safety

fs.writeFileSync(mainPath, text);
console.log('main.js lines:', text.split('\n').length);
