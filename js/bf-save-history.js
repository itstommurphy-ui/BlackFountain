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
let   _bfStoreLoaded     = false; // set true after store successfully loads

// ══════════════════════════════════════════════════════════════════════════════
// CORE SAVE / LOAD
// Replaces saveStore() and loadStore() in settings.js entirely.
// ══════════════════════════════════════════════════════════════════════════════

async function saveStore(opts = {}) {
  // Block saves during history restore or before store loads to prevent overwriting empty
  if (_bfSaveBlocked || !_bfStoreLoaded) return;

  const { silent = false, historyType = null, historyLabel = '', slot = null } = opts;

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
      await _bfWriteHistory(historyType, historyLabel, slot);
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
  // Always try cloud first if sbPullStore is available.
  // Don't gate on _sbUser here — sbPullStore() handles auth internally
  // and returns null if not logged in. Gating here caused a race where
  // _sbUser wasn't set yet when loadStore ran, causing silent fallthrough
  // to empty IDB and wiping Supabase with the sample project.

  if (typeof sbPullStore === 'function') {

    _bfShowStartupLoader();

    let cloudData = null;
    let attempts  = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS && !cloudData) {
      attempts++;
      try {
        _bfUpdateStartupLoader(`Connecting to cloud${attempts > 1 ? ` (attempt ${attempts})` : ''}…`);
        cloudData = await Promise.race([
          sbPullStore(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
        ]);
      } catch(e) {
        console.warn(`[loadStore] Attempt ${attempts} failed:`, e.message);
        if (attempts < MAX_ATTEMPTS) {
          _bfUpdateStartupLoader(`Retrying…`);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    _bfHideStartupLoader();

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
      _bfStoreLoaded = true;
      (store.files || []).forEach(f => { if (!f.data && blobMap[f.id]) f.data = blobMap[f.id]; });
      _bfApplyStoreMigrations();
      console.log('[loadStore] Cloud data applied, projects:', store.projects?.length);
      return;
    }

    // sbPullStore returned null — either not logged in, or network failure
    // If we got null AND we know there's no user, that's expected — skip to IDB
    // If we got null AND there should be a user, that's a network failure
    if (attempts >= MAX_ATTEMPTS && typeof _sbUser !== 'undefined' && _sbUser) {
      const retry = await new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = '_bf-offline-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
        overlay.innerHTML = `
          <div style="font-family:var(--font-display);font-size:22px;letter-spacing:3px;color:var(--accent)">BLACK FOUNTAIN</div>
          <div style="font-size:14px;color:var(--text2);text-align:center;max-width:340px;line-height:1.6">
            Could not connect to the cloud after ${MAX_ATTEMPTS} attempts.<br>
            <span style="font-size:12px;color:var(--text3)">Check your connection and try again.</span>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" onclick="window._bfOfflineResolve(true)">Try again</button>
            <button class="btn" onclick="window._bfOfflineResolve(false)">Continue offline</button>
          </div>`;
        window._bfOfflineResolve = val => { overlay.remove(); delete window._bfOfflineResolve; resolve(val); };
        document.body.appendChild(overlay);
      });

      if (retry) return loadStore();
      // User chose offline — fall through to IDB
    }
  }

  // Offline fallback: IDB
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
      _bfStoreLoaded = true;
      _bfApplyStoreMigrations();
      console.log('[loadStore] IDB fallback applied, projects:', store.projects?.length);
      showToast('Loaded from local cache — changes will sync when you reconnect', 'info');
      window.addEventListener('online', () => {
        if (typeof sbPushStore === 'function') sbPushStore();
      }, { once: true });
      return;
    }
  } catch(e) {
    console.warn('[loadStore] IDB fallback failed:', e);
  }

  // Last resort: localStorage
  try {
    const projectsJson = localStorage.getItem('bf_projects_backup');
    if (projectsJson) {
      store.projects    = JSON.parse(projectsJson);
      store.contacts    = JSON.parse(localStorage.getItem('bf_contacts_backup')  || '[]');
      store.locations   = JSON.parse(localStorage.getItem('bf_locations_backup') || '[]');
      store.folders     = JSON.parse(localStorage.getItem('bf_folders_backup')   || '[]');
      store.teamMembers = JSON.parse(localStorage.getItem('bf_team_backup')      || '[]');
      store.currentProjectId = localStorage.getItem('bf_currentProjectId_backup') || null;
      _bfStoreLoaded = true;
      _bfApplyStoreMigrations();
      console.log('[loadStore] localStorage fallback applied, projects:', store.projects?.length);
      showToast('Loaded from emergency backup — please reconnect to sync', 'info');
    }
  } catch(e) {
    console.warn('[loadStore] localStorage fallback failed:', e);
  }
}

// ── Startup loader (subtle — not the full restore overlay) ────────────────────

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
    <style>
      @keyframes _bf-pulse {
        0%   { width:0%;   margin-left:0% }
        50%  { width:60%;  margin-left:20% }
        100% { width:0%;   margin-left:100% }
      }
    </style>`;
  document.body.appendChild(el);
}

function _bfUpdateStartupLoader(text) {
  const el = document.getElementById('_bf-startup-label');
  if (el) el.textContent = text;
}

function _bfHideStartupLoader() {
  document.getElementById('_bf-startup-loader')?.remove();
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
  _bfAutoSaveEnabled = localStorage.getItem('bf_autosave_enabled') !== 'false';

  _bfAutoSaveTimer = setInterval(async () => {
    if (!_bfAutoSaveEnabled || _bfSaveBlocked || !_bfStoreLoaded) return;
    await saveStore({ silent: true, historyType: 'auto', historyLabel: 'Autosave' });
    console.log('[autosave] saved');
  }, BF_AUTOSAVE_INTERVAL);

   // Only save on unload/hide if the store actually loaded successfully
   // Without this guard, hard-refreshing before the store loads writes
   // an empty store to Supabase and wipes all projects.
   document.addEventListener('visibilitychange', () => {
     if (document.hidden && !_bfSaveBlocked && _bfStoreLoaded) saveStore({ silent: true });
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

async function _bfWriteHistory(type, label, slot) {
  if (!_sb || !_sbUser) return;
  const token = await _bfGetToken();
  if (!token) return;

  const stripped = {
    ...store,
    files: (store.files || []).map(({ data: _d, ...f }) => f),
  };

  if (type === 'auto') {
    await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&type=eq.auto`,
      { method: 'DELETE', headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
  } else if (slot) {
    await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&type=eq.manual&slot=eq.${slot}`,
      { method: 'DELETE', headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
  } else {
    const countRes = await fetch(
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&type=eq.manual&select=id,saved_at&order=saved_at.asc`,
      { headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
    );
    if (countRes.ok) {
      const rows = await countRes.json();
      if (rows.length >= BF_MAX_MANUAL_SAVES) {
        const oldest = rows[0].id;
        await fetch(
          `${_SB_URL}/rest/v1/save_history?id=eq.${oldest}`,
          { method: 'DELETE', headers: { 'apikey': _SB_KEY, 'Authorization': `Bearer ${token}` } }
        );
      }
    }
  }

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
      slot:          slot || null,
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
      `${_SB_URL}/rest/v1/save_history?user_id=eq.${_sbUser.id}&select=id,type,label,slot,project_count,saved_at&order=saved_at.desc`,
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

// ── Manual save slots ─────────────────────────────────────────────────────────

const BF_SAVE_SLOTS = 3;

async function bfManualSave() {
  const rows = await _bfFetchHistory();
  const manualRows = rows.filter(r => r.type === 'manual');
  const slots = [];
  for (let i = 1; i <= BF_SAVE_SLOTS; i++) {
    const slotData = manualRows.find(r => r.slot === i);
    slots.push(slotData || null);
  }

  document.getElementById('_bf-save-slots-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_bf-save-slots-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:22px 20px 18px;width:360px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Save to slot</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Choose a slot to save your current project state</div>
      <div id="_bf-slots-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${slots.map((slot, idx) => {
          const i = idx + 1;
          if (!slot) {
            return `
              <div class="_bf-slot-row" onclick="bfSaveToSlot(${i}, null)" 
                style="padding:14px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;cursor:pointer;transition:all .15s">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="font-size:11px;font-weight:700;font-family:var(--font-mono);width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--border);border-radius:6px;color:var(--text2)">${i}</div>
                  <div>
                    <div style="font-size:13px;color:var(--text3)">Empty slot</div>
                  </div>
                </div>
              </div>`;
          }
          const date = new Date(slot.saved_at);
          const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const label = slot.label || 'Manual save';
          return `
            <div class="_bf-slot-row" onclick="bfSaveToSlot(${i}, '${_bfEscAttr(slot.label || '')}')" 
              style="padding:14px 16px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;cursor:pointer;transition:all .15s">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:11px;font-weight:700;font-family:var(--font-mono);width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--accent);border-radius:6px;color:var(--surface)">${i}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:500;color:var(--text)">${_bfEsc(label)}</div>
                  <div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${dateStr} at ${timeStr}</div>
                </div>
                <div style="font-size:10px;color:var(--accent);opacity:0.7">Overwrite</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-sm" onclick="document.getElementById('_bf-save-slots-overlay').remove()">Cancel</button>
      </div>
    </div>
    <style>
      ._bf-slot-row:hover { border-color:var(--accent) !important; background:var(--surface) !important; }
    </style>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function bfSaveToSlot(slotNum, existingLabel) {
  document.getElementById('_bf-save-slots-overlay')?.remove();
  
  let label = null;
  if (!existingLabel) {
    label = await _bfPromptSlotLabel();
    if (label === null) return;
  }

  showToast('Saving…', 'info');
  await saveStore({ historyType: 'manual', historyLabel: label, slot: slotNum });
  showToast(`Saved to Slot ${slotNum} ✓`, 'success');
}

function _bfPromptSlotLabel() {
  return new Promise(resolve => {
    document.getElementById('_bf-slot-label-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_bf-slot-label-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:22px 20px 18px;width:340px">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Name this save</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Give it a name so you can find it later (optional)</div>
        <input id="_bf-slot-label-input" class="form-input" placeholder="e.g. Before reshoot day…" style="width:100%;margin-bottom:16px" maxlength="60">
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-sm" onclick="document.getElementById('_bf-slot-label-overlay').remove();window._bfSlotLabelResolve(null)">Cancel</button>
          <button class="btn btn-sm btn-primary" onclick="window._bfSlotLabelResolve(document.getElementById('_bf-slot-label-input').value.trim())">Save</button>
        </div>
      </div>`;
    window._bfSlotLabelResolve = val => {
      overlay.remove();
      delete window._bfSlotLabelResolve;
      resolve(val === null ? null : val);
    };
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) window._bfSlotLabelResolve(null); });
    setTimeout(() => {
      const inp = document.getElementById('_bf-slot-label-input');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') window._bfSlotLabelResolve(inp.value.trim());
          if (e.key === 'Escape') window._bfSlotLabelResolve(null);
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
window.bfSaveToSlot      = bfSaveToSlot;
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
  slot integer,
  data jsonb,
  project_count integer,
  saved_at timestamptz default now()
);

alter table save_history enable row level security;

create policy "Users manage own history" on save_history
  for all using (auth.uid() = user_id);
*/
