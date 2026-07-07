/**
 * AI 영상 분석 페이지 부트스트랩 (4단계)
 * MediaPipe + Gemini + Firebase 저장 + 영상 등록 + 분석 이력
 */
import {
  AI_ANALYSIS_ELIGIBLE_TYPES, VIDEO_FILTER_CHALLENGE
} from '../js/app/constants.js?v=2026.07.07.04';
import { extractYouTubeVideoId, buildYouTubeEmbedUrl } from '../js/app/youtubeUtils.js?v=2026.07.07.04';
import { PoseAnalyzer } from '../ai/poseAnalyzer.js?v=2026.07.07.04';
import { analyzeTableTennisPose } from '../ai/tableTennisAnalyzer.js?v=2026.07.07.04';
import { buildAnalysisResult } from '../ai/scoreCalculator.js?v=2026.07.07.04';
import { generateCoachComment } from '../ai/aiProviderFactory.js?v=2026.07.07.04';
import {
  renderAnalysisReportCard, renderLoadingCard, renderPlaceholderCard
} from '../ai/reportGenerator.js?v=2026.07.07.04';
import { renderAnalysisHistoryList } from '../ai/analysisHistoryUi.js?v=2026.07.07.04';
import {
  renderRegisterFormHtml, bindMemberChipToggle
} from '../ai/registerPanelUi.js?v=2026.07.07.04';
import {
  initAiAnalysisFirebase,
  fetchMembersForAi,
  fetchCompletedChallengesForAi
} from '../firebase/aiAnalysisFirebase.js?v=2026.07.07.04';
import {
  saveAnalysis, listRecentAnalyses, ANALYSIS_STATUS
} from '../firebase/aiAnalysisRepository.js?v=2026.07.07.04';
import {
  registerClubVideo, registerMatchVideo
} from '../firebase/videoRegisterService.js?v=2026.07.07.04';

const ADMIN_STORAGE_KEY = 'isatok_admin';
const poseAnalyzer = new PoseAnalyzer();

/** @type {string} */
let selectedType = AI_ANALYSIS_ELIGIBLE_TYPES[1];

/** @type {boolean} */
let isAnalyzing = false;

/** @type {boolean} */
let isSaving = false;

/** @type {File|null} */
let selectedLocalFile = null;

/** @type {object|null} */
let pendingAnalysis = null;

/** @type {{ id: string, name: string }[]} */
let membersCache = [];

/** @type {object[]} */
let challengesCache = [];

/** @type {string[]} */
let registerMemberIds = [];

// ── 관리자 게이트 ─────────────────────────────────────

function isAdmin() {
  try { return localStorage.getItem(ADMIN_STORAGE_KEY) === '1'; } catch (e) { return false; }
}

function showGate() {
  document.getElementById('ai-gate').hidden = false;
  document.getElementById('ai-app').hidden = true;
}

function showApp() {
  document.getElementById('ai-gate').hidden = true;
  document.getElementById('ai-app').hidden = false;
}

// ── 토스트 ─────────────────────────────────────────────

let _toastTimer = null;

function toast(msg) {
  var el = document.getElementById('ai-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.remove('on'); }, 3200);
}

function setLoadingMessage(msg) {
  var el = document.getElementById('ai-loading-msg');
  if (el) el.textContent = msg;
}

// ── 영상 종류 선택 ─────────────────────────────────────

function renderTypePick() {
  var box = document.getElementById('ai-type-pick');
  if (!box) return;
  box.innerHTML = AI_ANALYSIS_ELIGIBLE_TYPES.map(function(type) {
    var on = type === selectedType ? ' on' : '';
    return '<button type="button" class="ai-type-chip' + on + '" data-type="' + type + '">' + type + '</button>';
  }).join('');

  box.querySelectorAll('.ai-type-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      selectedType = chip.getAttribute('data-type') || AI_ANALYSIS_ELIGIBLE_TYPES[0];
      renderTypePick();
      if (pendingAnalysis) showRegisterSection();
    });
  });
}

// ── 로컬 파일 선택 ─────────────────────────────────────

function updateLocalFileLabel() {
  var nameEl = document.getElementById('ai-local-file-name');
  if (!nameEl) return;
  if (selectedLocalFile) {
    nameEl.hidden = false;
    nameEl.textContent = '📁 ' + selectedLocalFile.name;
  } else {
    nameEl.hidden = true;
    nameEl.textContent = '';
  }
}

// ── YouTube 미리보기 ───────────────────────────────────

function updatePreview() {
  var urlEl = document.getElementById('ai-youtube-url');
  var preview = document.getElementById('ai-preview');
  var analyzeBtn = document.getElementById('btn-ai-analyze');
  if (!urlEl || !preview) return;

  var url = urlEl.value.trim();
  var videoId = extractYouTubeVideoId(url);
  var canAnalyze = (!!videoId || !!selectedLocalFile) && !isAnalyzing && !isSaving;

  if (analyzeBtn) analyzeBtn.disabled = !canAnalyze;

  if (!videoId) {
    preview.className = 'ai-preview ai-preview--empty';
    preview.innerHTML = url
      ? '유효하지 않은 유튜브 URL입니다'
      : (selectedLocalFile ? '로컬 파일로 분석할 수 있습니다' : 'URL을 입력하면 미리보기가 표시됩니다');
    return;
  }

  var embedUrl = buildYouTubeEmbedUrl(videoId);
  preview.className = 'ai-preview';
  preview.innerHTML = '<iframe src="' + embedUrl + '" title="영상 미리보기" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
}

// ── 분석 이력 ─────────────────────────────────────────

async function loadAnalysisHistory() {
  var listEl = document.getElementById('ai-history-list');
  var emptyEl = document.getElementById('ai-history-empty');
  if (!listEl || !emptyEl) return;

  try {
    var db = initAiAnalysisFirebase();
    var items = await listRecentAnalyses(db, 20);
    if (!items.length) {
      emptyEl.hidden = false;
      listEl.innerHTML = '';
      return;
    }
    emptyEl.hidden = true;
    listEl.innerHTML = renderAnalysisHistoryList(items);
  } catch (e) {
    emptyEl.hidden = false;
    emptyEl.textContent = '이력을 불러오지 못했습니다';
    listEl.innerHTML = '';
  }
}

// ── 등록 패널 ─────────────────────────────────────────

async function ensureRegisterData() {
  if (!membersCache.length) {
    membersCache = await fetchMembersForAi();
  }
  if (!challengesCache.length) {
    challengesCache = await fetchCompletedChallengesForAi(80);
  }
}

function showRegisterSection() {
  var section = document.getElementById('ai-register-section');
  var form = document.getElementById('ai-register-form');
  if (!section || !form || !pendingAnalysis) return;

  section.hidden = false;
  registerMemberIds = [];

  ensureRegisterData().then(function() {
    form.innerHTML = renderRegisterFormHtml({
      videoType: selectedType,
      members: membersCache,
      challenges: challengesCache
    });

    if (selectedType !== VIDEO_FILTER_CHALLENGE) {
      bindMemberChipToggle(registerMemberIds, function(ids) {
        registerMemberIds = ids;
      });
    }

    var saveBtn = document.getElementById('btn-ai-save-register');
    if (saveBtn) saveBtn.addEventListener('click', saveAnalysisAndRegister);
  }).catch(function(err) {
    form.innerHTML = '<p class="ai-report__placeholder-text">등록 폼 로드 실패: '
      + (err.message || '') + '</p>';
  });
}

function hideRegisterSection() {
  var section = document.getElementById('ai-register-section');
  if (section) section.hidden = true;
  pendingAnalysis = null;
}

// ── Firebase 저장 + 영상 등록 ─────────────────────────

async function saveAnalysisAndRegister() {
  if (!pendingAnalysis || isSaving) return;

  var urlEl = document.getElementById('ai-youtube-url');
  var youtubeUrl = urlEl ? urlEl.value.trim() : '';
  if (!extractYouTubeVideoId(youtubeUrl)) {
    toast('⚠️ 영상 등록에는 유효한 유튜브 URL이 필요합니다');
    return;
  }

  isSaving = true;
  var saveBtn = document.getElementById('btn-ai-save-register');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
  }

  try {
    var db = initAiAnalysisFirebase();
    var sourceVideoId = null;
    var sourceChallengeId = null;

    if (selectedType === VIDEO_FILTER_CHALLENGE) {
      var chEl = document.getElementById('ai-register-challenge');
      var challengeId = chEl ? chEl.value : '';
      sourceChallengeId = await registerMatchVideo(db, {
        challengeId: challengeId,
        youtubeUrl: youtubeUrl
      });
    } else {
      var memberNames = registerMemberIds.map(function(mid) {
        var m = membersCache.find(function(x) { return x.id === mid; });
        return m ? m.name : '';
      }).filter(Boolean);
      var descEl = document.getElementById('ai-register-desc');
      var description = descEl ? descEl.value : '';

      sourceVideoId = await registerClubVideo(db, {
        youtubeUrl: youtubeUrl,
        category: selectedType,
        memberIds: registerMemberIds,
        memberNames: memberNames,
        description: description,
        date: ''
      });
    }

    await saveAnalysis(db, {
      youtubeUrl: youtubeUrl,
      videoType: selectedType,
      sourceVideoId: sourceVideoId,
      sourceChallengeId: sourceChallengeId,
      analysisStatus: pendingAnalysis.analysisStatus,
      totalScore: pendingAnalysis.totalScore,
      forehand: pendingAnalysis.forehand,
      backhand: pendingAnalysis.backhand,
      footwork: pendingAnalysis.footwork,
      readyPosition: pendingAnalysis.readyPosition,
      balance: pendingAnalysis.balance,
      recommendedTraining: pendingAnalysis.recommendedTraining,
      coachComment: pendingAnalysis.coachComment
    });

    toast('✅ 분석 저장 및 영상 등록 완료');
    hideRegisterSection();
    await loadAnalysisHistory();
  } catch (err) {
    toast('❌ ' + (err.message || '저장 실패'));
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ 분석 저장 + 영상 등록';
    }
  } finally {
    isSaving = false;
    updatePreview();
  }
}

// ── AI 분석 파이프라인 ─────────────────────────────────

async function runAnalysis() {
  if (isAnalyzing) return;

  var urlEl = document.getElementById('ai-youtube-url');
  var reportArea = document.getElementById('ai-report-area');
  var analyzeBtn = document.getElementById('btn-ai-analyze');
  if (!urlEl || !reportArea) return;

  var youtubeUrl = urlEl.value.trim();
  var videoId = extractYouTubeVideoId(youtubeUrl);

  if (!videoId && !selectedLocalFile) {
    toast('⚠️ 유튜브 URL 또는 분석용 영상 파일이 필요합니다');
    return;
  }

  hideRegisterSection();
  isAnalyzing = true;
  if (analyzeBtn) analyzeBtn.disabled = true;
  reportArea.innerHTML = renderLoadingCard('MediaPipe 준비 중…');

  try {
    var poseResult = await poseAnalyzer.analyzeVideo({
      youtubeUrl: youtubeUrl,
      localFile: selectedLocalFile,
      onProgress: function(info) {
        if (info.message) setLoadingMessage(info.message);
      }
    });

    var techniqueScores = analyzeTableTennisPose(poseResult.frames);
    var result = buildAnalysisResult(techniqueScores);

    setLoadingMessage('Gemini 코치 코멘트 생성 중…');

    var coachComment = '';
    var recommendedTraining = result.recommendedTraining;
    var geminiOk = false;

    try {
      var aiResult = await generateCoachComment({
        totalScore: result.totalScore,
        forehand: result.forehand,
        backhand: result.backhand,
        footwork: result.footwork,
        readyPosition: result.readyPosition,
        balance: result.balance,
        recommendedTraining: result.recommendedTraining,
        videoType: selectedType,
        frameCount: poseResult.frameCount,
        landmarkCount: poseResult.landmarkCount
      });
      coachComment = aiResult.coachComment;
      if (aiResult.recommendedTraining) {
        recommendedTraining = aiResult.recommendedTraining;
      }
      geminiOk = true;
    } catch (aiErr) {
      coachComment = '포즈 분석은 완료됐지만 AI 코멘트 생성에 실패했습니다. '
        + '잠시 후 다시 시도해 주세요.';
      toast('⚠️ Gemini: ' + (aiErr.message || '코멘트 생성 실패'));
    }

    pendingAnalysis = {
      totalScore: result.totalScore,
      forehand: result.forehand,
      backhand: result.backhand,
      footwork: result.footwork,
      readyPosition: result.readyPosition,
      balance: result.balance,
      recommendedTraining: recommendedTraining,
      coachComment: coachComment,
      analysisStatus: geminiOk ? ANALYSIS_STATUS.COMPLETED : ANALYSIS_STATUS.ERROR
    };

    reportArea.innerHTML = renderAnalysisReportCard({
      totalScore: result.totalScore,
      forehand: result.forehand,
      backhand: result.backhand,
      footwork: result.footwork,
      readyPosition: result.readyPosition,
      balance: result.balance,
      recommendedTraining: recommendedTraining,
      coachComment: coachComment,
      analysisStatus: pendingAnalysis.analysisStatus,
      frameCount: poseResult.frameCount,
      landmarkCount: poseResult.landmarkCount,
      sourceKind: poseResult.sourceKind,
      geminiComment: geminiOk
    });

    showRegisterSection();

    toast(geminiOk
      ? '✅ 분석 완료 — 아래에서 등록하세요'
      : '✅ 포즈 분석 완료 — 코멘트 생성 실패');
  } catch (err) {
    reportArea.innerHTML = renderPlaceholderCard();
    var msg = err && err.message ? err.message : '분석 실패';
    toast('❌ ' + msg);
    if (msg.indexOf('분석용 영상 파일') >= 0 || msg.indexOf('CORS') >= 0) {
      var fileInput = document.getElementById('ai-local-video');
      if (fileInput) fileInput.focus();
    }
  } finally {
    isAnalyzing = false;
    updatePreview();
  }
}

// ── 초기화 ─────────────────────────────────────────────

async function init() {
  if (!isAdmin()) {
    showGate();
    return;
  }

  showApp();
  renderTypePick();

  var reportArea = document.getElementById('ai-report-area');
  if (reportArea) reportArea.innerHTML = renderPlaceholderCard();

  var urlEl = document.getElementById('ai-youtube-url');
  if (urlEl) {
    urlEl.addEventListener('input', updatePreview);
    urlEl.addEventListener('change', updatePreview);
  }

  var fileEl = document.getElementById('ai-local-video');
  if (fileEl) {
    fileEl.addEventListener('change', function() {
      selectedLocalFile = fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
      updateLocalFileLabel();
      updatePreview();
    });
  }

  var analyzeBtn = document.getElementById('btn-ai-analyze');
  if (analyzeBtn) analyzeBtn.addEventListener('click', runAnalysis);

  try {
    initAiAnalysisFirebase();
    await loadAnalysisHistory();
  } catch (e) {
    /* Firebase 연결 실패 시 분석·저장 시 재시도 */
  }

  updatePreview();
}

init();
