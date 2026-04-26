// ─── State ────────────────────────────────────────────────────────────────────
let customerMenu = [];
let customerCategories = [];
let customerActiveCategory = '';
let customerOrder = [];
let selectedPaymentMethod = 'card';
let currentUser = null;
let currentScreen = 'menu';
let guestLoginPairToken = null;
let guestLoginPoller = null;
let guestCheckoutRequested = false;

let currentLanguage = localStorage.getItem('kioskLanguage') || 'en';
const LANGUAGE_CODES = {
  en: 'en-US',
  es: 'es-MX',
  zh: 'zh-CN',
  ar: 'ar-SA',
  vi: 'vi-VN'
};

const translationCache = JSON.parse(localStorage.getItem('laraTranslationCache') || '{}');

// Reward / promo applied at checkout
let appliedRewardId = null;
let appliedRewardLabel = '';
let appliedPromoCode = null;
let appliedPromoLabel = '';
let discountAmount = 0;
let spinPrizeDetails = null; // { type, value } stored from spin result for deferred discount calc

// Drink modal state
let modalItem = null;
let modalQty = 1;

// Edit modal state
let editingIndex = -1;

// ─── Translations ─────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    language: 'Language',
    kiosk: 'Kiosk',
    hi: 'Hi',
    chooseDrink: 'Choose your drink',
    reviewOrder: 'Review your order',
    payment: 'Payment',
    orderTotal: 'Order total',
    orderPlaced: 'Order placed!',
    orderReceived: 'Your order has been received.',
    status: 'Status',
    orderReceivedShort: 'Order received',
    pickup: 'Pickup',
    pickupCounter: 'Pick up at the counter',
    startNewOrder: 'Start New Order',
    yourRewardPoints: 'Your Reward Points',
    rewards: 'Rewards',
    spin: 'Spin',
    rewardsAndPromos: 'Rewards & Promos',
    redemptionHistory: 'Redemption History',
    noRedemptionsYet: 'No redemptions yet.',
    spinWheel: 'Spin the Wheel',
    close: 'Close',
    spinAndWin: 'Spin & Win',
    editItem: 'Edit item',
    sweetness: 'Sweetness',
    iceLevel: 'Ice Level',
    size: 'Size',
    topping: 'Topping',
    noSugar: 'No Sugar',
    quarterSugar: 'Quarter Sugar',
    regularSugar: 'Regular Sugar',
    extraSweet: 'Extra Sweet',
    noIce: 'No Ice',
    lightIce: 'Light Ice',
    regularIce: 'Regular Ice',
    extraIce: 'Extra Ice',
    regular: 'Regular',
    large: 'Large (+$1.00)',
    none: 'None',
    extraBoba: 'Extra Boba (+$0.75)',
    qty: 'qty',
    cancel: 'Cancel',
    saveChanges: 'Save Changes',
    addToOrder: 'Add to Order',
    item: 'item',
    items: 'items',
    drinksSelected: 'drink(s) selected',
    noItemsYet: 'No items added yet.',
    noDrinksYet: 'No drinks added yet. Pick a drink from the menu to start.',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax (8.25%)',
    total: 'Total',
    backToMenu: '← Back to Menu',
    clearOrder: 'Clear Order',
    continueToPayment: 'Continue to Payment →',
    backToReview: '← Back to Review',
    placeOrder: 'Place Order',
    card: 'Card',
    applePay: 'Apple Pay',
    cash: 'Cash',
    loadingWeather: 'Loading weather…',
    weatherUnavailable: 'Weather unavailable right now.',
    customize: 'Customize →',
    popular: 'Popular',
    edit: 'Edit',
    remove: 'Remove',
    noModifications: 'No modifications',
    checking: 'Checking…',
    apply: 'Apply',
    redeem: 'Redeem',
    locked: 'Locked',
    addDrinkFirst: 'Add at least one drink first.',
    emptyOrder: 'Your order is empty.',
    placingOrder: 'Placing order…',
    pointsEarnedThisOrder: 'points earned this order',
    newBalance: 'New balance',
    code: 'Code',
    youWon: 'You won',
    added: 'added',
    applied: 'applied',
    couldNotLoadRewards: 'Could not load rewards.',
    invalidOrExpiredCode: 'Invalid or expired code.',
    couldNotValidateCode: 'Could not validate code.',
    applyRewardLabel: 'Apply a Reward',
    ptsAvailable: 'pts available',
    selectReward: 'Select a reward',
    keepOrdering: 'keep ordering to unlock rewards!',
    earnPointsPrompt: 'Earn 10 pts per dollar, start ordering to earn rewards!',
    ptsNeeded: 'pts needed',
    needMore: 'need',
    more: 'more',
    signInToSpin: 'Sign in with your TAMU Google account to spin!',
    alreadySpun: 'Already spun today. Come back tomorrow!',
    checkingEligibility: 'Checking eligibility…',
    spinChance: 'Spin once per day for a chance to win prizes!',
    spinChanceShort: 'Spin for a chance to win!',
    spun: 'Spun!',
    spinning: 'Spinning…',
    processing: 'Processing…',
    weatherClearSky: 'Clear sky',
    weatherMainlyClear: 'Mainly clear',
    weatherPartlyCloudy: 'Partly cloudy',
    weatherOvercast: 'Overcast',
    weatherFoggy: 'Foggy',
    weatherLightDrizzle: 'Light drizzle',
    weatherDrizzle: 'Drizzle',
    weatherLightRain: 'Light rain',
    weatherModerateRain: 'Moderate rain',
    weatherHeavyRain: 'Heavy rain',
    weatherRainShowers: 'Rain showers',
    weatherModerateShowers: 'Moderate showers',
    weatherHeavyShowers: 'Heavy showers',
    weatherThunderstorm: 'Thunderstorm',
    weatherThunderstormHail: 'Thunderstorm + hail',
    weatherMixedConditions: 'Mixed conditions',
    rainyDaySuggestion: 'Rainy outside. Warm up with a Brown Sugar or Matcha Milk Tea.',
    hotDaySuggestion: 'Really warm out. Strawberry or Peach Green Tea over ice is refreshing.',
    niceWeatherSuggestion: 'Warm and sunny. Fruit teas are popular, especially Mango Green Tea.',
    coolWeatherSuggestion: 'Getting cool outside. Brown Sugar Milk Tea or Thai Tea will warm you up.',
    feelsLike: 'Feels like',
    windMph: 'mph wind',
    promoCodePlaceholder: 'Promo code (e.g. RBT-ABC123)',
    youHaveCode: 'You have a code',
    transactionSaved: 'saved.',
    database: '(Database)',
    fallback: '(Fallback)',
    pointsUnit: 'pts',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signInBeforeCheckout: 'Sign in before checkout?',
    signInBeforeCheckoutSubtitle: 'Sign in to earn reward points, or continue as a guest.',
    scanQrCode: 'Scan QR Code',
    signInWithGoogle: 'Sign In with Google',
    scanQrInstructions: 'Scan this code with your phone to sign in, and the kiosk will continue on this computer automatically.',
    waitingForPhoneSignIn: 'Waiting for phone sign-in…',
    googleKioskInstructions: 'Use Google on this kiosk to sign in before you pay.',
    continueWithGoogle: 'Continue with Google',
    continueAsGuest: 'Continue as Guest',
    signInForRewards: 'Sign In for Rewards',
    closeSignIn: 'Close sign-in popup',
    signInQrAlt: 'Sign in QR code',
    preparingSecureSignIn: 'Preparing secure sign-in…',
    scanQrFinishGoogle: 'Scan the QR code with your phone, then finish Google sign-in there.',
    signInCompleteConnecting: 'Sign-in complete. Connecting this kiosk…',
    qrExpired: 'This QR code expired. Please reopen the sign-in box to get a new one.',
    couldNotCreateQr: 'Could not create QR sign-in.',
    couldNotFinishKioskSignIn: 'Could not finish kiosk sign-in.'
  },
  es: {
    language: 'Idioma',
    kiosk: 'Quiosco',
    hi: 'Hola',
    chooseDrink: 'Elige tu bebida',
    reviewOrder: 'Revisa tu pedido',
    payment: 'Pago',
    orderTotal: 'Total del pedido',
    orderPlaced: '¡Pedido realizado!',
    orderReceived: 'Hemos recibido tu pedido.',
    status: 'Estado',
    orderReceivedShort: 'Pedido recibido',
    pickup: 'Recogida',
    pickupCounter: 'Recoge en el mostrador',
    startNewOrder: 'Iniciar nuevo pedido',
    yourRewardPoints: 'Tus puntos de recompensa',
    rewards: 'Recompensas',
    spin: 'Girar',
    rewardsAndPromos: 'Recompensas y promociones',
    redemptionHistory: 'Historial de canjes',
    noRedemptionsYet: 'Aún no hay canjes.',
    spinWheel: 'Gira la rueda',
    close: 'Cerrar',
    spinAndWin: 'Gira y gana',
    editItem: 'Editar artículo',
    sweetness: 'Dulzor',
    iceLevel: 'Nivel de hielo',
    size: 'Tamaño',
    topping: 'Ingrediente extra',
    noSugar: 'Sin azúcar',
    quarterSugar: 'Un cuarto de azúcar',
    regularSugar: 'Azúcar regular',
    extraSweet: 'Extra dulce',
    noIce: 'Sin hielo',
    lightIce: 'Poco hielo',
    regularIce: 'Hielo regular',
    extraIce: 'Extra hielo',
    regular: 'Regular',
    large: 'Grande (+$1.00)',
    none: 'Ninguno',
    extraBoba: 'Boba extra (+$0.75)',
    qty: 'cant.',
    cancel: 'Cancelar',
    saveChanges: 'Guardar cambios',
    addToOrder: 'Agregar al pedido',
    item: 'artículo',
    items: 'artículos',
    drinksSelected: 'bebida(s) seleccionada(s)',
    noItemsYet: 'Aún no has agregado artículos.',
    noDrinksYet: 'Aún no has agregado bebidas. Elige una bebida del menú para comenzar.',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    tax: 'Impuesto (8.25%)',
    total: 'Total',
    backToMenu: '← Volver al menú',
    clearOrder: 'Borrar pedido',
    continueToPayment: 'Continuar al pago →',
    backToReview: '← Volver a revisar',
    placeOrder: 'Realizar pedido',
    card: 'Tarjeta',
    applePay: 'Apple Pay',
    cash: 'Efectivo',
    loadingWeather: 'Cargando clima…',
    weatherUnavailable: 'El clima no está disponible en este momento.',
    customize: 'Personalizar →',
    popular: 'Popular',
    edit: 'Editar',
    remove: 'Eliminar',
    noModifications: 'Sin modificaciones',
    checking: 'Verificando…',
    apply: 'Aplicar',
    redeem: 'Canjear',
    locked: 'Bloqueado',
    addDrinkFirst: 'Agrega al menos una bebida primero.',
    emptyOrder: 'Tu pedido está vacío.',
    placingOrder: 'Realizando pedido…',
    pointsEarnedThisOrder: 'puntos ganados en este pedido',
    newBalance: 'Nuevo saldo',
    code: 'Código',
    youWon: 'Ganaste',
    added: 'agregado',
    applied: 'aplicado',
    couldNotLoadRewards: 'No se pudieron cargar las recompensas.',
    invalidOrExpiredCode: 'Código inválido o vencido.',
    couldNotValidateCode: 'No se pudo validar el código.',
    applyRewardLabel: 'Aplicar una recompensa',
    ptsAvailable: 'pts disponibles',
    selectReward: 'Selecciona una recompensa',
    keepOrdering: 'sigue ordenando para desbloquear recompensas.',
    earnPointsPrompt: 'Gana 10 pts por dólar, empieza a ordenar para ganar recompensas.',
    ptsNeeded: 'pts necesarios',
    needMore: 'faltan',
    more: 'más',
    signInToSpin: '¡Inicia sesión con tu cuenta TAMU de Google para girar!',
    alreadySpun: 'Ya giraste hoy. ¡Vuelve mañana!',
    checkingEligibility: 'Verificando elegibilidad…',
    spinChance: '¡Gira una vez al día para tener la oportunidad de ganar premios!',
    spinChanceShort: '¡Gira para tener la oportunidad de ganar!',
    spun: '¡Girado!',
    spinning: 'Girando…',
    processing: 'Procesando…',
    weatherClearSky: 'Cielo despejado',
    weatherMainlyClear: 'Mayormente despejado',
    weatherPartlyCloudy: 'Parcialmente nublado',
    weatherOvercast: 'Nublado',
    weatherFoggy: 'Neblina',
    weatherLightDrizzle: 'Llovizna ligera',
    weatherDrizzle: 'Llovizna',
    weatherLightRain: 'Lluvia ligera',
    weatherModerateRain: 'Lluvia moderada',
    weatherHeavyRain: 'Lluvia fuerte',
    weatherRainShowers: 'Chubascos',
    weatherModerateShowers: 'Chubascos moderados',
    weatherHeavyShowers: 'Chubascos fuertes',
    weatherThunderstorm: 'Tormenta eléctrica',
    weatherThunderstormHail: 'Tormenta eléctrica con granizo',
    weatherMixedConditions: 'Condiciones mixtas',
    rainyDaySuggestion: 'Día lluvioso, los tés con leche son perfectos.',
    hotDaySuggestion: 'Día caluroso, los tés frutales y el hielo extra son ideales.',
    niceWeatherSuggestion: 'Buen clima, los tés frutales o los tés con leche clásicos quedan muy bien.',
    coolWeatherSuggestion: 'Clima fresco, los tés con leche y sabores más intensos son ideales.',
    feelsLike: 'Se siente como',
    windMph: 'mph de viento',
    promoCodePlaceholder: 'Código promocional (ej. RBT-ABC123)',
    youHaveCode: 'Tienes un código',
    transactionSaved: 'guardada.',
    database: '(Base de datos)',
    fallback: '(Respaldo)',
    pointsUnit: 'pts',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    signInBeforeCheckout: '¿Iniciar sesión antes de pagar?',
    signInBeforeCheckoutSubtitle: 'Inicia sesión para ganar puntos de recompensa, o continúa como invitado.',
    scanQrCode: 'Escanear código QR',
    signInWithGoogle: 'Iniciar sesión con Google',
    scanQrInstructions: 'Escanea este código con tu teléfono para iniciar sesión, y el quiosco continuará automáticamente en esta computadora.',
    waitingForPhoneSignIn: 'Esperando inicio de sesión desde el teléfono…',
    googleKioskInstructions: 'Usa Google en este quiosco para iniciar sesión antes de pagar.',
    continueWithGoogle: 'Continuar con Google',
    continueAsGuest: 'Continuar como invitado',
    signInForRewards: 'Iniciar sesión para recompensas',
    closeSignIn: 'Cerrar ventana de inicio de sesión',
    signInQrAlt: 'Código QR para iniciar sesión',
    preparingSecureSignIn: 'Preparando inicio de sesión seguro…',
    scanQrFinishGoogle: 'Escanea el código QR con tu teléfono y luego termina el inicio de sesión con Google allí.',
    signInCompleteConnecting: 'Inicio de sesión completo. Conectando este quiosco…',
    qrExpired: 'Este código QR expiró. Vuelve a abrir la ventana de inicio de sesión para obtener uno nuevo.',
    couldNotCreateQr: 'No se pudo crear el inicio de sesión con QR.',
    couldNotFinishKioskSignIn: 'No se pudo terminar el inicio de sesión en el quiosco.'
  }
};

function t(key) {
  return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
}

async function translateWithLara(text) {
  if (!text || currentLanguage === 'en') return text;

  const targetLanguage = LANGUAGE_CODES[currentLanguage] || currentLanguage;
  const cacheKey = `${targetLanguage}:${text}`;

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sourceLanguage: 'en-US',
        targetLanguage
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Translation failed');
    }

    translationCache[cacheKey] = data.translatedText;
    localStorage.setItem('laraTranslationCache', JSON.stringify(translationCache));

    return data.translatedText;
  } catch (err) {
    console.error('Lara translation failed:', err);
    return text;
  }
}

async function ensureLanguageLoaded() {
  if (currentLanguage === 'en') return;

  if (!TRANSLATIONS[currentLanguage]) {
    TRANSLATIONS[currentLanguage] = {};
  }

  const keys = Object.keys(TRANSLATIONS.en);

  await Promise.all(keys.map(async key => {
    if (!TRANSLATIONS[currentLanguage][key]) {
      TRANSLATIONS[currentLanguage][key] = await translateWithLara(TRANSLATIONS.en[key]);
    }
  }));
}

// ─── Image map ────────────────────────────────────────────────────────────────
const IMAGE_MAP = {
  // ── Milk Tea ──────────────────────────────────────────────
  'Classic Milk Tea':         '/boba/Classic-Milk-Tea.PNG',
  'Brown Sugar Milk Tea':     '/boba/Brown-Sugar-Milk-Tea.PNG',
  'Taro Milk Tea':            '/boba/Taro-Milk-Tea.PNG',
  'Matcha Milk Tea':          '/boba/Matcha-Milk-Tea.PNG',
  'Thai Tea':                 '/boba/Thai-Milk-Tea.PNG',
  'Wintermelon Milk Tea':     '/boba/Wintermelon-Milk-Tea.PNG',
  'Oolong Milk Tea':          '/boba/Ooglong-Tea.png',
  'Hokkaido Milk Tea':        '/boba/Classic-Milk-Tea.PNG',
  'Oat Milk Brown Sugar Tea': '/boba/Brown-Sugar-Milk-Tea.PNG',
  // ── Tea ───────────────────────────────────────────────────
  'Honey Green Tea':          '/boba/Honey-Green-Tea.PNG',
  'Jasmine Green Tea':        '/boba/Jasmine-Green-Tea.png',
  'Black Tea Lemonade':       '/boba/Black-Tea-Lemonade.png',
  'Yuzu Lemonade':            '/boba/Black-Tea-Lemonade.png',
  // ── Fruit Tea ─────────────────────────────────────────────
  'Lychee Green Tea':         '/boba/Lychee.png',
  'Mango Green Tea':          '/boba/Mango.png',
  'Peach Green Tea':          '/boba/Peach.png',
  'Strawberry Green Tea':     '/boba/Strawberry-.png',
  'Passion Fruit Tea':        '/boba/Peach.png',
  'Kumquat Green Tea':        '/boba/Lychee.png',
  'Mango Coconut Jelly Tea':  '/boba/Mango.png',
  // ── Coffee ────────────────────────────────────────────────
  'Coffee Milk Tea':          '/boba/Coffee-Milk-Tea.png',
  'Vietnamese Iced Coffee':   '/boba/Coffee-Milk-Tea.png',
  'Espresso Milk Tea':        '/boba/Coffee-Milk-Tea.png',
  'Mocha Boba':               '/boba/Coffee-Milk-Tea.png',
  'Caramel Coffee Milk Tea':  '/boba/Coffee-Milk-Tea.png',
  // ── New Milk Tea ──────────────────────────────────────────
  'Coconut Milk Tea':         '/boba/Classic-Milk-Tea.PNG',
  'Oreo Milk Tea':            '/boba/Brown-Sugar-Milk-Tea.PNG',
  // ── New Tea ───────────────────────────────────────────────
  'Kumquat Green Tea':        '/boba/Honey-Green-Tea.PNG',
  'Peppermint Herbal Tea':    '/boba/Honey-Green-Tea.PNG',
  'Chrysanthemum Tea':        '/boba/Honey-Green-Tea.PNG',
  // ── New Fruit Tea ─────────────────────────────────────────
  'Watermelon Fruit Tea':     '/boba/Strawberry-.png',
  'Dragonfruit Green Tea':    '/boba/Strawberry-.png',
  'Kiwi Green Tea':           '/boba/Peach.png',
  // ── Seasonal ──────────────────────────────────────────────
  'Watermelon Slush':         '/boba/Strawberry-.png',
  'Osmanthus Oolong':         '/boba/Honey-Green-Tea.PNG',
  'Mango Coconut Jelly Tea':  '/boba/Mango.png',
  'Brown Sugar Pearl Latte':  '/boba/Brown-Sugar-Milk-Tea.PNG',
  // ── Smoothie ──────────────────────────────────────────────
  'Mango Smoothie':           '/boba/Mango.png',
  'Strawberry Smoothie':      '/boba/Strawberry-.png',
  'Taro Smoothie':            '/boba/Taro-Milk-Tea.PNG',
  'Matcha Smoothie':          '/boba/Matcha-Milk-Tea.PNG',
};

function getDrinkImg(name) {
  return IMAGE_MAP[name] || '/boba/Sonny-Boba.png';
}

// ─── Translation helpers ─────────────────────────────────────────────────────
function translateCategoryName(category) {
  const englishMap = {
    milk_tea: 'Milk Tea',
    tea: 'Tea',
    fruit_tea: 'Fruit Tea',
    coffee: 'Coffee',
    seasonal: 'Seasonal',
    smoothie: 'Smoothie'
  };

  const englishText = englishMap[category] || category.replace(/_/g, ' ');
  return TRANSLATIONS[currentLanguage]?.[`category_${category}`] || englishText;
}

async function ensureCategoryTranslations() {
  if (currentLanguage === 'en') return;

  const categories = {
    milk_tea: 'Milk Tea',
    tea: 'Tea',
    fruit_tea: 'Fruit Tea',
    coffee: 'Coffee'
  };

  await Promise.all(Object.entries(categories).map(async ([key, englishText]) => {
    const translationKey = `category_${key}`;

    if (!TRANSLATIONS[currentLanguage][translationKey]) {
      TRANSLATIONS[currentLanguage][translationKey] = await translateWithLara(englishText);
    }
  }));
}

function translateDrinkName(name) {
  return TRANSLATIONS[currentLanguage]?.[`drink_${name}`] || name;
}

async function ensureDrinkTranslations() {
  if (currentLanguage === 'en') return;

  await Promise.all(customerMenu.map(async item => {
    const key = `drink_${item.name}`;

    if (!TRANSLATIONS[currentLanguage][key]) {
      TRANSLATIONS[currentLanguage][key] = await translateWithLara(item.name);
    }

    if (item.description) {
      const descKey = `description_${item.name}`;

      if (!TRANSLATIONS[currentLanguage][descKey]) {
        TRANSLATIONS[currentLanguage][descKey] = await translateWithLara(item.description);
      }
    }
  }));
}

function translateSelectionValue(value) {
  const valueMap = {
    'No Sugar': t('noSugar'),
    'Quarter Sugar': t('quarterSugar'),
    'Regular Sugar': t('regularSugar'),
    'Extra Sweet': t('extraSweet'),
    'No Ice': t('noIce'),
    'Light Ice': t('lightIce'),
    'Regular Ice': t('regularIce'),
    'Extra Ice': t('extraIce'),
    'Regular': t('regular'),
    'Large': currentLanguage === 'es' ? 'Grande' : 'Large',
    'None': t('none'),
    'Extra Boba': currentLanguage === 'es' ? 'Boba extra' : 'Extra Boba'
  };

  return valueMap[value] || value;
}

function syncConfirmBalanceText() {
  const balanceWrap = document.getElementById('confirm-balance-text');
  const balanceValue = document.getElementById('confirm-pts-balance')?.textContent || '0';
  if (!balanceWrap) return;
  balanceWrap.innerHTML = `${t('newBalance')}: <strong id="confirm-pts-balance">${balanceValue}</strong> ${t('pointsUnit')}`;
}

function updateSelectOptionsText() {
  const mapOptions = (id, entries) => {
    const select = document.getElementById(id);
    if (!select) return;
    Array.from(select.options).forEach((opt, index) => {
      if (entries[index] != null) opt.textContent = entries[index];
    });
  };

  mapOptions('modal-sweetness', [t('noSugar'), t('quarterSugar'), t('regularSugar'), t('extraSweet')]);
  mapOptions('modal-ice', [t('noIce'), t('lightIce'), t('regularIce'), t('extraIce')]);
  mapOptions('modal-size', [t('regular'), t('large')]);
  mapOptions('modal-topping', [t('none'), t('extraBoba')]);

  mapOptions('edit-sweetness', [t('noSugar'), t('quarterSugar'), t('regularSugar'), t('extraSweet')]);
  mapOptions('edit-ice', [t('noIce'), t('lightIce'), t('regularIce'), t('extraIce')]);
  mapOptions('edit-size', [t('regular'), t('large')]);
  mapOptions('edit-topping', [t('none'), t('extraBoba')]);

  const labelMap = {
    'modal-sweetness': t('sweetness'),
    'modal-ice': t('iceLevel'),
    'modal-size': t('size'),
    'modal-topping': t('topping'),
    'edit-sweetness': t('sweetness'),
    'edit-ice': t('iceLevel'),
    'edit-size': t('size'),
    'edit-topping': t('topping')
  };

  Object.entries(labelMap).forEach(([id, text]) => {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) label.textContent = text;
  });
  saveKioskState();
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage;

    // Keep the kiosk layout the same for every language.
    // Arabic text will still render correctly, but the whole UI will not flip.
    document.documentElement.dir = 'ltr';
    document.body.dir = 'ltr';
    document.body.classList.toggle('arabic-text', currentLanguage === 'ar');

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const setPlaceholder = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.placeholder = value;
  };

  const setAriaLabel = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-label', value);
  };

  const setAlt = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('alt', value);
  };

  const languageSelect = document.getElementById('language-select');
  if (languageSelect) languageSelect.value = currentLanguage;

  setText('language-select-label', t('language'));
  setText('kiosk-label', t('kiosk'));
  setText('menu-title', t('chooseDrink'));
  setText('review-title', t('reviewOrder'));
  setText('payment-title', t('payment'));
  setText('go-to-review-btn', t('reviewOrder') + ' →');
  setText('menu-screen-count-label', t('drinksSelected'));
  setText('checkout-rewards-title', t('rewardsAndPromos'));
  setText('apply-promo-btn', t('apply'));
  setText('subtotal-label', t('subtotal'));
  setText('tax-label', t('tax'));
  setText('total-label', t('total'));
  setText('back-to-menu-btn', t('backToMenu'));
  setText('customer-clear-btn', t('clearOrder'));
  setText('go-to-payment-btn', t('continueToPayment'));
  setText('payment-total-label', t('orderTotal'));
  setText('back-to-review-btn', t('backToReview'));
  setText('customer-checkout-btn', t('placeOrder'));
  setText('confirm-title', t('orderPlaced'));
  setText('confirm-status-label', t('status'));
  setText('confirm-status-value', t('orderReceivedShort'));
  setText('confirm-pickup-label', t('pickup'));
  setText('confirm-pickup-value', t('pickupCounter'));
  setText('confirm-points-earned-label', t('pointsEarnedThisOrder'));
  setText('start-new-order-btn', t('startNewOrder'));
  setText('topbar-points-label', t('yourRewardPoints'));
  setText('open-rewards-btn', t('rewards'));
  setText('open-spin-topbar-btn', t('spin'));
  setText('rewards-modal-title', t('rewards'));
  setText('rewards-history-title', t('redemptionHistory'));
  setText('open-spin-btn', t('spinWheel'));
  setText('rewards-modal-close2', t('close'));
  setText('spin-modal-title', t('spinAndWin'));
  setText('spin-modal-close', t('close'));
  setText('edit-modal-cancel', t('cancel'));
  setText('edit-modal-save', t('saveChanges'));
  setText('modal-qty-label', t('qty'));
  setPlaceholder('promo-code-input', t('promoCodePlaceholder'));

  // Sign-in / guest checkout modal
  setText('guest-login-title', t('signInBeforeCheckout'));
  setText('guest-login-subtitle', t('signInBeforeCheckoutSubtitle'));
  setText('guest-login-tab-qr', t('scanQrCode'));
  setText('guest-login-tab-google', t('signInWithGoogle'));
  setText('guest-login-qr-instructions', t('scanQrInstructions'));
  setText('guest-login-qr-status', t('waitingForPhoneSignIn'));
  setText('guest-login-google-instructions', t('googleKioskInstructions'));
  setText('guest-login-google-btn', t('continueWithGoogle'));
  setText('guest-continue-btn', t('continueAsGuest'));
  setText('guest-login-rewards-btn', t('signInForRewards'));
  setText('kiosk-auth-btn', currentUser ? t('signOut') : t('signIn'));
  setAriaLabel('guest-login-close', t('closeSignIn'));
  setAlt('guest-login-qr-image', t('signInQrAlt'));

  if (!document.getElementById('confirmation-message')?.dataset.transactionMessage) {
    setText('confirmation-message', t('orderReceived'));
  }

  if (!appliedRewardLabel && !appliedPromoLabel) {
    setText('discount-label', t('discount'));
  }

  updateSelectOptionsText();
  syncConfirmBalanceText();
}

// ─── Pricing helpers ──────────────────────────────────────────────────────────
function extraPrice(size, topping) {
  let extra = 0;
  if (size === 'Large') extra += 1.0;
  if (topping === 'Extra Boba') extra += 0.75;
  return extra;
}

function calcSubtotal() {
  return customerOrder.reduce((s, i) => s + Number(i.linePrice || 0), 0);
}

function calcTax(subtotal) {
  return subtotal * 0.0825;
}

// ─── Screen routing ───────────────────────────────────────────────────────────
function setActiveScreen(name) {
  currentScreen = name;
  ['menu', 'review', 'payment', 'confirm'].forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    el.classList.remove('active-screen');
    el.classList.add('hidden-screen');
  });
  const target = document.getElementById(`screen-${name}`);
  target.classList.remove('hidden-screen');
  target.classList.add('active-screen');
  saveKioskState();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;

function saveKioskState(extra = {}) {
  const state = {
    customerOrder,
    customerActiveCategory,
    selectedPaymentMethod,
    currentLanguage,
    currentScreen,
    guestCheckoutRequested,
    appliedRewardId,
    appliedRewardLabel,
    appliedPromoCode,
    appliedPromoLabel,
    discountAmount,
    spinPrizeDetails,
    ...extra
  };
  sessionStorage.setItem('rbtKioskState', JSON.stringify(state));
}

function restoreKioskState() {
  try {
    const raw = sessionStorage.getItem('rbtKioskState');
    if (!raw) return;
    const state = JSON.parse(raw);
    customerOrder = Array.isArray(state.customerOrder) ? state.customerOrder : [];
    customerActiveCategory = state.customerActiveCategory || '';
    selectedPaymentMethod = state.selectedPaymentMethod || 'card';
    currentLanguage = state.currentLanguage || currentLanguage;
    currentScreen = state.currentScreen || 'menu';
    guestCheckoutRequested = Boolean(state.guestCheckoutRequested);
    appliedRewardId = state.appliedRewardId || null;
    appliedRewardLabel = state.appliedRewardLabel || '';
    appliedPromoCode = state.appliedPromoCode || null;
    appliedPromoLabel = state.appliedPromoLabel || '';
    discountAmount = Number(state.discountAmount || 0);
    spinPrizeDetails = state.spinPrizeDetails || null;
  } catch (_) {}
}

function clearGuestPairingPoller() {
  if (guestLoginPoller) {
    clearInterval(guestLoginPoller);
    guestLoginPoller = null;
  }
}

function updateKioskAuthButton() {
  const btn = document.getElementById('kiosk-auth-btn');
  if (!btn) return;
  btn.textContent = currentUser ? t('signOut') : t('signIn');
}

function openGuestLoginOverlay(fromCheckout = false) {
  guestCheckoutRequested = fromCheckout;
  saveKioskState();
  const overlay = document.getElementById('guest-login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('open');
  switchGuestLoginTab('qr');
  startGuestPairing(); // Generate real QR code for phone sign-in
}

function closeGuestLoginOverlay() {
  const overlay = document.getElementById('guest-login-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('open');
  clearGuestPairingPoller();
  guestLoginPairToken = null;
}

function switchGuestLoginTab(tab) {
  const qrBtn = document.getElementById('guest-login-tab-qr');
  const googleBtn = document.getElementById('guest-login-tab-google');
  const qrPanel = document.getElementById('guest-login-qr-panel');
  const googlePanel = document.getElementById('guest-login-google-panel');
  if (!qrBtn || !googleBtn || !qrPanel || !googlePanel) return;

  const qrActive = tab === 'qr';
  qrBtn.style.background = qrActive ? 'var(--accent)' : '#fff';
  qrBtn.style.color = qrActive ? '#fff' : 'var(--muted)';
  googleBtn.style.background = qrActive ? '#fff' : 'var(--accent)';
  googleBtn.style.color = qrActive ? 'var(--muted)' : '#fff';
  qrPanel.style.display = qrActive ? '' : 'none';
  googlePanel.style.display = qrActive ? 'none' : '';
}

async function startGuestPairing() {
  const img = document.getElementById('guest-login-qr-image');
  const status = document.getElementById('guest-login-qr-status');
  if (!img || !status) return;
  clearGuestPairingPoller();
  status.textContent = t('preparingSecureSignIn');
  try {
    const res = await fetch('/api/auth/pair/new?returnTo=' + encodeURIComponent('/customer.html'));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('couldNotCreateQr'));
    guestLoginPairToken = data.token;
    img.src = data.qrUrl;
    img.onload = () => {
      const loading = document.getElementById('guest-login-qr-loading');
      if (loading) loading.style.display = 'none';
    };
    status.textContent = t('scanQrFinishGoogle');
    guestLoginPoller = setInterval(checkGuestPairingStatus, 2000);
  } catch (err) {
    status.textContent = err.message;
  }
}

async function checkGuestPairingStatus() {
  if (!guestLoginPairToken) return;
  const statusEl = document.getElementById('guest-login-qr-status');
  try {
    const res = await fetch(`/api/auth/pair-status/${guestLoginPairToken}`);
    const data = await res.json();
    if (data.status === 'authorized') {
      clearGuestPairingPoller();
      if (statusEl) statusEl.textContent = t('signInCompleteConnecting');
      const claimRes = await fetch(`/api/auth/pair-claim/${guestLoginPairToken}`, { method: 'POST' });
      const claimData = await claimRes.json();
      if (!claimRes.ok) throw new Error(claimData.error || t('couldNotFinishKioskSignIn'));
      await loadUser();
      closeGuestLoginOverlay();
      if (guestCheckoutRequested && customerOrder.length) {
        renderTotals();
        setActiveScreen('payment');
      }
      guestCheckoutRequested = false;
      saveKioskState();
      return;
    }
    if (data.status === 'expired') {
      clearGuestPairingPoller();
      guestLoginPairToken = null;
      if (statusEl) statusEl.textContent = t('qrExpired');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message;
  }
}

function startCustomerGoogleLogin(fromCheckout = false) {
  guestCheckoutRequested = fromCheckout;
  saveKioskState({ guestCheckoutRequested });
  window.location.href = '/auth/google?returnTo=' + encodeURIComponent('/customer.html');
}

function handleCustomerAuthButton() {
  if (currentUser) {
    fetch('/auth/logout', { method: 'POST' }).finally(() => {
      currentUser = null;
      updateKioskAuthButton();
      const greeting = document.getElementById('kiosk-user-greeting');
      if (greeting) greeting.textContent = '';
      window.location.reload();
    });
    return;
  }
  openGuestLoginOverlay(false);
}

function showToast(msg) {
  let tEl = document.getElementById('kiosk-toast');
  if (!tEl) {
    tEl = document.createElement('div');
    tEl.id = 'kiosk-toast';
    document.body.appendChild(tEl);
  }
  tEl.textContent = msg;
  tEl.classList.add('kiosk-toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => tEl.classList.remove('kiosk-toast-show'), 2200);
}

// ─── Auth / rewards bar ───────────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.authenticated) {
      currentUser = null;
      updateKioskAuthButton();
      return;
    }
    currentUser = data.user;
    const greeting = document.getElementById('kiosk-user-greeting');
    if (greeting) greeting.textContent = `${t('hi')}, ${currentUser.firstName || currentUser.displayName}`;
    renderRewardsTopbar(currentUser.rewardPoints ?? 0);
    updateKioskAuthButton();
  } catch (_) {}
}

function renderRewardsTopbar(pts) {
  const bar = document.getElementById('rewards-topbar');
  const ptsEl = document.getElementById('topbar-pts');
  if (!bar) return;
  bar.style.display = 'flex';
  if (ptsEl) ptsEl.textContent = pts.toLocaleString();
}

function updateTopbarPts(pts) {
  const ptsEl = document.getElementById('topbar-pts');
  if (ptsEl) ptsEl.textContent = pts.toLocaleString();
  if (currentUser) currentUser.rewardPoints = pts;
  syncConfirmBalanceText();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function renderTabs() {
  const wrap = document.getElementById('customer-tabs');
  if (!wrap) return;
  wrap.innerHTML = customerCategories.map(cat => `
    <button class="tab-btn ${customerActiveCategory === cat ? 'active' : ''}" data-category="${cat}" type="button">
      ${translateCategoryName(cat)}
    </button>
  `).join('');

  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      customerActiveCategory = btn.dataset.category;
      renderTabs();
      renderMenu();
    });
  });
  saveKioskState();
}

// ─── Menu grid ────────────────────────────────────────────────────────────────
function renderMenu() {
  const wrap = document.getElementById('customer-menu');
  if (!wrap) return;
  const filtered = customerMenu.filter(i => i.category === customerActiveCategory);

  wrap.innerHTML = filtered.map(item => {
  const displayName = translateDrinkName(item.name);

  return `
    <article class="menu-card" data-id="${item.id}" tabindex="0" role="button"
             aria-label="${displayName}, $${Number(item.price).toFixed(2)}">
      <div class="drink-image-wrap">
        <div class="drink-image" style="background-image:url('${getDrinkImg(item.name)}');"></div>
      </div>
      <div class="topline">
        <h3 style="margin:0;">${displayName}</h3>
        ${item.popular ? `<span class="tag">${t('popular')}</span>` : ''}
      </div>
      ${item.description ? `<p>${TRANSLATIONS[currentLanguage][`description_${item.name}`] || item.description}</p>` : ''}
      <div class="price-line" style="margin-top:auto;">
        <span class="price">$${Number(item.price).toFixed(2)}</span>
        <button class="btn add-btn" data-id="${item.id}" type="button" style="font-size:0.85rem;padding:8px 16px;">
          ${t('customize')}
        </button>
      </div>
    </article>
  `;
  }).join('');

  wrap.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('add-btn')) return;
      const item = customerMenu.find(x => x.id === Number(card.dataset.id));
      if (item) openDrinkModal(item);
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = customerMenu.find(x => x.id === Number(card.dataset.id));
        if (item) openDrinkModal(item);
      }
    });
  });

  wrap.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = customerMenu.find(x => x.id === Number(btn.dataset.id));
      if (item) openDrinkModal(item);
    });
  });
  saveKioskState();
}

// ─── Drink Detail Modal ───────────────────────────────────────────────────────
function openDrinkModal(item) {
  modalItem = item;
  modalQty = 1;

  const modalImg = document.getElementById('modal-drink-img');
  if (modalImg) {
    modalImg.src = getDrinkImg(item.name);
    modalImg.alt = `${item.name} drink image`;
  }

  const displayName = translateDrinkName(item.name);

  document.getElementById('modal-drink-img').alt = displayName;
  document.getElementById('modal-drink-name').textContent = displayName;
  document.getElementById('modal-drink-desc').textContent = ''; // description hidden per request
  document.getElementById('modal-sweetness').value = 'Regular Sugar';
  document.getElementById('modal-ice').value = 'Regular Ice';
  document.getElementById('modal-size').value = 'Regular';
  document.getElementById('modal-topping').value = 'None';

  updateSelectOptionsText();
  document.getElementById('modal-cancel-btn').textContent = t('cancel');

  updateModalQty();
  updateModalPrice();

  document.getElementById('drink-modal-overlay').classList.add('open');
  document.getElementById('modal-cancel-btn').focus();

  // Load and display ingredients for this drink
  const ingWrap = document.getElementById('modal-ingredients-wrap');
  const ingList = document.getElementById('modal-ingredients-list');
  if (ingWrap && ingList) {
    ingList.textContent = '…';
    ingWrap.style.display = 'block';
    fetch('/api/public/menu-item/' + item.id + '/ingredients')
      .then(r => r.ok ? r.json() : { ingredients: [] })
      .then(data => {
        const ings = data.ingredients || [];
        if (ings.length) {
          ingList.textContent = ings.join(', ');
        } else {
          ingWrap.style.display = 'none';
        }
      })
      .catch(() => { ingWrap.style.display = 'none'; });
  }
}

function closeDrinkModal() {
  const modalImg = document.getElementById('modal-drink-img');
    if (modalImg) {
      modalImg.alt = '';
    }
  document.getElementById('drink-modal-overlay').classList.remove('open');
  modalItem = null;
}

function updateModalQty() {
  document.getElementById('modal-qty-display').textContent = modalQty;
}

function updateModalPrice() {
  if (!modalItem) return;
  const size = document.getElementById('modal-size').value;
  const topping = document.getElementById('modal-topping').value;
  const extra = extraPrice(size, topping);
  const unit = Number(modalItem.price) + extra;
  const total = unit * modalQty;
  document.getElementById('modal-drink-price').textContent = `$${unit.toFixed(2)}`;
  document.getElementById('modal-add-btn').textContent = `${t('addToOrder')} $${total.toFixed(2)}`;
}

function addModalItemToOrder() {
  if (!modalItem) return;
  const selections = {
    sweetness: ['No Sugar','Quarter Sugar','Regular Sugar','Extra Sweet'][document.getElementById('modal-sweetness').selectedIndex] || 'Regular Sugar',
    ice:       ['No Ice','Light Ice','Regular Ice','Extra Ice'][document.getElementById('modal-ice').selectedIndex] || 'Regular Ice',
    size:      ['Regular','Large'][document.getElementById('modal-size').selectedIndex] || 'Regular',
    topping:   ['None','Extra Boba'][document.getElementById('modal-topping').selectedIndex] || 'None'
  };
  const extra = extraPrice(selections.size, selections.topping);
  const unitPrice = Number(modalItem.price) + extra;
  const linePrice = unitPrice * modalQty;

  customerOrder.push({
    ...modalItem,
    quantity: modalQty,
    selections,
    unitPrice,
    linePrice
  });

  showToast(`${translateDrinkName(modalItem.name)} x ${modalQty} ${t('added')}`);
  closeDrinkModal();
  renderOrder();
}

// ── Modal events
document.getElementById('modal-cancel-btn').addEventListener('click', closeDrinkModal);
document.getElementById('drink-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('drink-modal-overlay')) closeDrinkModal();
});
document.getElementById('modal-qty-minus').addEventListener('click', () => {
  if (modalQty > 1) {
    modalQty--;
    updateModalQty();
    updateModalPrice();
  }
});
document.getElementById('modal-qty-plus').addEventListener('click', () => {
  if (modalQty < 10) {
    modalQty++;
    updateModalQty();
    updateModalPrice();
  }
});
document.getElementById('modal-add-btn').addEventListener('click', addModalItemToOrder);
['modal-size', 'modal-topping'].forEach(id => {
  document.getElementById(id).addEventListener('change', updateModalPrice);
});

// ─── Order rendering ──────────────────────────────────────────────────────────
function renderOrder() {
  const lines = document.getElementById('customer-order-lines');
  const count = document.getElementById('customer-item-count');
  const revCount = document.getElementById('review-item-count');
  const menuCount = document.getElementById('menu-screen-count');

  const itemCount = customerOrder.reduce((s, i) => s + (i.quantity || 1), 0);
  count.textContent = `${itemCount} ${itemCount === 1 ? t('item') : t('items')}`;
  revCount.textContent = `${itemCount} ${itemCount === 1 ? t('item') : t('items')}`;
  menuCount.textContent = String(itemCount);

  renderTotals();

  if (!customerOrder.length) {
    lines.innerHTML = `<p class="cart-note">${t('noDrinksYet')}</p>`;
    saveKioskState();
    return;
  }

  lines.innerHTML = customerOrder.map((item, idx) => {
    const mods = [
      item.selections.size !== 'Regular' ? translateSelectionValue(item.selections.size) : null,
      item.selections.sweetness !== 'Regular Sugar' ? translateSelectionValue(item.selections.sweetness) : null,
      item.selections.ice !== 'Regular Ice' ? translateSelectionValue(item.selections.ice) : null,
      item.selections.topping !== 'None' ? translateSelectionValue(item.selections.topping) : null
    ].filter(Boolean);

    return `
      <article class="order-item">
        <div class="line-top">
          <strong>${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}</strong>
          <strong>$${Number(item.linePrice).toFixed(2)}</strong>
        </div>
        <small class="muted">${mods.join(', ') || t('noModifications')}</small>
        <div class="order-item-actions">
          <button class="btn ghost edit-btn" data-index="${idx}" type="button" style="font-size:0.82rem;padding:6px 12px;">${t('edit')}</button>
          <button class="btn ghost remove-btn" data-index="${idx}" type="button" style="font-size:0.82rem;padding:6px 12px;">${t('remove')}</button>
        </div>
      </article>`;
  }).join('');

  lines.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      customerOrder.splice(Number(btn.dataset.index), 1);
      resetDiscount();
      renderOrder();
    });
  });

  lines.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.index)));
  });

  saveKioskState();
}

function renderTotals() {
  const subtotal = calcSubtotal();
  const discount = discountAmount;
  const discounted = subtotal - discount;
  const tax = calcTax(discounted);
  const total = discounted + tax;

  document.getElementById('customer-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('customer-tax').textContent = `$${tax.toFixed(2)}`;
  document.getElementById('customer-total').textContent = `$${total.toFixed(2)}`;
  document.getElementById('payment-total').textContent = `$${total.toFixed(2)}`;

  const discountRow = document.getElementById('discount-row');
  if (discount > 0) {
    discountRow.style.display = '';
    document.getElementById('customer-discount').textContent = `−$${discount.toFixed(2)}`;
    document.getElementById('discount-label').textContent = appliedRewardLabel || appliedPromoLabel || t('discount');
    const note = document.getElementById('payment-discount-note');
    if (note) {
      note.textContent = `Includes ${appliedRewardLabel || appliedPromoLabel} (−$${discount.toFixed(2)})`;
      note.style.display = '';
    }
  } else {
    discountRow.style.display = 'none';
    const note = document.getElementById('payment-discount-note');
    if (note) note.style.display = 'none';
  }

  saveKioskState();
}

// ─── Rewards panel on review screen ──────────────────────────────────────────
let rewardsCatalogCache = [];

async function loadCheckoutRewardsPanel() {
  const panel = document.getElementById('checkout-rewards-panel');
  if (!panel) return;

  if (!currentUser) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  try {
    const [rwRes, promoRes] = await Promise.all([
      fetch('/api/rewards'),
      fetch('/api/promos')
    ]);
    const rwData = await rwRes.json();
    const promoData = await promoRes.json();

    const userPts = rwData.userPoints ?? currentUser.rewardPoints ?? 0;
    updateTopbarPts(userPts);
    rewardsCatalogCache = rwData.catalog || [];

    const wrap = document.getElementById('reward-select-wrap');

    if (appliedRewardId) {
      wrap.innerHTML = '';
      renderAppliedDiscount();
      renderTotals();
      return;
    }

    const affordable = rewardsCatalogCache.filter(r => r.points_cost <= userPts);

    if (affordable.length > 0) {
      wrap.innerHTML = `
        <label style="display:block;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">
          ${t('applyRewardLabel')} (${userPts} ${t('ptsAvailable')})
        </label>
        <div style="display:flex;gap:8px;margin-bottom:6px;">
          <select id="reward-select" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;">
            <option value="">${t('selectReward')}</option>
            ${affordable.map(r => `<option value="${r.reward_id}" data-label="${r.label}" data-type="${r.reward_type}" data-value="${r.reward_value}">${r.label} (${r.points_cost} ${t('pointsUnit')})</option>`).join('')}
          </select>
          <button type="button" class="btn-apply" id="apply-reward-btn">${t('apply')}</button>
        </div>`;
      document.getElementById('apply-reward-btn').addEventListener('click', applySelectedReward);

      if (affordable.length === 1 && !appliedPromoCode) {
        const sel = document.getElementById('reward-select');
        sel.value = affordable[0].reward_id;
        applySelectedReward();
      }
    } else {
      wrap.innerHTML = `<p class="muted" style="font-size:0.83rem;margin:0 0 6px;">
        ${userPts > 0 ? `${userPts} ${t('pointsUnit')}, ${t('keepOrdering')}` : t('earnPointsPrompt')}
      </p>`;
    }

    if (promoData.codes?.length > 0 && !appliedPromoCode) {
      const input = document.getElementById('promo-code-input');
      if (input) {
        input.placeholder = `${t('youHaveCode')}: ${promoData.codes[0].code}`;
        input.value = promoData.codes[0].code;
        await applyPromoCode();
      }
    }

    if (appliedPromoCode && spinPrizeDetails && discountAmount === 0) {
      calcRewardDiscount(spinPrizeDetails.type, Number(spinPrizeDetails.value || 0));
    }

    renderAppliedDiscount();
    renderTotals();
  } catch (e) {
    console.error('Rewards panel failed:', e);
  }
}

function applySelectedReward() {
  const sel = document.getElementById('reward-select');
  if (!sel || !sel.value) return;
  const opt = sel.options[sel.selectedIndex];

  appliedRewardId = Number(sel.value);
  appliedRewardLabel = opt.dataset.label || 'Reward';
  appliedPromoCode = null;
  appliedPromoLabel = '';

  calcRewardDiscount(opt.dataset.type, Number(opt.dataset.value || 0));
  renderAppliedDiscount();
  renderTotals();

  const wrap = document.getElementById('reward-select-wrap');
  if (wrap) wrap.innerHTML = '';
}

function calcRewardDiscount(type, value) {
  const subtotal = calcSubtotal();
  if (!subtotal) {
    discountAmount = 0;
    return;
  }

  if (type === 'percent_off') {
    discountAmount = Number(((subtotal * value) / 100).toFixed(2));
  } else if (type === 'free_drink') {
    discountAmount = customerOrder.length ? Math.min(...customerOrder.map(i => i.unitPrice)) : 0;
    discountAmount = Number(discountAmount.toFixed(2));
  } else if (type === 'free_topping') {
    discountAmount = 0.75;
  } else if (type === 'flat_off') {
    discountAmount = Math.min(subtotal, value);
  } else {
    discountAmount = 0;
  }

  discountAmount = Math.min(discountAmount, subtotal);
}

async function applyPromoCode() {
  const input = document.getElementById('promo-code-input');
  const fb = document.getElementById('promo-feedback');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) return;

  if (fb) {
    fb.style.color = 'var(--muted)';
    fb.textContent = t('checking');
  }

  try {
    const res = await fetch(`/api/promos/validate/${code}`);
    const data = await res.json();

    if (!data.valid) {
      if (fb) {
        fb.style.color = 'var(--accent)';
        fb.textContent = data.reason || t('invalidOrExpiredCode');
      }
      return;
    }

    const promo = data.promo;
    appliedPromoCode = code;
    appliedPromoLabel = promo.label;
    appliedRewardId = null;
    appliedRewardLabel = '';

    const subtotal = calcSubtotal();
    if (promo.promo_type === 'percent_off') discountAmount = Number(((subtotal * Number(promo.promo_value)) / 100).toFixed(2));
    else if (promo.promo_type === 'flat_off') discountAmount = Math.min(subtotal, Number(promo.promo_value));
    else if (promo.promo_type === 'free_drink') discountAmount = customerOrder.length ? Math.min(...customerOrder.map(i => i.unitPrice)) : 0;
    else if (promo.promo_type === 'free_topping') discountAmount = 0.75;
    discountAmount = Math.min(discountAmount, subtotal);

    if (fb) {
      fb.style.color = '#15803d';
      fb.textContent = `✓ "${promo.label}" ${t('applied')}! −$${discountAmount.toFixed(2)}`;
    }

    renderAppliedDiscount();
    renderTotals();
  } catch (_) {
    if (fb) {
      fb.style.color = 'var(--accent)';
      fb.textContent = t('couldNotValidateCode');
    }
  }
}

function renderAppliedDiscount() {
  const wrap = document.getElementById('applied-reward-display');
  if (!wrap) return;

  if (appliedRewardId || appliedPromoCode) {
    const label = appliedRewardLabel || appliedPromoLabel;
    wrap.innerHTML = `
      <div class="applied-reward-tag">
        ✓ ${label}
        <button type="button" onclick="clearDiscount()" aria-label="Remove discount">✕</button>
      </div>`;
  } else {
    wrap.innerHTML = '';
  }
}

function clearDiscount() {
  appliedRewardId = null;
  appliedRewardLabel = '';
  appliedPromoCode = null;
  appliedPromoLabel = '';
  discountAmount = 0;
  spinPrizeDetails = null;
  const fb = document.getElementById('promo-feedback');
  if (fb) fb.textContent = '';
  renderAppliedDiscount();
  renderTotals();
  loadCheckoutRewardsPanel();
}

window.clearDiscount = clearDiscount;

function resetDiscount() {
  clearDiscount();
}

// ─── Rewards Modal ────────────────────────────────────────────────────────────
async function openRewardsModal() {
  const overlay = document.getElementById('rewards-modal-overlay');
  overlay.classList.add('open');

  try {
    const res = await fetch('/api/rewards');
    const data = await res.json();
    const pts = data.userPoints ?? 0;

    document.getElementById('rewards-pts-display').textContent = `${pts.toLocaleString()} ${t('pointsUnit')}`;
    updateTopbarPts(pts);

    const catalog = data.catalog || [];
    const listEl = document.getElementById('rewards-catalog-list');
    listEl.innerHTML = catalog.map(r => {
      const canRedeem = pts >= r.points_cost;
      return `
        <div class="reward-card ${canRedeem ? 'can-redeem' : ''}">
          <div class="rw-info">
            <div class="rw-name">${r.label}</div>
            <div class="rw-cost">${r.points_cost} ${t('pointsUnit')} ${canRedeem ? '' : `· ${t('needMore')} ${r.points_cost - pts} ${t('more')}`}</div>
          </div>
          <button class="btn-redeem" 
                  data-id="${r.reward_id}" 
                  data-label="${r.label}" 
                  data-type="${r.reward_type}"
                  data-value="${r.reward_value || 0}"
                  ${!canRedeem ? 'disabled' : ''}>
            ${canRedeem ? t('redeem') : t('locked')}
          </button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-redeem:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        appliedRewardId = Number(btn.dataset.id);
        appliedRewardLabel = btn.dataset.label;
        appliedPromoCode = null;
        appliedPromoLabel = '';
        calcRewardDiscount(btn.dataset.type, Number(btn.dataset.value || 0));
        showToast(`${btn.dataset.label} ${t('applied')} -$${discountAmount.toFixed(2)}`);
        closeRewardsModal();
        renderAppliedDiscount();
        renderTotals();
      });
    });

    const histEl = document.getElementById('rewards-history-list');
    const history = data.history || [];
    histEl.innerHTML = history.length
      ? history.map(h => `
          <div class="rw-history-item">
            <span>${h.label}</span>
            <span>${new Date(h.redeemed_at).toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'en-US')}</span>
          </div>`).join('')
      : `<p class="muted" style="font-size:0.85rem;">${t('noRedemptionsYet')}</p>`;
  } catch (e) {
    document.getElementById('rewards-catalog-list').innerHTML = `<p class="muted">${t('couldNotLoadRewards')}</p>`;
  }
}

function closeRewardsModal() {
  document.getElementById('rewards-modal-overlay').classList.remove('open');
}

document.getElementById('rewards-modal-close').addEventListener('click', closeRewardsModal);
document.getElementById('rewards-modal-close2').addEventListener('click', closeRewardsModal);
document.getElementById('rewards-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('rewards-modal-overlay')) closeRewardsModal();
});

// ─── Spin Wheel ───────────────────────────────────────────────────────────────
// segmentIndex MUST match server.js SPIN_PRIZES segmentIndex values
const SPIN_SEGMENTS = [
  { label: '50% Off\nOne Drink', color: '#9e3b35', segmentIndex: 0 },
  { label: 'Free\nTopping',      color: '#c05a4a', segmentIndex: 1 },
  { label: '$1 Off\nYour Order', color: '#d07a5a', segmentIndex: 2 },
  { label: 'Free\nSmall Drink',  color: '#b84d3e', segmentIndex: 3 },
  { label: 'Buy One\nGet One',   color: '#a04040', segmentIndex: 4 },
  { label: '25% Off\nOrder',     color: '#cc6655', segmentIndex: 5 }
];

let spinAngle = 0;
let spinning = false;
let canSpin = false;
let spinResult = null;
let spinAnimDone = false;
let spinApiDone = false;
let hasSpunThisSession = false;

function drawWheel() {
  const canvas = document.getElementById('spin-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 4;
  const segAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  SPIN_SEGMENTS.forEach((seg, i) => {
    const start = spinAngle + i * segAngle;
    const end = start + segAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + segAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px Inter, sans-serif';
    seg.label.split('\n').forEach((line, li) => {
      ctx.fillText(line, radius - 10, li * 14 - (seg.label.includes('\n') ? 7 : 0));
    });
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
  ctx.fillStyle = '#fffaf7';
  ctx.fill();
  ctx.strokeStyle = 'rgba(158,59,53,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

async function openSpinModal() {
  closeRewardsModal();
  const overlay = document.getElementById('spin-modal-overlay');
  overlay.classList.add('open');
  drawWheel();

  const btn = document.getElementById('spin-btn');
  const msgEl = document.getElementById('spin-status-msg');
  const result = document.getElementById('spin-result');
  result.classList.remove('show');

  if (!currentUser) {
    btn.disabled = true;
    btn.textContent = 'SPIN!';
    msgEl.textContent = t('signInToSpin');
    return;
  }

  if (hasSpunThisSession) {
    btn.disabled = true;
    btn.textContent = t('spun');
    msgEl.textContent = t('alreadySpun');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'SPIN!';
  msgEl.textContent = t('checkingEligibility');
  try {
    const res = await fetch('/api/spin/status');
    const data = await res.json();
    canSpin = data.canSpin;
    if (canSpin) {
      btn.disabled = false;
      msgEl.textContent = t('spinChance');
    } else {
      btn.disabled = true;
      btn.textContent = t('spun');
      msgEl.textContent = data.reason || t('alreadySpun');
    }
  } catch (_) {
    canSpin = true;
    btn.disabled = false;
    msgEl.textContent = t('spinChanceShort');
  }
}

function closeSpinModal() {
  document.getElementById('spin-modal-overlay').classList.remove('open');
}

function tryFinishSpin() {
  if (!spinAnimDone || !spinApiDone) return;

  spinning = false;
  const result = document.getElementById('spin-result');
  const prizeEl = document.getElementById('spin-prize-label');
  const codeEl = document.getElementById('spin-promo-code');

  if (spinResult) {
    const segAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;
    // Use segmentIndex from server for accurate wheel snap
    const segIdx = spinResult.prize?.segmentIndex ?? SPIN_SEGMENTS.findIndex(
      s => s.label.replace(/\n/g, ' ') === (spinResult.prize?.label || '')
    );
    if (segIdx >= 0) {
      const base = -Math.PI / 2 - (segIdx + 0.5) * segAngle;
      const n = Math.round((spinAngle - base) / (2 * Math.PI));
      spinAngle = base + n * 2 * Math.PI;
      drawWheel();
    }

    prizeEl.textContent = `${t('youWon')}: ${spinResult.prize?.label || 'a prize'}!`;
    codeEl.textContent = spinResult.code ? `${t('code')}: ${spinResult.code}` : '';
    result.classList.add('show');

    if (spinResult.prize) {
      // Auto-apply discount immediately — no code entry needed
      appliedPromoCode = spinResult.code || 'SPIN-AUTO';
      appliedPromoLabel = spinResult.prize.label || 'Prize';
      spinPrizeDetails = spinResult.prize;
      // Calculate discount right now based on prize type
      const prize = spinResult.prize;
      const subtotal = calcSubtotal();
      if (prize.type === 'percent_off') {
        discountAmount = Number(((subtotal * Number(prize.value)) / 100).toFixed(2));
      } else if (prize.type === 'free_drink') {
        discountAmount = customerOrder.length ? Number(Math.min(...customerOrder.map(i => i.unitPrice)).toFixed(2)) : 0;
      } else if (prize.type === 'free_topping') {
        discountAmount = 0.75;
      } else if (prize.type === 'flat_off') {
        discountAmount = Math.min(subtotal, Number(prize.value) || 0);
      }
      discountAmount = Math.min(discountAmount, subtotal);
    }

    showToast(`${t('youWon')}: ${spinResult.prize?.label}! ✅ Applied to your order!`);
  }

  const btn = document.getElementById('spin-btn');
  btn.textContent = t('spun');
  canSpin = false;
  hasSpunThisSession = true;
}

async function executeSpin() {
  if (!canSpin || spinning) return;
  spinning = true;
  spinAnimDone = false;
  spinApiDone = false;
  spinResult = null;

  const btn = document.getElementById('spin-btn');
  btn.disabled = true;
  btn.textContent = t('spinning');

  const extraSpins = 5 + Math.random() * 3;
  const targetAngle = spinAngle + extraSpins * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duration = 4000;
  const startAngle = spinAngle;
  const startTime = performance.now();

  function easeOutFn(p) {
    return 1 - Math.pow(1 - p, 3);
  }

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    spinAngle = startAngle + (targetAngle - startAngle) * easeOutFn(progress);
    drawWheel();
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      spinAnimDone = true;
      if (!spinApiDone) btn.textContent = t('processing');
      tryFinishSpin();
    }
  }

  requestAnimationFrame(animate);

  try {
    const res = await fetch('/api/spin', { method: 'POST' });
    spinResult = await res.json();
  } catch (_) {
    spinResult = { prize: { label: 'Free Topping', type: 'free_topping', value: 0 }, code: 'RBT-DEMO' };
  }

  spinApiDone = true;
  tryFinishSpin();
}

document.getElementById('spin-btn').addEventListener('click', executeSpin);
document.getElementById('spin-modal-close').addEventListener('click', closeSpinModal);
document.getElementById('spin-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('spin-modal-overlay')) closeSpinModal();
});

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function openEditModal(index) {
  const item = customerOrder[index];
  if (!item) return;
  editingIndex = index;

  document.getElementById('edit-modal-title').textContent = item.name;
  updateSelectOptionsText(); // translate options FIRST

  // Map stored English selections to the correct option index
  const sweetnessMap = ['No Sugar','Quarter Sugar','Regular Sugar','Extra Sweet'];
  const iceMap       = ['No Ice','Light Ice','Regular Ice','Extra Ice'];
  const sizeMap      = ['Regular','Large'];
  const toppingMap   = ['None','Extra Boba'];

  function setByVal(id, map, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const idx = map.indexOf(val);
    el.selectedIndex = idx >= 0 ? idx : 0;
  }
  setByVal('edit-sweetness', sweetnessMap, item.selections.sweetness);
  setByVal('edit-ice',       iceMap,       item.selections.ice);
  setByVal('edit-size',      sizeMap,      item.selections.size);
  setByVal('edit-topping',   toppingMap,   item.selections.topping);

  document.getElementById('edit-modal-overlay').classList.remove('hidden');
  document.getElementById('edit-modal-overlay').classList.add('open');
}

document.getElementById('edit-modal-cancel').addEventListener('click', () => {
  document.getElementById('edit-modal-overlay').classList.remove('open');
  document.getElementById('edit-modal-overlay').classList.add('hidden');
});

document.getElementById('edit-modal-save').addEventListener('click', () => {
  if (editingIndex < 0) return;
  const item = customerOrder[editingIndex];
  const newSel = {
    sweetness: ['No Sugar','Quarter Sugar','Regular Sugar','Extra Sweet'][document.getElementById('edit-sweetness').selectedIndex] || document.getElementById('edit-sweetness').value,
    ice:       ['No Ice','Light Ice','Regular Ice','Extra Ice'][document.getElementById('edit-ice').selectedIndex] || document.getElementById('edit-ice').value,
    size:      ['Regular','Large'][document.getElementById('edit-size').selectedIndex] || document.getElementById('edit-size').value,
    topping:   ['None','Extra Boba'][document.getElementById('edit-topping').selectedIndex] || document.getElementById('edit-topping').value
  };
  const extra = extraPrice(newSel.size, newSel.topping);
  const unitPrice = Number(item.price) + extra;
  customerOrder[editingIndex] = { ...item, selections: newSel, unitPrice, linePrice: unitPrice * (item.quantity || 1) };
  document.getElementById('edit-modal-overlay').classList.remove('open');
  document.getElementById('edit-modal-overlay').classList.add('hidden');
  renderOrder();
});

// ─── Payment ──────────────────────────────────────────────────────────────────
function setPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-option').forEach(btn => {
    btn.classList.toggle('active-payment', btn.dataset.payment === method);
    if (btn.dataset.payment === 'card') btn.textContent = t('card');
    if (btn.dataset.payment === 'applepay') btn.textContent = t('applePay');
    if (btn.dataset.payment === 'cash') btn.textContent = t('cash');
  });
  saveKioskState();
}

document.querySelectorAll('.payment-option').forEach(btn => {
  btn.addEventListener('click', () => setPaymentMethod(btn.dataset.payment));
});

// ─── Checkout ─────────────────────────────────────────────────────────────────
document.getElementById('customer-checkout-btn').addEventListener('click', async () => {
  const out = document.getElementById('customer-checkout-result');
  if (!customerOrder.length) {
    out.textContent = t('addDrinkFirst');
    return;
  }

  out.textContent = t('placingOrder');

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashierId: 7,
        paymentMethod: selectedPaymentMethod,
        rewardId: appliedRewardId || null,
        promoCode: appliedPromoCode || null,
        items: customerOrder.map(item => ({
          id: item.id,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          selections: item.selections
        }))
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error || 'Checkout failed.');

    const confirmationMessage = document.getElementById('confirmation-message');
    confirmationMessage.dataset.transactionMessage = '1';
    confirmationMessage.textContent =
      `Transaction #${data.transactionId} ${t('transactionSaved')} ${data.source === 'database' ? t('database') : t('fallback')}`;

    const rewardsBox = document.getElementById('confirm-rewards-box');
    if (data.pointsEarned > 0) {
      document.getElementById('confirm-pts-earned').textContent = `+${data.pointsEarned}`;
      document.getElementById('confirm-pts-balance').textContent = (data.newPointBalance ?? 0).toLocaleString();
      rewardsBox.style.display = '';
      updateTopbarPts(data.newPointBalance ?? ((currentUser?.rewardPoints ?? 0) + data.pointsEarned));
    } else {
      rewardsBox.style.display = 'none';
    }

    syncConfirmBalanceText();
    out.textContent = '';
    setActiveScreen('confirm');
  } catch (e) {
    out.textContent = e.message;
  }
});

// ─── Navigation wiring ────────────────────────────────────────────────────────
document.getElementById('go-to-review-btn').addEventListener('click', () => {
  if (!customerOrder.length) {
    showToast(t('addDrinkFirst'));
    return;
  }
  renderOrder();
  setActiveScreen('review');
  loadCheckoutRewardsPanel();
});

document.getElementById('back-to-menu-btn').addEventListener('click', () => setActiveScreen('menu'));
document.getElementById('go-to-payment-btn').addEventListener('click', () => {
  if (!customerOrder.length) {
    showToast(t('emptyOrder'));
    return;
  }
  if (!currentUser) {
    openGuestLoginOverlay(true);
    return;
  }
  renderTotals();
  setActiveScreen('payment');
});
document.getElementById('back-to-review-btn').addEventListener('click', () => setActiveScreen('review'));
document.getElementById('customer-clear-btn').addEventListener('click', () => {
  customerOrder = [];
  resetDiscount();
  renderOrder();
});
document.getElementById('start-new-order-btn').addEventListener('click', () => {
  customerOrder = [];
  selectedPaymentMethod = 'card';
  resetDiscount();
  setPaymentMethod('card');
  document.getElementById('customer-checkout-result').textContent = '';

  const confirmationMessage = document.getElementById('confirmation-message');
  delete confirmationMessage.dataset.transactionMessage;
  confirmationMessage.textContent = t('orderReceived');

  renderOrder();
  setActiveScreen('menu');
});

document.getElementById('apply-promo-btn').addEventListener('click', applyPromoCode);

// Rewards / spin buttons
document.getElementById('open-rewards-btn')?.addEventListener('click', openRewardsModal);
document.getElementById('open-spin-topbar-btn')?.addEventListener('click', openSpinModal);
document.getElementById('open-spin-btn')?.addEventListener('click', openSpinModal);

// Language selector
document.getElementById('language-select')?.addEventListener('change', async e => {
  currentLanguage = e.target.value;
  localStorage.setItem('kioskLanguage', currentLanguage);

  showToast(currentLanguage === 'en' ? 'Language changed' : 'Translating...');

  if (!TRANSLATIONS[currentLanguage]) {
    TRANSLATIONS[currentLanguage] = {};
  }

  await ensureLanguageLoaded();
  await ensureCategoryTranslations();
  await ensureDrinkTranslations();

  applyStaticTranslations();

  if (currentUser) {
    const greeting = document.getElementById('kiosk-user-greeting');
    if (greeting) greeting.textContent = `${t('hi')}, ${currentUser.firstName || currentUser.displayName}`;
  }

  renderTabs();
  renderMenu();
  renderOrder();
  renderTotals();
  setPaymentMethod(selectedPaymentMethod);
  loadCustomerWeather();
});

document.getElementById('kiosk-auth-btn')?.addEventListener('click', handleCustomerAuthButton);
document.getElementById('guest-login-close')?.addEventListener('click', closeGuestLoginOverlay);
document.getElementById('guest-login-overlay')?.addEventListener('click', event => {
  if (event.target.id === 'guest-login-overlay') closeGuestLoginOverlay();
});
document.getElementById('guest-login-tab-qr')?.addEventListener('click', () => {
  switchGuestLoginTab('qr');
  if (!guestLoginPairToken) startGuestPairing();
});
document.getElementById('guest-login-tab-google')?.addEventListener('click', () => switchGuestLoginTab('google'));
document.getElementById('guest-login-google-btn')?.addEventListener('click', () => startCustomerGoogleLogin(guestCheckoutRequested));
document.getElementById('guest-login-rewards-btn')?.addEventListener('click', () => startCustomerGoogleLogin(guestCheckoutRequested));
document.getElementById('guest-continue-btn')?.addEventListener('click', () => {
  closeGuestLoginOverlay();
  if (guestCheckoutRequested && customerOrder.length) {
    renderTotals();
    setActiveScreen('payment');
  }
  guestCheckoutRequested = false;
  saveKioskState();
});

// ─── Deep-link support (#rewards / #spin from portal) ────────────────────────
function checkDeepLink() {
  if (window.location.hash === '#rewards') openRewardsModal();
  if (window.location.hash === '#spin') openSpinModal();
}

// ─── Assistant ────────────────────────────────────────────────────────────────
function openAssistantModal() {
  document.getElementById('assistant-modal-overlay')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('assistant-input')?.focus(), 50);
}

function closeAssistantModal() {
  document.getElementById('assistant-modal-overlay')?.classList.add('hidden');
}

function addAssistantMessage(text, sender) {
  const box = document.getElementById('assistant-messages');
  if (!box) return;

  const msg = document.createElement('div');
  msg.className = sender === 'user'
    ? 'assistant-msg assistant-msg-user'
    : 'assistant-msg assistant-msg-bot';

  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

async function askAssistant(message) {
  const clean = String(message || '').trim();
  if (!clean) return;

  addAssistantMessage(clean, 'user');

  const thinking = 'Thinking...';
  addAssistantMessage(thinking, 'bot');

  const box = document.getElementById('assistant-messages');
  const thinkingEl = box?.lastElementChild;

  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: clean })
    });

    const data = await res.json();
    if (thinkingEl) {
      thinkingEl.textContent = data.reply || 'Sorry, I could not answer that.';
    }
  } catch (_) {
    if (thinkingEl) {
      thinkingEl.textContent = 'Sorry, the assistant is unavailable right now.';
    }
  }
}

document.getElementById('assistant-open-btn')?.addEventListener('click', openAssistantModal);
document.getElementById('assistant-close-btn')?.addEventListener('click', closeAssistantModal);

document.getElementById('assistant-modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'assistant-modal-overlay') closeAssistantModal();
});

document.querySelectorAll('.assistant-chip').forEach(btn => {
  btn.addEventListener('click', () => askAssistant(btn.dataset.question));
});

document.getElementById('assistant-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('assistant-input');
  const message = input?.value || '';
  if (input) input.value = '';
  askAssistant(message);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function loadCustomerMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json();
  customerMenu = data.items || [];
  customerCategories = Object.keys(data.categories || {});
  if (!customerCategories.includes(customerActiveCategory)) {
    customerActiveCategory = customerCategories[0] || '';
  }
  renderTabs();
  renderMenu();
  renderOrder();
}

async function loadCustomerWeather() {
  const banner = document.getElementById('customer-weather-banner');
  if (!banner) return;
  banner.innerHTML = `<p class="muted">${t('loadingWeather')}</p>`;

  const LAT = 30.6280;
  const LON = -96.3344;

  function weatherLabel(code) {
    const m = {
      0: t('weatherClearSky'),
      1: t('weatherMainlyClear'),
      2: t('weatherPartlyCloudy'),
      3: t('weatherOvercast'),
      45: t('weatherFoggy'),
      51: t('weatherLightDrizzle'),
      53: t('weatherDrizzle'),
      61: t('weatherLightRain'),
      63: t('weatherModerateRain'),
      65: t('weatherHeavyRain'),
      80: t('weatherRainShowers'),
      81: t('weatherModerateShowers'),
      82: t('weatherHeavyShowers'),
      95: t('weatherThunderstorm'),
      96: t('weatherThunderstormHail'),
      99: t('weatherThunderstormHail')
    };
    return m[Number(code)] || t('weatherMixedConditions');
  }

  function drinkSuggestion(temp, code) {
    if ([61, 63, 65, 80, 81, 82, 95].includes(Number(code))) {
      return t('rainyDaySuggestion');
    }
    if (temp >= 95) {
      return t('hotDaySuggestion');
    }
    if (temp >= 85) {
      return t('hotDaySuggestion');
    }
    if (temp >= 75) {
      return t('niceWeatherSuggestion');
    }
    if (temp >= 65) {
      return t('niceWeatherSuggestion');
    }
    if (temp >= 50) {
      return t('coolWeatherSuggestion');
    }
    return t('coolWeatherSuggestion');
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current || {};

    const temp = cur.temperature_2m != null ? Math.round(cur.temperature_2m) : null;
    const feels = cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : null;
    const wind = cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null;
    const code = cur.weather_code ?? null;
    const label = weatherLabel(code);
    const tip = drinkSuggestion(temp, code);

    if (temp === null) throw new Error('No temperature data');

    banner.innerHTML = `
      <div class="weather-banner-content">
        <div>
          <span class="weather-temp">${temp}°F</span>
          <span class="muted" style="margin-left:10px;">${label}</span>
          ${feels !== null ? `<span class="muted" style="margin-left:8px;font-size:0.83rem;">${t('feelsLike')} ${feels}°F</span>` : ''}
          ${wind !== null ? `<span class="muted" style="margin-left:8px;font-size:0.83rem;">${wind} ${t('windMph')}</span>` : ''}
        </div>
        <p class="weather-suggestion" style="margin:0;">${tip}</p>
      </div>`;
  } catch (_) {
    banner.innerHTML = `<p class="muted" style="margin:0;">${t('weatherUnavailable')}</p>`;
  }
}

async function init() {
  restoreKioskState();
  applyStaticTranslations();
  await loadUser();
  await loadCustomerMenu();
  await loadCustomerWeather();
  setPaymentMethod(selectedPaymentMethod || 'card');

  if (guestCheckoutRequested && currentUser && customerOrder.length) {
    renderTotals();
    setActiveScreen('payment');
    guestCheckoutRequested = false;
  } else if (customerOrder.length && ['review', 'payment', 'confirm'].includes(currentScreen)) {
    renderOrder();
    if (currentScreen === 'payment') renderTotals();
    setActiveScreen(currentScreen);
  } else {
    setActiveScreen('menu');
  }

  updateKioskAuthButton();
  saveKioskState();
  checkDeepLink();
}

init();
// ─── Live Activity Ticker ──────────────────────────────────────────────────────
const TICKER_MESSAGES = {
  en: [
    'Someone just ordered a Brown Sugar Milk Tea!',
    '⭐ A customer earned 60 reward points!',
    '🏆 Mango Green Tea is trending right now!',
    '🎉 A free topping coupon was just redeemed!',
    'Someone went with no ice, bold choice!',
    '🌟 Matcha Milk Tea has been popular today!',
    '🎡 A customer just spun the reward wheel!',
    'Taro Milk Tea, a fan favorite!',
    '🫧 Extra boba on a Strawberry Green Tea!',
    'Coffee Milk Tea for the afternoon crowd!',
    '🏅 50+ orders completed today!',
    '🍑 Peach Green Tea flying out the door!',
    'Seasonal specials are going fast!',
    '🎁 Someone redeemed a free drink reward!',
  ],
  es: [
    '¡Alguien acaba de pedir un Té con Leche de Azúcar Morena!',
    '⭐ ¡Un cliente ganó 60 puntos de recompensa!',
    '🏆 ¡El Té Verde de Mango está de tendencia ahora!',
    '🎉 ¡Se acaba de canjear un cupón de topping gratis!',
    '¡Alguien eligió sin hielo, ¡decisión valiente!',
    '🌟 ¡El Té con Leche de Matcha ha sido popular hoy!',
    '🎡 ¡Un cliente giró la ruleta de recompensas!',
    'Té con Leche de Taro, ¡un favorito de los fans!',
    '🫧 ¡Boba extra en un Té Verde de Fresa!',
    '¡Té con Leche de Café para la multitud de la tarde!',
    '🏅 ¡50+ pedidos completados hoy!',
    '🍑 ¡El Té Verde de Durazno volando por la puerta!',
    '¡Las especialidades de temporada se agotan rápido!',
    '🎁 ¡Alguien canjeó una recompensa de bebida gratis!',
  ],
  zh: [
    '刚刚有人点了黑糖奶茶！',
    '⭐ 一位顾客获得了60个奖励积分！',
    '🏆 芒果绿茶现在正在流行！',
    '🎉 刚刚有人兑换了免费配料券！',
    '有人选择了无冰，真大胆！',
    '🌟 抹茶奶茶今天很受欢迎！',
    '🎡 有顾客刚刚转动了奖励转盘！',
    '芋头奶茶，粉丝最爱！',
    '🫧 草莓绿茶加了额外的珍珠！',
    '下午时段的咖啡奶茶！',
    '🏅 今天已完成50多份订单！',
    '🍑 蜜桃绿茶卖得超快！',
    '季节特饮正在热卖！',
    '🎁 有人兑换了免费饮品奖励！',
  ],
  ar: [
    'طلب شخص ما للتو شاي حليب بالسكر البني!',
    '⭐ كسب أحد العملاء 60 نقطة مكافأة!',
    '🏆 شاي المانجو الأخضر رائج الآن!',
    '🎉 تم استبدال كوبون إضافات مجانية للتو!',
    'اختار شخص ما بدون ثلج، اختيار جريء!',
    '🌟 شاي حليب الماتشا كان شعبياً اليوم!',
    '🎡 دار عميل على عجلة المكافآت للتو!',
    'شاي حليب التارو، المفضل لدى المعجبين!',
    '🫧 بوبا إضافية على شاي الفراولة الأخضر!',
    'شاي حليب القهوة لجمهور ما بعد الظهر!',
    '🏅 أكثر من 50 طلباً منجزاً اليوم!',
    '🍑 شاي الخوخ الأخضر يطير من الباب!',
    'مشروبات الموسم تنتهي بسرعة!',
    '🎁 استبدل شخص ما مكافأة مشروب مجاني!',
  ],
  vi: [
    'Ai đó vừa đặt Trà Sữa Đường Đen!',
    '⭐ Một khách hàng vừa kiếm được 60 điểm thưởng!',
    '🏆 Trà Xanh Xoài đang thịnh hành ngay lúc này!',
    '🎉 Một phiếu giảm giá topping miễn phí vừa được đổi!',
    'Ai đó chọn không đá, lựa chọn dũng cảm!',
    '🌟 Trà Sữa Matcha rất phổ biến hôm nay!',
    '🎡 Một khách hàng vừa quay vòng quay thưởng!',
    'Trà Sữa Khoai Môn, món yêu thích của mọi người!',
    '🫧 Thêm trân châu vào Trà Xanh Dâu Tây!',
    'Trà Sữa Cà Phê cho buổi chiều!',
    '🏅 Hơn 50 đơn hàng đã hoàn thành hôm nay!',
    '🍑 Trà Xanh Đào đang bán chạy!',
    'Đặc sản theo mùa đang cháy hàng!',
    '🎁 Ai đó vừa đổi phần thưởng đồ uống miễn phí!',
  ]
};

let tickerIdx = 0;

function startLiveTicker() {
  const ticker = document.getElementById('live-ticker');
  const text   = document.getElementById('live-ticker-text');
  if (!ticker || !text) return;
  ticker.style.display = 'flex';

  function showNext() {
    text.style.opacity = '0';
    text.style.transition = 'opacity 0.4s';
    setTimeout(() => {
      const msgs = TICKER_MESSAGES[currentLanguage] || TICKER_MESSAGES.en;
      text.textContent = msgs[tickerIdx % msgs.length];
      tickerIdx++;
      text.style.opacity = '1';
    }, 400);
  }
  showNext();
  setInterval(showNext, 5000);
}

setTimeout(startLiveTicker, 2000);
