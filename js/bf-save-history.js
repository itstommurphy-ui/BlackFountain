// ══════════════════════════════════════════════════════════════════════════════
// BLACK FOUNTAIN — SAVE HISTORY SYSTEM
// bf-save-history.js
//
// WIRING:
//   1. Add <script src="js/bf-save-history.js"></script> after supabase-sync.js
//   2. Replace saveStore() and loadStore() in settings.js with the versions below
//   3. Replace initAutoSave() in settings.js with the version below
//   4. Add <div id="bf-save-history-ui"></div> to settings.html where you want the UI
//   5. Call renderSaveHistoryUI() when settings view opens
//   6. Run the SQL migration (see bottom of file) in Supabase
//
// REMOVES: bf-save-slots.js — delete it and its <script> tag entirely
// ══════════════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────────────

const BF_MAX_MANUAL_SAVES = 5;
const BF_AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
let   _bfAutoSaveEnabled   = true;
let   _bfAutoSaveTimer     = null;
let   _bfSaveBlocked       = false; // set true during history load to prevent overwrite

// ══════════════════════════════════════════════════════════════════════════════
// CORE SAVE / LOAD
// Replaces saveStore() and loadStore() in settings.js entirely.
// ══════════════════════════════════════════════════════════════════════════════

async function saveStore(opts = {}) {
  // Block saves during history restore to prevent overwriting loaded state
  if (_bfSaveBlocked) return;

  const { silent = false, historyType = null, historyLabel = '' } = opts;

  // Visual feedback
  if (!silent && window.SaveFeedback) SaveFeedback.showSaving();

  // Record section activity
  const p = currentProject();
  if (p && _activeSection && _activeSection !== 'overview') {
    if (!p.sectionActivity) p.sectionActivity = {};
    p.sectionActivity[_activeSection] = Date.now();
  }

  // 1. IDB — fast local cache so the app works offline
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(store, 'v1');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) {
    console.error('[saveStore] IDB failed:', e);
  }

  // 2. Supabase — source of truth
  if (typeof sbPushStore === 'function' && _sbUser) {
    try {
      await sbPushStore();
    } catch(e) {
      console.warn('[saveStore] Supabase push failed:', e);
    }
  }

  // 3. If this is a history save, write a row to save_history
  if (historyType && _sbUser) {
    try {
      await _bfWriteHistory(historyType, historyLabel);
    } catch(e) {
      console.warn('[saveStore] History write failed:', e);
    }
  }

  if (!silent && window.SaveFeedback) SaveFeedback.showSaved();

  if (typeof EventBus !== 'undefined') {
    EventBus.emit(EventBus.Events.DATA_SAVED, { timestamp: Date.now() });
  }
}

async function loadStore() {
  // Try Supabase first (source of truth)
  if (typeof sbPullStore === 'function' && _sbUser) {
    try {
      const cloudData = await Promise.race([
        sbPullStore(),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);
      if (cloudData && cloudData.projects !== undefined) {
        // Preserve local file blobs (never stored in cloud)
        const blobMap = {};
        try {
          const db = await openDB();
          const idbData = await new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readonly');
            const req = tx.objectStore('kv').get('v1');
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
          });
          (idbData?.files || []).forEach(f => { if (f.data) blobMap[f.id] = f.data; });
        } catch(e) {}

        Object.assign(store, cloudData);
        // Restore blobs
        (store.files || []).forEach(f => { if (!f.data && blobMap[f.id]) f.data = blobMap[f.id]; });
        _bfApplyStoreMigrations();
        return;
      }
    } catch(e) {
      console.warn('[loadStore] Supabase pull failed, falling back to IDB:', e);
    }
  }

  // Fallback: IDB
  try {
    const db = await openDB();
    const idbData = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('v1');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (idbData) {
      Object.assign(store, idbData);
      _bfApplyStoreMigrations();
      // Push IDB state up to Supabase
      if (typeof sbPushStore === 'function' && _sbUser) {
        setTimeout(() => sbPushStore(), 1000);
      }
      return;
    }
  } catch(e) {
    console.warn('[loadStore] IDB fallback failed:', e);
  }

  // Last resort: localStorage backup
  try {
    const projectsJson = localStorage.getItem('bf_projects_backup');
    if (projectsJson) {
      store.projects  = JSON.parse(projectsJson);
      store.contacts  = JSON.parse(localStorage.getItem('bf_contacts_backup')  || '[]');
      store.locations = JSON.parse(localStorage.getItem('bf_locations_backup') || '[]');
      store.folders   = JSON.parse(localStorage.getItem('bf_folders_backup')   || '[]');
      store.teamMembers = JSON.parse(localStorage.getItem('bf_team_backup')    || '[]');
      store.currentProjectId = localStorage.getItem('bf_currentProjectId_backup') || null;
      _bfApplyStoreMigrations();
    }
  } catch(e) {
    console.warn('[loadStore] localStorage fallback failed:', e);
  }
}

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

// ── Autosave ──────────────────────────────────────────────────────────────────

function initAutoSave() {
  // Load user preference
  _bfAutoSaveEnabled = localStorage.getItem('bf_autosave_enabled') !== 'false';

  _bfAutoSaveTimer = setInterval(async () => {
    if (!_bfAutoSaveEnabled || _bfSaveBlocked) return;
    await saveStore({ silent: true, historyType: 'auto', historyLabel: 'Autosave' });
    console.log('[autosave] saved');
  }, BF_AUTOSAVE_INTERVAL);

  // Save on tab hide / close — but NOT during a history load
  window.addEventListener('beforeunload', () => {
    if (!_bfSaveBlocked) saveStore({ silent: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !_bfSaveBlocked) saveStore({ silent: true });
  });
}

function setBfAutoSave(enabled) {
  _bfAutoSaveEnabled = enabled;
  localStorage.setItem('bf_autosave_enabled', enabled ? 'true' : 'false');
  showToast(`Autosave ${enabled ? 'enabled' : 'disabled'}`, 'info');
  renderSaveHistoryUI();
}

// ── History writes ────────────────────────────────────────────────────────────

async function _bfGetToken() {
  if (_cachedToken) return _cachedToken;
  const { data: { session } } = await _sb.auth.getSession();
  _cachedToken = session?.access_token || null;
  return _cachedToken;
}

async function _bfWriteHistory(type, label) {
  if (!_sb || !_sbUser) return;
  const token = await _bfGetToken();
  if (!token) return;

  const stripped = {
    ...store,
    files: (store.files || []).map(({ data: _d, ...f }) => f),
  };

  // For auto saves: delete existing auto rows first (keep only latest)
  // For manual saves: keep up to BF_MAX_MANUAL_SAVES, delete oldest if over limit
  if (type === 'auto') {
    await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&type=eq.auto`,
      { method: 'DELETE', headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
  } else {
    // Count existing manual saves
    const countRes = await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&type=eq.manual&select=id,saved_at&order=saved_at.asc`,
      { headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
    if (countRes.ok) {
      const rows = await countRes.json();
      if (rows.length >= BF_MAX_MANUAL_SAVES) {
        // Delete oldest to make room
        const oldest = rows[0].id;
        await fetch(
          `${_SB_URL}/rest/v1/save_history?id=eq.${oldest}`,
          { method: 'DELETE', headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
        );
      }
    }
  }

  // Write new row
  await fetch(`${_SB_URL}/rest/v1/save_history`, {
    method: 'POST',
    headers: {
      'apikey': _SB_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      user_id:       _sbUser.id,
      type,
      label:         label || null,
      data:          stripped,
      project_count: (store.projects || []).length,
    }),
  });
}

// ── History reads ─────────────────────────────────────────────────────────────

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
  } catch(e) {
    return [];
  }
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
  } catch(e) {
    return null;
  }
}

// ── Load from history ─────────────────────────────────────────────────────────

async function bfLoadFromHistory(id, label) {
  const dateStr = label || 'this save';
  const confirmed = await new Promise(resolve => {
    showConfirmDialog(
      `Restore "${dateStr}"?\n\nYour current state will be replaced. This cannot be undone.`,
      'Restore',
      () => resolve(true),
      { onCancel: () => resolve(false) }
    );
  });
  if (!confirmed) return;

  // Show loading overlay
  _bfShowLoadingOverlay();

  try {
    _bfUpdateLoadingProgress(10, 'Fetching save data…');
    const data = await _bfFetchHistoryRow(id);
    if (!data) {
      _bfHideLoadingOverlay();
      showToast('Could not fetch save data — try again', 'error');
      return;
    }

    _bfUpdateLoadingProgress(40, 'Writing to local cache…');

    // Block saves so nothing overwrites IDB or Supabase during restore
    _bfSaveBlocked = true;
    window.saveStore   = async () => {};
    window.sbPushStore = async () => {};

    // Write to IDB
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(data, 'v1');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    _bfUpdateLoadingProgress(70, 'Pushing to cloud…');

    // Push the restored data directly to Supabase stores table
    // so on reload Supabase returns the right data
    const token = await _bfGetToken();
    if (token) {
      await fetch(`${_SB_URL}/rest/v1/stores?on_conflict=user_id`, {
        method: 'POST',
        headers: {
          'apikey': _SB_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          user_id:    _sbUser.id,
          data:       { ...data, _lastSave: Date.now() },
          updated_at: new Date().toISOString(),
        }),
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

// ── Manual save ───────────────────────────────────────────────────────────────

async function bfManualSave() {
  const label = await _bfPromptLabel();
  if (label === null) return; // cancelled
  showToast('Saving…', 'info');
  await saveStore({ historyType: 'manual', historyLabel: label || 'Manual save' });
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
    window._bfLabelResolve = val => {
      overlay.remove();
      delete window._bfLabelResolve;
      resolve(val === null ? null : val);
    };
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

// ── Delete save ──────────────────────────────────────────────────────────────

async function _bfDeleteHistoryRow(id) {
  if (!_sb || !_sbUser) return false;
  const token = await _bfGetToken();
  if (!token) return false;
  try {
    const res = await fetch(
      `${_SB_URL}/rest/v1/save_history?id=eq.${id}&user_id=eq.${_sbUser.id}`,
      { 
        method: 'DELETE', 
        headers: { 
          'apikey': _SB_KEY, 
          'Authorization': `Bearer ${token}` 
        } 
      }
    );
    return res.ok;
  } catch(e) {
    console.error('[bfDeleteSave] Delete failed:', e);
    return false;
  }
}

async function bfDeleteSave(id) {
  const row = (await _bfFetchHistory()).find(r => r.id === id);
  if (!row) return;
  
  const label = row.label || (row.type === 'auto' ? 'Autosave' : 'Manual save');
  const dateStr = new Date(row.saved_at).toLocaleDateString('en-GB', { 
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric' 
  });
  
  const confirmed = await new Promise(resolve => {
    showConfirmDialog(
      `Delete "${label}" from ${dateStr}?\n\nThis cannot be undone.`,
      '🗑 Delete Save',
      () => resolve(true),
      { danger: true, onCancel: () => resolve(false) }
    );
  });
  
  if (!confirmed) return;
  
  showToast('Deleting...', 'info');
  const success = await _bfDeleteHistoryRow(id);
  if (success) {
    showToast('Save deleted', 'success');
    renderSaveHistoryUI();
  } else {
    showToast('Delete failed', 'error');
  }
}

// ── Loading overlay ───────────────────────────────────────────────────────────

function _bfShowLoadingOverlay() {
  document.getElementById('_bf-loading-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_bf-loading-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px';
  overlay.innerHTML = `
    <div style="font-family:var(--font-display);font-size:22px;letter-spacing:3px;color:var(--accent)">BLACK FOUNTAIN</div>
    <div style="width:320px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span id="_bf-load-label" style="font-size:12px;color:var(--text2)">Restoring…</span>
        <span id="_bf-load-pct" style="font-size:12px;font-family:var(--font-mono);color:var(--accent)">0%</span>
      </div>
      <div style="height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
        <div id="_bf-load-bar" style="height:100%;width:0%;background:var(--accent);border-radius:2px;transition:width .3s ease"></div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3)">Please wait — do not close this tab</div>`;
  document.body.appendChild(overlay);
}

function _bfUpdateLoadingProgress(pct, label) {
  const bar   = document.getElementById('_bf-load-bar');
  const pctEl = document.getElementById('_bf-load-pct');
  const lblEl = document.getElementById('_bf-load-label');
  if (bar)   bar.style.width  = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (lblEl) lblEl.textContent = label || '';
}

function _bfHideLoadingOverlay() {
  document.getElementById('_bf-loading-overlay')?.remove();
}

// ── UI ────────────────────────────────────────────────────────────────────────

async function renderSaveHistoryUI() {
  const el = document.getElementById('bf-save-history-ui');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">Save History</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          Autosave every 5 minutes · up to 5 manual saves
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);cursor:pointer">
          <input type="checkbox" ${_bfAutoSaveEnabled ? 'checked' : ''} onchange="setBfAutoSave(this.checked)" style="cursor:pointer;accent-color:var(--accent)">
          Autosave
        </label>
        <button class="btn btn-sm btn-primary" onclick="bfManualSave()">💾 Save now</button>
      </div>
    </div>
    <div id="_bf-history-list" style="font-size:12px;color:var(--text3);padding:12px 0">Loading…</div>`;

  // Load history async
  const rows = await _bfFetchHistory();
  const listEl = document.getElementById('_bf-history-list');
  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `<div style="color:var(--text3);font-style:italic;padding:8px 0">No saves yet — autosave will create one in 5 minutes, or click "Save now".</div>`;
    return;
  }

  listEl.innerHTML = rows.map(row => {
    const date    = new Date(row.saved_at);
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const isAuto  = row.type === 'auto';
    const label   = row.label || (isAuto ? 'Autosave' : 'Manual save');
    const loadLabel = `${label} — ${dateStr} ${timeStr}`;

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;margin-bottom:6px">
        <div style="flex-shrink:0">
          <span style="font-size:9px;font-weight:700;font-family:var(--font-mono);padding:2px 7px;border-radius:3px;
            background:${isAuto ? 'rgba(91,179,240,0.12)' : 'rgba(230,188,60,0.12)'};
            color:${isAuto ? '#5bb3f0' : 'var(--accent)'}">
            ${isAuto ? 'AUTO' : 'MANUAL'}
          </span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${_bfEsc(label)}
          </div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">
            ${dateStr} at ${timeStr} · ${row.project_count ?? '?'} project${row.project_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm" onclick="bfLoadFromHistory('${row.id}', '${_bfEscAttr(loadLabel)}')"
            style="font-size:11px">
            ⏏ Restore
          </button>
          <button class="btn btn-sm" style="background:var(--red);color:white;font-size:11px;padding:6px 10px;"
            onclick="bfDeleteSave('${row.id}')" title="Delete this save">
            🗑 Delete
          </button>
        </div>
      </div>`;
  }).join('');
}

function _bfEsc(s)     { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _bfEscAttr(s) { return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// Expose globals
window.saveStore          = saveStore;
window.loadStore          = loadStore;
window.initAutoSave       = initAutoSave;
window.renderSaveHistoryUI = renderSaveHistoryUI;
window.bfManualSave       = bfManualSave;
window.bfLoadFromHistory  = bfLoadFromHistory;
window.bfDeleteSave       = bfDeleteSave;
window.setBfAutoSave      = setBfAutoSave;

// ══════════════════════════════════════════════════════════════════════════════
// SQL — run in Supabase SQL Editor if not already done
// ══════════════════════════════════════════════════════════════════════════════
/*
create table save_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('auto', 'manual')),
  label text,
  data jsonb,
  project_count integer,
  saved_at timestamptz default now()
);

alter table save_history enable row level security;

create policy "Users manage own history" on save_history
  for all using (auth.uid() = user_id);
*/
