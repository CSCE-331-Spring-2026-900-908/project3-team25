let ytPlayer;
let ytReady = false;
let saveTimer = null;

const YT_VIDEO_ID = 'XDELAKWrnMc';
const FIXED_VOLUME = 20;

const MUSIC_STORAGE_KEYS = {
  playing: 'rbt_music_playing',
  time: 'rbt_music_time',
  muted: 'rbt_music_muted'
};

function getSavedPlaying() {
  const value = localStorage.getItem(MUSIC_STORAGE_KEYS.playing);
  return value === null ? false : value === 'true';
}

function getSavedTime() {
  return Number(localStorage.getItem(MUSIC_STORAGE_KEYS.time) || '0');
}

function getSavedMuted() {
  const value = localStorage.getItem(MUSIC_STORAGE_KEYS.muted);
  return value === null ? true : value === 'true';
}

function setSavedPlaying(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.playing, String(value));
}

function setSavedTime(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.time, String(value || 0));
}

function setSavedMuted(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.muted, String(value));
}

function updateMuteButton() {
  const btn = document.getElementById('musicMuteBtn');
  if (!btn) return;
  const muted = getSavedMuted();
  btn.textContent = muted ? '🔇' : '🔊';
  btn.setAttribute('aria-label', muted ? 'Unmute background music' : 'Mute background music');
  btn.setAttribute('title', muted ? 'Unmute music' : 'Mute music');
  btn.classList.toggle('is-muted', muted);
}

function savePlayerState() {
  if (!ytPlayer || !ytReady) return;
  try {
    const currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    setSavedTime(currentTime);
  } catch (err) {
    console.error('Could not save player time:', err);
  }
}

function startSaveLoop() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(() => {
    if (getSavedPlaying()) savePlayerState();
  }, 1000);
}

function applyMuteState() {
  if (!ytPlayer || !ytReady) return;
  ytPlayer.setVolume(FIXED_VOLUME);
  if (getSavedMuted()) {
    ytPlayer.mute();
  } else {
    ytPlayer.unMute();
    ytPlayer.setVolume(FIXED_VOLUME);
  }
  updateMuteButton();
}

function restorePlayback() {
  if (!ytPlayer || !ytReady) return;
  const savedTime = getSavedTime();
  const shouldPlay = getSavedPlaying();
  ytPlayer.setVolume(FIXED_VOLUME);
  if (savedTime > 0) ytPlayer.seekTo(savedTime, true);
  applyMuteState();
  if (shouldPlay) ytPlayer.playVideo();
}

function toggleMute() {
  if (!ytPlayer || !ytReady) return;
  const nextMuted = !getSavedMuted();
  setSavedMuted(nextMuted);
  if (nextMuted) {
    ytPlayer.mute();
  } else {
    ytPlayer.unMute();
    ytPlayer.setVolume(FIXED_VOLUME);
    ytPlayer.playVideo();
    setSavedPlaying(true);
  }
  updateMuteButton();
}

function attachMusicControls() {
  const muteBtn = document.getElementById('musicMuteBtn');
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);
  updateMuteButton();
}

function onPlayerReady() {
  ytReady = true;
  restorePlayback();
  startSaveLoop();
  window.addEventListener('beforeunload', () => {
    savePlayerState();
  });
}

function onPlayerStateChange(event) {
  if (!window.YT || !window.YT.PlayerState) return;
  if (event.data === window.YT.PlayerState.PLAYING) {
    setSavedPlaying(true);
    applyMuteState();
  }
  if (event.data === window.YT.PlayerState.PAUSED) savePlayerState();
}

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('youtube-player', {
    height: '1',
    width: '1',
    videoId: YT_VIDEO_ID,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      loop: 1,
      modestbranding: 1,
      playlist: YT_VIDEO_ID,
      rel: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  attachMusicControls();
});