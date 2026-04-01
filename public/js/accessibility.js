(function () {
  const STORAGE = {
    voice: 'rbt_access_voice'
  };

  let voiceEnabled = localStorage.getItem(STORAGE.voice) === 'true';
  let hoverTimer = null;
  let armedElement = null;
  let armedUntil = 0;

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

  function speak(message){
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
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

  function announce(message, speakToo = false){
    const live = announcer();
    live.textContent = '';
    setTimeout(() => { live.textContent = message; }, 10);
    if (speakToo) speak(message);
  }

  function labelFor(el){
    if (!el) return 'Control';
    return (
      el.getAttribute('data-accessibility-label') ||
      el.getAttribute('aria-label') ||
      (el.labels && el.labels[0] && el.labels[0].textContent.trim()) ||
      el.getAttribute('title') ||
      el.textContent.trim() ||
      el.placeholder ||
      el.name ||
      el.id ||
      'Control'
    ).replace(/\s+/g, ' ').trim();
  }

  function roleFor(el){
    const role = (el.getAttribute('role') || el.tagName || 'element').toLowerCase();
    if (role === 'a') return 'link';
    if (role === 'button') return 'button';
    if (role === 'input' || role === 'select' || role === 'textarea') return 'input';
    return role;
  }

  function describe(el){
    const label = labelFor(el);
    const role = roleFor(el);
    if (role === 'input') return `${label}. Input field.`;
    if (role === 'button') return `${label}. Button.`;
    if (role === 'link') return `${label}. Link.`;
    return `${label}.`;
  }

  function applyStates(){
    document.body.classList.toggle('voice-guide-enabled', voiceEnabled);
    const voiceBtn = document.getElementById('voiceGuideToggle');
    if (voiceBtn) {
      voiceBtn.textContent = voiceEnabled ? 'Voice Guide: On' : 'Voice Guide: Off';
      voiceBtn.setAttribute('aria-pressed', String(voiceEnabled));
      voiceBtn.setAttribute('aria-label', voiceEnabled ? 'Turn voice guide off' : 'Turn voice guide on');
    }
  }

  function wireToolbar(){
    const voiceBtn = document.getElementById('voiceGuideToggle');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem(STORAGE.voice, String(voiceEnabled));
        armedElement = null;
        armedUntil = 0;
        applyStates();
        announce(`Voice guide ${voiceEnabled ? 'enabled' : 'disabled'}.`, true);
      });
    }
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

  function wireHoverAndFocusSpeech(){
    const selector = 'a, button, input, select, textarea, [tabindex], .menu-card, .payment-option, .tab-btn, .progress-step';

    document.addEventListener('focusin', (e) => {
      const el = e.target.closest(selector);
      if (!el || !voiceEnabled) return;
      announce(describe(el), true);
    });

    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest(selector);
      if (!el || !voiceEnabled) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        announce(describe(el), true);
      }, 650);
    });

    document.addEventListener('mouseout', () => {
      clearTimeout(hoverTimer);
    });
  }

  function wireConfirmActivation(){
    const selector = 'a, button, .menu-card, .payment-option, .tab-btn';
    document.addEventListener('click', (e) => {
      const el = e.target.closest(selector);
      if (!el || !voiceEnabled) return;
      if (el.id === 'voiceGuideToggle' || el.id === 'musicMuteBtn' || el.closest('.accessibility-toolbar')) return;

      const now = Date.now();
      if (armedElement === el && now < armedUntil) {
        armedElement = null;
        armedUntil = 0;
        return;
      }

      armedElement = el;
      armedUntil = now + 4000;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      announce(`${labelFor(el)} selected. Click again to activate.`, true);
    }, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyStates();
    wireToolbar();
    improveLabels();
    wireHoverAndFocusSpeech();
    wireConfirmActivation();
    const skip = document.querySelector('.skip-link');
    if (skip) skip.addEventListener('click', () => announce('Skipped to main content.', true));
    announce('Voice accessibility ready.', false);
  });
})();