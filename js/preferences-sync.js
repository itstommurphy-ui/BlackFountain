// ══════════════════════════════════════════
// PREFERENCES SYNC
// ══════════════════════════════════════════
// Ensures store.preferences is initialised,
// synced to Supabase, and applied on load.
//
// Adding a new global preference:
//   1. Add it to PREFERENCE_DEFAULTS below
//   2. Call Prefs.set('myKey', value) to save
//   3. Call Prefs.get('myKey') to read
//   4. Add UI in settings if needed
//
// Drop AFTER settings.js in index.html.
// ══════════════════════════════════════════

const Prefs = (function () {

  // ── Defaults ────────────────────────────────────────────────
  // Add new global preferences here. These are used when no
  // stored value exists yet.

  const PREFERENCE_DEFAULTS = {
    theme:           'dark',
    fontSize:        'classic',
    defaultCurrency: '£',
    // future examples:
    // defaultCallTime: 420,   // 07:00 in minutes
    // defaultWrapTime: 1020,  // 17:00 in minutes
    // scheduleShowNonShot: true,
  };

  // ── Ensure store.preferences exists ────────────────────────

  function _ensure() {
    if (!store.preferences) store.preferences = {};
    // Fill in any missing keys with defaults
    Object.entries(PREFERENCE_DEFAULTS).forEach(([k, v]) => {
      if (store.preferences[k] === undefined) store.preferences[k] = v;
    });
  }

  // ── Get ─────────────────────────────────────────────────────

  function get(key) {
    _ensure();
    return store.preferences[key] ?? PREFERENCE_DEFAULTS[key];
  }

  // ── Set ─────────────────────────────────────────────────────
  // Saves to store (which syncs to Supabase via saveStore)
  // and mirrors to localStorage as fallback.

   function set(key, value) {
     _ensure();
     if (store.preferences[key] === value) return; // no change, no save
     store.preferences[key] = value;
     try { localStorage.setItem(`blackfountain_pref_${key}`, String(value)); } catch(e) {}
     saveStore();
   }

  // ── Apply all preferences to the UI ────────────────────────
  // Call this after loadStore() completes.

  function applyAll() {
    _ensure();

    // Theme
    const theme = get('theme');
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('blackfountain_theme', theme);

    // Font size
    const fontSize = get('fontSize');
    document.documentElement.removeAttribute('data-font-size');
    if (fontSize !== 'classic') document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('blackfountain_font_size', fontSize);

    console.log('[Prefs] Applied:', JSON.stringify(store.preferences));
  }

  // ── Public ──────────────────────────────────────────────────

  return { get, set, applyAll, defaults: PREFERENCE_DEFAULTS };

})();

// ── Patch setTheme to go through Prefs ────────────────────────

const _origSetTheme = window.setTheme;
window.setTheme = function (theme) {
  Prefs.set('theme', theme);
  // Still call the original for immediate UI update
  if (_origSetTheme) _origSetTheme(theme);
};

// ── Patch setFontSize to go through Prefs ─────────────────────

const _origSetFontSize = window.setFontSize;
window.setFontSize = function (size) {
  Prefs.set('fontSize', size);
  if (_origSetFontSize) _origSetFontSize(size);
};

// ── Default currency setting ───────────────────────────────────
// Exposed globally so the settings UI can call it.

window.setDefaultCurrency = function (symbol) {
  Prefs.set('defaultCurrency', symbol);
  showToast(`Default currency set to ${symbol}`, 'success');
};

// ── Patch loadStore to initialise preferences after load ───────
// We wrap the existing init.js post-load hook rather than
// patching loadStore itself (which is complex).
// Call Prefs.applyAll() from init.js after loadStore() resolves,
// OR use the hook below if init.js isn't easy to modify.

const _origLoadTheme = window.loadTheme;
window.loadTheme = function () {
  // Called early (before store loads) — use localStorage fallback
  if (_origLoadTheme) _origLoadTheme();
};

// Hook: once the DOM is ready and store has likely loaded,
// re-apply from store.preferences (overrides the localStorage values
// that loadTheme set).
// This uses a short delay to run after init.js's loadStore() resolves.
// For a cleaner integration, call Prefs.applyAll() directly in init.js
// after await loadStore().

document.addEventListener('DOMContentLoaded', () => {
  // Wait for loadStore to complete — it's async so we poll briefly
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (typeof store !== 'undefined' && (store.preferences !== undefined || attempts > 20)) {
        clearInterval(poll);
        Prefs.applyAll();
        if (typeof updateThemeButtons === 'function') updateThemeButtons();
        if (typeof updateFontSizeButtons === 'function') updateFontSizeButtons();
        _injectDefaultCurrencyUI();
      }
    }, 200);
});

// ── Inject default currency selector into Settings ─────────────

function _injectDefaultCurrencyUI() {
  return; // now handled in settings.html
}

// ── Expose globally ────────────────────────────────────────────
window.Prefs = Prefs;

// ── Patch defaultProject to use default currency ───────────────

const _origDefaultProject = window.defaultProject;
window.defaultProject = function (data) {
  const project = _origDefaultProject(data);
  if (!project.budgetCurrency) {
    project.budgetCurrency = Prefs.get('defaultCurrency');
  }
  return project;
};