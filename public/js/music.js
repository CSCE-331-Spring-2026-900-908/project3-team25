let ytPlayer;
let ytReady = false;
let saveTimer = null;

const YT_VIDEO_ID = 'XDELAKWrnMc';
const MUSIC_STORAGE_KEYS = {
  playing: 'rbt_music_playing',
  time: 'rbt_music_time',
  volume: 'rbt_music_volume'
};

function getSavedPlaying() {
  return localStorage.getItem(MUSIC_STORAGE_KEYS.playing) === 'true';
}

function getSavedTime() {
  return Number(localStorage.getItem(MUSIC_STORAGE_KEYS.time) || '0');
}

function getSavedVolume() {
  const value = Number(localStorage.getItem(MUSIC_STORAGE_KEYS.volume) || '85');
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 85;
}

function setSavedPlaying(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.playing, String(value));
}

function setSavedTime(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.time, String(value || 0));
}

function setSavedVolume(value) {
  localStorage.setItem(MUSIC_STORAGE_KEYS.volume, String(value));
}

function updateMusicButton() {
  const btn = document.getElementById('musicBtn');
  if (!btn) return;
  btn.textContent = getSavedPlaying() ? 'Pause Music' : 'Play Music';
}

function updateVolumeLabel() {
  const label = document.getElementById('musicVolumeLabel');
  if (!label) return;
  label.textContent = `Volume: ${getSavedVolume()}%`;
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

function restorePlayback() {
  if (!ytPlayer || !ytReady) return;

  const savedTime = getSavedTime();
  const savedVolume = getSavedVolume();
  const shouldPlay = getSavedPlaying();

  ytPlayer.setVolume(savedVolume);

  if (savedTime > 0) {
    ytPlayer.seekTo(savedTime, true);
  }

  if (shouldPlay) {
    ytPlayer.playVideo();
  } else {
    ytPlayer.pauseVideo();
  }

  updateMusicButton();
  updateVolumeLabel();
}

function toggleMusic() {
  if (!ytPlayer || !ytReady) return;

  const shouldPlay = !getSavedPlaying();
  setSavedPlaying(shouldPlay);

  if (shouldPlay) {
    ytPlayer.playVideo();
  } else {
    savePlayerState();
    ytPlayer.pauseVideo();
  }

  updateMusicButton();
}

function setMusicVolume(value) {
  const volume = Math.max(0, Math.min(100, Number(value)));
  setSavedVolume(volume);

  if (ytPlayer && ytReady) {
    ytPlayer.setVolume(volume);
  }

  updateVolumeLabel();
}

function attachMusicControls() {
  const btn = document.getElementById('musicBtn');
  const slider = document.getElementById('musicVolume');

  if (btn) {
    btn.addEventListener('click', toggleMusic);
  }

  if (slider) {
    slider.value = String(getSavedVolume());
    slider.addEventListener('input', (e) => {
      setMusicVolume(e.target.value);
    });
  }

  updateMusicButton();
  updateVolumeLabel();
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
    updateMusicButton();
  }

  if (event.data === window.YT.PlayerState.PAUSED) {
    savePlayerState();
    setSavedPlaying(false);
    updateMusicButton();
  }
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