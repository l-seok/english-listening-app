/**
 * Voice gender detection and classification helper for Web Speech API
 */

const FEMALE_INDICATORS = [
  'female', 'woman', 'samantha', 'victoria', 'karen', 'zira', 'jenny', 'ava', 'emma',
  'sonia', 'fiona', 'moira', 'veena', 'tessa', 'susan', 'hazel', 'catherine',
  'natural (female)', 'google us english', 'en-us-standard-c', 'en-us-standard-e',
  'en-us-wavenet-c', 'en-us-wavenet-e', 'stephanie', 'allison', 'linda', 'joanna', 'kendra'
];

const MALE_INDICATORS = [
  'male', 'man', 'alex', 'daniel', 'david', 'george', 'guy', 'fred', 'tom',
  'oliver', 'arthur', 'james', 'natural (male)', 'google uk english male',
  'en-us-standard-b', 'en-us-standard-d', 'en-us-wavenet-b', 'en-us-wavenet-d',
  'brian', 'rishi', 'matthew', 'justin', 'joey'
];

export function detectVoiceGender(voice: SpeechSynthesisVoice): 'female' | 'male' | 'unknown' {
  const name = voice.name.toLowerCase();
  for (const indicator of FEMALE_INDICATORS) {
    if (name.includes(indicator)) return 'female';
  }
  for (const indicator of MALE_INDICATORS) {
    if (name.includes(indicator)) return 'male';
  }
  return 'unknown';
}

export interface DualVoiceConfig {
  mode: 'alternate' | 'single';
  femaleVoiceURI: string;
  maleVoiceURI: string;
}

export function pickBestDefaultVoices(voices: SpeechSynthesisVoice[]): {
  femaleVoice: SpeechSynthesisVoice | null;
  maleVoice: SpeechSynthesisVoice | null;
} {
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  const candidatePool = englishVoices.length > 0 ? englishVoices : voices;

  let female: SpeechSynthesisVoice | null = null;
  let male: SpeechSynthesisVoice | null = null;

  for (const v of candidatePool) {
    const gender = detectVoiceGender(v);
    if (gender === 'female' && !female) {
      female = v;
    } else if (gender === 'male' && !male) {
      male = v;
    }
    if (female && male) break;
  }

  // Fallbacks if one or both genders weren't explicitly matched
  if (!female && candidatePool.length > 0) {
    female = candidatePool[0];
  }
  if (!male && candidatePool.length > 1) {
    male = candidatePool[1];
  } else if (!male && candidatePool.length > 0) {
    male = candidatePool[0];
  }

  return { femaleVoice: female, maleVoice: male };
}
