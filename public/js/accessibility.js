
(function () {
  const STORAGE = {
    voice: 'rbt_access_voice',
    contrast: 'rbt_access_contrast',
    motion: 'rbt_access_reduce_motion'
  };

  let voiceEnabled = localStorage.getItem(STORAGE.voice) === 'true';

  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function announcer(){
    let live = document.getElementById('sr-live-region');
    if (!live) {
      live = document.createElement('div');
      live.id = 'sr-live-region';
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.appendChild(live);
    }
    return live;
  }

  function announce(message, speakToo = false){
    const live = announcer();
    live.textContent = '';
    setTimeout(() => { live.textContent = message; }, 10);
    if (speakToo && voiceEnabled && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis unavailable', e);
      }
    }
  }

  function labelFor(el){
    if (!el) return '';
    return (
      el.getAttribute('data-accessibility-label') ||
      el.getAttribute('aria-label') ||
      (el.labels && el.labels[0] && el.labels[0].textContent.trim()) ||
      el.getAttribute('title') ||
      el.textContent.trim() ||
      el.placeholder ||
      el.name ||
      el.id ||
      el.className ||
      'Control'
    ).replace(/\s+/g, ' ').trim();
  }

  function applyStates(){
    document.body.classList.toggle('access-high-contrast', localStorage.getItem(STORAGE.contrast) === 'true');
    document.body.classList.toggle('access-reduce-motion', localStorage.getItem(STORAGE.motion) === 'true');
    document.body.classList.toggle('voice-guide-enabled', voiceEnabled);

    const voiceBtn = document.getElementById('voiceGuideToggle');
    const contrastBtn = document.getElementById('contrastToggle');
    const motionBtn = document.getElementById('motionToggle');
    const musicBtn = document.getElementById('musicMuteBtn');

    if (voiceBtn) {
      voiceBtn.textContent = voiceEnabled ? 'Voice Guide: On' : 'Voice Guide: Off';
      voiceBtn.setAttribute('aria-pressed', String(voiceEnabled));
    }
    if (contrastBtn) {
      const on = localStorage.getItem(STORAGE.contrast) === 'true';
      contrastBtn.textContent = on ? 'High Contrast: On' : 'High Contrast: Off';
      contrastBtn.setAttribute('aria-pressed', String(on));
    }
    if (motionBtn) {
      const on = localStorage.getItem(STORAGE.motion) === 'true';
      motionBtn.textContent = on ? 'Reduce Motion: On' : 'Reduce Motion: Off';
      motionBtn.setAttribute('aria-pressed', String(on));
    }
    if (musicBtn && !musicBtn.hasAttribute('aria-label')) {
      musicBtn.setAttribute('aria-label', 'Toggle background music');
    }
  }

  function toggleSetting(key){
    const next = localStorage.getItem(key) !== 'true';
    localStorage.setItem(key, String(next));
    applyStates();
    const name = key === STORAGE.contrast ? 'High contrast' : 'Reduce motion';
    announce(`${name} ${next ? 'enabled' : 'disabled'}.`, true);
  }

  function wireToolbar(){
    const voiceBtn = document.getElementById('voiceGuideToggle');
    const contrastBtn = document.getElementById('contrastToggle');
    const motionBtn = document.getElementById('motionToggle');

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem(STORAGE.voice, String(voiceEnabled));
        applyStates();
        announce(`Voice guide ${voiceEnabled ? 'enabled' : 'disabled'}.`, true);
      });
    }
    if (contrastBtn) contrastBtn.addEventListener('click', () => toggleSetting(STORAGE.contrast));
    if (motionBtn) motionBtn.addEventListener('click', () => toggleSetting(STORAGE.motion));
  }

  function interactionMessage(el, eventType){
    const role = (el.getAttribute('role') || el.tagName || 'element').toLowerCase();
    const label = labelFor(el);
    if (eventType === 'focusin') {
      if (role === 'input' || role === 'select' || role === 'textarea') {
        return `${label}. Input field.`;
      }
      return `${label}. ${role === 'a' ? 'Link.' : role === 'button' ? 'Button.' : ''}`.trim();
    }
    if (eventType === 'click') {
      return `${label} selected.`;
    }
    return label;
  }

  function wireVoiceGuide(){
    const selector = 'a, button, input, select, textarea, [tabindex], .menu-card, .payment-option, .tab-btn, .progress-step';
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      announce(interactionMessage(el, 'focusin'), true);
    });
    document.addEventListener('click', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      announce(interactionMessage(el, 'click'), true);
    });
  }

  function improveLabels(){
    qsa('.menu-card').forEach((card) => {
      const title = card.querySelector('h3')?.textContent?.trim() || 'Drink';
      const price = card.querySelector('.price')?.textContent?.trim() || '';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${title}${price ? ', ' + price : ''}`);
    });
    qsa('.payment-option').forEach((btn) => {
      const payment = btn.getAttribute('data-payment') || btn.textContent.trim();
      btn.setAttribute('aria-label', `${payment} payment option`);
    });
    qsa('.tab-btn').forEach((btn) => {
      btn.setAttribute('aria-label', `${btn.textContent.trim()} category`);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyStates();
    wireToolbar();
    wireVoiceGuide();
    improveLabels();
    const skip = document.querySelector('.skip-link');
    if (skip) skip.addEventListener('click', () => announce('Skipped to main content.', true));
    announce('Accessibility features ready.', false);
  });
})();
