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
    categorySuffix: "category",
    current: "Current",
    options: "Options",
    setTo: "set to",
    ingredients: "Ingredients",
    customizePrompt: "Use the dropdowns below to customize sweetness, ice level, size, and topping."
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
    categorySuffix: "categoría",
    current: "Actual",
    options: "Opciones",
    setTo: "cambiado a",
    ingredients: "Ingredientes",
    customizePrompt: "Usa las listas desplegables para personalizar el dulzor, el nivel de hielo, el tamaño y el topping."
  },
  zh: {
    control: "控件",
    dropdown: "下拉菜单",
    voiceGuideOn: "语音引导：开启",
    voiceGuideOff: "语音引导：关闭",
    turnVoiceOff: "关闭语音引导",
    turnVoiceOn: "开启语音引导",
    voiceEnabled: "语音引导已开启。",
    voiceDisabled: "语音引导已关闭。",
    categorySuffix: "类别",
    current: "当前",
    options: "选项",
    setTo: "设置为",
    ingredients: "配料",
    customizePrompt: "使用下面的下拉菜单来选择甜度、冰量、大小和配料。"
  },
  vi: {
    control: "điều khiển",
    dropdown: "danh sách chọn",
    voiceGuideOn: "Hướng dẫn giọng nói: Bật",
    voiceGuideOff: "Hướng dẫn giọng nói: Tắt",
    turnVoiceOff: "Tắt hướng dẫn giọng nói",
    turnVoiceOn: "Bật hướng dẫn giọng nói",
    voiceEnabled: "Đã bật hướng dẫn giọng nói.",
    voiceDisabled: "Đã tắt hướng dẫn giọng nói.",
    categorySuffix: "danh mục",
    current: "Hiện tại",
    options: "Tùy chọn",
    setTo: "đã chọn",
    ingredients: "Thành phần",
    customizePrompt: "Dùng các danh sách chọn bên dưới để tùy chỉnh độ ngọt, mức đá, kích cỡ và topping."
  },
  ar: {
    control: "عنصر تحكم",
    dropdown: "قائمة منسدلة",
    voiceGuideOn: "الدليل الصوتي: تشغيل",
    voiceGuideOff: "الدليل الصوتي: إيقاف",
    turnVoiceOff: "إيقاف الدليل الصوتي",
    turnVoiceOn: "تشغيل الدليل الصوتي",
    voiceEnabled: "تم تشغيل الدليل الصوتي.",
    voiceDisabled: "تم إيقاف الدليل الصوتي.",
    categorySuffix: "فئة",
    current: "الحالي",
    options: "الخيارات",
    setTo: "تم التغيير إلى",
    ingredients: "المكونات",
    customizePrompt: "استخدم القوائم المنسدلة بالأسفل لتخصيص درجة الحلاوة، مستوى الثلج، الحجم، والإضافات."
  }
};

const SPEECH_LANGS = {
  en: "en-US",
  es: "es-MX",
  zh: "zh-CN",
  vi: "vi-VN",
  ar: "ar-SA"
};

function getCurrentLanguage() {
  const selectLang = document.getElementById("language-select")?.value;
  const storedLang = localStorage.getItem(LANGUAGE_KEY);
  const lang = selectLang || storedLang || "en";

  return ["en", "es", "zh", "vi", "ar"].includes(lang) ? lang : "en";
}

function ui(key) {
  const lang = getCurrentLanguage();
  return UI_TEXT[lang]?.[key] || UI_TEXT.en[key] || key;
}

function getSpeechLang() {
  return SPEECH_LANGS[getCurrentLanguage()] || "en-US";
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
    if (!el) return ui("control");
    const tag = (el.tagName || "").toLowerCase();

    // For <select>: announce label + current value + all options
    if (tag === "select") {
      const label = getElementLabel(el);
      const opts = Array.from(el.options).map(o => normalizeText(o.textContent)).filter(Boolean);
      const currentVal = normalizeText(el.options[el.selectedIndex]?.textContent || "");
      return opts.length
        ? `${label}. ${ui("current")}: ${currentVal}. ${ui("options")}: ${opts.join(", ")}.`
        : label;
    }

    // For topping-check labels: announce name + checked state
    if (el.classList && el.classList.contains("topping-check")) {
      const cb = el.querySelector("input[type=checkbox]");
      const name = normalizeText(el.textContent);
      const checked = cb && cb.checked;
      return checked ? `${name}, checked` : `${name}, unchecked`;
    }

    // For checkboxes directly
    if (tag === "input" && el.type === "checkbox") {
      const lbl = el.closest("label");
      const name = lbl ? normalizeText(lbl.textContent) : (el.getAttribute("aria-label") || el.value || "checkbox");
      return el.checked ? `${name}, checked` : `${name}, unchecked`;
    }

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
      'a, button, input, select, textarea, [tabindex], .menu-card, .payment-option, .tab-btn, .portal-btn, .portal-card, label.topping-check'
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

      // For dropdowns: announce label AND all available options clearly
      if ((el.tagName || "").toLowerCase() === "select") {
        const label = getElementLabel(el);
        const opts = Array.from(el.options).map(o => normalizeText(o.textContent)).filter(Boolean);
        const currentVal = normalizeText(el.options[el.selectedIndex]?.textContent || "");
        const msg = opts.length
          ? `${label}. ${ui("current")}: ${currentVal}. ${ui("options")}: ${opts.join(", ")}.`
          : label;
        announce(msg, true);
        return;
      }

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

        // For checkboxes/topping-check labels, delay so checked state is updated first
        const tag = (el.tagName || "").toLowerCase();
        const isCheckboxLike = tag === "input" && el.type === "checkbox"
          || (el.classList && el.classList.contains("topping-check"));
        if (isCheckboxLike) {
          setTimeout(() => announce(describeElement(el), true), 50);
        } else {
          announce(describeElement(el), true);
        }
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
      const desc  = normalizeText(card.querySelector("p")?.textContent || "");

      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      // Include description in aria-label so voice guide reads it
      const label = [title, price, desc].filter(Boolean).join(". ");
      card.setAttribute("aria-label", label);
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
          improveModalLabels();
        }, 0);
      }

      if (!voiceEnabled) return;

      const selected = el.options[el.selectedIndex];
      if (selected) {
        const label = getElementLabel(el);
        const val = normalizeText(selected.textContent);
        speak(`${label} ${ui("setTo")} ${val}`);
      }
    });
  }

  function wireKeyboardActivation() {
    document.addEventListener('keydown', (event) => {
      const el = getTrackedElement(event.target);
      if (!el) return;

      const tag = (el.tagName || '').toLowerCase();

      // Let native buttons, links, inputs, and selects handle themselves
      if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.click();
      }
    });
  }


  // ── Read description when drink modal opens ──────────────────
  function watchModalOpen() {
    const modalOverlay = document.getElementById('drink-modal-overlay');
    if (!modalOverlay) return;
    const observer = new MutationObserver(() => {
      if (!voiceEnabled) return;
      if (modalOverlay.classList.contains('open')) {
        const name  = normalizeText(document.getElementById('modal-drink-name')?.textContent || '');
        const price = normalizeText(document.getElementById('modal-drink-price')?.textContent || '');
        const desc  = normalizeText(document.getElementById('modal-drink-desc')?.textContent || '');
        const ings  = normalizeText(document.getElementById('modal-ingredients-list')?.textContent || '');
        const parts = [name, price, desc];
        if (ings && ings !== '…') parts.push(`${ui("ingredients")}: ${ings}`);
        parts.push(ui("customizePrompt"));
        setTimeout(() => speak(parts.filter(Boolean).join('. ')), 300);
        // Refresh modal labels/tabindex for newly-rendered toppings
        setTimeout(() => improveModalLabels(), 100);
      }
    });
    observer.observe(modalOverlay, { attributes: true, attributeFilter: ['class'] });
  }


  // ── Improve accessibility labels inside the customize modal ──────────────────
  function improveModalLabels() {
    // Give every modal select a proper aria-label from its associated <label>
    [
      { selectId: 'modal-sweetness', labelText: 'Sweetness' },
      { selectId: 'modal-ice',       labelText: 'Ice Level' },
      { selectId: 'modal-size',      labelText: 'Size' },
      { selectId: 'modal-temp',      labelText: 'Temperature' },
      { selectId: 'edit-sweetness',  labelText: 'Sweetness' },
      { selectId: 'edit-ice',        labelText: 'Ice Level' },
      { selectId: 'edit-size',       labelText: 'Size' },
      { selectId: 'edit-temp',       labelText: 'Temperature' },
    ].forEach(({ selectId, labelText }) => {
      const sel = document.getElementById(selectId);
      if (sel) {
        // Find associated label text from DOM (may be translated)
        const lbl = document.querySelector(`label[for="${selectId}"]`);
        const text = (lbl && normalizeText(lbl.textContent)) || labelText;
        sel.setAttribute('aria-label', text);
        sel.setAttribute('data-accessibility-label', text);
      }
    });

    // Make topping-check labels focusable and give them aria roles
    document.querySelectorAll('.topping-check').forEach(lbl => {
      if (!lbl.getAttribute('tabindex')) lbl.setAttribute('tabindex', '0');
      lbl.setAttribute('role', 'checkbox');
      const cb = lbl.querySelector('input[type=checkbox]');
      if (cb) lbl.setAttribute('aria-checked', String(cb.checked));
      // Keep aria-checked in sync when checkbox changes
      if (cb && !cb._ariaSync) {
        cb._ariaSync = true;
        cb.addEventListener('change', () => {
          lbl.setAttribute('aria-checked', String(cb.checked));
        });
      }
    });
  }

  function watchDynamicLabels() {
    const menu = document.getElementById("customer-menu");
    const tabs = document.getElementById("customer-tabs");

    const observer = new MutationObserver(() => {
      improveLabels();
    });

    if (menu) {
      observer.observe(menu, { childList: true, subtree: true });
    }

    if (tabs) {
      observer.observe(tabs, { childList: true, subtree: true });
    }

    // Watch the modals for topping checkboxes being injected
    const modalContainers = [
      document.getElementById('modal-topping-checks'),
      document.getElementById('edit-topping-checks'),
      document.getElementById('drink-modal-overlay'),
    ].filter(Boolean);

    const modalObserver = new MutationObserver(() => {
      improveModalLabels();
    });

    modalContainers.forEach(container => {
      modalObserver.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });

    // Also run once on init
    improveModalLabels();
  }


  document.addEventListener('DOMContentLoaded', () => {
    getLiveRegion();
    loadVoices();
    updateVoiceButton();
    improveLabels();
    improveModalLabels();
    wireHoverSpeech();
    watchDynamicLabels();
    wireFocusSpeech();
    wireClickSpeech();
    wireSelectSpeech();
    wireKeyboardActivation();
    watchModalOpen();
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
    };
  }
})();