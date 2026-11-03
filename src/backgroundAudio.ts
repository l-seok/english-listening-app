/**
 * Background audio keeper and MediaSession controller for mobile screen-off playback
 * Keeps the mobile browser audio thread and JavaScript timer alive when the screen is turned off.
 */

// 1-second silent WAV 44.1kHz mono Base64 data URI
const SILENT_WAV_BASE64 =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/wD/';

let backgroundAudioElement: HTMLAudioElement | null = null;

export function initBackgroundAudio(): HTMLAudioElement {
  if (!backgroundAudioElement && typeof window !== 'undefined') {
    const audio = new Audio(SILENT_WAV_BASE64);
    audio.loop = true;
    audio.volume = 0.01; // minimal volume to avoid complete zero mute optimization by mobile OS
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    backgroundAudioElement = audio;
  }
  return backgroundAudioElement!;
}

export async function startBackgroundAudio(): Promise<boolean> {
  try {
    const audio = initBackgroundAudio();
    if (audio.paused) {
      await audio.play();
    }
    return true;
  } catch (err) {
    console.warn('Background audio auto-start restricted, waiting for user gesture:', err);
    return false;
  }
}

export function pauseBackgroundAudio(): void {
  if (backgroundAudioElement && !backgroundAudioElement.paused) {
    backgroundAudioElement.pause();
  }
}

export function stopBackgroundAudio(): void {
  if (backgroundAudioElement) {
    backgroundAudioElement.pause();
    backgroundAudioElement.currentTime = 0;
  }
}

export interface MediaSessionControls {
  onPlay?: () => void;
  onPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function updateMediaSessionState(
  title: string,
  artist: string,
  album: string,
  controls?: MediaSessionControls
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || '영어 문장 반복 청취',
      artist: artist || 'RepeatEcho',
      album: album || '반복 섀도잉 학습'
    });

    if (controls) {
      if (controls.onPlay) {
        navigator.mediaSession.setActionHandler('play', controls.onPlay);
      }
      if (controls.onPause) {
        navigator.mediaSession.setActionHandler('pause', controls.onPause);
      }
      if (controls.onPrevious) {
        navigator.mediaSession.setActionHandler('previoustrack', controls.onPrevious);
      }
      if (controls.onNext) {
        navigator.mediaSession.setActionHandler('nexttrack', controls.onNext);
      }
    }
  } catch (err) {
    console.warn('MediaSession update error:', err);
  }
}
