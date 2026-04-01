const ACCESSIBILITY_STORAGE_KEY = 'rbt_accessibility_settings';
const DEFAULT_ACCESSIBILITY_SETTINGS = {
  fontScale: 1,
  highContrast: false,
  reduceMotion: false,
  disableAudio: false
};

function getAccessibilitySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) || '{}');
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS, ...saved };
  } catch (_) {
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  }
}

function saveAccessibilitySettings(settings) {
  localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
  window.__accessibilitySettings = settings;
}

function announceAccessibility(message) {
  const liveRegion = document.getElementById('sr-live-region');
  if (!liveRegion || !message) return;
  liveRegion.textContent = '';
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 30);
}

function updateToolbarButtons(settings) {
  const contrastBtn = document.getElementById('toggle-contrast-btn');
  const motionBtn = document.getElementById('toggle-motion-btn');
  const audioBtn = document.getElementById('toggle-audio-btn');
  const scaleLabel = document.getElementById('font-scale-label');

  if (contrastBtn) {
    contrastBtn.setAttribute('aria-pressed', String(settings.highContrast));
    contrastBtn.textContent = settings.highContrast ? 'Standard Colors' : 'High Contrast';
  }

  if (motionBtn) {
    motionBtn.setAttribute('aria-pressed', String(settings.reduceMotion));
    motionBtn.textContent = settings.reduceMotion ? 'Allow Motion' : 'Reduce Motion';
  }

  if (audioBtn) {
    audioBtn.setAttribute('aria-pressed', String(settings.disableAudio));
    audioBtn.textContent = settings.disableAudio ? 'Enable Music' : 'Mute Site Music';
  }

  if (scaleLabel) {
    scaleLabel.textContent = `${Math.round(settings.fontScale * 100)}%`;
  }
}

function applyAccessibilitySettings(settings) {
  const safeScale = Math.max(0.9, Math.min(1.4, Number(settings.fontScale || 1)));
  document.documentElement.style.fontSize = `${safeScale * 100}%`;
  document.body.classList.toggle('high-contrast-mode', !!settings.highContrast);
  document.body.classList.toggle('reduce-motion-mode', !!settings.reduceMotion);
  document.body.classList.toggle('audio-disabled-mode', !!settings.disableAudio);
  updateToolbarButtons({ ...settings, fontScale: safeScale });
}

function updateSetting(updater, announcement) {
  const current = getAccessibilitySettings();
  const next = updater({ ...current });
  saveAccessibilitySettings(next);
  applyAccessibilitySettings(next);
  if (announcement) announceAccessibility(announcement(next));
}

function injectAccessibilityUI() {
  const body = document.body;
  if (!body) return;

  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  body.prepend(skipLink);

  const toolbar = document.createElement('section');
  toolbar.className = 'accessibility-toolbar';
  toolbar.setAttribute('aria-label', 'Accessibility controls');
  toolbar.innerHTML = `
    <div class="accessibility-toolbar__group">
      <strong>Accessibility</strong>
      <span class="toolbar-hint">Alt + = / Alt + - / Alt + 2</span>
    </div>
    <div class="accessibility-toolbar__group">
      <button class="btn ghost toolbar-btn" id="decrease-font-btn" type="button">A-</button>
      <span class="font-scale-pill" id="font-scale-label">100%</span>
      <button class="btn ghost toolbar-btn" id="increase-font-btn" type="button">A+</button>
    </div>
    <div class="accessibility-toolbar__group toolbar-toggle-group">
      <button class="btn ghost toolbar-btn" id="toggle-contrast-btn" type="button" aria-pressed="false">High Contrast</button>
      <button class="btn ghost toolbar-btn" id="toggle-motion-btn" type="button" aria-pressed="false">Reduce Motion</button>
      <button class="btn ghost toolbar-btn" id="toggle-audio-btn" type="button" aria-pressed="false">Mute Site Music</button>
    </div>
  `;
  body.insertBefore(toolbar, body.firstChild.nextSibling);

  const live = document.createElement('div');
  live.id = 'sr-live-region';
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  body.appendChild(live);

  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main-content';
    main.setAttribute('tabindex', '-1');
  }

  document.getElementById('increase-font-btn')?.addEventListener('click', () => {
    updateSetting((settings) => ({ ...settings, fontScale: Math.min(1.4, Number(settings.fontScale || 1) + 0.1) }),
      (settings) => `Text size set to ${Math.round(settings.fontScale * 100)} percent.`);
  });

  document.getElementById('decrease-font-btn')?.addEventListener('click', () => {
    updateSetting((settings) => ({ ...settings, fontScale: Math.max(0.9, Number(settings.fontScale || 1) - 0.1) }),
      (settings) => `Text size set to ${Math.round(settings.fontScale * 100)} percent.`);
  });

  document.getElementById('toggle-contrast-btn')?.addEventListener('click', () => {
    updateSetting((settings) => ({ ...settings, highContrast: !settings.highContrast }),
      (settings) => settings.highContrast ? 'High contrast mode enabled.' : 'High contrast mode disabled.');
  });

  document.getElementById('toggle-motion-btn')?.addEventListener('click', () => {
    updateSetting((settings) => ({ ...settings, reduceMotion: !settings.reduceMotion }),
      (settings) => settings.reduceMotion ? 'Reduced motion enabled.' : 'Reduced motion disabled.');
  });

  document.getElementById('toggle-audio-btn')?.addEventListener('click', () => {
    updateSetting((settings) => ({ ...settings, disableAudio: !settings.disableAudio }),
      (settings) => settings.disableAudio ? 'Background music muted for accessibility.' : 'Background music enabled.');
    window.dispatchEvent(new CustomEvent('rbt-audio-setting-changed'));
  });

  document.addEventListener('keydown', (event) => {
    if (!event.altKey) return;
    if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      document.getElementById('increase-font-btn')?.click();
    } else if (event.key === '-') {
      event.preventDefault();
      document.getElementById('decrease-font-btn')?.click();
    } else if (event.key === '2') {
      event.preventDefault();
      document.getElementById('toggle-contrast-btn')?.click();
    } else if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      document.getElementById('toggle-motion-btn')?.click();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  injectAccessibilityUI();
  const settings = getAccessibilitySettings();
  saveAccessibilitySettings(settings);
  applyAccessibilitySettings(settings);
});

window.announceAccessibility = announceAccessibility;
window.getAccessibilitySettings = getAccessibilitySettings;
