/**
 * Standalone single HTML file generator
 * Generates a completely self-contained single index.html file with embedded CSS and JS,
 * including female/male voice alternation, full repeat loop, mobile touch optimization,
 * screen-off background audio playback via MediaSession & silent carrier, and daily study log persistence.
 */

export function generateStandaloneHtml(
  initialText: string,
  repeatCount = 3,
  pauseSeconds = 1,
  rate = 1.0,
  initialFullLoop = true,
  initialVoiceMode = 'alternate'
): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>영어 문장 반복 청취 & 대형 자막 (날짜별 저장 & 화면꺼짐 재생)</title>
  <style>
    /* =========================================================
       [디자인 및 스타일]
       모바일 & PC 반응형, 부드러운 파스텔/슬레이트 테마, 터치 친화적 UI
       ========================================================= */
    :root {
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #e0e7ff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --safe-bottom: env(safe-area-inset-bottom, 16px);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      line-height: 1.6;
      padding: 16px 12px calc(80px + var(--safe-bottom)) 12px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    @media (min-width: 640px) {
      body {
        padding: 24px 16px 40px 16px;
      }
    }

    .container {
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* 헤더 */
    header {
      text-align: center;
      margin-bottom: 4px;
    }

    header h1 {
      font-size: 1.45rem;
      font-weight: 800;
      color: #1e1b4b;
      letter-spacing: -0.02em;
    }

    header p {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 2px;
    }

    @media (min-width: 640px) {
      header h1 { font-size: 1.75rem; }
      header p { font-size: 0.95rem; }
    }

    /* 공통 카드 */
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    @media (min-width: 640px) {
      .card { padding: 24px; }
    }

    /* 대형 자막 디스플레이 영역 */
    .subtitle-stage {
      background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%);
      color: #ffffff;
      border-radius: 20px;
      padding: 24px 16px;
      text-align: center;
      min-height: 190px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);
      position: relative;
    }

    @media (min-width: 640px) {
      .subtitle-stage {
        padding: 32px 24px;
        min-height: 230px;
      }
    }

    .subtitle-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .subtitle-meta span {
      background: rgba(255, 255, 255, 0.12);
      padding: 4px 10px;
      border-radius: 8px;
    }

    .gender-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      padding: 4px 12px !important;
      border-radius: 20px !important;
      transition: all 0.2s ease;
    }

    .gender-female {
      background: rgba(244, 63, 94, 0.2) !important;
      color: #fda4af !important;
      border: 1px solid rgba(244, 63, 94, 0.4);
    }

    .gender-male {
      background: rgba(56, 189, 248, 0.2) !important;
      color: #7dd3fc !important;
      border: 1px solid rgba(56, 189, 248, 0.4);
    }

    .subtitle-text {
      font-size: 1.45rem;
      font-weight: 700;
      line-height: 1.45;
      color: #f8fafc;
      max-width: 780px;
      word-break: keep-all;
      margin: 8px 0;
      user-select: text;
    }

    @media (min-width: 640px) {
      .subtitle-text { font-size: 1.85rem; }
    }

    .subtitle-text.waiting {
      color: #94a3b8;
      font-size: 1.1rem;
      font-weight: 500;
    }

    .pause-indicator {
      margin-top: 8px;
      font-size: 0.85rem;
      color: #38bdf8;
      font-weight: 600;
      display: none;
    }

    /* 설정 폼 그리드 */
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 14px;
    }

    @media (min-width: 640px) {
      .settings-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }

    @media (min-width: 860px) {
      .settings-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
      display: flex;
      justify-content: space-between;
    }

    .form-group input, .form-group select, .form-group textarea {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      font-size: 0.95rem;
      font-family: inherit;
      color: var(--text-main);
      background-color: #ffffff;
      outline: none;
      min-height: 44px;
    }

    textarea {
      min-height: 120px;
      resize: vertical;
      line-height: 1.5;
    }

    /* 버튼 공통 */
    button {
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 0.95rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      touch-action: manipulation;
      transition: all 0.15s ease;
    }

    button:active {
      transform: scale(0.98);
    }

    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: #e2e8f0; color: #334155; }
    .btn-secondary:hover { background: #cbd5e1; }
    .btn-danger { background: #fee2e2; color: #991b1b; }
    .btn-danger:hover { background: #fecaca; }

    .toggle-active {
      background: #e0e7ff !important;
      color: #4338ca !important;
      border: 1px solid #c7d2fe !important;
      font-weight: 700 !important;
    }

    /* 문장 리스트 */
    .sentence-list {
      max-height: 320px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }

    .sentence-item {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: #f8fafc;
      font-size: 0.9rem;
      display: flex;
      align-items: baseline;
      gap: 10px;
      cursor: pointer;
      min-height: 48px;
    }

    .sentence-item.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1e3a8a;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);
    }

    .sentence-num {
      font-size: 0.8rem;
      color: #64748b;
      min-width: 24px;
      font-weight: 700;
    }

    .sentence-item.active .sentence-num {
      color: #2563eb;
    }

    /* 모달 공통 */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-content {
      background: #ffffff;
      border-radius: 20px;
      max-width: 650px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-body {
      padding: 16px 20px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .modal-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      background: #f8fafc;
    }

    /* 히스토리 항목 카드 */
    .history-card {
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px 14px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.15s ease;
    }

    .history-card:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
    }

    /* 모바일 하단 제어 바 */
    .mobile-bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-top: 1px solid var(--border-color);
      padding: 10px 16px calc(10px + var(--safe-bottom)) 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      z-index: 999;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06);
    }

    @media (min-width: 640px) {
      .mobile-bottom-bar { display: none; }
    }

    .mobile-bottom-bar button {
      flex: 1;
      padding: 8px 6px;
      font-size: 0.8rem;
      min-height: 44px;
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- 헤더 -->
    <header>
      <h1>영어 문장 반복 청취 & 대형 자막</h1>
      <p>👩 여성 ↔ 👨 남성 교차 음성 · 날짜별 공부 저장 · 스마트폰 화면꺼짐 재생</p>
    </header>

    <!-- [대형 자막 디스플레이] -->
    <section class="subtitle-stage">
      <div class="subtitle-meta">
        <span id="labelSentence">문장: 0 / 0</span>
        <span id="labelRepeat">반복: 0 / 0</span>
        <span id="genderBadge" class="gender-badge gender-female">👩 여성 음성</span>
        <span id="labelLoop">전체반복: ${initialFullLoop ? 'ON' : 'OFF'}</span>
        <span id="labelSpeed">${rate.toFixed(1)}x</span>
      </div>
      <div class="subtitle-text waiting" id="subtitleText">
        '학습 시작'을 누르면 여자/남자 음성이 번갈아가며 재생됩니다.
      </div>
      <div class="pause-indicator" id="pauseIndicator">
        문장 간 대기 중...
      </div>
    </section>

    <!-- [PC용 상단 제어 바] -->
    <div class="controls-toolbar card" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <button id="btnStart" class="btn-primary" style="flex: 2; min-width: 130px;">▶ 학습 시작</button>
      <button id="btnPause" class="btn-secondary" style="flex: 1; min-width: 90px;" disabled>⏸ 일시정지</button>
      <button id="btnResume" class="btn-secondary" style="flex: 1; min-width: 90px; display: none;">▶ 재개</button>
      <button id="btnStop" class="btn-danger" style="flex: 1; min-width: 90px;" disabled>⏹ 정지</button>

      <button id="btnVoiceToggle" class="btn-secondary toggle-active" style="flex: 1.5; min-width: 130px;">
        👥 음성: <span id="voiceModeText">남녀 교차</span>
      </button>

      <button id="btnLoopToggle" class="btn-secondary ${initialFullLoop ? 'toggle-active' : ''}" style="flex: 1.5; min-width: 110px;">
        🔁 전체 반복: <span id="loopStatusText">${initialFullLoop ? 'ON' : 'OFF'}</span>
      </button>

      <!-- 화면꺼짐 재생 모드 토글 -->
      <button id="btnBgAudioToggle" class="btn-secondary toggle-active" style="flex: 1.5; min-width: 140px;" title="스마트폰 화면을 끄거나 다른 앱으로 전환해도 음성이 멈추지 않고 계속 재생됩니다">
        🎧 화면꺼짐 재생: <span id="bgAudioText">ON</span>
      </button>

      <!-- 날짜별 학습 기록 버튼 -->
      <button id="btnOpenHistory" class="btn-secondary" style="flex: 1.5; min-width: 130px;">
        📅 날짜별 기록 (<span id="historyCount">0</span>)
      </button>

      <button id="btnSaveToday" class="btn-secondary" style="flex: 1.2; min-width: 110px;" title="현재 문장을 오늘 날짜의 학습 노트로 저장합니다">
        💾 오늘 저장
      </button>

      <button id="btnPrev" class="btn-secondary" style="flex: 1; min-width: 70px;" disabled>⏮ 이전</button>
      <button id="btnNext" class="btn-secondary" style="flex: 1; min-width: 70px;" disabled>⏭ 다음</button>
    </div>

    <!-- [설정 및 텍스트 입력 영역] -->
    <section class="card">
      <div class="form-group">
        <label for="textInput">학습할 영어 문장 (마침표 ., 물음표 ?, 느낌표 ! 단위 자동 분리)</label>
        <textarea id="textInput" placeholder="영어 문장을 입력하세요...">${initialText.replace(/`/g, '\\`')}</textarea>
      </div>

      <!-- 세부 설정 그리드 -->
      <div class="settings-grid">
        <div class="form-group">
          <label for="inputRepeat">문장별 반복 횟수 <strong id="valRepeat" style="color: var(--primary);">${repeatCount}회</strong></label>
          <input type="number" id="inputRepeat" min="1" max="10" value="${repeatCount}">
        </div>

        <div class="form-group">
          <label for="inputPause">문장 간 쉬는 시간 <strong id="valPause" style="color: var(--primary);">${pauseSeconds}초</strong></label>
          <input type="number" id="inputPause" min="0" max="10" step="0.5" value="${pauseSeconds}">
        </div>

        <div class="form-group">
          <label for="inputRate">읽기 속도 <strong id="valRate" style="color: var(--primary);">${rate.toFixed(1)}x</strong></label>
          <input type="range" id="inputRate" min="0.5" max="2.0" step="0.1" value="${rate}">
        </div>

        <div class="form-group">
          <label for="selectVoiceMode">음성 재생 방식</label>
          <select id="selectVoiceMode">
            <option value="alternate" selected>남/녀 음성 번갈아 교차 (추천)</option>
            <option value="female-only">여성 음성만 사용</option>
            <option value="male-only">남성 음성만 사용</option>
          </select>
        </div>
      </div>
    </section>

    <!-- [문장 목록 영역] -->
    <section class="card">
      <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 6px;">문장 리스트 (터치 시 해당 문장 즉시 재생)</h3>
      <div class="sentence-list" id="sentenceList"></div>
    </section>
  </div>

  <!-- [스마트폰 하단 고정 제어 바] -->
  <div class="mobile-bottom-bar">
    <button id="btnMobilePrev" class="btn-secondary" disabled>⏮</button>
    <button id="btnMobilePlay" class="btn-primary">▶ 시작</button>
    <button id="btnMobileNext" class="btn-secondary" disabled>⏭</button>
    <button id="btnMobileVoice" class="btn-secondary toggle-active">👥 남녀</button>
    <button id="btnMobileBg" class="btn-secondary toggle-active">🎧 백그라운드</button>
    <button id="btnMobileHistory" class="btn-secondary">📅 기록</button>
  </div>

  <!-- [날짜별 학습 기록 모달] -->
  <div class="modal-backdrop" id="historyModal">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #1e1b4b;">📅 날짜별 학습 기록 및 복습</h3>
          <p style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">날짜별로 저장된 학습 문장을 원클릭으로 다시 불러와 복습하세요.</p>
        </div>
        <button id="btnCloseHistory" style="background: none; border: none; font-size: 1.3rem; color: #64748b; padding: 4px; min-height: auto;">✕</button>
      </div>

      <div class="modal-body">
        <!-- 통계 스트립 -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #f1f5f9; padding: 10px; border-radius: 12px; text-align: center;">
          <div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">총 학습 일수</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #4f46e5;" id="statDays">0일</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">총 학습 세션</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0284c7;" id="statSessions">0회</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">총 학습 시간</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #10b981;" id="statMinutes">0분</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: #334155;">저장된 날짜별 기록 목록</h4>
          <button id="btnSaveCurrentToHistory" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; min-height: 36px;">
            + 현재 문장 오늘 기록에 저장
          </button>
        </div>

        <div id="historyListContainer" style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          <!-- 자바스크립트로 날짜별 카드 렌더링 -->
        </div>
      </div>

      <div class="modal-footer">
        <button id="btnClearAllHistory" class="btn-danger" style="font-size: 0.8rem; padding: 6px 12px; min-height: 36px;">
          전체 기록 삭제
        </button>
        <button id="btnCloseHistoryFooter" class="btn-secondary" style="font-size: 0.8rem; padding: 6px 14px; min-height: 36px;">
          닫기
        </button>
      </div>
    </div>
  </div>

  <!-- =========================================================
       [핵심 스크립트] 
       1. 남/녀 교차 음성
       2. 화면꺼짐 백그라운드 오디오 세션 & MediaSession
       3. 날짜별 공부 내용 로컬스토리지 저장 및 불러오기
       ========================================================= -->
  <script>
    // 1. 상태 변수
    let sentences = [];
    let currentSentenceIdx = 0;
    let currentRepeatCount = 1;
    let isPlaying = false;
    let isPaused = false;
    let isFullLoop = ${initialFullLoop};
    let voiceMode = '${initialVoiceMode}';
    let currentGender = 'female';
    let loopCycle = 1;
    let pauseTimeoutId = null;
    let currentUtterance = null;
    let rate = ${rate};

    // 화면 꺼짐 백그라운드 재생 세션
    let isBgAudioEnabled = true;
    let bgAudioElement = null;

    // 학습 시간 측정 타이머
    let sessionStartTime = null;
    let sessionElapsedSeconds = 0;
    let sessionTimerInterval = null;

    let femaleVoice = null;
    let maleVoice = null;

    // DOM 참조
    const textInput = document.getElementById('textInput');
    const inputRepeat = document.getElementById('inputRepeat');
    const inputPause = document.getElementById('inputPause');
    const inputRate = document.getElementById('inputRate');
    const valRepeat = document.getElementById('valRepeat');
    const valPause = document.getElementById('valPause');
    const valRate = document.getElementById('valRate');
    const selectVoiceMode = document.getElementById('selectVoiceMode');

    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnVoiceToggle = document.getElementById('btnVoiceToggle');
    const voiceModeText = document.getElementById('voiceModeText');
    const btnLoopToggle = document.getElementById('btnLoopToggle');
    const loopStatusText = document.getElementById('loopStatusText');
    const btnBgAudioToggle = document.getElementById('btnBgAudioToggle');
    const bgAudioText = document.getElementById('bgAudioText');
    const btnOpenHistory = document.getElementById('btnOpenHistory');
    const btnSaveToday = document.getElementById('btnSaveToday');
    const historyCount = document.getElementById('historyCount');

    // 모바일 하단 제어 바
    const btnMobilePlay = document.getElementById('btnMobilePlay');
    const btnMobilePrev = document.getElementById('btnMobilePrev');
    const btnMobileNext = document.getElementById('btnMobileNext');
    const btnMobileVoice = document.getElementById('btnMobileVoice');
    const btnMobileBg = document.getElementById('btnMobileBg');
    const btnMobileHistory = document.getElementById('btnMobileHistory');

    // 자막 요소
    const subtitleText = document.getElementById('subtitleText');
    const labelSentence = document.getElementById('labelSentence');
    const labelRepeat = document.getElementById('labelRepeat');
    const genderBadge = document.getElementById('genderBadge');
    const labelLoop = document.getElementById('labelLoop');
    const labelSpeed = document.getElementById('labelSpeed');
    const pauseIndicator = document.getElementById('pauseIndicator');
    const sentenceList = document.getElementById('sentenceList');

    // 모달 요소
    const historyModal = document.getElementById('historyModal');
    const btnCloseHistory = document.getElementById('btnCloseHistory');
    const btnCloseHistoryFooter = document.getElementById('btnCloseHistoryFooter');
    const btnSaveCurrentToHistory = document.getElementById('btnSaveCurrentToHistory');
    const btnClearAllHistory = document.getElementById('btnClearAllHistory');
    const historyListContainer = document.getElementById('historyListContainer');
    const statDays = document.getElementById('statDays');
    const statSessions = document.getElementById('statSessions');
    const statMinutes = document.getElementById('statMinutes');

    // =========================================================
    // [화면 꺼짐 백그라운드 재생 세션 초기화]
    // 모바일 OS가 슬립/화면꺼짐 상태에서도 오디오 및 JS 타이머를 유지하도록
    // 1초 무음 WAV를 배경에서 연속 루프 재생합니다.
    // =========================================================
    const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';

    function initBackgroundAudio() {
      if (!bgAudioElement) {
        bgAudioElement = new Audio(SILENT_WAV_BASE64);
        bgAudioElement.loop = true;
        bgAudioElement.volume = 0.01;
        bgAudioElement.setAttribute('playsinline', 'true');
        bgAudioElement.setAttribute('webkit-playsinline', 'true');
      }
    }

    async function startBgAudioSession() {
      if (!isBgAudioEnabled) return;
      try {
        initBackgroundAudio();
        if (bgAudioElement.paused) {
          await bgAudioElement.play();
        }
      } catch (e) {
        console.warn('Background audio session auto-play notice:', e);
      }
    }

    function stopBgAudioSession() {
      if (bgAudioElement) {
        bgAudioElement.pause();
        bgAudioElement.currentTime = 0;
      }
    }

    // 잠금 화면 컨트롤 (MediaSession API)
    function updateMediaSession(text, sentenceIdx, totalSentences, repeat, totalRepeats) {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: text || '영어 문장 반복 청취',
            artist: (currentGender === 'female' ? '👩 여성 음성' : '👨 남성 음성') + ' · RepeatEcho',
            album: \`문장 \${sentenceIdx + 1}/\${totalSentences} · 반복 \${repeat}/\${totalRepeats} · 전체 \${loopCycle}회차\`
          });

          navigator.mediaSession.setActionHandler('play', () => { btnResume.click(); });
          navigator.mediaSession.setActionHandler('pause', () => { btnPause.click(); });
          navigator.mediaSession.setActionHandler('previoustrack', () => { btnPrev.click(); });
          navigator.mediaSession.setActionHandler('nexttrack', () => { btnNext.click(); });
        } catch (e) {
          console.warn('MediaSession error:', e);
        }
      }
    }

    // =========================================================
    // [날짜별 학습 기록 LocalStorage 매니저]
    // =========================================================
    const STORAGE_KEY = 'repeatecho_study_logs_v1';

    function getTodayStr() {
      const d = new Date();
      return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
    }

    function loadHistoryLogs() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function saveHistoryLogs(logs) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        updateHistoryBadge();
      } catch (e) {}
    }

    function updateHistoryBadge() {
      const logs = loadHistoryLogs();
      historyCount.textContent = logs.length;
    }

    function saveCurrentSession(customTitle) {
      const text = textInput.value.trim();
      if (!text) {
        alert('저장할 문장이 없습니다.');
        return;
      }
      const sents = parseSentences(text);
      const now = new Date();
      const timeStr = \`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}\`;
      const dateStr = getTodayStr();

      let title = customTitle || '';
      if (!title) {
        const first = sents[0] || '영어 학습';
        title = first.length > 28 ? first.slice(0, 28) + '...' : first;
      }

      const newLog = {
        id: 'log_' + Date.now(),
        date: dateStr,
        time: timeStr,
        timestamp: Date.now(),
        title: title,
        text: text,
        sentenceCount: sents.length,
        repeatCount: parseInt(inputRepeat.value, 10) || 3,
        totalCycles: loopCycle,
        durationSeconds: sessionElapsedSeconds,
        voiceMode: voiceMode
      };

      const logs = [newLog, ...loadHistoryLogs()];
      saveHistoryLogs(logs);
      renderHistoryModal();
      alert(\`✅ 오늘(\${dateStr}) 날짜로 학습 내용이 저장되었습니다!\`);
    }

    function renderHistoryModal() {
      const logs = loadHistoryLogs();
      updateHistoryBadge();

      // 통계 계산
      const uniqueDays = new Set(logs.map(l => l.date)).size;
      const totalSec = logs.reduce((a, b) => a + (b.durationSeconds || 0), 0);
      statDays.textContent = uniqueDays + '일';
      statSessions.textContent = logs.length + '회';
      statMinutes.textContent = Math.round(totalSec / 60) + '분';

      historyListContainer.innerHTML = '';
      if (logs.length === 0) {
        historyListContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 24px; font-size: 0.9rem;">아직 저장된 날짜별 학습 기록이 없습니다.<br>오늘 공부한 문장을 저장해 보세요!</div>';
        return;
      }

      // 날짜별 그룹화
      logs.forEach((log) => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = \`
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.75rem; font-weight: 700; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 6px;">\${log.date} \${log.time}</span>
              <span style="font-size: 0.75rem; color: #64748b;">· \${log.sentenceCount}개 문장 (반복 \${log.repeatCount}회)</span>
            </div>
            <button class="btn-delete" style="background: none; border: none; color: #ef4444; font-size: 0.75rem; padding: 2px 6px; cursor: pointer;">삭제</button>
          </div>
          <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-top: 2px;">\${log.title}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span style="font-size: 0.75rem; color: #64748b;">학습시간: \${Math.round(log.durationSeconds / 60)}분 · \${log.totalCycles}회차 완료</span>
            <button class="btn-load-review btn-primary" style="padding: 4px 10px; font-size: 0.75rem; min-height: 32px;">
              ▶ 이 날 문장 불러와 복습하기
            </button>
          </div>
        \`;

        // 불러오기
        card.querySelector('.btn-load-review').addEventListener('click', () => {
          textInput.value = log.text;
          inputRepeat.value = log.repeatCount;
          valRepeat.textContent = log.repeatCount + '회';
          renderSentenceList();
          historyModal.style.display = 'none';
          alert(\`📖 "\${log.title}" 문장을 불러왔습니다. '학습 시작'을 누르면 바로 복습할 수 있습니다.\`);
        });

        // 삭제
        card.querySelector('.btn-delete').addEventListener('click', () => {
          if (confirm('이 학습 기록을 삭제하시겠습니까?')) {
            const updated = logs.filter(item => item.id !== log.id);
            saveHistoryLogs(updated);
            renderHistoryModal();
          }
        });

        historyListContainer.appendChild(card);
      });
    }

    // 모달 열기/닫기
    btnOpenHistory.addEventListener('click', () => {
      renderHistoryModal();
      historyModal.style.display = 'flex';
    });
    btnMobileHistory.addEventListener('click', () => {
      btnOpenHistory.click();
    });
    btnCloseHistory.addEventListener('click', () => { historyModal.style.display = 'none'; });
    btnCloseHistoryFooter.addEventListener('click', () => { historyModal.style.display = 'none'; });
    btnSaveToday.addEventListener('click', () => saveCurrentSession());
    btnSaveCurrentToHistory.addEventListener('click', () => saveCurrentSession());
    btnClearAllHistory.addEventListener('click', () => {
      if (confirm('정말로 모든 날짜별 학습 기록을 초기화하시겠습니까?')) {
        localStorage.removeItem(STORAGE_KEY);
        renderHistoryModal();
      }
    });

    // 화면꺼짐 재생 모드 토글
    function toggleBgAudio() {
      isBgAudioEnabled = !isBgAudioEnabled;
      btnBgAudioToggle.classList.toggle('toggle-active', isBgAudioEnabled);
      btnMobileBg.classList.toggle('toggle-active', isBgAudioEnabled);
      bgAudioText.textContent = isBgAudioEnabled ? 'ON' : 'OFF';
      btnMobileBg.textContent = isBgAudioEnabled ? '🎧 화면꺼짐ON' : '🎧 화면꺼짐OFF';

      if (isPlaying && isBgAudioEnabled) {
        startBgAudioSession();
      } else if (!isBgAudioEnabled) {
        stopBgAudioSession();
      }
    }

    btnBgAudioToggle.addEventListener('click', toggleBgAudio);
    btnMobileBg.addEventListener('click', toggleBgAudio);

    // 음성 로딩
    function loadVoices() {
      if (!('speechSynthesis' in window)) return;
      const all = window.speechSynthesis.getVoices();
      const enVoices = all.filter(v => v.lang.startsWith('en'));
      const pool = enVoices.length > 0 ? enVoices : all;

      const femaleHints = ['female', 'samantha', 'victoria', 'zira', 'karen', 'jenny', 'google us english', 'fiona'];
      const maleHints = ['male', 'alex', 'daniel', 'david', 'george', 'guy', 'fred', 'google uk english male'];

      femaleVoice = pool.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h))) || pool[0];
      maleVoice = pool.find(v => maleHints.some(h => v.name.toLowerCase().includes(h)));
      if (!maleVoice && pool.length > 1) {
        maleVoice = pool.find(v => v !== femaleVoice) || pool[1];
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }

    function parseSentences(txt) {
      if (!txt || !txt.trim()) return [];
      return txt
        .split(/(?<=[.?!])\\s+|\\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    function renderSentenceList() {
      sentences = parseSentences(textInput.value);
      sentenceList.innerHTML = '';
      if (sentences.length === 0) {
        sentenceList.innerHTML = '<div style="color: #94a3b8; padding: 12px; font-size: 0.85rem;">입력된 문장이 없습니다.</div>';
        return;
      }
      sentences.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'sentence-item' + (i === currentSentenceIdx && isPlaying ? ' active' : '');
        item.id = 'sentence-' + i;
        item.innerHTML = \`<span class="sentence-num">\${i + 1}.</span> <span>\${s}</span>\`;
        item.addEventListener('click', () => jumpToSentence(i));
        sentenceList.appendChild(item);
      });
    }

    function jumpToSentence(idx) {
      if (idx < 0 || idx >= sentences.length) return;
      stopSpeech();
      currentSentenceIdx = idx;
      currentRepeatCount = 1;
      currentGender = 'female';
      isPlaying = true;
      isPaused = false;
      updateButtons();
      speakCurrent();
    }

    // 핵심 낭독 함수
    function speakCurrent() {
      if (!isPlaying || isPaused) return;

      if (currentSentenceIdx >= sentences.length) {
        if (isFullLoop && sentences.length > 0) {
          loopCycle++;
          currentSentenceIdx = 0;
          currentRepeatCount = 1;
          pauseIndicator.textContent = \`🔁 전체 \${loopCycle}회차 반복을 시작합니다...\`;
          pauseIndicator.style.display = 'block';
          pauseTimeoutId = setTimeout(() => {
            speakCurrent();
          }, 800);
          return;
        } else {
          finishStudy();
          return;
        }
      }

      // 화면꺼짐 백그라운드 오디오 루프 유지
      startBgAudioSession();

      const text = sentences[currentSentenceIdx];
      const targetRepeat = parseInt(inputRepeat.value, 10) || 1;

      // 성별 결정
      let activeGender = currentGender;
      if (voiceMode === 'female-only') activeGender = 'female';
      else if (voiceMode === 'male-only') activeGender = 'male';

      // 자막 및 뱃지 업데이트
      subtitleText.textContent = text;
      subtitleText.classList.remove('waiting');
      labelSentence.textContent = '문장: ' + (currentSentenceIdx + 1) + ' / ' + sentences.length;
      labelRepeat.textContent = '반복: ' + currentRepeatCount + ' / ' + targetRepeat;
      labelLoop.textContent = isFullLoop ? '전체반복: ON (' + loopCycle + '회차)' : '전체반복: OFF';
      labelSpeed.textContent = rate.toFixed(1) + 'x';

      if (activeGender === 'female') {
        genderBadge.textContent = '👩 여성 음성';
        genderBadge.className = 'gender-badge gender-female';
      } else {
        genderBadge.textContent = '👨 남성 음성';
        genderBadge.className = 'gender-badge gender-male';
      }

      pauseIndicator.style.display = 'none';
      highlightList();

      // 잠금 화면 / 블루투스 컨트롤 메타데이터 업데이트
      updateMediaSession(text, currentSentenceIdx, sentences.length, currentRepeatCount, targetRepeat);

      currentUtterance = new SpeechSynthesisUtterance(text);

      // 음성 먼저 할당 (속도 리셋 버그 방지)
      if (activeGender === 'female' && femaleVoice) {
        currentUtterance.voice = femaleVoice;
        currentUtterance.lang = femaleVoice.lang || 'en-US';
      } else if (activeGender === 'male' && maleVoice) {
        currentUtterance.voice = maleVoice;
        currentUtterance.lang = maleVoice.lang || 'en-US';
      } else {
        currentUtterance.lang = 'en-US';
      }

      // voice 지정 후 rate 및 pitch 지정
      currentUtterance.rate = Math.max(0.5, Math.min(2.0, rate));
      currentUtterance.pitch = activeGender === 'female' ? 1.12 : 0.88;

      currentUtterance.onend = function() {
        if (!isPlaying || isPaused) return;

        // 남/녀 교차
        if (voiceMode === 'alternate') {
          currentGender = currentGender === 'female' ? 'male' : 'female';
        }

        if (currentRepeatCount < targetRepeat) {
          currentRepeatCount++;
          pauseTimeoutId = setTimeout(speakCurrent, 300);
        } else {
          currentRepeatCount = 1;
          currentSentenceIdx++;

          if (currentSentenceIdx < sentences.length) {
            const pauseSec = parseFloat(inputPause.value) || 0;
            if (pauseSec > 0) {
              pauseIndicator.textContent = \`다음 문장까지 \${pauseSec}초 휴식 중...\`;
              pauseIndicator.style.display = 'block';
            }
            pauseTimeoutId = setTimeout(() => {
              pauseIndicator.style.display = 'none';
              speakCurrent();
            }, pauseSec * 1000);
          } else {
            speakCurrent();
          }
        }
      };

      currentUtterance.onerror = function(e) {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('TTS 오류:', e);
        }
      };

      window.speechSynthesis.speak(currentUtterance);
    }

    function highlightList() {
      const items = document.querySelectorAll('.sentence-item');
      items.forEach((item, idx) => {
        if (idx === currentSentenceIdx) {
          item.classList.add('active');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    }

    function stopSpeech() {
      if (pauseTimeoutId) {
        clearTimeout(pauseTimeoutId);
        pauseTimeoutId = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopBgAudioSession();
    }

    function finishStudy() {
      stopSpeech();
      isPlaying = false;
      isPaused = false;
      subtitleText.textContent = '🎉 모든 문장 청취 완료!';
      subtitleText.classList.remove('waiting');
      pauseIndicator.style.display = 'none';
      updateButtons();

      // 세션 자동 저장 (10초 이상 공부했을 시)
      if (sessionElapsedSeconds > 10) {
        saveCurrentSession();
      }
    }

    function updateButtons() {
      btnStart.disabled = isPlaying && !isPaused;
      btnPause.disabled = !isPlaying || isPaused;
      btnPause.style.display = isPaused ? 'none' : 'inline-flex';
      btnResume.style.display = isPaused ? 'inline-flex' : 'none';
      btnStop.disabled = !isPlaying && !isPaused;

      btnPrev.disabled = !isPlaying || currentSentenceIdx <= 0;
      btnNext.disabled = !isPlaying || currentSentenceIdx >= sentences.length - 1;

      btnMobilePrev.disabled = !isPlaying || currentSentenceIdx <= 0;
      btnMobileNext.disabled = !isPlaying || currentSentenceIdx >= sentences.length - 1;

      if (!isPlaying) {
        btnMobilePlay.textContent = '▶ 시작';
        btnMobilePlay.className = 'btn-primary';
      } else if (isPaused) {
        btnMobilePlay.textContent = '▶ 재개';
        btnMobilePlay.className = 'btn-primary';
      } else {
        btnMobilePlay.textContent = '⏸ 일시정지';
        btnMobilePlay.className = 'btn-secondary';
      }
    }

    // 음성 모드 토글
    function cycleVoiceMode() {
      if (voiceMode === 'alternate') voiceMode = 'female-only';
      else if (voiceMode === 'female-only') voiceMode = 'male-only';
      else voiceMode = 'alternate';

      selectVoiceMode.value = voiceMode;
      updateVoiceModeUI();
    }

    function updateVoiceModeUI() {
      if (voiceMode === 'alternate') {
        voiceModeText.textContent = '남녀 교차';
        btnVoiceToggle.classList.add('toggle-active');
        btnMobileVoice.classList.add('toggle-active');
      } else if (voiceMode === 'female-only') {
        voiceModeText.textContent = '여성만';
        btnVoiceToggle.classList.remove('toggle-active');
        btnMobileVoice.classList.remove('toggle-active');
      } else {
        voiceModeText.textContent = '남성만';
        btnVoiceToggle.classList.remove('toggle-active');
        btnMobileVoice.classList.remove('toggle-active');
      }
    }

    btnVoiceToggle.addEventListener('click', cycleVoiceMode);
    btnMobileVoice.addEventListener('click', cycleVoiceMode);
    selectVoiceMode.addEventListener('change', (e) => {
      voiceMode = e.target.value;
      updateVoiceModeUI();
    });

    btnLoopToggle.addEventListener('click', () => {
      isFullLoop = !isFullLoop;
      loopStatusText.textContent = isFullLoop ? 'ON' : 'OFF';
      btnLoopToggle.classList.toggle('toggle-active', isFullLoop);
      labelLoop.textContent = isFullLoop ? '전체반복: ON (' + loopCycle + '회차)' : '전체반복: OFF';
    });

    textInput.addEventListener('input', () => {
      if (!isPlaying) renderSentenceList();
    });

    inputRepeat.addEventListener('input', (e) => { valRepeat.textContent = e.target.value + '회'; });
    inputPause.addEventListener('input', (e) => { valPause.textContent = e.target.value + '초'; });
    inputRate.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      rate = Math.max(0.5, Math.min(2.0, v));
      valRate.textContent = rate.toFixed(1) + 'x';
      labelSpeed.textContent = rate.toFixed(1) + 'x';

      if (isPlaying && !isPaused) {
        stopSpeech();
        speakCurrent();
      }
    });

    btnStart.addEventListener('click', () => {
      sentences = parseSentences(textInput.value);
      if (sentences.length === 0) return alert('문장을 입력해 주세요!');
      renderSentenceList();
      stopSpeech();
      currentSentenceIdx = 0;
      currentRepeatCount = 1;
      currentGender = 'female';
      loopCycle = 1;
      isPlaying = true;
      isPaused = false;
      sessionElapsedSeconds = 0;
      sessionStartTime = Date.now();

      if (sessionTimerInterval) clearInterval(sessionTimerInterval);
      sessionTimerInterval = setInterval(() => {
        if (isPlaying && !isPaused) {
          sessionElapsedSeconds++;
        }
      }, 1000);

      updateButtons();
      speakCurrent();
    });

    btnPause.addEventListener('click', () => {
      if (!isPlaying || isPaused) return;
      isPaused = true;
      if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
      window.speechSynthesis.pause();
      stopBgAudioSession();
      updateButtons();
    });

    btnResume.addEventListener('click', () => {
      if (!isPlaying || !isPaused) return;
      isPaused = false;
      startBgAudioSession();
      window.speechSynthesis.resume();
      updateButtons();
      if (!window.speechSynthesis.speaking) speakCurrent();
    });

    btnStop.addEventListener('click', () => {
      stopSpeech();
      isPlaying = false;
      isPaused = false;
      if (sessionTimerInterval) clearInterval(sessionTimerInterval);
      currentSentenceIdx = 0;
      currentRepeatCount = 1;
      currentGender = 'female';
      loopCycle = 1;
      subtitleText.textContent = "'학습 시작'을 누르면 여자/남자 음성이 번갈아가며 재생됩니다.";
      subtitleText.classList.add('waiting');
      labelSentence.textContent = '문장: 0 / ' + sentences.length;
      updateButtons();
    });

    btnPrev.addEventListener('click', () => {
      if (currentSentenceIdx > 0) jumpToSentence(currentSentenceIdx - 1);
    });

    btnNext.addEventListener('click', () => {
      if (currentSentenceIdx < sentences.length - 1) jumpToSentence(currentSentenceIdx + 1);
    });

    btnMobilePlay.addEventListener('click', () => {
      if (!isPlaying) btnStart.click();
      else if (isPaused) btnResume.click();
      else btnPause.click();
    });

    btnMobilePrev.addEventListener('click', () => btnPrev.click());
    btnMobileNext.addEventListener('click', () => btnNext.click());

    // 초기화
    renderSentenceList();
    updateHistoryBadge();
  </script>
</body>
</html>`;
}
