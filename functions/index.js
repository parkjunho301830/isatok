const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash-lite";

setGlobalOptions({maxInstances: 10, region: "asia-northeast3"});

/**
 * @param {string} apiKey
 * @param {string} prompt
 * @return {Promise<string>}
 */
async function callGemini(apiKey, prompt) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${GEMINI_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.7,
      },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const candidates = data.candidates || [];
  const parts = (candidates[0] && candidates[0].content &&
    candidates[0].content.parts) || [];
  const text = parts[0] && parts[0].text;
  if (!text) {
    throw new Error("Empty Gemini response");
  }
  return text;
}

/**
 * @param {string} raw
 * @param {object} fallback
 * @return {object}
 */
function parseJsonResponse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {/* fallback */}
  return fallback;
}

/**
 * @param {function} handler
 * @return {function}
 */
function aiHandler(handler) {
  return onRequest({secrets: [geminiApiKey], cors: true}, async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "POST only"});
      return;
    }
    try {
      await handler(req, res, geminiApiKey.value());
    } catch (err) {
      logger.error("AI handler failed", err);
      res.status(500).json({error: "ai_failed"});
    }
  });
}

exports.weeklyCoachReport = aiHandler(async (req, res, apiKey) => {
  const {memberName, statsSummary} = req.body || {};
  if (!memberName || !statsSummary) {
    res.status(400).json({error: "memberName and statsSummary required"});
    return;
  }
  const prompt =
    "당신은 탁구 동호회 전문 코치이자 스포츠 매거진 에디터입니다.\n" +
    `${memberName} 선수의 이번 주 기록을 바탕으로 ` +
    "개인 맞춤 주간 리포트를 한국어로 작성하세요.\n\n" +
    "규칙: JSON만 출력 (마크다운·코드블록 없음)\n" +
    "{\"badge\":\"🔥\",\"weekTag\":\"연승 질주\"," +
    "\"headline\":\"12자 이내\",\"highlight\":\"핵심 수치 한 줄\"," +
    "\"story\":\"2~3문장\",\"nextMission\":\"다음 주 미션\"}\n\n" +
    `데이터:\n${statsSummary}`;
  const raw = await callGemini(apiKey, prompt);
  const report = parseJsonResponse(raw, {
    badge: "✨", weekTag: "이번 주", headline: "주간 코칭 리포트",
    highlight: "", story: raw, nextMission: "",
  });
  res.json({ok: true, report});
});

exports.postMatchComment = aiHandler(async (req, res, apiKey) => {
  const {memberName, matchSummary} = req.body || {};
  if (!memberName || !matchSummary) {
    res.status(400).json({error: "memberName and matchSummary required"});
    return;
  }
  const prompt =
    "당신은 탁구 경기 중계 해설자입니다.\n" +
    `${memberName} 선수의 방금 끝난 경기 결과를 바탕으로 ` +
    "한국어 한 줄 코멘트를 작성하세요.\n\n" +
    "규칙:\n" +
    "- JSON만 출력\n" +
    "- comment는 1문장, 40자 이내, 생동감 있게\n" +
    "- emoji는 분위기 이모지 1개\n" +
    "- 승리면 격려, 패배면 위로+다음 팁\n\n" +
    "{\"emoji\":\"🔥\",\"comment\":\"...\"}\n\n" +
    `경기 데이터:\n${matchSummary}`;
  const raw = await callGemini(apiKey, prompt);
  const data = parseJsonResponse(raw, {emoji: "🎙️", comment: raw.slice(0, 60)});
  res.json({ok: true, comment: data});
});

exports.dailyBriefing = aiHandler(async (req, res, apiKey) => {
  const {memberName, statsSummary} = req.body || {};
  if (!memberName || !statsSummary) {
    res.status(400).json({error: "memberName and statsSummary required"});
    return;
  }
  const prompt =
    "당신은 탁구 동호회 AI 코치입니다.\n" +
    `${memberName} 선수의 오늘 컨디션·기록을 바탕으로 ` +
    "데일리 브리핑을 한국어로 작성하세요.\n\n" +
    "규칙: JSON만 출력\n" +
    "{\"badge\":\"☀️\",\"tag\":\"오늘의 브리핑\"," +
    "\"headline\":\"10자 이내 캐치\",\"tip\":\"오늘 플레이 팁 1문장\"," +
    "\"pick\":\"오늘 추천 행동 1문장\"}\n\n" +
    `데이터:\n${statsSummary}`;
  const raw = await callGemini(apiKey, prompt);
  const briefing = parseJsonResponse(raw, {
    badge: "☀️", tag: "오늘의 브리핑", headline: "오늘도 한 판!",
    tip: raw, pick: "",
  });
  res.json({ok: true, briefing});
});

exports.opponentAnalysis = aiHandler(async (req, res, apiKey) => {
  const {memberName, opponentName, statsSummary} = req.body || {};
  if (!memberName || !opponentName || !statsSummary) {
    res.status(400).json({
      error: "memberName, opponentName and statsSummary required",
    });
    return;
  }
  const prompt =
    "당신은 탁구 전술 분석가입니다.\n" +
    `${memberName} vs ${opponentName} 대결 전 분석을 한국어로 작성하세요.\n\n` +
    "규칙: JSON만 출력, 재미있지만 실용적으로\n" +
    "{\"badge\":\"⚔️\",\"headline\":\"8자 이내\"," +
    "\"strategy\":\"전략 1~2문장\",\"warning\":\"주의점 1문장\"," +
    "\"winTip\":\"승리 팁 1문장\"}\n\n" +
    `데이터:\n${statsSummary}`;
  const raw = await callGemini(apiKey, prompt);
  const analysis = parseJsonResponse(raw, {
    badge: "⚔️", headline: "대결 분석",
    strategy: raw, warning: "", winTip: "",
  });
  res.json({ok: true, analysis});
});

exports.monthlyClubStory = aiHandler(async (req, res, apiKey) => {
  const {monthLabel, clubSummary} = req.body || {};
  if (!monthLabel || !clubSummary) {
    res.status(400).json({error: "monthLabel and clubSummary required"});
    return;
  }
  const prompt =
    "당신은 탁구 동호회 스포츠 매거진 에디터입니다.\n" +
    `${monthLabel} 동호회 이야기를 한국어로 작성하세요.\n\n` +
    "규칙: JSON만 출력, 카카오 공유하기 좋은 톤\n" +
    "{\"badge\":\"📰\",\"headline\":\"월간 헤드라인 15자 이내\"," +
    "\"story\":\"2~3문장 동호회 하이라이트\"," +
    "\"mvp\":\"이달의 주목 선수 한 줄\"," +
    "\"quote\":\"명언·캐치프레이즈 한 줄\"}\n\n" +
    `데이터:\n${clubSummary}`;
  const raw = await callGemini(apiKey, prompt);
  const story = parseJsonResponse(raw, {
    badge: "📰", headline: monthLabel + " 이사탁",
    story: raw, mvp: "", quote: "",
  });
  res.json({ok: true, story});
});
