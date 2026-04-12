(function () {
  const STORAGE_KEY = "rbt_voice_guide_enabled";

  let voiceEnabled = localStorage.getItem(STORAGE_KEY) === "true";
  let hoverTimer = null;
  let lastHoveredEl = null;

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

  function getElementLabel(el) {
    if (!el) return "control";

    const tag = (el.tagName || "").toLowerCase();

    if (tag === "select") {
      const associated = el.id && document.querySelector(`label[for="${el.id}"]`);
      return normalizeText(
        el.getAttribute("data-accessibility-label") ||
        el.getAttribute("aria-label") ||
        (associated ? associated.textContent : null) ||
        el.id ||
        el.name ||
        "dropdown"
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
      "control"
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
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  }

  function announce(text, alsoSpeak = false) {
    const live = getLiveRegion();
    const clean = normalizeText(text);
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

    btn.textContent = voiceEnabled ? "Voice Guide: On" : "Voice Guide: Off";
    btn.setAttribute("aria-pressed", String(voiceEnabled));
    btn.setAttribute(
      "aria-label",
      voiceEnabled ? "Turn voice guide off" : "Turn voice guide on"
    );

    document.body.classList.toggle("voice-guide-enabled", voiceEnabled);
  }

  function toggleVoiceGuide() {
    voiceEnabled = !voiceEnabled;
    localStorage.setItem(STORAGE_KEY, String(voiceEnabled));
    updateVoiceButton();
    announce(`Voice guide ${voiceEnabled ? "enabled" : "disabled"}.`, true);
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
      btn.setAttribute("aria-label", `${label} category`);
    });
  }

  function wireSelectSpeech() {
    document.addEventListener("change", (event) => {
      const el = event.target;
      if (!voiceEnabled || (el.tagName || "").toLowerCase() !== "select") return;
      const selected = el.options[el.selectedIndex];
      if (selected) speak(normalizeText(selected.textContent));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    getLiveRegion();
    updateVoiceButton();
    improveLabels();
    wireHoverSpeech();
    wireFocusSpeech();
    wireClickSpeech();
    wireSelectSpeech();
  });
})();