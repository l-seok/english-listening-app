/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  Sliders,
  Type,
  RefreshCw,
  FileCode2,
  Clock,
  Layers,
  Sun,
  Users,
  Calendar,
  Save,
  Trash2,
  Headphones,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  Award,
  BookMarked
} from 'lucide-react';
import { PRESET_LESSONS } from './presets';
import { generateStandaloneHtml } from './standaloneHtml';
import { detectVoiceGender, pickBestDefaultVoices } from './voiceUtils';
import {
  StudySessionLog,
  loadStudyLogs,
  saveStudyLog,
  deleteStudyLog,
  clearAllStudyLogs,
  calculateStudyStats,
  getTodayDateString,
  formatKoreanDate
} from './studyStorage';
import {
  startBackgroundAudio,
  pauseBackgroundAudio,
  stopBackgroundAudio,
  updateMediaSessionState
} from './backgroundAudio';

export default function App() {
  // ==========================================
  // 1. 학습 상태 관리 (Playback & State)
  // ==========================================
  const [inputText, setInputText] = useState<string>(PRESET_LESSONS[0].text);
  const [splitMode, setSplitMode] = useState<'punctuation' | 'newline'>('punctuation');
  const [repeatCount, setRepeatCount] = useState<number>(3);
  const [pauseSeconds, setPauseSeconds] = useState<number>(1.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // [기능 1] 남/녀 음성 교차 설정 (Female ↔ Male Alternation)
  const [voiceMode, setVoiceMode] = useState<'alternate' | 'female-only' | 'male-only'>('alternate');
  const [currentGender, setCurrentGender] = useState<'female' | 'male'>('female');
  const [femaleVoiceURI, setFemaleVoiceURI] = useState<string>('');
  const [maleVoiceURI, setMaleVoiceURI] = useState<string>('');

  // [기능 2] 전체 반복 (Full Playlist Loop)
  const [isFullLoop, setIsFullLoop] = useState<boolean>(true);
  const [loopCycle, setLoopCycle] = useState<number>(1);

  // [기능 3] 스마트폰 화면꺼짐 / 백그라운드 재생 모드 (Screen-Off Background Playback)
  const [isBgAudioMode, setIsBgAudioMode] = useState<boolean>(true);

  // [기능 4] 날짜별 학습 기록 저장 & 복습 (Daily Study History)
  const [studyLogs, setStudyLogs] = useState<StudySessionLog[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSaveSuccessToast, setShowSaveSuccessToast] = useState<string | null>(null);
  const [saveTitleInput, setSaveTitleInput] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // 학습 시간 측정 타이머
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const sessionTimerRef = useRef<number | null>(null);

  // 모바일 탭 뷰 (Mobile Tab Selector)
  const [mobileTab, setMobileTab] = useState<'theater' | 'list' | 'settings'>('theater');

  // 재생 엔진 상태
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState<number>(0);
  const [currentRepeat, setCurrentRepeat] = useState<number>(1);
  const [isResting, setIsResting] = useState<boolean>(false);
  const [restCountdown, setRestCountdown] = useState<number>(0);
  const [activeWordCharRange, setActiveWordCharRange] = useState<{ start: number; length: number } | null>(null);

  // 화면 꺼짐 방지 (Wake Lock API)
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  // 자막 뷰 모드
  const [fontSize, setFontSize] = useState<'md' | 'lg' | 'xl'>('lg');
  const [isBlindMode, setIsBlindMode] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [showHtmlModal, setShowHtmlModal] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  // Web Speech API Voices
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs for speech, rate, and timeout management
  const playbackRateRef = useRef<number>(1.0);
  const pauseTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentSentenceItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // keep playbackRateRef always in sync
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // Load study logs on mount
  useEffect(() => {
    setStudyLogs(loadStudyLogs());
  }, []);

  // Study timer effect
  useEffect(() => {
    if (isPlaying && !isPaused) {
      sessionTimerRef.current = window.setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    }
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isPlaying, isPaused]);

  // ==========================================
  // 2. 문장 파싱 (Sentence Splitting Logic)
  // ==========================================
  const sentences = useMemo(() => {
    if (!inputText || !inputText.trim()) return [];
    if (splitMode === 'newline') {
      return inputText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return inputText
      .split(/(?<=[.?!])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [inputText, splitMode]);

  // ==========================================
  // 3. 브라우저 Web Speech API 음성 및 남/녀 매핑
  // ==========================================
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (!allVoices || allVoices.length === 0) return;

      const englishVoices = allVoices.filter((v) => v.lang.startsWith('en'));
      const voiceList = englishVoices.length > 0 ? englishVoices : allVoices;
      setVoices(voiceList);

      const best = pickBestDefaultVoices(voiceList);
      if (best.femaleVoice) {
        setFemaleVoiceURI(best.femaleVoice.voiceURI);
      }
      if (best.maleVoice) {
        setMaleVoiceURI(best.maleVoice.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 활성 문장이 바뀔 때 자막 목록 부드러운 스크롤
  useEffect(() => {
    if (isPlaying && currentSentenceItemRef.current) {
      currentSentenceItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentSentenceIdx, isPlaying]);

  // ==========================================
  // 4. 스마트폰 화면 꺼짐 방지 (Wake Lock)
  // ==========================================
  const toggleWakeLock = async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      alert('현재 브라우저에서는 화면 켜짐 유지(Wake Lock) API를 지원하지 않습니다.');
      return;
    }

    try {
      if (wakeLockActive && wakeLockSentinelRef.current) {
        await wakeLockSentinelRef.current.release();
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
      } else {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);

        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(() => {});
      }
      stopBackgroundAudio();
    };
  }, []);

  // ==========================================
  // 5. 날짜별 학습 내용 저장 핸들러
  // ==========================================
  const handleSaveCurrentSession = (customTitle?: string) => {
    if (sentences.length === 0) {
      alert('저장할 문장이 없습니다. 문장을 먼저 입력해 주세요.');
      return;
    }

    const saved = saveStudyLog({
      title: customTitle || saveTitleInput.trim() || undefined,
      text: inputText,
      sentenceCount: sentences.length,
      repeatCount: repeatCount,
      totalCycles: loopCycle,
      totalSentencesSpoken: (loopCycle - 1) * sentences.length * repeatCount + (currentSentenceIdx + 1) * currentRepeat,
      durationSeconds: sessionSeconds,
      voiceMode: voiceMode,
      playbackRate: playbackRate
    });

    setStudyLogs(loadStudyLogs());
    setSaveTitleInput('');
    setShowSaveSuccessToast(`오늘(${getTodayDateString()}) 학습 내용이 저장되었습니다!`);
    setTimeout(() => setShowSaveSuccessToast(null), 3000);
  };

  const handleLoadPastSession = (log: StudySessionLog) => {
    handleStop();
    setInputText(log.text);
    setRepeatCount(log.repeatCount);
    setVoiceMode(log.voiceMode);
    setShowHistoryModal(false);
    setShowSaveSuccessToast(`"${log.title}" 문장을 불러왔습니다.`);
    setTimeout(() => setShowSaveSuccessToast(null), 2500);
  };

  const handleDeleteSession = (id: string) => {
    if (confirm('이 학습 기록을 삭제하시겠습니까?')) {
      const updated = deleteStudyLog(id);
      setStudyLogs(updated);
    }
  };

  // ==========================================
  // 6. TTS 재생 및 백그라운드 오디오 제어
  // ==========================================
  const clearAllTimers = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const stopAllSpeech = () => {
    clearAllTimers();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    setIsResting(false);
    setActiveWordCharRange(null);
    stopBackgroundAudio();
  };

  // 문장 낭독 실행 함수
  const speakSentence = (sentenceIndex: number, repeatNum: number, targetGender: 'female' | 'male') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('현재 브라우저에서 Web Speech API를 지원하지 않습니다.');
      return;
    }

    // 모든 문장 끝에 도달했을 때
    if (sentenceIndex >= sentences.length) {
      if (isFullLoop && sentences.length > 0) {
        setLoopCycle((prev) => prev + 1);
        setIsResting(true);
        setRestCountdown(1.0);
        pauseTimerRef.current = window.setTimeout(() => {
          setIsResting(false);
          speakSentence(0, 1, 'female');
        }, 800);
        return;
      } else {
        // 학습 종료 시 자동 저장 (15초 이상 학습했을 경우)
        if (sessionSeconds >= 15) {
          handleSaveCurrentSession();
        }
        setIsPlaying(false);
        setIsPaused(false);
        setIsResting(false);
        stopBackgroundAudio();
        return;
      }
    }

    // 화면 꺼짐 백그라운드 재생 유지 (무음 루프 오디오 활성화)
    if (isBgAudioMode) {
      startBackgroundAudio();
    }

    stopAllSpeech();
    setIsPlaying(true);
    setIsPaused(false);
    setIsResting(false);
    setCurrentSentenceIdx(sentenceIndex);
    setCurrentRepeat(repeatNum);
    setCurrentGender(targetGender);
    setIsRevealed(false);

    const textToSpeak = sentences[sentenceIndex];
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    activeUtteranceRef.current = utterance;

    // 1. 발화 성별 결정
    let effectiveGender: 'female' | 'male' = targetGender;
    if (voiceMode === 'female-only') effectiveGender = 'female';
    else if (voiceMode === 'male-only') effectiveGender = 'male';

    // 2. 음성 객체 먼저 할당 (Chromium 브라우저의 속도 리셋 방지)
    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (effectiveGender === 'female' && femaleVoiceURI) {
      selectedVoice = voices.find((item) => item.voiceURI === femaleVoiceURI);
    } else if (effectiveGender === 'male' && maleVoiceURI) {
      selectedVoice = voices.find((item) => item.voiceURI === maleVoiceURI);
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    // 3. 반드시 voice 할당 후에 rate와 pitch를 설정
    const effectiveRate = Number(playbackRateRef.current || playbackRate || 1.0);
    utterance.rate = Math.max(0.5, Math.min(2.0, effectiveRate));
    utterance.pitch = effectiveGender === 'female' ? 1.12 : 0.88;

    // 잠금 화면 / 블루투스 컨트롤 메타데이터 실시간 갱신 (MediaSession API)
    updateMediaSessionState(
      textToSpeak,
      (effectiveGender === 'female' ? '👩 여성 발음' : '👨 남성 발음') + ' · RepeatEcho',
      `문장 ${sentenceIndex + 1}/${sentences.length} · 반복 ${repeatNum}/${repeatCount}회 · 전체 ${loopCycle}회차`,
      {
        onPlay: handleResume,
        onPause: handlePause,
        onPrevious: handlePrevSentence,
        onNext: handleNextSentence
      }
    );

    // 단어별 하이라이트
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setActiveWordCharRange({
          start: event.charIndex,
          length: event.charLength || 4,
        });
      }
    };

    // 문장 읽기 종료 시 처리 (남/녀 교차 전환)
    utterance.onend = () => {
      setActiveWordCharRange(null);

      const nextGender: 'female' | 'male' =
        voiceMode === 'alternate' ? (targetGender === 'female' ? 'male' : 'female') : targetGender;

      // 1. 현재 문장의 반복 횟수가 남아있는 경우
      if (repeatNum < repeatCount) {
        pauseTimerRef.current = window.setTimeout(() => {
          speakSentence(sentenceIndex, repeatNum + 1, nextGender);
        }, 300);
      } else {
        // 2. 현재 문장의 반복 완료 -> 다음 문장으로 넘어가기 전 휴식
        const nextIdx = sentenceIndex + 1;

        if (nextIdx < sentences.length) {
          if (pauseSeconds > 0) {
            setIsResting(true);
            setRestCountdown(pauseSeconds);

            const startTime = Date.now();
            const totalDuration = pauseSeconds * 1000;

            countdownIntervalRef.current = window.setInterval(() => {
              const elapsed = Date.now() - startTime;
              const remaining = Math.max(0, (totalDuration - elapsed) / 1000);
              setRestCountdown(parseFloat(remaining.toFixed(1)));

              if (remaining <= 0) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
              }
            }, 100);

            pauseTimerRef.current = window.setTimeout(() => {
              setIsResting(false);
              speakSentence(nextIdx, 1, nextGender);
            }, totalDuration);
          } else {
            speakSentence(nextIdx, 1, nextGender);
          }
        } else {
          // 마지막 문장 종료 -> 전체 반복 여부 판별
          if (isFullLoop && sentences.length > 0) {
            setLoopCycle((prev) => prev + 1);
            setIsResting(true);
            setRestCountdown(1.0);
            pauseTimerRef.current = window.setTimeout(() => {
              setIsResting(false);
              speakSentence(0, 1, nextGender);
            }, 1000);
          } else {
            if (sessionSeconds >= 15) {
              handleSaveCurrentSession();
            }
            setIsPlaying(false);
            setIsPaused(false);
            setIsResting(false);
            stopBackgroundAudio();
          }
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Speech synthesis error:', e);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // 속도 조절 핸들러 (실시간 즉시 반영)
  const handlePlaybackRateChange = (newRate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Math.round(newRate * 10) / 10));
    setPlaybackRate(clamped);
    playbackRateRef.current = clamped;

    if (isPlaying && !isPaused && !isResting) {
      stopAllSpeech();
      speakSentence(currentSentenceIdx, currentRepeat, currentGender);
    }
  };

  // '학습 시작'
  const handleStart = () => {
    if (sentences.length === 0) {
      alert('먼저 학습할 영어 문장을 입력하거나 추천 예문을 선택해 주세요.');
      return;
    }
    setLoopCycle(1);
    setSessionSeconds(0);
    speakSentence(0, 1, 'female');
  };

  // '일시정지'
  const handlePause = () => {
    if (!isPlaying || isPaused) return;
    setIsPaused(true);
    clearAllTimers();
    pauseBackgroundAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  };

  // '재개'
  const handleResume = () => {
    if (!isPlaying || !isPaused) return;
    setIsPaused(false);
    if (isBgAudioMode) {
      startBackgroundAudio();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && isPlaying) {
          speakSentence(currentSentenceIdx, currentRepeat, currentGender);
        }
      }, 150);
    }
  };

  // '정지 (처음부터)'
  const handleStop = () => {
    // 15초 이상 학습했으면 정지 시 자동 저장
    if (sessionSeconds >= 15 && sentences.length > 0) {
      handleSaveCurrentSession();
    }
    stopAllSpeech();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIdx(0);
    setCurrentRepeat(1);
    setCurrentGender('female');
    setLoopCycle(1);
    setSessionSeconds(0);
    setIsResting(false);
    setIsRevealed(false);
  };

  // 이전 문장
  const handlePrevSentence = () => {
    if (currentSentenceIdx > 0) {
      speakSentence(currentSentenceIdx - 1, 1, 'female');
    }
  };

  // 다음 문장
  const handleNextSentence = () => {
    if (currentSentenceIdx < sentences.length - 1) {
      speakSentence(currentSentenceIdx + 1, 1, 'female');
    }
  };

  // 현재 문장 다시 듣기
  const handleReplayCurrent = () => {
    if (sentences.length > 0) {
      speakSentence(currentSentenceIdx, 1, currentGender);
    }
  };

  // 특정 문장 클릭하여 점프
  const handleJumpTo = (index: number) => {
    speakSentence(index, 1, 'female');
    if (mobileTab === 'list') {
      setMobileTab('theater');
    }
  };

  // 음성 모드 토글
  const cycleVoiceMode = () => {
    setVoiceMode((prev) => {
      if (prev === 'alternate') return 'female-only';
      if (prev === 'female-only') return 'male-only';
      return 'alternate';
    });
  };

  // 화면꺼짐 재생 모드 토글
  const toggleBgAudioMode = () => {
    setIsBgAudioMode((prev) => {
      const next = !prev;
      if (!next) {
        stopBackgroundAudio();
      } else if (isPlaying && !isPaused) {
        startBackgroundAudio();
      }
      return next;
    });
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying) handleStart();
        else if (isPaused) handleResume();
        else handlePause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSentence();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextSentence();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReplayCurrent();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        cycleVoiceMode();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsFullLoop((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isPaused, currentSentenceIdx, sentences, isFullLoop, currentGender, voiceMode]);

  // 단일 HTML 파일 다운로드
  const handleDownloadStandaloneHtml = () => {
    const htmlCode = generateStandaloneHtml(
      inputText,
      repeatCount,
      pauseSeconds,
      playbackRate,
      isFullLoop,
      voiceMode
    );
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'english_repeat_listening.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // HTML 코드 클립보드 복사
  const handleCopyHtml = async () => {
    const htmlCode = generateStandaloneHtml(
      inputText,
      repeatCount,
      pauseSeconds,
      playbackRate,
      isFullLoop,
      voiceMode
    );
    try {
      await navigator.clipboard.writeText(htmlCode);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // 대형 자막 크기 클래스
  const subtitleSizeClass =
    fontSize === 'xl' ? 'text-2xl sm:text-3xl md:text-4xl' : fontSize === 'lg' ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-xl md:text-2xl';

  const currentSentenceText = sentences[currentSentenceIdx] || '';
  const activeDisplayGender = voiceMode === 'female-only' ? 'female' : voiceMode === 'male-only' ? 'male' : currentGender;

  // 통계 계산
  const studyStats = useMemo(() => calculateStudyStats(studyLogs), [studyLogs]);

  // 자막 하이라이트 렌더링
  const renderHighlightedSubtitle = () => {
    if (!currentSentenceText) {
      return (
        <span className="text-slate-400 font-normal">
          '학습 시작'을 누르면 여자/남자 음성이 번갈아가며 재생됩니다.
        </span>
      );
    }

    if (isBlindMode && !isRevealed && isPlaying) {
      return (
        <div
          onClick={() => setIsRevealed(true)}
          className="cursor-pointer select-none py-4 px-6 rounded-2xl bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1.5 touch-manipulation"
        >
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm sm:text-base">
            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>블라인드 리스닝 모드</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">귀로 먼저 들은 후 터치하면 자막이 나타납니다</p>
          <span className="mt-1 text-xs text-sky-400 underline font-medium">자막 보기 (터치)</span>
        </div>
      );
    }

    if (activeWordCharRange && isPlaying && !isPaused && !isResting) {
      const { start, length } = activeWordCharRange;
      const before = currentSentenceText.slice(0, start);
      const highlighted = currentSentenceText.slice(start, start + length);
      const after = currentSentenceText.slice(start + length);

      return (
        <span>
          <span>{before}</span>
          <span className="bg-sky-400/25 text-sky-300 px-1 py-0.5 rounded-md border-b-2 border-sky-400 font-bold">
            {highlighted}
          </span>
          <span>{after}</span>
        </span>
      );
    }

    return <span>{currentSentenceText}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 pb-28 sm:pb-12">
      {/* Toast 알림 */}
      {showSaveSuccessToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce-short">
          <BookmarkCheck className="w-4 h-4 text-emerald-400" />
          <span>{showSaveSuccessToast}</span>
        </div>
      )}

      {/* =========================================================
          Top Bar: 모바일 및 PC 대응 헤더
          ========================================================= */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                RepeatEcho
              </span>
              <span className="hidden md:inline-block ml-2 text-xs text-slate-500 font-medium">
                날짜별 학습 저장 & 화면꺼짐 재생
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (데스크톱) */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>날짜별 학습 기록 ({studyLogs.length})</span>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('presets-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>추천 예문집</span>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('script-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-400" />
              <span>문장 리스트 ({sentences.length})</span>
            </button>
            <button
              onClick={() => setShowHtmlModal(true)}
              className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-slate-500" />
              <span>단일 HTML 다운로드</span>
            </button>
          </nav>

          {/* Zone 3: Actions (화면꺼짐 재생 토글, 저장, 재생/일시정지) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* 화면꺼짐 백그라운드 재생 모드 버튼 */}
            <button
              onClick={toggleBgAudioMode}
              title={isBgAudioMode ? '화면꺼짐 백그라운드 재생 활성화됨' : '화면꺼짐 재생 끔'}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] sm:min-h-[auto] ${
                isBgAudioMode
                  ? 'bg-sky-50 text-sky-800 border border-sky-300 shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Headphones className={`w-4 h-4 ${isBgAudioMode ? 'text-sky-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">화면꺼짐 재생: {isBgAudioMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* 오늘의 학습 저장 버튼 */}
            <button
              onClick={() => handleSaveCurrentSession()}
              title="현재 문장을 오늘 날짜의 학습 기록에 저장"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer min-h-[40px] sm:min-h-[auto]"
            >
              <Save className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">오늘 학습 저장</span>
            </button>

            {!isPlaying || isPaused ? (
              <button
                onClick={isPaused ? handleResume : handleStart}
                disabled={sentences.length === 0}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px] sm:min-h-[auto]"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isPaused ? '재개' : '시작'}</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] sm:min-h-[auto]"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>일시정지</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================
          모바일 전용 세그먼트 네비게이션 탭 (375px~430px 최적화)
          ========================================================= */}
      <div className="md:hidden px-3 pt-3 sticky top-14 z-30 bg-slate-50">
        <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setMobileTab('theater')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              mobileTab === 'theater' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>대형 자막</span>
          </button>
          <button
            onClick={() => setMobileTab('list')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              mobileTab === 'list' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>문장 ({sentences.length})</span>
          </button>
          <button
            onClick={() => setMobileTab('settings')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
              mobileTab === 'settings' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>음성 & 설정</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          Main Content Container
          ========================================================= */}
      <main className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 flex flex-col gap-5 sm:gap-6">

        {/* ---------------------------------------------------------
            1. 대형 자막 디스플레이 스테이지 (Hero Subtitle Stage)
            --------------------------------------------------------- */}
        <section
          className={`${
            mobileTab !== 'theater' ? 'hidden md:flex' : 'flex'
          } flex-col justify-between bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl border border-slate-800 min-h-[260px] sm:min-h-[320px] relative overflow-hidden transition-all`}
        >
          {/* 부드러운 앰비언트 글로우 백드롭 */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* 자막 상단 메타 바 */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-400 relative z-10 border-b border-slate-800/80 pb-3">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
              <span className="font-semibold text-slate-200">
                문장 <span className="tabular-nums text-indigo-400">{sentences.length > 0 ? currentSentenceIdx + 1 : 0}</span> / <span className="tabular-nums">{sentences.length}</span>
              </span>
              <span className="text-slate-700">·</span>
              <span className="font-semibold text-slate-200">
                반복 <span className="tabular-nums text-sky-400">{currentRepeat}</span> / <span className="tabular-nums">{repeatCount}</span>회
              </span>
              <span className="text-slate-700">·</span>

              {/* 실시간 발화 성별 뱃지 */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all shadow-xs ${
                  activeDisplayGender === 'female'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                }`}
              >
                <span>{activeDisplayGender === 'female' ? '👩 여성 음성' : '👨 남성 음성'}</span>
                {voiceMode === 'alternate' && (
                  <span className="text-[10px] text-slate-400 font-normal">(교차중)</span>
                )}
              </div>

              <span className="text-slate-700">·</span>

              {/* 전체 반복 상태 배지 */}
              <button
                onClick={() => setIsFullLoop(!isFullLoop)}
                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                  isFullLoop
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
                title="클릭하여 전체 반복 켜기/끄기"
              >
                <Repeat className="w-3 h-3" />
                <span>전체반복 {isFullLoop ? `ON (${loopCycle}회차)` : 'OFF'}</span>
              </button>

              <span className="text-slate-700">·</span>

              {/* 화면꺼짐 재생 활성 뱃지 */}
              {isBgAudioMode && (
                <span className="text-sky-400 text-xs font-medium flex items-center gap-1">
                  <Headphones className="w-3 h-3" />
                  <span className="hidden sm:inline">화면꺼짐 재생중</span>
                </span>
              )}
            </div>

            {/* 자막 옵션: 블라인드 모드 & 글자 크기 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsBlindMode(!isBlindMode)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer min-h-[36px] ${
                  isBlindMode
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {isBlindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isBlindMode ? '블라인드 ON' : '자막 가리기'}</span>
                <span className="sm:hidden">{isBlindMode ? '가림ON' : '가리기'}</span>
              </button>

              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60 text-xs">
                <button
                  onClick={() => setFontSize('md')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer min-h-[32px] ${
                    fontSize === 'md' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400'
                  }`}
                >
                  기본
                </button>
                <button
                  onClick={() => setFontSize('lg')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer min-h-[32px] ${
                    fontSize === 'lg' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400'
                  }`}
                >
                  크게
                </button>
                <button
                  onClick={() => setFontSize('xl')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer min-h-[32px] ${
                    fontSize === 'xl' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400'
                  }`}
                >
                  특대
                </button>
              </div>
            </div>
          </div>

          {/* 중앙 대형 자막 텍스트 영역 */}
          <div className="my-6 sm:my-8 text-center flex flex-col items-center justify-center relative z-10 min-h-[100px] sm:min-h-[140px]">
            <div
              className={`font-semibold tracking-normal leading-relaxed max-w-4xl transition-all duration-150 select-text ${subtitleSizeClass}`}
            >
              {renderHighlightedSubtitle()}
            </div>

            {/* 문장 간 쉬는 시간 카운트다운 표시기 */}
            {isResting && (
              <div className="mt-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-sky-950/80 border border-sky-500/30 text-sky-300 flex items-center gap-2 text-xs sm:text-sm animate-pulse">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
                <span>
                  {currentSentenceIdx >= sentences.length - 1 && isFullLoop ? (
                    <>전체 다음 회차 반복 대기 중: <strong className="tabular-nums font-bold text-white">{restCountdown}</strong>초</>
                  ) : (
                    <>
                      다음 문장까지 쉬는 시간: <strong className="tabular-nums font-bold text-white">{restCountdown}</strong>초
                      {voiceMode === 'alternate' && (
                        <span className="text-slate-400 ml-1">
                          (다음 발음: {activeDisplayGender === 'female' ? '👨 남성' : '👩 여성'})
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* 일시정지 상태 안내 */}
            {isPaused && (
              <div className="mt-3 px-3 py-1 rounded-lg bg-amber-900/60 border border-amber-600/40 text-amber-200 text-xs font-semibold">
                일시정지됨 (재생 버튼을 터치하여 계속)
              </div>
            )}
          </div>

          {/* 자막 하단: 다음 문장 미리보기 & 전체 진행도 게이지 */}
          <div className="relative z-10 border-t border-slate-800/80 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-xs sm:max-w-md">
                {currentSentenceIdx < sentences.length - 1 ? (
                  <>
                    <span className="text-slate-500 font-medium">다음 문장:</span>{' '}
                    <span className="text-slate-300 italic">{sentences[currentSentenceIdx + 1]}</span>
                  </>
                ) : sentences.length > 0 ? (
                  <span className="text-indigo-400 font-medium">
                    {isFullLoop ? `마지막 문장 (종료 후 1번으로 전체 반복)` : '마지막 문장입니다.'}
                  </span>
                ) : (
                  <span>문장을 입력하면 미리보기가 나타납니다.</span>
                )}
              </span>

              <div className="flex items-center gap-2 text-slate-400 shrink-0 ml-2">
                {isPlaying && (
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    학습중 {Math.floor(sessionSeconds / 60)}분 {sessionSeconds % 60}초
                  </span>
                )}
                <span className="tabular-nums font-medium text-slate-300">
                  진행 {sentences.length > 0 ? Math.round(((currentSentenceIdx + 1) / sentences.length) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-300"
                style={{
                  width: `${sentences.length > 0 ? ((currentSentenceIdx + 1) / sentences.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------
            스마트폰 화면꺼짐 재생 안내 배너 (Tip Banner)
            --------------------------------------------------------- */}
        {isBgAudioMode && (
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl px-3.5 py-2.5 text-xs text-sky-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <strong>화면꺼짐 재생 모드 활성화:</strong> 스마트폰 전원 버튼을 눌러 화면을 끄거나 주머니에 넣어도 이어폰으로 문장이 계속 낭독되며, 잠금화면 위젯으로 조작할 수 있습니다.
              </span>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------
            2. 메인 컨트롤 툴바 (Desktop / Tablet용)
            --------------------------------------------------------- */}
        <section
          className={`${
            mobileTab !== 'theater' ? 'hidden md:flex' : 'flex'
          } bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex-wrap items-center justify-between gap-3`}
        >
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            {!isPlaying || isPaused ? (
              <button
                onClick={isPaused ? handleResume : handleStart}
                disabled={sentences.length === 0}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs min-h-[44px]"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isPaused ? '재개' : '학습 시작'}</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
              >
                <Pause className="w-4 h-4" />
                <span>일시정지</span>
              </button>
            )}

            <button
              onClick={handleStop}
              disabled={!isPlaying && !isPaused}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="정지 (처음부터 다시)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* 음성 교차 모드 원터치 전환 버튼 */}
            <button
              onClick={cycleVoiceMode}
              className={`px-3 py-2.5 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                voiceMode === 'alternate'
                  ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="클릭하여 남/녀 교차, 여성 전용, 남성 전용 모드로 순환 변경합니다"
            >
              <Users className={`w-4 h-4 ${voiceMode === 'alternate' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>
                음성: <strong className={voiceMode === 'alternate' ? 'text-purple-700' : 'text-slate-700'}>
                  {voiceMode === 'alternate' ? '👩↔👨 남녀교차' : voiceMode === 'female-only' ? '👩 여성만' : '👨 남성만'}
                </strong>
              </span>
            </button>

            {/* 전체 반복 토글 버튼 */}
            <button
              onClick={() => setIsFullLoop(!isFullLoop)}
              className={`px-3 py-2.5 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                isFullLoop
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="모든 문장을 다 읽은 후 처음부터 다시 무한 반복합니다"
            >
              <Repeat className={`w-4 h-4 ${isFullLoop ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>전체 반복: <strong className={isFullLoop ? 'text-indigo-700' : 'text-slate-500'}>{isFullLoop ? 'ON' : 'OFF'}</strong></span>
            </button>

            <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevSentence}
                disabled={!isPlaying || currentSentenceIdx <= 0}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="이전 문장 (← 키)"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={handleReplayCurrent}
                disabled={sentences.length === 0}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[44px]"
                title="현재 문장 다시 듣기 (R 키)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">현재 문장 다시</span>
              </button>

              <button
                onClick={handleNextSentence}
                disabled={!isPlaying || currentSentenceIdx >= sentences.length - 1}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="다음 문장 (→ 키)"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 배속 조절 퀵 버튼 (실시간 반영) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[0.75, 1.0, 1.25, 1.5, 1.75].map((rate) => (
              <button
                key={rate}
                onClick={() => handlePlaybackRateChange(rate)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer tabular-nums min-h-[36px] ${
                  playbackRate === rate
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`${rate}배속으로 즉시 변경`}
              >
                {rate.toFixed(2).replace(/\.00$/, '')}x
              </button>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------
            3. 매개변수 & 남/녀 음성 선택 상세 설정 섹션
            --------------------------------------------------------- */}
        <section
          className={`${
            mobileTab !== 'settings' ? 'hidden md:block' : 'block'
          } bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">남/녀 음성 및 학습 매개변수 설정</h3>
            </div>
            <span className="text-xs text-slate-500">실시간 즉시 반영</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. 음성 발화 방식 */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>음성 발화 방식</span>
                <span className="text-purple-600 font-bold text-[11px]">
                  {voiceMode === 'alternate' ? '남/녀 번갈아 교차' : voiceMode === 'female-only' ? '여성만' : '남성만'}
                </span>
              </label>
              <select
                value={voiceMode}
                onChange={(e) => setVoiceMode(e.target.value as any)}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer min-h-[44px]"
              >
                <option value="alternate">👩 ↔ 👨 남/녀 번갈아 교차 (추천)</option>
                <option value="female-only">👩 여성 음성만 사용</option>
                <option value="male-only">👨 남성 음성만 사용</option>
              </select>
            </div>

            {/* 2. 문장별 반복 횟수 */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>문장별 반복 횟수</span>
                <span className="tabular-nums text-indigo-600 font-bold">{repeatCount}회</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setRepeatCount(Math.max(1, repeatCount - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                >
                  -
                </button>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(parseInt(e.target.value, 10))}
                  className="flex-1 accent-indigo-600 cursor-pointer min-h-[36px]"
                />
                <button
                  type="button"
                  onClick={() => setRepeatCount(Math.min(10, repeatCount + 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. 문장 간 쉬는 시간 */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>문장 간 쉬는 시간</span>
                <span className="tabular-nums text-indigo-600 font-bold">{pauseSeconds.toFixed(1)}초</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPauseSeconds(Math.max(0, +(pauseSeconds - 0.5).toFixed(1)))}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={pauseSeconds}
                  onChange={(e) => setPauseSeconds(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600 cursor-pointer min-h-[36px]"
                />
                <button
                  type="button"
                  onClick={() => setPauseSeconds(Math.min(5, +(pauseSeconds + 0.5).toFixed(1)))}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                >
                  +
                </button>
              </div>
            </div>

            {/* 4. 읽기 속도 조절 */}
            <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>읽기 속도</span>
                <span className="tabular-nums text-indigo-600 font-bold">{playbackRate.toFixed(1)}배속</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handlePlaybackRateChange(playbackRate - 0.1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                  title="0.1배속 느리게"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={playbackRate}
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600 cursor-pointer min-h-[36px]"
                />
                <button
                  type="button"
                  onClick={() => handlePlaybackRateChange(playbackRate + 0.1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 active:bg-slate-100 font-bold cursor-pointer text-base"
                  title="0.1배속 빠르게"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 세부 음성 매핑 (여성 음성 / 남성 음성 개별 선택 드롭다운) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                <span>👩 지정 여성 음성 (Female Voice)</span>
                <span className="text-slate-400 font-normal text-[11px]">· 고음역 맑은 톤 자동보정</span>
              </label>
              <select
                value={femaleVoiceURI}
                onChange={(e) => setFemaleVoiceURI(e.target.value)}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer truncate min-h-[44px]"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {detectVoiceGender(v) === 'female' ? '👩 [여성추천] ' : '🗣 '}
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">
                <span>👨 지정 남성 음성 (Male Voice)</span>
                <span className="text-slate-400 font-normal text-[11px]">· 중저음 톤 자동보정</span>
              </label>
              <select
                value={maleVoiceURI}
                onChange={(e) => setMaleVoiceURI(e.target.value)}
                className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer truncate min-h-[44px]"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {detectVoiceGender(v) === 'male' ? '👨 [남성추천] ' : '🗣 '}
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------
            4. 텍스트 입력창 & 추천 예문집
            --------------------------------------------------------- */}
        <section
          id="presets-section"
          className={`${
            mobileTab !== 'settings' ? 'hidden md:grid' : 'grid'
          } grid-cols-1 lg:grid-cols-3 gap-5`}
        >
          {/* 좌측 2칸: 텍스트 입력창 */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">학습할 영어 문장 입력</h3>
              </div>

              {/* 분리 모드 토글 */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setSplitMode('punctuation')}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer min-h-[36px] ${
                    splitMode === 'punctuation'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  문장부호(.?!) 분리
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('newline')}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer min-h-[36px] ${
                    splitMode === 'newline'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  줄바꿈 단위 분리
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="영어 문장들을 여기에 붙여넣으세요..."
              rows={6}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed font-sans text-slate-800 resize-y"
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                인식된 문장 수: <strong className="text-indigo-600 font-bold">{sentences.length}개</strong>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveCurrentSession()}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 p-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>오늘 날짜로 저장</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="hover:text-rose-600 p-1 cursor-pointer"
                >
                  텍스트 비우기
                </button>
              </div>
            </div>
          </div>

          {/* 우측 1칸: 섀도잉 추천 예문집 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">추천 섀도잉 예문집</h3>
            </div>
            <p className="text-xs text-slate-500">터치 한 번으로 검증된 원어민 예문 로드</p>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] pr-1">
              {PRESET_LESSONS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    handleStop();
                    setInputText(preset.text);
                    if (mobileTab === 'settings') {
                      setMobileTab('theater');
                    }
                  }}
                  className="text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer group min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                      {preset.title}
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------
            5. 문장 리스트 & 실시간 하이라이트 (Script List)
            --------------------------------------------------------- */}
        <section
          id="script-section"
          className={`${
            mobileTab !== 'list' ? 'hidden md:flex' : 'flex'
          } flex-col bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs gap-3`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">문장 리스트 ({sentences.length})</h3>
            </div>
            <span className="text-xs text-slate-500">터치 시 해당 문장 즉시 재생</span>
          </div>

          <div
            ref={listContainerRef}
            className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100"
          >
            {sentences.length > 0 ? (
              sentences.map((sentence, idx) => {
                const isActive = idx === currentSentenceIdx && isPlaying;
                return (
                  <div
                    key={idx}
                    ref={isActive ? currentSentenceItemRef : null}
                    onClick={() => handleJumpTo(idx)}
                    className={`pt-2.5 first:pt-0 p-3 rounded-xl transition-all flex items-start gap-3 cursor-pointer group min-h-[50px] ${
                      isActive
                        ? 'bg-indigo-50/80 border border-indigo-200 text-indigo-950 shadow-xs'
                        : 'hover:bg-slate-50 active:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 text-xs font-bold">
                      {isActive ? (
                        <div className={`w-7 h-7 rounded-lg text-white flex items-center justify-center ${activeDisplayGender === 'female' ? 'bg-rose-500' : 'bg-sky-600'}`}>
                          <Volume2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <span className="text-slate-500 group-hover:text-indigo-600">
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className={`text-sm leading-relaxed ${isActive ? 'font-bold text-indigo-950' : 'font-medium'}`}>
                        {sentence}
                      </p>

                      {isActive && (
                        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 text-xs text-indigo-600 font-semibold">
                          <span className={`px-1.5 py-0.2 rounded text-[11px] ${activeDisplayGender === 'female' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                            {activeDisplayGender === 'female' ? '👩 여성' : '👨 남성'}
                          </span>
                          <span>반복 {currentRepeat} / {repeatCount}회</span>
                          <span>·</span>
                          <span>{playbackRate.toFixed(1)}x</span>
                          {isFullLoop && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-700">전체 {loopCycle}회차</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpTo(idx);
                      }}
                      className="p-2 rounded-lg text-indigo-600 transition-opacity cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="이 문장 듣기"
                    >
                      <Play className="w-4 h-4 fill-indigo-600" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                입력된 문장이 없습니다.
              </div>
            )}
          </div>
        </section>

      </main>

      {/* =========================================================
          스마트폰 전용 하단 고정 제어 바 (Mobile Sticky Thumb Bar)
          ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 shadow-lg flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="truncate max-w-[170px]">
            {sentences.length > 0
              ? `${currentSentenceIdx + 1}/${sentences.length}: ${sentences[currentSentenceIdx] || ''}`
              : '문장 없음'}
          </span>
          <div className="flex items-center gap-1.5 font-semibold">
            <span className={activeDisplayGender === 'female' ? 'text-rose-600' : 'text-sky-600'}>
              {activeDisplayGender === 'female' ? '👩 여성' : '👨 남성'}
            </span>
            <span>·</span>
            <span className="text-indigo-600">반복 {currentRepeat}/{repeatCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 items-center">
          <button
            onClick={handlePrevSentence}
            disabled={!isPlaying || currentSentenceIdx <= 0}
            className="h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center disabled:opacity-40 active:bg-slate-200"
            title="이전 문장"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (!isPlaying) handleStart();
              else if (isPaused) handleResume();
              else handlePause();
            }}
            disabled={sentences.length === 0}
            className={`col-span-2 h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] ${
              !isPlaying || isPaused
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-white'
            }`}
          >
            {!isPlaying || isPaused ? (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{isPaused ? '재개' : '시작'}</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span>일시정지</span>
              </>
            )}
          </button>

          <button
            onClick={handleNextSentence}
            disabled={!isPlaying || currentSentenceIdx >= sentences.length - 1}
            className="h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center disabled:opacity-40 active:bg-slate-200"
            title="다음 문장"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* 화면꺼짐 재생 토글 */}
          <button
            onClick={toggleBgAudioMode}
            className={`h-11 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
              isBgAudioMode
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-slate-100 text-slate-500'
            }`}
            title="화면꺼짐 재생 토글"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{isBgAudioMode ? '화면꺼짐' : '일반'}</span>
          </button>

          {/* 날짜별 기록 모달 열기 */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex flex-col items-center justify-center text-[10px] font-bold"
            title="날짜별 공부 기록"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>기록({studyLogs.length})</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          Footer (데스크톱)
          ========================================================= */}
      <footer className="border-t border-slate-200 bg-white py-5 hidden md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">RepeatEcho</span> · 날짜별 학습 저장 · 👩 여성 ↔ 👨 남성 교차 · 스마트폰 화면꺼짐 재생
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>날짜별 공부 기록 보기</span>
            </button>
            <button
              onClick={() => setShowHtmlModal(true)}
              className="text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>단일 index.html 내보내기</span>
            </button>
          </div>
        </div>
      </footer>

      {/* =========================================================
          [핵심 모달] 날짜별 공부 내용 저장 & 복습 캘린더 모달
          ========================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* 모달 헤더 */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">날짜별 영어 학습 기록 & 복습</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    공부한 날짜와 문장이 자동/수동 저장되며, 언제든 클릭 한 번으로 다시 불러와 복습할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* 통계 요약 띠 */}
            <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 bg-slate-50 border-b border-slate-200 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">총 학습 일수</span>
                <div className="text-base sm:text-lg font-bold text-indigo-600 mt-0.5">{studyStats.uniqueDays}일</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">총 학습 세션</span>
                <div className="text-base sm:text-lg font-bold text-sky-600 mt-0.5">{studyStats.totalSessions}회</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">총 누적 시간</span>
                <div className="text-base sm:text-lg font-bold text-emerald-600 mt-0.5">{studyStats.totalMinutes}분</div>
              </div>
            </div>

            {/* 현재 문장 즉시 저장 인풋 바 */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={saveTitleInput}
                onChange={(e) => setSaveTitleInput(e.target.value)}
                placeholder={`현재 문장 제목 입력 (기본: "${sentences[0]?.slice(0, 20) || '오늘의 학습'}...")`}
                className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={() => handleSaveCurrentSession()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>오늘 날짜로 저장</span>
              </button>
            </div>

            {/* 날짜별 히스토리 리스트 */}
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              {studyLogs.length > 0 ? (
                studyLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const logSentences = log.text.split(/(?<=[.?!])\s+|\n+/).filter(Boolean);

                  return (
                    <div
                      key={log.id}
                      className="border border-slate-200 rounded-2xl p-3.5 sm:p-4 hover:border-slate-300 hover:shadow-xs transition-all bg-white flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-md text-[11px] font-bold">
                              {formatKoreanDate(log.date)} {log.time}
                            </span>
                            <span className="text-xs text-slate-500">
                              · {log.sentenceCount}개 문장 (반복 {log.repeatCount}회)
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{log.title}</h4>
                        </div>

                        <button
                          onClick={() => handleDeleteSession(log.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="기록 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 세션 메타 정보 */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <span>학습시간: {Math.max(1, Math.round(log.durationSeconds / 60))}분</span>
                          <span>·</span>
                          <span>{log.totalCycles}회차 완료</span>
                          <span>·</span>
                          <span>
                            {log.voiceMode === 'alternate' ? '남녀교차' : log.voiceMode === 'female-only' ? '여성만' : '남성만'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 sm:mt-0">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer py-1"
                          >
                            <span>{isExpanded ? '문장 접기' : '문장 보기'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleLoadPastSession(log)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-[0.98]"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>이 날 문장 복습하기</span>
                          </button>
                        </div>
                      </div>

                      {/* 펼쳐보기 영역 */}
                      {isExpanded && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                          {logSentences.map((s, idx) => (
                            <div key={idx} className="flex items-baseline gap-2">
                              <span className="text-slate-400 font-bold min-w-[20px]">{idx + 1}.</span>
                              <span className="text-slate-800">{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                  <Calendar className="w-8 h-8 text-slate-300" />
                  <span>아직 저장된 날짜별 학습 기록이 없습니다.</span>
                  <span className="text-xs text-slate-400">학습을 진행하면 완료 시 자동으로 저장되거나, 위의 '오늘 날짜로 저장' 버튼을 누르면 기록됩니다.</span>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {studyLogs.length > 0 ? (
                <button
                  onClick={() => {
                    if (confirm('정말로 모든 학습 기록을 삭제하시겠습니까?')) {
                      clearAllStudyLogs();
                      setStudyLogs([]);
                    }
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer py-1 px-2"
                >
                  전체 기록 초기화
                </button>
              ) : <div />}

              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          단일 HTML 파일 다운로드 & 소스코드 복사 모달
          ========================================================= */}
      {showHtmlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">단일 HTML 파일 (index.html) 다운로드</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  날짜별 학습 저장, 스마트폰 화면꺼짐 재생, 남녀 교차 음성이 모두 내장된 완전 독립형 파일입니다.
                </p>
              </div>
              <button
                onClick={() => setShowHtmlModal(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">✨ 최신 기능 반영 완료:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>날짜별 공부 내용 저장:</strong> 브라우저 LocalStorage를 통해 단일 파일에서도 날짜별 기록 및 복습이 가능합니다.</li>
                  <li><strong>화면꺼짐 백그라운드 재생:</strong> MediaSession API와 무음 오디오 세션 루프를 탑재하여 스마트폰 잠금 상태에서도 끊김 없이 재생됩니다.</li>
                  <li><strong>남/녀 자동 교차 발음:</strong> 여성과 남성 음성이 번갈아가며 섀도잉 발화를 이끌어줍니다.</li>
                </ul>
              </div>

              <pre className="p-3 sm:p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono max-h-56 overflow-y-auto">
                {generateStandaloneHtml(inputText, repeatCount, pauseSeconds, playbackRate, isFullLoop, voiceMode).slice(0, 1000)}
                {'\n... (전체 520여 줄의 단일 HTML 완성 코드)'}
              </pre>
            </div>

            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={handleCopyHtml}
                className="px-3 sm:px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              >
                {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHtml ? '복사 완료!' : 'HTML 복사'}</span>
              </button>
              <button
                onClick={handleDownloadStandaloneHtml}
                className="px-3 sm:px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>index.html 파일 받기</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
