/**
 * 모듈 초기화 오케스트레이션·앱 부트스트랩
 */
import { ensureLatestVersion, initPwa } from './pwa.js?v=2026.07.07.01';
import { initMemberPhotos, memberAvatarHtml, initMemberPhotoLightbox, isMemberPhotoLightboxOpen, closeMemberPhotoLightbox } from './memberPhotos.js?v=2026.07.07.01';
import {
  initWizard, checkMyPlayerSetup, initMyPlayerOnLoad, renderMyRecordHome,
  renderMyPage,
  isMyPlayerSetupMandatory, getMyPlayerId, getMyPlayerName, requireMyPlayer, isMyPlayerReady
} from './wizard.js?v=2026.07.07.01';
import { initMatchStats } from './matchStats.js?v=2026.07.07.01';
import { initHallReportCore } from './hallReportCore.js?v=2026.07.07.01';
import {
  initSeasons, _applySeasonsSnapshotRender, _renderSeasonList
} from './seasons.js?v=2026.07.07.01';
import { initHallTab, renderHall } from './hallTab.js?v=2026.07.07.01';
import { initStatsTab, getStatsSection, isStatsRankingView, isStatsClubView } from './statsTab.js?v=2026.07.07.01';
import { initVideosTab, renderVideos, handleLessonVideoDeepLink, handleMatchVideoDeepLink, refreshVideosViewBadges, onVideoModalClosed, clearVideosScrollAnchor, bootVideosDeepLinkSection } from './videosTab.js?v=2026.07.07.01';
import { peekBootVideoDeepLinkSection } from './videoDeepLink.js?v=2026.07.07.01';
import {
  initMyPage,
  _renderMyExtrasHtml, _renderMyDashboardHtml,
  _hydrateMyWeeklyReport, _hydrateMyDailyBriefing, _hydrateOpponentAnalysis,
  _hydrateMyAiCards,
  _buildPostMatchCoachComment, _myPointDeltaForResult,
  showResultFeedback, showInstantRegisterSuccess
} from './myPage.js?v=2026.07.07.01';
import { gradeAvatarStyle } from './memberUtils.js?v=2026.07.07.01';
import { initRankingTab, renderR, setRkScope, setRk, getRkMode } from './rankingTab.js?v=2026.07.07.01';
import {
  initMembersTab, renderM, getRecommendedOpponents, _refreshPlayerProfileIfOpen
} from './membersTab.js?v=2026.07.07.01';
import {
  initChallenges, TM, GM,
  renderC, renderGridsBS,
  isBSOpen, handleBsBackPress, isBSFocused, isBsPlayerSearchActive, isBsFormInputFocused,
  deferBsGridRefresh, flushBsGridIfPending,
  applyChallengesSnapshotRender, handleDeepLink,
  initBsPlayerSearchInputs, getChallengeFilter,
  getWizardChallengeState, setMy, setOpp, setChallengeType, getEditChId,
  getBsGameMode, isInstantCreateMode, mountInstantResultForm, unmountInstantResultForm,
  scrollBsStep, initResultForm, updateChSubmitBtn, nowDateTimeFields
} from './challenges.js?v=2026.07.07.01';
import { initModals, openMo, closeMo } from './modals.js?v=2026.07.07.01';
import { initAdminTab, isAdmin, requireAdmin, applyAdminUI, onAdminModalClosed } from './adminTab.js?v=2026.07.07.01';
import {
  initPlayerPresence, startPlayerPresenceTracking, touchPlayerPresence
} from './playerPresence.js?v=2026.07.07.01';
import { initNoticesBoards } from './noticesBoards.js?v=2026.07.07.01';
import { initAppNav, applyEntryNavigation } from './appNav.js?v=2026.07.07.01';
import { initAttendance, initAttendancePage, renderAttendanceMembers } from './attendance.js?v=2026.07.07.01';
import { initBackNav, registerOverlay, unregisterOverlay } from './backNav.js?v=2026.07.07.01';
import {
  initCustomSelects, watchCustomSelects, setCustomSelectBackNav,
  isCustomSelectOpen, closeCustomSelectPanel
} from './customSelect.js?v=2026.07.07.01';
import {
  g, toast, $ko, renderEmptyState, scrollToElement, scrollChManageIntoView, waitForElement,
  cssEscape, isMobileUa, lockBodyScroll, unlockBodyScroll, getBodyScrollLock,
  initAppCore, initVersionUI
} from './appCore.js?v=2026.07.07.01';
import {
  initFirebase, getDb, getMembers, getChal, getNotices, getBoards, getSeasons, getTournaments, getVideos,
  findMemberByName,
  removeMemberLocal, removeChallengeLocal, unshiftChallengeLocal, updateChallengeLocal,
  unshiftNoticeLocal, updateNoticeLocal, removeNoticeLocal,
  unshiftBoardLocal, updateBoardLocal, removeBoardLocal,
  unshiftVideoLocal, removeVideoLocal,
  bumpVideoViewLocal, bumpChallengeVideoViewLocal
} from './firebaseApp.js?v=2026.07.07.01';
import { initVideoViews } from './videoViews.js?v=2026.07.07.01';
import { initVideoViewLogs } from './videoViewLogs.js?v=2026.07.07.01';
import {
  initScrollBridge, applyMembersSnapshotRender, isScrolling,
  markPendingChallengeRender, markPendingDeepLink, markPendingSeasonRender
} from './scrollBridge.js?v=2026.07.07.01';
import {
  _computeDoublesRecord, _computeSinglesRecord, _computeCombinedRecord,
  _computeMemberBadges, _buildMemberBadgesHtml, _getMemberRankPosition
} from './matchStats.js?v=2026.07.07.01';

let _delId = null;
let _hallMode = 'double';
let _myDashMode = 'double';
let _currentPage = 'challenge';
let _deepLinkCh = null;
let _pendingDeepLinkFilter = null;
let _deepLinkHandled = false;
let _deepLinkInFlight = false;

function memberAv(name, colorClass, extraClass, inlineStyle) {
  return memberAvatarHtml(name, colorClass || '', extraClass || '', inlineStyle || '');
}

function refreshAfterMemberPhotos() {
  if (_currentPage === 'members') renderM();
  if (_currentPage === 'stats') {
    if (getStatsSection() === 'ranking') renderR();
    else if (getStatsSection() === 'coaching') renderMyPage();
    else if (getStatsSection() === 'club') renderHall();
  }
  if (_currentPage === 'challenge') renderMyRecordHome();
  _refreshPlayerProfileIfOpen();
}

function initUxDefaults() {
  setRkScope('season');
  setRk('double');
  var hallDbl = g('hall-dbl'), hallInd = g('hall-ind');
  if (hallDbl) hallDbl.classList.toggle('on', _hallMode === 'double');
  if (hallInd) hallInd.classList.toggle('on', _hallMode === 'individual');
}

function applyBootVideoDeepLinkPage() {
  if (!peekBootVideoDeepLinkSection()) return;
  _currentPage = 'videos';
  bootVideosDeepLinkSection();
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.toggle('on', p.id === 'page-videos');
  });
  document.querySelectorAll('.bni').forEach(function(n) {
    n.classList.toggle('on', n.dataset.p === 'videos');
  });
  document.querySelectorAll('.nav-i').forEach(function(n) {
    n.classList.toggle('on', n.dataset.page === 'videos');
  });
  document.body.classList.remove('has-fab');
}

function finish() {
  try {
    applyBootVideoDeepLinkPage();
    g('ls').style.display = 'none';
    g('app').style.display = 'flex';
    var sb = g('sidebar');
    if (sb) sb.style.display = '';

    initMatchStats({
      getChal: getChal,
      getMembers: getMembers,
      getSeasons: getSeasons,
      getTournaments: getTournaments
    });
    initHallReportCore({
      getChal: getChal,
      getMembers: getMembers
    });
    initModals({
      g: g,
      lockBodyScroll: lockBodyScroll,
      unlockBodyScroll: unlockBodyScroll,
      onModalClosed: function(id) {
        onAdminModalClosed(id);
        onVideoModalClosed(id);
      }
    });
    initAppNav({
      g: g,
      getCurrentPage: function() { return _currentPage; },
      setCurrentPage: function(id) { _currentPage = id; },
      setDeepLinkCh: function(v) { _deepLinkCh = v; },
      setPendingDeepLinkFilter: function(v) { _pendingDeepLinkFilter = v; },
      renderC: renderC,
      renderM: renderM,
      renderR: renderR,
      renderHall: renderHall,
      renderMyPage: renderMyPage,
      initAttendancePage: initAttendancePage,
      requireMyPlayer: requireMyPlayer,
      alignHallModeFromRanking: function() {
        var rk = getRkMode();
        if (rk === 'double' || rk === 'individual') _hallMode = rk;
      }
    });
    initStatsTab({
      g: g,
      renderR: renderR,
      renderMyPage: renderMyPage,
      renderHall: renderHall,
      alignHallModeFromRanking: function() {
        var rk = getRkMode();
        if (rk === 'double' || rk === 'individual') _hallMode = rk;
      },
      requireMyPlayer: requireMyPlayer
    });
    initVideosTab({
      g: g,
      toast: toast,
      getDb: getDb,
      getChal: getChal,
      getVideos: getVideos,
      getMembers: getMembers,
      getMyPlayerId: getMyPlayerId,
      isMyPlayerReady: isMyPlayerReady,
      memberAvatarHtml: memberAvatarHtml,
      openMo: openMo,
      closeMo: closeMo,
      unshiftVideoLocal: unshiftVideoLocal,
      removeVideoLocal: removeVideoLocal,
      scrollToElement: scrollToElement,
      nav: function(id, section) { window.nav(id, section); },
      isDeepLinkHandled: function() { return _deepLinkHandled; },
      setDeepLinkHandled: function(v) { _deepLinkHandled = v; },
      isDeepLinkInFlight: function() { return _deepLinkInFlight; },
      setDeepLinkInFlight: function(v) { _deepLinkInFlight = v; }
    });
    initVideoViewLogs({
      g: g,
      toast: toast,
      getDb: getDb,
      getVideos: getVideos,
      getMyPlayerName: getMyPlayerName,
      openMo: openMo,
      closeMo: closeMo
    });
    initVideoViews({
      getDb: getDb,
      bumpVideoViewLocal: bumpVideoViewLocal,
      bumpChallengeVideoViewLocal: bumpChallengeVideoViewLocal,
      onVideoViewsChanged: function() {
        if (_currentPage === 'videos') refreshVideosViewBadges();
      }
    });
    initBackNav({
      g: g,
      nav: function(id, fromBack) { window.nav(id, fromBack); },
      openMo: openMo,
      closeMo: function(id) { closeMo(id); },
      isLightboxOpen: isMemberPhotoLightboxOpen,
      closeLightbox: function() { closeMemberPhotoLightbox(); },
      isCustomSelectOpen: isCustomSelectOpen,
      closeCustomSelectPanel: closeCustomSelectPanel,
      handleBsBackPress: handleBsBackPress,
      isBSOpen: isBSOpen,
      closeBottomSheet: function() { window.closeBS(); },
      isMyPlayerMandatory: isMyPlayerSetupMandatory
    });
    setCustomSelectBackNav({ registerOverlay: registerOverlay, unregisterOverlay: unregisterOverlay });
    initCustomSelects();
    watchCustomSelects();
    initAdminTab({
      g: g,
      toast: toast,
      openMo: openMo,
      closeMo: closeMo,
      nav: window.nav,
      getCurrentPage: function() { return _currentPage; },
      isStatsRankingView: function() { return isStatsRankingView(_currentPage); },
      renderC: renderC,
      renderM: renderM,
      renderR: renderR,
      renderHall: renderHall,
      renderVideos: renderVideos,
      renderSeasonList: _renderSeasonList
    });
    initPlayerPresence({
      g: g,
      getDb: getDb,
      getMyPlayerId: getMyPlayerId,
      getMyPlayerName: getMyPlayerName,
      isAdmin: isAdmin,
      getCurrentPage: function() { return _currentPage; }
    });
    initNoticesBoards({
      g: g,
      toast: toast,
      getDb: getDb,
      getNotices: getNotices,
      getBoards: getBoards,
      openMo: openMo,
      closeMo: closeMo,
      unshiftNoticeLocal: unshiftNoticeLocal,
      updateNoticeLocal: updateNoticeLocal,
      removeNoticeLocal: removeNoticeLocal,
      unshiftBoardLocal: unshiftBoardLocal,
      updateBoardLocal: updateBoardLocal,
      removeBoardLocal: removeBoardLocal
    });
    initChallenges({
      g: g,
      toast: toast,
      getDb: getDb,
      getMembers: getMembers,
      getChal: getChal,
      isAdmin: isAdmin,
      requireAdmin: requireAdmin,
      openMo: openMo,
      closeMo: closeMo,
      findMemberByName: findMemberByName,
      lockBodyScroll: lockBodyScroll,
      unlockBodyScroll: unlockBodyScroll,
      scrollToElement: scrollToElement,
      scrollChManageIntoView: scrollChManageIntoView,
      waitForElement: waitForElement,
      isMobileUa: isMobileUa,
      cssEscape: cssEscape,
      getCurrentPage: function() { return _currentPage; },
      isStatsRankingView: function() { return isStatsRankingView(_currentPage); },
      isStatsClubView: function() { return isStatsClubView(_currentPage); },
      isScrolling: isScrolling,
      renderR: renderR,
      renderM: renderM,
      renderHall: renderHall,
      renderMyPage: renderMyPage,
      renderVideos: renderVideos,
      refreshPlayerProfileIfOpen: _refreshPlayerProfileIfOpen,
      nav: window.nav,
      myPointDeltaForResult: _myPointDeltaForResult,
      buildPostMatchCoachComment: _buildPostMatchCoachComment,
      showResultFeedback: showResultFeedback,
      showInstantRegisterSuccess: showInstantRegisterSuccess,
      markPendingChallengeRender: markPendingChallengeRender,
      markPendingDeepLink: markPendingDeepLink,
      getDeepLinkCh: function() { return _deepLinkCh; },
      setDeepLinkCh: function(v) { _deepLinkCh = v; },
      getPendingDeepLinkFilter: function() { return _pendingDeepLinkFilter; },
      setPendingDeepLinkFilter: function(v) { _pendingDeepLinkFilter = v; },
      isDeepLinkHandled: function() { return _deepLinkHandled; },
      setDeepLinkHandled: function(v) { _deepLinkHandled = v; },
      isDeepLinkInFlight: function() { return _deepLinkInFlight; },
      setDeepLinkInFlight: function(v) { _deepLinkInFlight = v; },
      handleLessonVideoDeepLink: handleLessonVideoDeepLink,
      handleMatchVideoDeepLink: handleMatchVideoDeepLink,
      removeChallengeLocal: removeChallengeLocal,
      unshiftChallengeLocal: unshiftChallengeLocal,
      updateChallengeLocal: updateChallengeLocal,
      getBodyScrollLock: getBodyScrollLock,
      $ko: $ko
    });
    applyAdminUI();
    initBsPlayerSearchInputs();
    initVersionUI();
    initPwa();
    initMemberPhotoLightbox();
    initMemberPhotos(true).then(function() { refreshAfterMemberPhotos(); });
    initMembersTab({
      g: g,
      toast: toast,
      getDb: getDb,
      getMembers: getMembers,
      getChal: getChal,
      isAdmin: isAdmin,
      requireAdmin: requireAdmin,
      openMo: openMo,
      closeMo: closeMo,
      memberAv: memberAv,
      hydrateOpponentAnalysis: _hydrateOpponentAnalysis,
      getDelId: function() { return _delId; },
      setDelId: function(id) { _delId = id; },
      removeMemberLocal: removeMemberLocal
    });
    initRankingTab({
      g: g,
      getMembers: getMembers,
      memberAv: memberAv,
      renderEmptyState: renderEmptyState,
      scrollToElement: scrollToElement
    });
    initSeasons({
      g: g,
      toast: toast,
      getDb: getDb,
      getSeasons: getSeasons,
      getMembers: getMembers,
      isAdmin: isAdmin,
      requireAdmin: requireAdmin,
      openMo: openMo,
      closeMo: closeMo,
      isScrolling: isScrolling,
      markPendingSeasonRender: markPendingSeasonRender,
      getCurrentPage: function() { return _currentPage; },
      isStatsRankingView: function() { return isStatsRankingView(_currentPage); },
      isStatsClubView: function() { return isStatsClubView(_currentPage); },
      renderR: renderR,
      renderHall: renderHall,
      refreshPlayerProfileIfOpen: _refreshPlayerProfileIfOpen
    });
    initHallTab({
      g: g,
      getMembers: getMembers,
      getChal: getChal,
      getSeasons: getSeasons,
      getHallMode: function() { return _hallMode; },
      setHallMode: function(m) { _hallMode = m; },
      renderEmptyState: renderEmptyState
    });
    initMyPage({
      g: g,
      getMembers: getMembers,
      getChal: getChal,
      getMyDashMode: function() { return _myDashMode; },
      setMyDashMode: function(m) { _myDashMode = m; },
      memberAv: memberAv,
      gradeAvatarStyle: gradeAvatarStyle,
      getRecommendedOpponents: getRecommendedOpponents,
      renderMyPage: renderMyPage
    });
    initAttendance({
      g: g,
      toast: toast,
      getDb: getDb,
      getMembers: getMembers,
      getCurrentPage: function() { return _currentPage; }
    });
    initWizard({
      g: g,
      getMembers: getMembers,
      getChal: getChal,
      TM: TM,
      GM: GM,
      toast: toast,
      openMo: openMo,
      closeMo: closeMo,
      nav: window.nav,
      getState: getWizardChallengeState,
      setMy: setMy,
      setOpp: setOpp,
      setType: setChallengeType,
      getEditId: getEditChId,
      isInstantMode: isInstantCreateMode,
      mountInstantResultForm: mountInstantResultForm,
      unmountInstantResultForm: unmountInstantResultForm,
      scrollBsStep: scrollBsStep,
      initResultForm: initResultForm,
      getBsGameMode: getBsGameMode,
      computeDoublesRecord: _computeDoublesRecord,
      computeSinglesRecord: _computeSinglesRecord,
      computeCombinedRecord: _computeCombinedRecord,
      computeMemberBadges: _computeMemberBadges,
      buildMemberBadgesHtml: _buildMemberBadgesHtml,
      getMemberRankPosition: _getMemberRankPosition,
      nowDateTimeFields: nowDateTimeFields,
      updateChSubmitBtn: updateChSubmitBtn,
      renderMyExtrasHtml: _renderMyExtrasHtml,
      renderMyDashboardHtml: _renderMyDashboardHtml,
      hydrateMyWeeklyReport: function() { _hydrateMyWeeklyReport(false); },
      hydrateMyDailyBriefing: function() { _hydrateMyDailyBriefing(false); },
      hydrateMyAiCards: function() { _hydrateMyAiCards(); },
      renderEmptyState: renderEmptyState,
      openInstantBS: function(opts) { window.openInstantBS(opts); },
      onMyPlayerChanged: function() {
        renderMyPage();
        if (_currentPage === 'videos') renderVideos();
        touchPlayerPresence();
      },
      memberAvatarHtml: function(name, colorClass, extraClass, inlineStyle) {
        return memberAvatarHtml(name, colorClass || '', extraClass || '', inlineStyle || '');
      }
    });
    applyEntryNavigation();
    handleLessonVideoDeepLink();
    handleMatchVideoDeepLink();
    initUxDefaults();
    initMyPlayerOnLoad();
    startPlayerPresenceTracking();
    window.setF(getChallengeFilter());
    document.body.classList.toggle('has-fab', _currentPage === 'challenge');
  } catch (e) {
    console.error('[이사탁] finish error:', e);
    try {
      var ls = g('ls'), app = g('app');
      if (ls) ls.style.display = 'none';
      if (app) app.style.display = 'flex';
    } catch (e2) {}
    toast('⚠️ 초기화 오류 — 새로고침 해주세요');
  }
}

function wireScrollBridge() {
  initScrollBridge({
    getCurrentPage: function() { return _currentPage; },
    getMembers: getMembers,
    checkMyPlayerSetup: checkMyPlayerSetup,
    isStatsRankingView: function() { return isStatsRankingView(_currentPage); },
    isStatsClubView: function() { return isStatsClubView(_currentPage); },
    isVideosPage: function() { return _currentPage === 'videos'; },
    renderM: renderM,
    renderR: renderR,
    renderHall: renderHall,
    renderVideos: renderVideos,
    renderAttendanceMembers: renderAttendanceMembers,
    renderC: renderC,
    renderGridsBS: renderGridsBS,
    isBSOpen: isBSOpen,
    isBSFocused: isBSFocused,
    isBsPlayerSearchActive: isBsPlayerSearchActive,
    isBsFormInputFocused: isBsFormInputFocused,
    deferBsGridRefresh: deferBsGridRefresh,
    applySeasonsSnapshotRender: _applySeasonsSnapshotRender,
    handleDeepLink: handleDeepLink,
    isDeepLinkHandled: function() { return _deepLinkHandled; }
  });
}

export function bootApp() {
  initAppCore();
  wireScrollBridge();
  initFirebase({
    onMembers: applyMembersSnapshotRender,
    onChallenges: applyChallengesSnapshotRender,
    onSeasons: _applySeasonsSnapshotRender,
    onTournaments: function() {
      if (isStatsClubView(_currentPage)) renderHall();
      _refreshPlayerProfileIfOpen();
    },
    onVideos: function() {
      if (_currentPage === 'videos') renderVideos();
      handleLessonVideoDeepLink();
      handleMatchVideoDeepLink();
    },
    onReady: finish
  });
}

export function startApp() {
  var started = false;
  function bootOnce() {
    if (started) return;
    started = true;
    bootApp();
  }
  setTimeout(bootOnce, 8000);
  ensureLatestVersion().catch(function() { return null; }).then(bootOnce);
}
