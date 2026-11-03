/**
 * Study history and session log management for daily English learning
 */

export interface StudySessionLog {
  id: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:mm'
  timestamp: number;
  title: string;
  text: string;
  sentenceCount: number;
  repeatCount: number;
  totalCycles: number;
  totalSentencesSpoken: number;
  durationSeconds: number;
  voiceMode: 'alternate' | 'female-only' | 'male-only';
  playbackRate: number;
}

const STORAGE_KEY = 'repeatecho_study_logs_v1';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatKoreanDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
}

export function loadStudyLogs(): StudySessionLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    }
    return [];
  } catch (e) {
    console.warn('Failed to load study logs from localStorage:', e);
    return [];
  }
}

export function saveStudyLog(log: Omit<StudySessionLog, 'id' | 'timestamp' | 'date' | 'time' | 'title'> & { customDate?: string; title?: string }): StudySessionLog {
  const logs = loadStudyLogs();
  const now = new Date();
  const dateStr = log.customDate || getTodayDateString();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Generate title from first sentence if not specified
  let autoTitle = log.title?.trim();
  if (!autoTitle) {
    const firstLine = log.text.trim().split('\n')[0] || '영어 학습';
    autoTitle = firstLine.length > 30 ? firstLine.slice(0, 30) + '...' : firstLine;
  }

  const newEntry: StudySessionLog = {
    ...log,
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date: dateStr,
    time: timeStr,
    timestamp: Date.now(),
    title: autoTitle
  };

  const updated = [newEntry, ...logs];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save study log:', e);
  }

  return newEntry;
}

export function deleteStudyLog(id: string): StudySessionLog[] {
  const logs = loadStudyLogs();
  const updated = logs.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to delete study log:', e);
  }
  return updated;
}

export function clearAllStudyLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear logs:', e);
  }
}

export function groupLogsByDate(logs: StudySessionLog[]): Record<string, StudySessionLog[]> {
  const groups: Record<string, StudySessionLog[]> = {};
  for (const log of logs) {
    if (!groups[log.date]) {
      groups[log.date] = [];
    }
    groups[log.date].push(log);
  }
  return groups;
}

export function calculateStudyStats(logs: StudySessionLog[]) {
  const uniqueDays = new Set(logs.map((l) => l.date)).size;
  const totalSentences = logs.reduce((acc, cur) => acc + (cur.totalSentencesSpoken || cur.sentenceCount * cur.repeatCount), 0);
  const totalSeconds = logs.reduce((acc, cur) => acc + (cur.durationSeconds || 0), 0);
  return {
    uniqueDays,
    totalSessions: logs.length,
    totalSentences,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60)
  };
}
