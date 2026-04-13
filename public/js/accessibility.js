(function () {
  const STORAGE_KEY = "rbt_voice_guide_enabled";
  const LANGUAGE_KEY = "kioskLanguage";

  let voiceEnabled = localStorage.getItem(STORAGE_KEY) === "true";
  let hoverTimer = null;
  let lastHoveredEl = null;
  let availableVoices = [];

  const UI_TEXT = {
    en: {
      control: "control",
      dropdown: "dropdown",
      voiceGuideOn: "Voice Guide: On",
      voiceGuideOff: "Voice Guide: Off",
      turnVoiceOff: "Turn voice guide off",
      turnVoiceOn: "Turn voice guide on",
      voiceEnabled: "Voice guide enabled.",
      voiceDisabled: "Voice guide disabled.",
      categorySuffix: "category"
    },
    es: {
      control: "control",
      dropdown: "lista desplegable",
      voiceGuideOn: "Guía de voz: activada",
      voiceGuideOff: "Guía de voz: desactivada",
      turnVoiceOff: "Desactivar guía de voz",
      turnVoiceOn: "Activar guía de voz",
      voiceEnabled: "Guía de voz activada.",
      voiceDisabled: "Guía de voz desactivada.",
      categorySuffix: "categoría"
    }
  };

  function getCurrentLanguage() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || "en";
    return lang === "es" ? "es" : "en";
  }

  function ui(key) {
    const lang = getCurrentLanguage();
    return UI_TEXT[lang]?.[key] || UI_TEXT.en[key] || key;
  }

  function getSpeechLang() {
    return getCurrentLanguage() === "es" ? "es-MX" : "en-US";
  }

  function getVoiceButton() {
    return document.getElementById("voiceGuideToggle");
  }

  function getLiveRegion() {
    let live = document.getElementById("sr-live-region");
    if (!live) {
      live = document.createElement("div");
      live.id = "sr-live-region";
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      document.body.appendChild(live);
    }
    return live;
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function loadVoices() {
    availableVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  }

  function chooseBestVoice(langCode) {
    if (!availableVoices.length) return null;

    const lowerLang = langCode.toLowerCase();

    // Strong preference: exact language-region match
    let match = availableVoices.find(v => (v.lang || "").toLowerCase() === lowerLang);
    if (match) return match;

    // Next: same base language (es-*, en-*)
    const base = lowerLang.split("-")[0];
    match = availableVoices.find(v => (v.lang || "").toLowerCase().startsWith(base));
    if (match) return match;

    return null;
  }

  function getElementLabel(el) {
    if (!el) return ui("control");

    const tag = (el.tagName || "").toLowerCase();

    if (tag === "select") {
      const associated = el.id && document.querySelector(`label[for="${el.id}"]`);
      return normalizeText(
        el.getAttribute("data-accessibility-label") ||
        el.getAttribute("aria-label") ||
        (associated ? associated.textContent : null) ||
        el.id ||
        el.name ||
        ui("dropdown")
      );
    }

    if (tag === "option") {
      return normalizeText(el.textContent || el.value || "option");
    }

    return normalizeText(
      el.getAttribute("data-accessibility-label") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.textContent ||
      el.value ||
      el.placeholder ||
      el.name ||
      el.id ||
      ui("control")
    );
  }

  function describeElement(el) {
    return getElementLabel(el);
  }

  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;

    const clean = normalizeText(text);
    if (!clean) return;

    try {
      const speechLang = getSpeechLang();

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = speechLang;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = chooseBestVoice(speechLang);
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  }

  function announce(text, alsoSpeak = false) {
    const live = getLiveRegion();
    const clean = normalizeText(text);
    if (!clean) return;

    live.textContent = "";
    setTimeout(() => {
      live.textContent = clean;
    }, 10);

    if (alsoSpeak) {
      speak(clean);
    }
  }

  function updateVoiceButton() {
    const btn = getVoiceButton();
    if (!btn) return;

    btn.textContent = voiceEnabled ? "🔊" : "🔇";
    btn.setAttribute("aria-pressed", String(voiceEnabled));
    btn.setAttribute("aria-label", voiceEnabled ? ui("turnVoiceOff") : ui("turnVoiceOn"));
    btn.setAttribute("data-tooltip", voiceEnabled ? ui("voiceGuideOn") : ui("voiceGuideOff"));

    document.body.classList.toggle("voice-guide-enabled", voiceEnabled);
  }

  function toggleVoiceGuide() {
    voiceEnabled = !voiceEnabled;
    localStorage.setItem(STORAGE_KEY, String(voiceEnabled));
    updateVoiceButton();
    announce(voiceEnabled ? ui("voiceEnabled") : ui("voiceDisabled"), true);
  }

  function getTrackedElement(target) {
    if (!target) return null;

    if (target.id === "voiceGuideToggle") {
      return target;
    }

    if ((target.tagName || "").toLowerCase() === "option") {
      return target;
    }

    return target.closest(
      'a, button, input, select, textarea, [tabindex], .menu-card, .payment-option, .tab-btn, .portal-launch-btn'
    );
  }

  function wireHoverSpeech() {
    document.addEventListener("mouseover", (event) => {
      const el = getTrackedElement(event.target);
      if (!voiceEnabled || !el) return;
      if (el === lastHoveredEl) return;

      lastHoveredEl = el;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        announce(describeElement(el), true);
      }, 500);
    });

    document.addEventListener("mouseout", (event) => {
      const el = getTrackedElement(event.target);
      if (el) lastHoveredEl = null;
      clearTimeout(hoverTimer);
    });
  }

  function wireFocusSpeech() {
    document.addEventListener("focusin", (event) => {
      const el = getTrackedElement(event.target);
      if (!voiceEnabled || !el) return;
      announce(describeElement(el), true);
    });
  }

  function wireClickSpeech() {
    document.addEventListener(
      "click",
      (event) => {
        const el = getTrackedElement(event.target);
        if (!el) return;

        if (el.id === "voiceGuideToggle") {
          event.preventDefault();
          toggleVoiceGuide();
          return;
        }

        if (!voiceEnabled) return;

        announce(describeElement(el), true);
      },
      true
    );
  }

  function improveLabels() {
    document.querySelectorAll(".menu-card").forEach((card) => {
      const title = normalizeText(card.querySelector("h3")?.textContent || "menu item");
      const price = normalizeText(
        card.querySelector(".price")?.textContent ||
        card.querySelector(".price-line .price")?.textContent ||
        ""
      );

      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", price ? `${title}, ${price}` : title);
    });

    document.querySelectorAll(".payment-option").forEach((btn) => {
      const label = normalizeText(btn.textContent || "payment option");
      btn.setAttribute("aria-label", label);
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const label = normalizeText(btn.textContent || "tab");
      btn.setAttribute("aria-label", `${label} ${ui("categorySuffix")}`);
    });
  }

  function wireSelectSpeech() {
    document.addEventListener("change", (event) => {
      const el = event.target;
      if ((el.tagName || "").toLowerCase() !== "select") return;

      // Keep the voice button text in sync when language changes
      if (el.id === "language-select") {
        setTimeout(() => {
          updateVoiceButton();
          improveLabels();
        }, 0);
      }

      if (!voiceEnabled) return;

      const selected = el.options[el.selectedIndex];
      if (selected) speak(normalizeText(selected.textContent));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    getLiveRegion();
    loadVoices();
    updateVoiceButton();
    improveLabels();
    wireHoverSpeech();
    wireFocusSpeech();
    wireClickSpeech();
    wireSelectSpeech();
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
    };
  }
})();