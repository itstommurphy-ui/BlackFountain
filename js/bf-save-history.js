// ══════════════════════════════════════════════════════════════════════════════
// BLACK FOUNTAIN — SYNC
// bf-save-history.js  (clean rewrite)
//
// Rules:
//   1. Load from Supabase on start. That's it.
//   2. Save to Supabase when data changes (debounced 2s).
//   3. Never save on unload, never save before load completes.
//   4. IDB is gone. localStorage is gone. One source of truth.
//   5. Manual snapshots via save_history table — user-triggered only.
// ══════════════════════════════════════════════════════════════════════════════

let _bfStoreLoaded  = false;  // true only after Supabase data successfully applied
let _bfSaveBlocked  = false;  // true during history restore
let _bfSaveTimer    = null;   // debounce handle

// ── SAVE ──────────────────────────────────────────────────────────────────────

async function saveStore(opts = {}) {
  if (_bfSaveBlocked || !_bfStoreLoaded) return;
  if ((store.projects || []).length === 0) {
    console.warn('[saveStore] Blocked — store has 0 projects');
    return;
  }
  console.log('[saveStore] Called from:', new Error().stack.split('\n').slice(2,6).join('\n'));

  const { silent = false } = opts;
  if (!silent && window.SaveFeedback) SaveFeedback.showSaving();

  try { await sbPushStore(); } catch(e) {
    console.warn('[saveStore] Push failed:', e);
  }

  if (!silent && window.SaveFeedback) SaveFeedback.showSaved();
  if (typeof EventBus !== 'undefined') {
    EventBus.emit(EventBus.Events.DATA_SAVED, { timestamp: Date.now() });
  }
}

// Debounced save — use this for rapid changes (typing etc)
function debouncedSaveStore() {
  if (_bfSaveTimer) clearTimeout(_bfSaveTimer);
  _bfSaveTimer = setTimeout(() => saveStore({ silent: true }), 2000);
}

// ── LOAD ──────────────────────────────────────────────────────────────────────

async function loadStore() {
  _bfShowStartupLoader();

  let cloudData = null;
  let attempts  = 0;

  while (attempts < 3 && !cloudData) {
    attempts++;
    _bfUpdateStartupLoader(attempts > 1 ? `Retrying… (${attempts}/3)` : 'Connecting…');
    try {
      cloudData = await Promise.race([
        sbPullStore(),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000))
      ]);
    } catch(e) {
      console.warn(`[loadStore] Attempt ${attempts} failed:`, e.message);
      if (attempts < 3) await new Promise(r => setTimeout(r, 1500));
    }
  }

  _bfHideStartupLoader();

  if (cloudData) {
    Object.assign(store, cloudData);
    _bfStoreLoaded = true;
    _bfApplyStoreMigrations();
    console.log('[loadStore] Loaded from Supabase, projects:', store.projects?.length);
    return;
  }

  // All attempts failed — show retry dialog
  const retry = await new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
    el.innerHTML = `
      <div style="font-family:var(--font-display);font-size:22px;letter-spacing:3px;color:var(--accent)">BLACK FOUNTAIN</div>
      <div style="font-size:14px;color:var(--text2);text-align:center;max-width:320px;line-height:1.6">
        Could not reach the server.<br>
        <span style="font-size:12px;color:var(--text3)">Check your connection and try again.</span>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="window._bfRetry(true)">Try again</button>
        <button class="btn" onclick="window._bfRetry(false)">Work offline</button>
      </div>`;
    window._bfRetry = val => { el.remove(); delete window._bfRetry; resolve(val); };
    document.body.appendChild(el);
  });

  if (retry) return loadStore();

  // Offline — start with empty store, nothing will be saved until reconnect
  _bfStoreLoaded = false;
  _bfApplyStoreMigrations();
  showToast('Working offline — changes will not be saved', 'warning');
}

// ── AUTOSAVE (interval-based, replaces initAutoSave) ─────────────────────────

function initAutoSave() {
  // Save every 3 minutes — simple, no beforeunload, no visibilitychange
  setInterval(() => {
    if (!_bfStoreLoaded || _bfSaveBlocked) return;
    saveStore({ silent: true });
    console.log('[autosave] saved');
  }, 3 * 60 * 1000);
}

// ── STARTUP LOADER ────────────────────────────────────────────────────────────

function _bfShowStartupLoader() {
  document.getElementById('_bf-startup-loader')?.remove();
  const el = document.createElement('div');
  el.id = '_bf-startup-loader';
  el.style.cssText = 'position:fixed;inset:0;background:var(--surface,#111);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px';
  el.innerHTML = `
    <div style="font-family:var(--font-display,monospace);font-size:24px;letter-spacing:4px;color:var(--accent,#e6bc3c)">BLACK FOUNTAIN</div>
    <div style="width:220px">
      <div id="_bf-startup-label" style="font-size:11px;color:var(--text3,#666);text-align:center;margin-bottom:8px;font-family:var(--font-mono,monospace)">Connecting…</div>
      <div style="height:2px;background:var(--surface2,#222);border-radius:1px;overflow:hidden">
        <div style="height:100%;background:var(--accent,#e6bc3c);border-radius:1px;animation:_bf-pulse 1.2s ease-in-out infinite"></div>
      </div>
    </div>
    <style>@keyframes _bf-pulse{0%{width:0%;margin-left:0%}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}</style>`;
  document.body.appendChild(el);
}

function _bfUpdateStartupLoader(text) {
  const el = document.getElementById('_bf-startup-label');
  if (el) el.textContent = text;
}

function _bfHideStartupLoader() {
  document.getElementById('_bf-startup-loader')?.remove();
}

// ── MIGRATIONS ────────────────────────────────────────────────────────────────

function _bfApplyStoreMigrations() {
  if (!store.projects) store.projects = [];
  if (!store.files) store.files = [];
  if (!store.contacts) store.contacts = [];
  if (!store.locations) store.locations = [];
  if (!store.contactColumns) store.contactColumns = [];
  if (!store.contactCustomData) store.contactCustomData = {};
  if (!store.contactHiddenCols) store.contactHiddenCols = [];
  if (!store.locationHiddenCols) store.locationHiddenCols = [];
  if (!store.locationColumns) store.locationColumns = [];
  if (!store.locationCustomData) store.locationCustomData = {};
  if (!store.moodboards) store.moodboards = [];

  store.projects.forEach(p => {
    if (!p.id) p.id = makeId();
    if (!p.gearList) p.gearList = [];
    if (!p.gearPool) p.gearPool = [];
    if (!p.equipment) p.equipment = {};
    if (!p.callsheets) p.callsheets = [];
    if (!p.cast) p.cast = [];
    if (!p.extras) p.extras = [];
    if (!p.unit) p.unit = [];
    if (!p.schedule) p.schedule = [];
    if (!p.scripts) p.scripts = [];
    if (!p.locations) p.locations = [];
    if (!p.scoutingSheets) p.scoutingSheets = [];
    if (!p.breakdown) p.breakdown = [];
  });

  if (typeof store.currentProjectId === 'number') {
    store.currentProjectId = store.projects[store.currentProjectId]?.id ?? null;
  }
  if (store.currentProjectId) {
    if (!store.projects?.some(p => p.id === store.currentProjectId)) {
      store.currentProjectId = null;
    }
  }
}

// ── MANUAL SAVE HISTORY ───────────────────────────────────────────────────────
// User-triggered snapshots only. No autosave to history.

async function _bfGetToken() {
  if (_cachedToken) return _cachedToken;
  const { data: { session } } = await _sb.auth.getSession();
  _cachedToken = session?.access_token || null;
  return _cachedToken;
}

async function bfManualSave() {
  const label = await _bfPromptLabel();
  if (label === null) return;
  showToast('Saving…', 'info');

  const token = await _bfGetToken();
  if (!token || !_sbUser) { showToast('Not signed in', 'error'); return; }

  const stripped = { ...store, files: (store.files||[]).map(({data:_d,...f})=>f) };

  // Keep max 5 manual saves — delete oldest if over limit
  const existing = await _bfFetchHistory();
  if (existing.length >= 5) {
    const oldest = existing[existing.length - 1];
    await fetch(`${_SB_URL}/rest/v1/save_history?id=eq.${oldest.id}&user_id=eq.${_sbUser.id}`, {
      method: 'DELETE',
      headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` }
    });
  }

  await fetch(`${_SB_URL}/rest/v1/save_history`, {
    method: 'POST',
    headers: {
      'apikey': _SB_KEY, 'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      user_id: _sbUser.id, type: 'manual', label: label || 'Manual save',
      data: stripped, project_count: (store.projects||[]).length
    })
  });

  showToast('Saved ✓', 'success');
  renderSaveHistoryUI();
}

function _bfPromptLabel() {
  return new Promise(resolve => {
    document.getElementById('_bf-label-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_bf-label-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:22px 20px 18px;width:340px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Save a snapshot</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Give it a name so you can find it later (optional)</div>
        <input id="_bf-label-input" class="form-input" placeholder="e.g. Before reshoot day…" style="width:100%;margin-bottom:16px" maxlength="60">
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-sm" onclick="document.getElementById('_bf-label-overlay').remove();window._bfLabelResolve(null)">Cancel</button>
          <button class="btn btn-sm btn-primary" onclick="window._bfLabelResolve(document.getElementById('_bf-label-input').value.trim())">Save</button>
        </div>
      </div>`;
    window._bfLabelResolve = val => { overlay.remove(); delete window._bfLabelResolve; resolve(val === null ? null : val); };
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) window._bfLabelResolve(null); });
    setTimeout(() => {
      const inp = document.getElementById('_bf-label-input');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') window._bfLabelResolve(inp.value.trim());
          if (e.key === 'Escape') window._bfLabelResolve(null);
        });
      }
    }, 40);
  });
}

async function _bfFetchHistory() {
  if (!_sb || !_sbUser) return [];
  const token = await _bfGetToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&select=id,type,label,project_count,saved_at&order=saved_at.desc`,
      { headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch(e) { return []; }
}

async function _bfFetchHistoryRow(id) {
  if (!_sb || !_sbUser) return null;
  const token = await _bfGetToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `${_SB_URL}/rest/v1/save_history?id=eq.${id}&user_id=eq.${_sbUser.id}&select=data`,
      { headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.data ?? null;
  } catch(e) { return null; }
}

async function bfLoadFromHistory(id, label) {
  const confirmed = await new Promise(resolve => {
    showConfirmDialog(
      `Restore "${label || 'this save'}"?\n\nYour current state will be replaced.`,
      'Restore', () => resolve(true), { onCancel: () => resolve(false) }
    );
  });
  if (!confirmed) return;

  _bfShowLoadingOverlay();

  try {
    _bfUpdateLoadingProgress(20, 'Fetching save data…');
    const data = await _bfFetchHistoryRow(id);
    if (!data) { _bfHideLoadingOverlay(); showToast('Could not fetch save — try again', 'error'); return; }

    _bfUpdateLoadingProgress(60, 'Pushing to cloud…');
    _bfSaveBlocked = true;

    const token = await _bfGetToken();
    if (token) {
      await fetch(`${_SB_URL}/rest/v1/stores?on_conflict=user_id`, {
        method: 'POST',
        headers: {
          'apikey': _SB_KEY, 'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          user_id: _sbUser.id,
          data: { ...data, _lastSave: Date.now() },
          updated_at: new Date().toISOString()
        })
      });
    }

    _bfUpdateLoadingProgress(95, 'Reloading…');
    setTimeout(() => window.location.reload(), 400);

  } catch(e) {
    _bfHideLoadingOverlay();
    _bfSaveBlocked = false;
    showToast('Restore failed — ' + e.message, 'error');
  }
}

async function bfDeleteSave(id) {
  const rows = await _bfFetchHistory();
  const row = rows.find(r => r.id === id);
  if (!row) return;
  const confirmed = await new Promise(resolve => {
    showConfirmDialog(
      `Delete this save?\n\nThis cannot be undone.`,
      'Delete', () => resolve(true), { danger: true, onCancel: () => resolve(false) }
    );
  });
  if (!confirmed) return;
  const token = await _bfGetToken();
  await fetch(`${_SB_URL}/rest/v1/save_history?id=eq.${id}&user_id=eq.${_sbUser.id}`, {
    method: 'DELETE',
    headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` }
  });
  showToast('Deleted', 'success');
  renderSaveHistoryUI();
}

// ── LOADING OVERLAY ───────────────────────────────────────────────────────────

function _bfShowLoadingOverlay() {
  document.getElementById('_bf-loading-overlay')?.remove();
  const el = document.createElement('div');
  el.id = '_bf-loading-overlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px';
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:22px;letter-spacing:3px;color:var(--accent)">BLACK FOUNTAIN</div>
    <div style="width:320px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span id="_bf-load-label" style="font-size:12px;color:var(--text2)">Restoring…</span>
        <span id="_bf-load-pct" style="font-size:12px;font-family:var(--font-mono);color:var(--accent)">0%</span>
      </div>
      <div style="height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
        <div id="_bf-load-bar" style="height:100%;width:0%;background:var(--accent);border-radius:2px;transition:width .3s ease"></div>
      </div>
    </div>`;
  document.body.appendChild(el);
}

function _bfUpdateLoadingProgress(pct, label) {
  const bar = document.getElementById('_bf-load-bar');
  const pctEl = document.getElementById('_bf-load-pct');
  const lblEl = document.getElementById('_bf-load-label');
  if (bar) bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (lblEl) lblEl.textContent = label || '';
}

function _bfHideLoadingOverlay() {
  document.getElementById('_bf-loading-overlay')?.remove();
}

// ── SAVE HISTORY UI ───────────────────────────────────────────────────────────

async function renderSaveHistoryUI() {
  const el = document.getElementById('bf-save-history-ui');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">Save History</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Up to 5 manual saves</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="bfManualSave()">💾 Save now</button>
    </div>
    <div id="_bf-history-list" style="font-size:12px;color:var(--text3);padding:8px 0">Loading…</div>`;

  const rows = await _bfFetchHistory();
  const listEl = document.getElementById('_bf-history-list');
  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `<div style="color:var(--text3);font-style:italic">No saves yet — click "Save now" to create one.</div>`;
    return;
  }

  listEl.innerHTML = rows.map(row => {
    const date = new Date(row.saved_at);
    const dateStr = date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const label = row.label || 'Manual save';
    const loadLabel = `${label} — ${dateStr} ${timeStr}`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_bfEsc(label)}</div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">${dateStr} at ${timeStr} · ${row.project_count ?? '?'} project${row.project_count !== 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm" onclick="bfLoadFromHistory('${row.id}','${_bfEscAttr(loadLabel)}')" style="font-size:11px">⏏ Restore</button>
          <button class="btn btn-sm" style="background:var(--red);color:white;font-size:11px;padding:6px 10px" onclick="bfDeleteSave('${row.id}')">🗑 Delete</button>
        </div>
      </div>`;
  }).join('');
}

function _bfEsc(s)     { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _bfEscAttr(s) { return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── EXPORTS ───────────────────────────────────────────────────────────────────

window.saveStore           = saveStore;
window.loadStore           = loadStore;
window.initAutoSave        = initAutoSave;
window.renderSaveHistoryUI = renderSaveHistoryUI;
window.bfManualSave        = bfManualSave;
window.bfLoadFromHistory   = bfLoadFromHistory;
window.bfDeleteSave        = bfDeleteSave;
// Stubs for anything that still references old API
window.setBfAutoSave       = () => {};
window.bfSaveToSlot        = () => {};