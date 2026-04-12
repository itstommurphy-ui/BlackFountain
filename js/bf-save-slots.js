// ══════════════════════════════════════════════════════════════════════════════
// BLACK FOUNTAIN — SAVE SLOT SYSTEM
// bf-save-slots.js  (load after supabase-sync.js and settings.js)
//
// 3 manual save slots, each stored in:
//   1. Supabase save_slots table (cloud)
//   2. IndexedDB under keys slot_1 / slot_2 / slot_3
//   3. localStorage under bf_slot_1 / bf_slot_2 / bf_slot_3
//
// Autosave never touches these. Only explicit user action writes a slot.
// ══════════════════════════════════════════════════════════════════════════════

const SLOT_COUNT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _slotKey(n) { return `slot_${n}`; }
function _slotLsKey(n) { return `bf_slot_${n}`; }

function _slotSnapshot(label) {
  // Strip file blobs (same as sbPushStore) to keep size manageable
  return {
    data: {
      ...store,
      files: (store.files || []).map(({ data: _d, ...f }) => f),
    },
    label: label || '',
    saved_at: new Date().toISOString(),
    project_count: (store.projects || []).length,
  };
}

function _slotSummary(slot) {
  if (!slot) return null;
  return {
    label:         slot.label || '',
    saved_at:      slot.saved_at || null,
    project_count: slot.project_count || (slot.data?.projects?.length ?? 0),
  };
}

// ── Write to all three stores ─────────────────────────────────────────────────

async function _slotWriteIdb(n, snapshot) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(snapshot, _slotKey(n));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    console.log(`[saveSlot] IDB write slot ${n} success`);
  } catch(e) {
    console.warn(`[saveSlot] IDB write slot ${n} failed:`, e);
  }
}

function _slotWriteLS(n, snapshot) {
  try {
    // localStorage can't hold the full store — just save metadata for UI rendering.
    // IDB and Supabase hold the restorable snapshot. localStorage is belt-and-braces
    // for knowing a slot exists and when it was saved, not for full restore.
    const meta = {
      label:         snapshot.label,
      saved_at:      snapshot.saved_at,
      project_count: snapshot.project_count,
      // flag so _slotReadLS knows this is metadata-only, not restorable
      metaOnly:      true,
    };
    localStorage.setItem(_slotLsKey(n), JSON.stringify(meta));
  } catch(e) {
    console.warn(`[saveSlot] localStorage metadata write slot ${n} failed:`, e.message);
    // Non-fatal — IDB and Supabase are the real stores
  }
}

async function _slotWriteSupabase(n, snapshot) {
  if (!_sb || !_sbUser) return;
  try {
    if (!_cachedToken) {
      const { data: { session } } = await _sb.auth.getSession();
      _cachedToken = session?.access_token || null;
    }
    if (!_cachedToken) return;
    const response = await fetch(
      `${_SB_URL}/rest/v1/save_slots?on_conflict=user_id,slot`,
      {
        method: 'POST',
        headers: {
          'apikey':        _SB_KEY,
          'Authorization': `Bearer ${_cachedToken}`,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          user_id:       _sbUser.id,
          slot:          n,
          data:          snapshot.data,
          label:         snapshot.label,
          saved_at:      snapshot.saved_at,
          project_count: snapshot.project_count,
        }),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[saveSlot] Supabase write slot ${n} failed:`, response.status, err);
    }
  } catch(e) {
    console.warn(`[saveSlot] Supabase write slot ${n} exception:`, e.message);
  }
}

// ── Read from stores (waterfall: IDB → localStorage → Supabase) ───────────────

async function _slotReadIdb(n) {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(_slotKey(n));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    console.log(`[slotReadIdb] slot ${n}:`, result ? 'found' : 'null');
    return result;
  } catch(e) {
    console.warn(`[slotReadIdb] slot ${n} error:`, e);
    return null;
  }
}

function _slotReadLS(n) {
  try {
    const raw = localStorage.getItem(_slotLsKey(n));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Return as-is — caller checks for .data to determine if restorable
    return parsed;
  } catch(e) {
    return null;
  }
}

async function _slotReadSupabase(n) {
  if (!_sb || !_sbUser) return null;
  try {
    if (!_cachedToken) {
      const { data: { session } } = await _sb.auth.getSession();
      _cachedToken = session?.access_token || null;
    }
    if (!_cachedToken) return null;
    const response = await fetch(
      `${_SB_URL}/rest/v1/save_slots?user_id=eq.${_sbUser.id}&slot=eq.${n}&select=data,label,saved_at,project_count`,
      {
        headers: {
          'apikey':        _SB_KEY,
          'Authorization': `Bearer ${_cachedToken}`,
        },
      }
    );
    if (!response.ok) return null;
    const rows = await response.json();
    if (!rows?.length) return null;
    const r = rows[0];
    return { data: r.data, label: r.label, saved_at: r.saved_at, project_count: r.project_count };
  } catch(e) {
    return null;
  }
}

// Read with waterfall — returns the best available snapshot
async function _slotRead(n) {
  const idb = await _slotReadIdb(n);
  if (idb?.saved_at) return idb;
  const ls = _slotReadLS(n);
  if (ls?.saved_at) return ls;
  const sb = await _slotReadSupabase(n);
  return sb;
}

// ── Read all three slots for UI ───────────────────────────────────────────────

async function _slotReadAll() {
  return Promise.all(
    [1, 2, 3].map(n => _slotRead(n))
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

// Save current state into slot n (1–3)
async function saveSlot(n) {
  const label = await _slotPromptLabel(n);
  if (label === null) return; // user cancelled

  showToast(`Saving to slot ${n}…`, 'info');
  const snapshot = _slotSnapshot(label);

  await Promise.all([
    _slotWriteIdb(n, snapshot),
    _slotWriteSupabase(n, snapshot),
  ]);
  _slotWriteLS(n, snapshot); // sync

  showToast(`Slot ${n} saved ✓`, 'success');
  renderSaveSlots(); // refresh UI
}

async function loadSlot(n) {
  const slot = await _slotRead(n);
  if (!slot?.data) {
    showToast(`Slot ${n} is empty`, 'info');
    return;
  }

  const summary = _slotSummary(slot);
  const dateStr = summary.saved_at
    ? new Date(summary.saved_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'unknown time';

  const confirmed = await new Promise(resolve => {
    showConfirmDialog(
      `Load "${summary.label || `Slot ${n}`}" saved ${dateStr}?\n\nThis will reload the app with your saved data. Your current autosave is unaffected.`,
      'Load Save',
      () => resolve(true),
      { onCancel: () => resolve(false) }
    );
  });
  if (!confirmed) return;

  showToast('Loading save — restarting…', 'info');

  // Write slot data into the primary IDB key
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(slot.data, 'v1');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) {
    showToast('Could not write save data — try again', 'error');
    console.error('[loadSlot] IDB write failed:', e);
    return;
  }

  // Set skip flag for loadStore
  localStorage.setItem('bf_skip_cloud_pull', '1');

  // CRITICAL: Monkey-patch saveStore and sbPushStore to no-ops so that
  // the beforeunload/visibilitychange autosave listeners can't fire and
  // overwrite IDB or Supabase with the old 7-project state before reload.
  window.saveStore   = async () => { console.log('[loadSlot] saveStore blocked during slot load'); };
  window.sbPushStore = async () => { console.log('[loadSlot] sbPushStore blocked during slot load'); };

  // Also cancel any pending debounced save
  if (typeof cancelDebouncedSave === 'function') cancelDebouncedSave();

  window.location.reload();
}

// ── Label prompt ──────────────────────────────────────────────────────────────

function _slotPromptLabel(n) {
  return new Promise(resolve => {
    document.getElementById('_slot-prompt-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_slot-prompt-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:22px 20px 18px;width:340px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Save to Slot ${n}</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Give this save a name (optional)</div>
        <input id="_slot-label-input" class="form-input" placeholder="e.g. Before the big breakdown session…"
          style="width:100%;margin-bottom:16px" maxlength="60">
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-sm" onclick="document.getElementById('_slot-prompt-overlay').remove();window._slotPromptResolve(null)">Cancel</button>
          <button class="btn btn-sm btn-primary" onclick="window._slotPromptResolve(document.getElementById('_slot-label-input').value.trim())">Save</button>
        </div>
      </div>`;

    window._slotPromptResolve = val => {
      overlay.remove();
      delete window._slotPromptResolve;
      resolve(val === null ? null : (val || `Slot ${n}`));
    };

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) window._slotPromptResolve(null); });

    setTimeout(() => {
      const inp = document.getElementById('_slot-label-input');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') window._slotPromptResolve(inp.value.trim());
          if (e.key === 'Escape') window._slotPromptResolve(null);
        });
      }
    }, 40);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UI — renders into #save-slots-container (put this div in your settings page)
// ══════════════════════════════════════════════════════════════════════════════

async function renderSaveSlots() {
  const el = document.getElementById('save-slots-container');
  if (!el) return;

  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
    <div style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">Loading slots…</div>
  </div>`;

  const slots = await _slotReadAll();

  const cards = slots.map((slot, i) => {
    const n = i + 1;
    const summary = _slotSummary(slot);
    const isEmpty = !slot?.saved_at;
    const dateStr = summary?.saved_at
      ? new Date(summary.saved_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : null;

    return `
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">

        <!-- Slot header -->
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:6px;background:${isEmpty ? 'var(--surface3)' : 'rgba(230,188,60,0.15)'};border:1px solid ${isEmpty ? 'var(--border)' : 'rgba(230,188,60,0.4)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${isEmpty ? 'var(--text3)' : 'var(--accent)'};font-family:var(--font-mono)">${n}</div>
            <div>
              <div style="font-size:13px;font-weight:600;color:${isEmpty ? 'var(--text3)' : 'var(--text)'}">${isEmpty ? 'Empty slot' : (summary.label || `Save ${n}`)}</div>
              ${dateStr ? `<div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);margin-top:1px">${dateStr} · ${summary.project_count} project${summary.project_count !== 1 ? 's' : ''}</div>` : ''}
            </div>
          </div>
          ${!isEmpty ? `<span style="font-size:9px;background:rgba(40,167,69,0.12);color:#28a745;border:1px solid rgba(40,167,69,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-mono);font-weight:700">SAVED</span>` : ''}
        </div>

        <!-- Storage indicators -->
        <div style="display:flex;gap:6px">
          ${_slotStoragePip('Cloud', !isEmpty)}
          ${_slotStoragePip('Local', !isEmpty)}
          ${_slotStoragePip('Backup', !isEmpty)}
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-primary" onclick="saveSlot(${n})" style="flex:1">
            💾 ${isEmpty ? 'Save here' : 'Overwrite'}
          </button>
          ${!isEmpty ? `<button class="btn btn-sm" onclick="loadSlot(${n})" style="flex:1">⏏ Load</button>` : ''}
        </div>

      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">Manual Save Slots</div>
      <div style="font-size:11px;color:var(--text3);line-height:1.5">Save your work to a slot at any time. Each slot is stored in three places — cloud, device, and browser backup — so your saves survive even if one storage layer fails. Autosave never overwrites these.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${cards}
    </div>`;
}

function _slotStoragePip(label, active) {
  return `<div style="display:flex;align-items:center;gap:4px;font-size:9px;font-family:var(--font-mono);color:${active ? 'var(--text2)' : 'var(--text3)'}">
    <div style="width:6px;height:6px;border-radius:50%;background:${active ? '#28a745' : 'var(--border2)'}"></div>
    ${label}
  </div>`;
}

// Expose globals
window.saveSlot   = saveSlot;
window.loadSlot   = loadSlot;
window.renderSaveSlots = renderSaveSlots;