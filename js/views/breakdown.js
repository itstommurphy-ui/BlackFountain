// BREAKDOWN
// ══════════════════════════════════════════
// SCRIPT BREAKDOWN
// ══════════════════════════════════════════

let _bdPendingSelection = null;
let _bdActiveCategory = null;
let _bdFilter = { intExt: null, tod: null };

function _bdBadge(text, type) {
  const palette = {
    'INT':      ['#0d2a40','#5bb3f0'], 'EXT':      ['#0d2a16','#5fc460'],
    'INT/EXT':  ['#221040','#a57de8'], 'EXT/INT':  ['#221040','#a57de8'],
    'DAY':      ['#2e1f00','#f0b429'], 'NIGHT':    ['#080820','#8899dd'],
    'DAWN':     ['#2e1000','#e8884a'], 'DUSK':     ['#2e1000','#e8884a'],
    'MORNING':  ['#2e1e00','#f5c842'], 'EVENING':  ['#1a0820','#c47de8'],
    'CONTINUOUS':['#1a1a1a','#888'],  'SAME':     ['#1a1a1a','#888'],
    'LATER':    ['#1a1a1a','#888'],
  };
  const c = palette[text] || (type === 'intExt' ? palette['INT'] : ['#1a1a1a','#aaa']);
  return `<span class="bd-scene-badge" style="background:${c[0]};color:${c[1]}">${text}</span>`;
}
let _bdCtxFromScript = false;
let _bdSuggestions = [];
let _bdSuggestSelected = new Set();
let _activeBreakdownId = null;
let _bdRenamingId = null;

// ── Multiple-breakdown helpers ─────────────────────────────────────────────
function _migrateBreakdowns(p) {
  if (!p || p.scriptBreakdowns) return;
  p.scriptBreakdowns = [];
  if (p.scriptBreakdown && p.scriptBreakdown.rawText) {
    p.scriptBreakdowns.push({
      id: makeId(), name: 'Version 1', version: '',
      rawText: p.scriptBreakdown.rawText,
      tags: p.scriptBreakdown.tags || [],
      createdAt: Date.now()
    });
  }
}

function _getActiveBd(p) {
  _migrateBreakdowns(p);
  if (!p || !p.scriptBreakdowns || !p.scriptBreakdowns.length) return null;
  const found = _activeBreakdownId && p.scriptBreakdowns.find(b => b.id === _activeBreakdownId);
  return found || p.scriptBreakdowns[p.scriptBreakdowns.length - 1];
}

function _extractLocationFromHeading(heading) {
  // Remove INT./EXT. prefix variations
  let name = heading.replace(/^(INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|INT\.|EXT\.)\s*/i, '').trim();
  // Remove time-of-day suffix: " - DAY", " - NIGHT", " - CONTINUOUS", etc.
  name = name.replace(/\s*[-–]\s*(DAY|NIGHT|DUSK|DAWN|CONTINUOUS|CONT[''.]?D?|LATER|MOMENTS LATER|MORNING|AFTERNOON|EVENING|EARLY MORNING|LATE NIGHT|GOLDEN HOUR|MAGIC HOUR|SUNRISE|SUNSET|MIDDAY|MIDNIGHT|PRE-DAWN|DUSK\/DAWN)$/i, '').trim();
  return name;
}

function _autoImportBreakdownLocations(p, text) {
  if (!text || !p) return 0;
  const scenes = parseBreakdownScenes(text);
  let added = 0;
  for (const scene of scenes) {
    if (scene.heading === 'Full Script') continue;
    const raw = _extractLocationFromHeading(scene.heading);
    if (!raw || raw.length < 2) continue;
    const name = raw.toLowerCase().replace(/(^|[\s\-])(\w)/g, (_, sep, letter) => sep + letter.toUpperCase());
    if (!(p.locations || []).some(l => l.name.toLowerCase() === name.toLowerCase())) {
      if (!p.locations) p.locations = [];
      p.locations.push({ name, suit: 'possible', contacted: 'no', avail: '', rules: '', cost: '', costPeriod: '', access: '', recce: 'no', light: '', power: '', problems: '', decision: '', notes: '' });
      added++;
    }
  }
  return added;
}

function _createBreakdown(p, name, version, rawText, scriptId) {
  _migrateBreakdowns(p);
  const bd = { id: makeId(), name: name || 'New Breakdown', version: version || '', rawText: rawText || '', tags: [], createdAt: Date.now(), scriptId: scriptId || null };
  p.scriptBreakdowns.push(bd);
  _activeBreakdownId = bd.id;
  if (rawText) {
    const added = _autoImportBreakdownLocations(p, rawText);
    if (added > 0) setTimeout(() => showToast(`${added} location${added !== 1 ? 's' : ''} auto-imported from script headings`, 'success'), 400);
  }
  return bd;
}

function _selectBreakdown(id) {
  _activeBreakdownId = id;
  _bdRenamingId = null;
  const p = currentProject();
  if (p) renderBreakdown(p);
}
function _finishRenameBd(id, val) {
  _bdRenamingId = null;
  _renameBd(id, val);
  renderBreakdown(currentProject());
}

function _renameBd(id, name) {
  const p = currentProject();
  _migrateBreakdowns(p);
  const bd = (p.scriptBreakdowns || []).find(b => b.id === id);
  if (bd && name.trim()) { bd.name = name.trim(); saveStore(); }
}

function importBdCastToSection() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const text = bd.rawText;
  const tags = bd.tags || [];
  const castRoles  = [...new Set(tags.filter(t => t.category === 'cast'  ).map(t => text.slice(t.start, t.end).trim()).filter(Boolean))];
  const extrasRoles = [...new Set(tags.filter(t => t.category === 'extras').map(t => text.slice(t.start, t.end).trim()).filter(Boolean))];
  if (!castRoles.length && !extrasRoles.length) { showToast('No cast or extras tagged in breakdown yet', 'info'); return; }
  if (!p.cast)   p.cast   = [];
  if (!p.extras) p.extras = [];
  const blank = { name: '', number: '', email: '', notes: '', social: '', confirmed: 'green', dept: '' };
  let added = 0;
  for (const role of castRoles) {
    if (!p.cast.some(m => (m.role || '').toLowerCase() === role.toLowerCase())) {
      p.cast.push({ ...blank, role });
      added++;
    }
  }
  for (const role of extrasRoles) {
    if (!p.extras.some(m => (m.role || '').toLowerCase() === role.toLowerCase())) {
      p.extras.push({ ...blank, role });
      added++;
    }
  }
  if (!added) { showToast('All tagged cast/extras already in Cast & Extras section', 'info'); return; }
  saveStore();
  showToast(`${added} entr${added !== 1 ? 'ies' : 'y'} added to Cast & Extras section`, 'success');
}

// ── STRIPBOARD ────────────────────────────────────────────────────────────────

function _sbEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Traditional stripboard colors adapted for dark mode
// INT/DAY=blue, EXT/DAY=yellow-green, INT/NIGHT=deep-blue, EXT/NIGHT=green
// INT/EXT=purple, DAWN/DUSK=amber
function _sbStripColor(intExt, tod) {
  const isDusk  = tod && /DAWN|DUSK|GOLDEN HOUR|MAGIC HOUR|TWILIGHT|SUNRISE|SUNSET/.test(tod);
  const isNight = tod && /NIGHT|MIDNIGHT/.test(tod);
  if (intExt === 'EXT' && isNight)  return ['#081810', '#3a9e44']; // EXT/NIGHT — dark green
  if (intExt === 'EXT' && isDusk)   return ['#201408', '#d4882e']; // EXT/DUSK  — amber
  if (intExt === 'EXT')             return ['#141e08', '#a0c830']; // EXT/DAY   — yellow-green
  if (intExt === 'INT' && isNight)  return ['#080c22', '#4060c8']; // INT/NIGHT — deep blue
  if (intExt === 'INT' && isDusk)   return ['#1c1008', '#d48028']; // INT/DUSK  — amber
  if (intExt === 'INT')             return ['#081828', '#4898d8']; // INT/DAY   — blue
  if (intExt === 'INT/EXT' || intExt === 'EXT/INT') {
    if (isNight) return ['#160820', '#b060d0'];                    // I/E NIGHT — magenta
    return          ['#160e28', '#c890e0'];                        // I/E DAY   — lavender
  }
  return ['var(--surface)', '#888'];
}

function _sbPageEighths(scene) {
  // 1/8 page = ~6.75 lines (based on industry standard: 1 inch ≈ 1/8 page)
  const lineCount = scene.lineCount || 1;
  const eighths = Math.max(1, Math.round(lineCount / 6.75));
  return eighths >= 8 ? Math.floor(eighths/8) + '-' + (eighths%8||'0') + '/8' : eighths + '/8';
}

function _sbBuildSceneData(p) {
  const bd = _getActiveBd(p);
  if (!bd) return {};
  const scenes = parseBreakdownScenes(bd.rawText || '');
  const data = {};
  for (const scene of scenes) {
    const castTags = (bd.tags||[]).filter(t => t.category === 'cast' && t.start >= scene.start && t.start < scene.end);
    const cast = [...new Set(castTags.map(t => (bd.rawText||'').substring(t.start, t.end).trim()).filter(Boolean))];
    const shotCount = (p.shots||[]).filter(s => s.sceneKey === scene.heading).length;
    data[scene.heading] = { scene, cast, shotCount };
  }
  return data;
}

// KEY FIX: use data-key/data-src attributes instead of inline JSON params
// (inline JSON in double-quoted attributes breaks on scene headings with quotes/commas)
function _sbRenderStrip(sceneKey, data, sourceDayId) {
  const entry = data[sceneKey];
  const keyAttr = _sbEsc(sceneKey);
  const srcAttr = _sbEsc(sourceDayId || '');
  const drag = `draggable="true" data-key="${keyAttr}" data-src="${srcAttr}" ondragstart="_sbOnDragStart(event)" ondragend="_sbOnDragEnd(event)" ondragover="event.preventDefault()" onclick="_sbOpenScene(event)"`;
  if (!entry) {
    return `<div class="strip" ${drag}><div class="strip-swatch" style="background:#555"></div><div class="strip-body"><div class="strip-r1"><span class="strip-loc">${_sbEsc(sceneKey)}</span></div></div></div>`;
  }
  const { scene, cast } = entry;
  const [bg, swatch] = _sbStripColor(scene.intExt, scene.tod);
  const num    = scene.sceneNumber ? `<span class="strip-num">${_sbEsc(scene.sceneNumber)}</span>` : '';
  const ie     = scene.intExt ? `<span class="strip-ie" style="background:${swatch}28;color:${swatch}">${_sbEsc(scene.intExt)}</span>` : '';
  const loc    = `<span class="strip-loc">${_sbEsc(scene.location || scene.heading)}</span>`;
  const pages    = `<span class="strip-pages">${_sbPageEighths(scene)}</span>`;
  const tod      = scene.tod ? `<span class="strip-tod">${_sbEsc(scene.tod)}</span>` : '';
  const castHtml = cast.length ? `<div class="strip-cast">${cast.map(c=>_sbEsc(c)).join(', ')}</div>` : '';
  const shotBadge= entry.shotCount ? `<span class="strip-shots">${entry.shotCount} shot${entry.shotCount>1?'s':''}</span>` : '';
  return `<div class="strip" ${drag} style="background:${bg}" title="${keyAttr}">
    <div class="strip-swatch" style="background:${swatch}"></div>
    <div class="strip-body">
      <div class="strip-r1">${num}${loc}${ie}${shotBadge}</div>
      <div class="strip-r2">${tod}${pages}</div>
      ${castHtml}
    </div>
  </div>`;
}

function _sbRenderDrops(dayId, sceneKeys, data) {
  const strips = sceneKeys.map(k => _sbRenderStrip(k, data, dayId)).join('');
  const empty  = !sceneKeys.length ? `<div class="sb-empty-drop">Drop scenes here</div>` : '';
  return `<div class="sb-drops" ondragover="_sbOnDragOver(event,'${dayId}')" ondragleave="_sbOnDragLeave(event)" ondrop="_sbOnDrop(event,'${dayId}')" data-day="${dayId}">${strips}${empty}</div>`;
}

function _sbRenderDay(day, data, index) {
  const count      = (day.sceneKeys||[]).length;
  const isSelected = _sbSelectMode && _sbSelectedDays.has(day.id);
  const selClass   = isSelected ? ' sb-col-selected' : '';
  const cb         = _sbSelectMode
    ? `<span class="sb-sel-cb${isSelected?' checked':''}">${isSelected?'✓':''}</span>` : '';
  const clickAttr  = _sbSelectMode ? `onclick="_sbToggleDaySelect(event,'${day.id}')" style="cursor:pointer"` : '';
  const headStyle  = _sbSelectMode ? 'pointer-events:none' : '';
  return `<div class="sb-col${selClass}" data-day-id="${day.id}" ${clickAttr}>
    <div class="sb-col-head" style="${headStyle}">
      <div class="sb-col-head-top">
        ${cb}<span class="sb-col-daynum">${index + 1}</span>
        <input class="sb-col-title" value="${_sbEsc(day.label)}" onblur="_sbRenameDay('${day.id}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">
        <button class="sb-col-del" onclick="_sbRemoveDay('${day.id}')" title="Remove day">×</button>
      </div>
      <div class="sb-col-meta">
        <input class="sb-col-date" type="date" value="${_sbEsc(day.date||'')}" onchange="_sbSetDayDate('${day.id}',this.value)" onclick="try{this.showPicker()}catch(e){}" title="Shoot date">
        <span class="sb-col-count">${count} sc</span>
      </div>
    </div>
    ${_sbRenderDrops(day.id, day.sceneKeys||[], data)}
  </div>`;
}

function _sbRenderUnscheduled(unscheduled, data) {
  const count = unscheduled.length;
  return `<div class="sb-col sb-col-unscheduled">
    <div class="sb-col-head">
      <div class="sb-col-head-top">
        <span class="sb-col-daynum" style="font-size:13px;opacity:.5">—</span>
        <span class="sb-col-title" style="pointer-events:none;opacity:.8">Unscheduled</span>
        <span class="sb-col-count">${count}</span>
      </div>
      <div class="sb-col-meta" style="opacity:.5;font-size:10px;color:var(--text3)">Drag into a day to schedule</div>
    </div>
    ${_sbRenderDrops('unscheduled', unscheduled, data)}
  </div>`;
}

let _sbDragKey      = null;
let _sbDragSource   = null;
let _sbJustDragged  = false;
let _sbOpenSceneKey = null;
let _sbSelectMode   = false;
let _sbSelectedDays = new Set();

function renderStripboard(p) {
  const el = document.getElementById('section-stripboard');
  if (!el) return;
  if (!p) { el.innerHTML = `<div class="empty-state"><div class="icon">🎞️</div><h4>No project selected</h4></div>`; return; }
  const bd = _getActiveBd(p);
  if (!bd || !bd.rawText) {
    el.innerHTML = `<button class="btn-back" onclick="showSection('overview')">← Back to Overview</button><div class="empty-state"><div class="icon">🎞️</div><h4>No script loaded</h4><p>Import a script in <strong>Script Breakdown</strong> first.</p></div>`;
    return;
  }
  if (!p.stripboard) p.stripboard = { days: [] };
  const sb   = p.stripboard;
  const data = _sbBuildSceneData(p);
  const allKeys       = Object.keys(data);
  const scheduledKeys = new Set((sb.days||[]).flatMap(d => d.sceneKeys||[]));
  const unscheduled   = allKeys.filter(k => !scheduledKeys.has(k));
  const totalPages    = allKeys.reduce((sum, k) => sum + (data[k] ? (data[k].scene.end - data[k].scene.start) / 1700 : 0), 0);
  const scheduledSc   = scheduledKeys.size;
  const dayCols = (sb.days||[]).map((d, i) => _sbRenderDay(d, data, i)).join('');
  const addCol  = _sbSelectMode ? '' : `<div class="sb-add-col" onclick="_sbAddDay()" title="Add shoot day">＋</div>`;
  const n = _sbSelectedDays.size;
  const toolbar = _sbSelectMode
    ? `<button class="btn btn-sm" onclick="_sbToggleSelectMode()">Cancel</button>
       <span style="font-size:11px;color:var(--text3)">${n} day${n!==1?'s':''} selected</span>
       <button class="btn btn-sm btn-danger" onclick="_sbDeleteSelected()" ${!n?'disabled':''}>Remove ${n||''} day${n!==1?'s':''}</button>`
    : `<span style="font-size:13px;font-weight:700;color:var(--text)">Stripboard</span>
       <span style="font-size:11px;color:var(--text3)">${scheduledSc} of ${allKeys.length} scenes scheduled · ${sb.days.length} day${sb.days.length!==1?'s':''} · ~${totalPages.toFixed(1)} pages total</span>
       ${sb.days.length ? `<button class="btn btn-sm" style="margin-left:auto" onclick="_sbToggleSelectMode()">Select days</button>` : ''}`;
  el.innerHTML = `
    <button class="btn-back" onclick="showSection('overview')">← Back to Overview</button>
    <div class="sb-wrap">
      <div class="sb-toolbar">${toolbar}</div>
      <div class="sb-area">
        ${_sbRenderUnscheduled(unscheduled, data)}
        ${dayCols}
        ${addCol}
      </div>
    </div>`;
}

function _sbAddDay() {
  const p = currentProject();
  if (!p) return;
  if (!p.stripboard) p.stripboard = { days: [] };
  const n = p.stripboard.days.length + 1;
  p.stripboard.days.push({ id: makeId(), label: 'Day ' + n, date: '', sceneKeys: [] });
  saveStore();
  renderStripboard(p);
}

function _sbRenameDay(dayId, label) {
  const p = currentProject();
  if (!p?.stripboard) return;
  const day = p.stripboard.days.find(d => d.id === dayId);
  if (day && label.trim()) { day.label = label.trim(); saveStore(); }
}

function _sbSetDayDate(dayId, date) {
  const p = currentProject();
  if (!p?.stripboard) return;
  const day = p.stripboard.days.find(d => d.id === dayId);
  if (day) { day.date = date; saveStore(); }
}

function _sbRemoveDay(dayId) {
  const p = currentProject();
  if (!p?.stripboard) return;
  const day = p.stripboard.days.find(d => d.id === dayId);
  if (!day) return;
  showConfirmDialog(`Remove "${day.label}" and return its scenes to Unscheduled?`, 'Remove Day', () => {
    p.stripboard.days = p.stripboard.days.filter(d => d.id !== dayId);
    saveStore();
    renderStripboard(p);
  });
}

// Reads key/src from data attributes — avoids broken HTML from inline JSON params
function _sbToggleSelectMode() {
  _sbSelectMode = !_sbSelectMode;
  if (!_sbSelectMode) _sbSelectedDays.clear();
  renderStripboard(currentProject());
}

function _sbToggleDaySelect(e, dayId) {
  e.stopPropagation();
  if (_sbSelectedDays.has(dayId)) _sbSelectedDays.delete(dayId);
  else _sbSelectedDays.add(dayId);
  renderStripboard(currentProject());
}

function _sbDeleteSelected() {
  const n = _sbSelectedDays.size;
  if (!n) return;
  showConfirmDialog(
    `Remove ${n} day${n>1?'s':''} and return all their scenes to Unscheduled?`,
    `Remove ${n} Day${n>1?'s':''}`,
    () => {
      const p = currentProject();
      if (!p?.stripboard) return;
      p.stripboard.days = p.stripboard.days.filter(d => !_sbSelectedDays.has(d.id));
      _sbSelectedDays.clear();
      _sbSelectMode = false;
      saveStore();
      renderStripboard(p);
    }
  );
}

function _sbOnDragStart(e) {
  if (_sbSelectMode) return;
  const el      = e.currentTarget;
  _sbDragKey    = el.dataset.key;
  _sbDragSource = el.dataset.src || 'unscheduled';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _sbDragKey);
  el.classList.add('dragging');
}

function _sbOnDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.sb-col').forEach(c => c.classList.remove('drag-over'));
  _sbJustDragged = true;
  setTimeout(() => { _sbJustDragged = false; }, 300);
}

function _sbOnDragOver(e, targetDayId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.sb-col').forEach(c => c.classList.remove('drag-over'));
  const drops = document.querySelector(`.sb-drops[data-day="${targetDayId}"]`);
  if (drops) drops.closest('.sb-col')?.classList.add('drag-over');
}

function _sbOnDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.closest?.('.sb-col')?.classList.remove('drag-over');
  }
}

function _sbOnDrop(e, targetDayId) {
  e.preventDefault();
  document.querySelectorAll('.sb-col').forEach(c => c.classList.remove('drag-over'));
  const sceneKey    = _sbDragKey;
  const sourceDayId = _sbDragSource;
  _sbDragKey    = null;
  _sbDragSource = null;
  if (!sceneKey) return;
  const p = currentProject();
  if (!p?.stripboard) return;
  // Remove from source day (unscheduled = derived, nothing to remove)
  if (sourceDayId && sourceDayId !== 'unscheduled') {
    const srcDay = p.stripboard.days.find(d => d.id === sourceDayId);
    if (srcDay) srcDay.sceneKeys = srcDay.sceneKeys.filter(k => k !== sceneKey);
  }
  // Add to target day
  if (targetDayId && targetDayId !== 'unscheduled') {
    const tgtDay = p.stripboard.days.find(d => d.id === targetDayId);
    if (tgtDay && !tgtDay.sceneKeys.includes(sceneKey)) {
      const drops  = e.currentTarget;
      const strips = [...drops.querySelectorAll('.strip')];
      let insertIdx = strips.length;
      for (let i = 0; i < strips.length; i++) {
        const rect = strips[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { insertIdx = i; break; }
      }
      tgtDay.sceneKeys.splice(insertIdx, 0, sceneKey);
    }
  }
  saveStore();
  renderStripboard(p);
}

function _sbOpenScene(e) {
  if (_sbJustDragged || _sbSelectMode) return;
  const strip    = e.currentTarget;
  const sceneKey = strip.dataset.key;
  if (!sceneKey) return;
  const p = currentProject();
  if (!p) return;
  const bd = _getActiveBd(p);
  if (!bd) return;

  _sbOpenSceneKey = sceneKey;
  const data  = _sbBuildSceneData(p);
  const entry = data[sceneKey];
  if (!entry) return;
  const { scene, cast } = entry;
  const [bg, swatch] = _sbStripColor(scene.intExt, scene.tod);

  // Extract first few action lines from the raw script text
  const rawText      = bd.rawText || '';
  const contentStart = scene.start + sceneKey.length;
  const lines = rawText.substring(contentStart, scene.end)
    .split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6);
  const extractHtml = lines.length
    ? `<div class="form-group"><div class="sb-scene-extract">${_sbEsc(lines.join('\n'))}</div></div>` : '';

  // Per-scene saved data
  if (!p.stripboard) p.stripboard = { days: [] };
  if (!p.stripboard.sceneData) p.stripboard.sceneData = {};
  const sd       = p.stripboard.sceneData[sceneKey] || {};
  const synopsis = sd.synopsis || '';
  const shootLoc = sd.shootLoc || '';

  // Badges
  const numBadge = scene.sceneNumber ? `<span class="sb-scene-num">${_sbEsc(scene.sceneNumber)}</span>` : '';
  const ieBadge  = scene.intExt ? `<span class="sb-scene-badge" style="background:${swatch}22;color:${swatch}">${_sbEsc(scene.intExt)}</span>` : '';
  const todBadge = scene.tod    ? `<span class="sb-scene-badge" style="background:rgba(255,255,255,.07);color:var(--text3)">${_sbEsc(scene.tod)}</span>` : '';
  const castHtml = cast.length
    ? cast.map(c => `<span class="sb-cast-chip">${_sbEsc(c)}</span>`).join('')
    : `<span class="sb-no-cast">No cast tagged in breakdown</span>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'sb-scene-overlay';
  overlay.innerHTML = `
    <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="sb-scene-title" style="border-top:5px solid ${swatch};padding-top:18px">
      <div class="modal-header" style="margin-bottom:14px">
        <div style="flex:1;min-width:0">
          <div class="sb-scene-meta">${numBadge}${ieBadge}${todBadge}<span style="font-size:10px;color:var(--text3)">${_sbPageEighths(scene)} pages</span></div>
          <h3 id="sb-scene-title" style="font-size:18px;font-weight:700;margin:0;line-height:1.25;color:var(--text)">${_sbEsc(scene.location || scene.heading)}</h3>
        </div>
        <button class="modal-close" aria-label="Close" onclick="_sbCloseScene()">✕</button>
      </div>
      ${extractHtml}
      <div class="form-group">
        <label class="form-label" for="sb-synopsis-ta">Synopsis / Notes</label>
        <textarea class="form-textarea" id="sb-synopsis-ta" rows="3" placeholder="Add a brief synopsis or production notes…" style="resize:vertical">${_sbEsc(synopsis)}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:2px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Cast</label>
          <div class="sb-cast-chips">${castHtml}</div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="sb-shoot-loc-in">Shooting Location</label>
          <div class="sb-loc-wrap">
            <input class="form-input" id="sb-shoot-loc-in" placeholder="e.g. Stage 3, Studio B…" value="${_sbEsc(shootLoc)}" autocomplete="off">
          </div>
        </div>
      </div>
      ${(()=>{
        const shots = (p.shots||[]).filter(s => s.sceneKey === sceneKey);
        if (!shots.length) return `<div class="form-group" style="margin-top:14px;margin-bottom:0"><label class="form-label">Shots</label><span style="font-size:11px;color:var(--text3);opacity:.55">No shots yet — add them in Shot List</span></div>`;
        const rows = shots.map(s => `<div class="sb-shot-item"><span class="sb-shot-num">${_sbEsc(s.setup||'?')}.${_sbEsc(s.num||'?')}</span><span class="sb-shot-type">${_sbEsc(s.type||'')}</span><span class="sb-shot-desc">${_sbEsc(s.desc||s.movement||'')}</span>${s.length?`<span style="font-size:9px;color:var(--text3)">${_sbEsc(s.length)}</span>`:''}</div>`).join('');
        return `<div class="form-group" style="margin-top:14px;margin-bottom:0"><label class="form-label">Shots (${shots.length})</label><div class="sb-shots-list">${rows}</div></div>`;
      })()}
    </div>`;

  overlay.addEventListener('mousedown', ev => { if (ev.target === overlay) _sbCloseScene(); });
  overlay._sbKey = ev => { if (ev.key === 'Escape') _sbCloseScene(); };
  document.addEventListener('keydown', overlay._sbKey);
  document.body.appendChild(overlay);
  overlay.querySelector('#sb-synopsis-ta').addEventListener('blur', _sbSaveSceneFields);
  const locIn = overlay.querySelector('#sb-shoot-loc-in');
  locIn.addEventListener('input', _sbShootLocInput);
  locIn.addEventListener('blur', _sbSaveSceneFields);
  locIn.addEventListener('blur', () => setTimeout(() => document.getElementById('sb-loc-list')?.remove(), 150));
  setTimeout(() => overlay.querySelector('#sb-synopsis-ta')?.focus(), 60);
}

function _sbSaveSceneFields() {
  const p = currentProject();
  if (!p || !_sbOpenSceneKey) return;
  if (!p.stripboard) return;
  if (!p.stripboard.sceneData) p.stripboard.sceneData = {};
  const synopsis = document.getElementById('sb-synopsis-ta')?.value  || '';
  const shootLoc = document.getElementById('sb-shoot-loc-in')?.value || '';
  p.stripboard.sceneData[_sbOpenSceneKey] = { synopsis, shootLoc };
  saveStore();
}

function _sbCloseScene() {
  _sbSaveSceneFields();
  const overlay = document.getElementById('sb-scene-overlay');
  if (!overlay) return;
  if (overlay._sbKey) document.removeEventListener('keydown', overlay._sbKey);
  overlay.remove();
  _sbOpenSceneKey = null;
}

function _sbShootLocInput(e) {
  const input = e.target;
  const val   = input.value.trim().toLowerCase();
  let list = document.getElementById('sb-loc-list');
  if (!val) { list?.remove(); return; }
  const p = currentProject();
  const projectLocs = (p?.locations  || []).map(l => l.name);
  const globalLocs  = (store?.locations || []).map(l => l.name);
  const allNames    = [...new Set([...projectLocs, ...globalLocs])].filter(Boolean);
  const locs = allNames.filter(n => n.toLowerCase().includes(val));
  if (!locs.length) { list?.remove(); return; }
  // Position fixed relative to the input — avoids overflow:auto clipping inside modal
  const rect = input.getBoundingClientRect();
  if (!list) {
    list = document.createElement('div');
    list.id = 'sb-loc-list';
    list.className = 'sb-loc-list';
    document.body.appendChild(list);
  }
  list.style.top   = (rect.bottom + 4) + 'px';
  list.style.left  = rect.left + 'px';
  list.style.width = rect.width + 'px';
  list.innerHTML = locs.map(n =>
    `<div class="sb-loc-item" onmousedown="_sbShootLocSelect(event,this)">${_sbEsc(n)}</div>`
  ).join('');
}

function _sbShootLocSelect(e, el) {
  e.preventDefault(); // keep focus on input, don't trigger blur
  const name  = el.textContent;
  const input = document.getElementById('sb-shoot-loc-in');
  if (input) { input.value = name; _sbSaveSceneFields(); }
  document.getElementById('sb-loc-list')?.remove();
}

// ── END STRIPBOARD ────────────────────────────────────────────────────────────

function renderBreakdown(p) {
  const el = document.getElementById('section-breakdown');
  if (!el) return;
  if (!p) { el.innerHTML = `<div class="empty-state"><div class="icon">📄</div><h4>No project selected</h4></div>`; return; }
  _migrateBreakdowns(p);
  const bd = _getActiveBd(p);
  if (!bd || !bd.rawText) renderBreakdownImport(el, p);
  else renderBreakdownEditor(el, p);
  el.querySelectorAll('.goto-hook').forEach(h => { h.innerHTML = _gotoHtml('breakdown'); });
}

function renderBreakdownImport(el, p) {
  const hasBds = p.scriptBreakdowns && p.scriptBreakdowns.length > 0;
  const selectorHtml = hasBds ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${p.scriptBreakdowns.map(b => `<button class="btn btn-sm${_getActiveBd(p)?.id === b.id ? ' btn-primary' : ''}" onclick="_selectBreakdown('${b.id}')">${b.name}${b.version ? ' <span style=\'opacity:0.6;font-size:10px\'>('+b.version+')</span>' : ''}</button>`).join('')}
      <button class="btn btn-sm" onclick="_selectBreakdown(null);renderBreakdown(currentProject())">+ New Breakdown</button>
    </div>` : '';
  el.innerHTML = `
    <button class="btn-back" onclick="showSection('overview')">← Back to Overview</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${hasBds?'8px':'20px'}">
      <h3 class="section-heading">SCRIPT BREAKDOWN</h3>
      <span class="goto-hook"></span>
    </div>
    ${selectorHtml}
    <div style="max-width:560px;margin:0 auto">
      <div id="bd-upload-card" style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:36px 28px;text-align:center;margin-bottom:16px">
        <div style="font-size:52px;margin-bottom:14px">🎬</div>
        <h4 style="margin:0 0 8px;font-size:16px">Load Your Script</h4>
        <p style="color:var(--text3);font-size:13px;margin:0 0 24px;line-height:1.6">Paste or upload your script to begin tagging elements — cast, props, wardrobe, SFX and more — using the industry colour system. Tags auto-group into a per-scene breakdown report.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:10px">
          <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            📂 Upload File
            <input type="file" accept=".txt,.fountain,.fdx,.pdf" style="display:none" onchange="loadBreakdownFile(this)">
          </label>
          <button class="btn" onclick="document.getElementById('bd-paste-wrap').style.display='block';document.getElementById('bd-import-wrap').style.display='none';this.style.display='none'">✏️ Paste Script</button>
          <button class="btn" onclick="showBdScriptImporter()">📚 From Scripts &amp; Docs</button>
        </div>
        <div style="font-size:11px;color:var(--text3)">.txt · .fountain · .fdx (Final Draft XML) · .pdf — or drag &amp; drop a file here</div>
      </div>
      <div id="bd-paste-wrap" style="display:none">
        <textarea id="bd-paste-input" class="form-textarea" rows="18" placeholder="Paste your script here…

Scene headings are auto-detected, e.g.:
INT. COFFEE SHOP - DAY
EXT. STREET - NIGHT

Fountain and plain text both work." style="font-family:monospace;font-size:12px;line-height:1.7;resize:vertical;min-height:260px"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary" onclick="loadBreakdownPastedText()">Load Script</button>
          <button class="btn" onclick="document.getElementById('bd-paste-wrap').style.display='none'">Cancel</button>
        </div>
      </div>
      <div id="bd-import-wrap" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:0"></div>
    </div>`;
  // Wire drag-and-drop onto the upload card now that it's in the DOM
  const bdCard = document.getElementById('bd-upload-card');
  if (bdCard) {
    bdCard.classList.add('drop-zone');
    _makeDrop(bdCard, files => {
      const fakeInput = { files };
      loadBreakdownFile(fakeInput);
    });
  }
}

function _stripFountainMarkup(text) {
  // Remove boneyard block comments /* ... */
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove inline [[notes]]
  text = text.replace(/\[\[[\s\S]*?\]\]/g, '');
  return text.split('\n').map(line => {
    // Strip bold+italic, bold, italic, underline formatting marks
    let l = line
      .replace(/\*{3}(.+?)\*{3}/g, '$1')
      .replace(/\*{2}(.+?)\*{2}/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1');
    // Forced scene heading: strip leading dot (e.g. ".INT. BAR - DAY")
    if (/^\.[A-Z]/.test(l)) l = l.slice(1);
    // Centered text: "> text <"
    l = l.replace(/^>\s*/, '').replace(/\s*<$/, '');
    return l;
  }).join('\n');
}

function showBdScriptImporter() {
  const p = currentProject(); if (!p) return;
  const wrap = document.getElementById('bd-import-wrap');
  if (!wrap) return;
  // Toggle off if already open
  if (wrap.style.display === 'block') { wrap.style.display = 'none'; return; }
  document.getElementById('bd-paste-wrap').style.display = 'none';

  const scripts = (p.scripts || []).slice().sort((a,b) => (b.uploadedAt||0)-(a.uploadedAt||0));
  if (!scripts.length) {
    wrap.innerHTML = `
      <p style="color:var(--text3);font-size:13px;text-align:center;margin:12px 0">No files in Scripts &amp; Documents yet.</p>
      <p style="color:var(--text3);font-size:12px;text-align:center;margin:0 0 12px">Upload or write a script there first, then come back to import it.</p>
      <div style="text-align:center"><button class="btn btn-sm" onclick="document.getElementById('bd-import-wrap').style.display='none'">Close</button></div>`;
    wrap.style.display = 'block';
    return;
  }

  wrap.innerHTML = `
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;font-weight:500">SELECT A SCRIPT TO IMPORT</div>
    ${scripts.map(s => {
      const ext = s.name.toLowerCase().split('.').pop();
      const unsupported = ['doc','docx'].includes(ext);
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--surface3);margin-bottom:6px;border:1px solid var(--border2);${unsupported?'opacity:0.5':'cursor:pointer'}"
        ${unsupported ? '' : `onclick="importBreakdownFromScript('${s.id}')"`}>
        <span style="font-size:18px">${scriptFileIcon(s.type)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name.replace(/</g,'&lt;')}</div>
          ${s.label ? `<div style="font-size:11px;color:var(--text3)">${s.label.replace(/</g,'&lt;')}</div>` : ''}
        </div>
        <span style="font-size:10px;padding:2px 6px;background:var(--surface);border-radius:3px;color:var(--text3);flex-shrink:0">${ext.toUpperCase()}</span>
        <span style="font-size:11px;flex-shrink:0;${unsupported?'color:var(--text3)':'color:var(--accent2)'}">${unsupported ? 'Not supported' : 'Import →'}</span>
      </div>`;
    }).join('')}
    ${scripts.some(s => ['doc','docx'].includes(s.name.toLowerCase().split('.').pop())) ?
      `<p style="font-size:11px;color:var(--text3);margin:8px 0 4px">Word documents (.doc/.docx) cannot be read in the browser — re-save as .txt or .fountain to import.</p>` : ''}
    <button class="btn btn-sm" style="margin-top:6px" onclick="document.getElementById('bd-import-wrap').style.display='none'">Cancel</button>`;
  wrap.style.display = 'block';
}

async function importBreakdownFromScript(scriptId) {
  const p = currentProject(); if (!p) return;
  const s = p.scripts.find(x => x.id === scriptId); if (!s) return;
  const importWrap = document.getElementById('bd-import-wrap');
  if (importWrap) importWrap.style.display = 'none';

  _migrateBreakdowns(p);
  const name    = s.name.replace(/\.[^.]+$/, ''); // strip extension
  const version = s.label || '';
  const ext     = s.name.toLowerCase().split('.').pop();

  // Check if a breakdown already exists for this script (by id or by name fallback for older entries)
  const existing = (p.scriptBreakdowns || []).find(b => b.scriptId === scriptId || (!b.scriptId && b.name === name));
  if (existing) {
    showConfirmDialog('A breakdown for this file already exists.', 'View Breakdown', () => {
      _activeBreakdownId = existing.id;
      showSection('breakdown');
    }, {
      btnClass: 'btn-primary',
      extraButtons: [{ label: 'Create New Anyway', btnClass: '', onClick: () => _doCreateBreakdown(p, s, name, version, ext, scriptId) }]
    });
    return;
  }

  _doCreateBreakdown(p, s, name, version, ext, scriptId);
}

async function _doCreateBreakdown(p, s, name, version, ext, scriptId) {
  // PDF: convert stored dataUrl back to a File object then reuse existing extractor
  if (ext === 'pdf' || s.type.includes('pdf')) {
    showToast('Reading PDF for breakdown…', 'info');
    try {
      const res  = await fetch(s.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], s.name, { type: s.type || 'application/pdf' });
      await _extractTextForBreakdown(p, file, name, version, scriptId);
      showSection('breakdown');
    } catch(e) {
      showToast('Could not read PDF: ' + e.message, 'error');
    }
    return;
  }

  // Text-based formats: decode base64
  let text = '';
  try {
    const b64 = s.dataUrl.split(',')[1];
    text = decodeURIComponent(escape(atob(b64)));
  } catch(e) {
    try { text = atob(s.dataUrl.split(',')[1]); } catch(e2) { text = ''; }
  }

  if (!text.trim()) { showToast('Could not extract text from this file', 'error'); return; }

  // FDX detection: check extension OR detect FinalDraft XML structure
  // (stored name may not have .fdx if user renamed it in the upload modal)
  let isFdx = ext === 'fdx';
  if (!isFdx) {
    try { if (new DOMParser().parseFromString(text, 'text/xml').querySelector('FinalDraft')) isFdx = true; }
    catch(e) {}
  }
  if (isFdx) {
    try {
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const extracted = Array.from(xml.querySelectorAll('Paragraph'))
        .map(par => Array.from(par.querySelectorAll('Text')).map(t => t.textContent).join(''))
        .filter(t => t.trim()).join('\n');
      if (extracted.trim()) text = extracted;
    } catch(e) { /* fall through to raw text */ }
  } else {
    // Strip Fountain formatting marks for .fountain / .txt / .rtf
    text = _stripFountainMarkup(text);
  }

  if (!text.trim()) { showToast('Could not extract text from this file', 'error'); return; }
  _createBreakdown(p, name, version, text.trim(), scriptId);
  saveStore();
  showSection('breakdown');
  showToast(`Imported "${name}" into breakdown`, 'success');
}

function renderBreakdownEditor(el, p) {
  _bdActiveCategory = null;
  _bdFilter = { intExt: null, tod: null };
  const bd = _getActiveBd(p);
  const text = bd.rawText;
  const tags = bd.tags || [];
  const scenes = parseBreakdownScenes(text);

  const bds = p.scriptBreakdowns || [];
  const _bdSelItem = (b) => {
    if (b.id === bd.id) {
      if (_bdRenamingId === b.id) {
        return `<input id="bd-rename-inp" class="form-input" style="height:28px;padding:2px 8px;font-size:11px;font-weight:700;min-width:60px;width:${Math.max(60, b.name.length * 7 + 24)}px;max-width:220px;display:inline-block;border-color:var(--accent)" value="${_sbEsc(b.name)}" onblur="_finishRenameBd('${b.id}',this.value)" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){_bdRenamingId=null;renderBreakdown(currentProject())}">`;
      }
      return `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(230,188,60,0.12);border:1px solid rgba(230,188,60,0.5);border-radius:6px;padding:2px 4px 2px 10px;font-size:11px;font-weight:700;color:var(--accent)">${_sbEsc(b.name)}<button onclick="event.stopPropagation();_bdRenamingId='${b.id}';renderBreakdown(currentProject())" title="Rename" style="background:none;border:none;cursor:pointer;padding:2px 5px;font-size:12px;opacity:0.6;color:inherit;line-height:1">✎</button></span>`;
    }
    return `<button class="btn btn-sm" onclick="_selectBreakdown('${b.id}')">${_sbEsc(b.name)}</button>`;
  };
  const selectorHtml = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      ${bds.map(_bdSelItem).join('')}
      <button class="btn btn-sm" onclick="_bdRenamingId=null;_activeBreakdownId=null;renderBreakdownImport(document.getElementById('section-breakdown'),currentProject())">${bds.length > 1 ? '+ New' : '+ New Breakdown'}</button>
    </div>`;

  el.innerHTML = `
    <button class="btn-back" onclick="showSection('overview')">← Back to Overview</button>
    ${selectorHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <h3 class="section-heading" style="margin:0 0 2px">SCRIPT BREAKDOWN</h3>
        <div style="font-size:11px;color:var(--text3)" data-bd-counter>${scenes.length} scene${scenes.length!==1?'s':''} · ${tags.length} tag${tags.length!==1?'s':''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
        <span class="goto-hook"></span>
        <button class="btn btn-sm" onclick="showBdSuggestPanel()" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-color:#4a4a8a" title="Auto-detect characters, props, vehicles and more">✦ Auto-suggest</button>
        <button class="btn btn-sm" onclick="importBdCastToSection()" title="Export tagged Cast and Extras to the Cast &amp; Extras section">→ Export Cast/Extras</button>
        <button class="btn btn-sm" onclick="viewBreakdownReport()">⊞ View Report</button>
        <div class="dropdown">
          <button class="dropdown-toggle">↓ Export</button>
          <div class="dropdown-menu">
            <div class="dropdown-item" onclick="exportBreakdownReport('txt')">📄 Export as TXT</div>
            <div class="dropdown-item" onclick="exportBreakdownReport('pdf')">📕 Export as PDF</div>
            <div class="dropdown-item" onclick="exportBreakdownReport('doc')">📘 Export as DOC</div>
            <div class="dropdown-item" onclick="exportBreakdownReport('html')">🌐 Export as HTML</div>
          </div>
        </div>
        <button class="btn btn-sm" style="opacity:0.7" onclick="clearBreakdownTags()">✕ Clear Tags</button>
        <button class="btn btn-sm" style="opacity:0.7" onclick="clearBreakdownScript()">🗑 Delete Script</button>
      </div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:5px;display:flex;flex-wrap:wrap;gap:5px;align-items:center">
      <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-right:4px;white-space:nowrap">CATEGORIES <span style="opacity:0.6;font-weight:500">(click to activate multi-tagging):</span></span>
      ${BREAKDOWN_CATEGORIES.map(cat => `<span id="bd-key-${cat.id}" onclick="setBdActiveCat('${cat.id}')" style="background:${cat.color};color:${cat.textColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;cursor:pointer;transition:box-shadow 0.1s,transform 0.1s;user-select:none">${cat.label}</span>`).join('')}
    </div>
    <div id="bd-active-hint" style="font-size:11px;min-height:18px;margin-bottom:8px;padding-left:2px"></div>
    ${_bdFilterBar(scenes)}
    <div class="bd-layout">
      <div>
        <div id="bd-script-view" class="bd-script-view" onmouseup="onBreakdownMouseup(event)">${buildBreakdownHtml(text, tags)}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Breakdown Report</div>
        <div id="bd-report">${renderBreakdownReport(p, scenes)}</div>
      </div>
    </div>`;

  if (_bdRenamingId) setTimeout(() => {
    const inp = document.getElementById('bd-rename-inp');
    if (inp) { inp.focus(); inp.select(); }
  }, 0);

  if (!window._bdGlobalHandler) {
    document.addEventListener('mousedown', function(e) {
      const pop = document.getElementById('bd-popover');
      if (!pop || pop.style.display === 'none') return;
      if (!pop.contains(e.target)) { pop.style.display = 'none'; _bdPendingSelection = null; }
    });
    window._bdGlobalHandler = true;
  }
}

function parseSceneHeading(heading) {
  const h = heading.replace(/\s+/g, ' ').trim();
  // Strip optional leading scene number: "1.", "42A.", "1 ", "42A -"
  const numM = /^(\d+[A-Za-z]?)\s*[-.]?\s+/.exec(h);
  const sceneNumber = numM ? numM[1] : null;
  const rest = (numM ? h.slice(numM[0].length) : h).replace(/^\./, '').trim(); // strip Fountain dot
  // Match INT/EXT prefix (with or without period, with INTERIOR/EXTERIOR longform)
  const prefixM = /^(INT(?:ERIOR)?\.?(?:\/EXT(?:ERIOR)?\.?)?|EXT(?:ERIOR)?\.?(?:\/INT(?:ERIOR)?\.?)?|I\/E\.?)[\s.:\-]+/i.exec(rest);
  if (!prefixM) return { sceneNumber, intExt: null, location: h, tod: null };
  const rawPfx = prefixM[1].toUpperCase().replace(/[\s.]/g, '');
  let intExt;
  if (/INT.+EXT|IE/.test(rawPfx))       intExt = 'INT/EXT';
  else if (/EXT.+INT/.test(rawPfx))      intExt = 'EXT/INT';
  else if (/^INT/.test(rawPfx))          intExt = 'INT';
  else                                    intExt = 'EXT';
  const locationAndTod = rest.slice(prefixM[0].length).trim();
  const TOD_TERMS = 'DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|CONT\'D|LATER|MOMENTS LATER|SAME TIME|SAME|GOLDEN HOUR|SUNRISE|SUNSET|TWILIGHT|MIDNIGHT|NOON|MIDDAY|PRE-DAWN|MAGIC HOUR|EARLY MORNING|LATE NIGHT|DAY\\/NIGHT|NIGHT\\/DAY';
  const todM = new RegExp(`[-–—]\\s*(${TOD_TERMS})\\s*$`, 'i').exec(locationAndTod);
  const tod = todM ? todM[1].toUpperCase() : null;
  const location = (tod ? locationAndTod.slice(0, todM.index) : locationAndTod).trim();
  return { sceneNumber, intExt, location, tod };
}

function parseBreakdownScenes(text) {
  if (!text) return [];
  // Handles: scene numbers, INTERIOR/EXTERIOR longform, I/E, missing periods, Fountain dot prefix
  const headingRe = /^(?:\d+[A-Za-z]?\s*[-.]?\s+)?(?:\.)?(?:INT(?:ERIOR)?\.?(?:\/EXT(?:ERIOR)?\.?)?|EXT(?:ERIOR)?\.?(?:\/INT(?:ERIOR)?\.?)?|I\/E\.?)[\s.:\-]\S/i;
  const lines = text.split('\n');
  const scenes = [];
  let current = null, offset = 0, lineIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (headingRe.test(trimmed)) {
      if (current) { current.end = offset; current.lineCount = lineIndex - current.startLineIndex; scenes.push(current); }
      current = { heading: trimmed, start: offset, end: -1, startLineIndex: lineIndex, ...parseSceneHeading(trimmed) };
    }
    lineIndex++;
    offset += line.length + 1;
  }
  if (current) { current.end = text.length; current.lineCount = lineIndex - current.startLineIndex; scenes.push(current); }
  if (!scenes.length && text.trim()) scenes.push({ heading: 'Full Script', start: 0, end: text.length, intExt: null, location: null, tod: null, sceneNumber: null, lineCount: lines.length, startLineIndex: 0 });
  return scenes;
}

function buildBreakdownHtml(text, tags) {
  const scenes = parseBreakdownScenes(text);
  const events = [];
  for (const t of (tags||[])) {
    events.push({ pos: t.start, type: 'ts', id: t.id, category: t.category });
    events.push({ pos: t.end,   type: 'te', id: t.id });
  }
  for (const s of scenes) {
    events.push({ pos: s.start,                      type: 'hs', sceneStart: s.start, intExt: s.intExt, tod: s.tod });
    events.push({ pos: s.start + s.heading.length,   type: 'he', intExt: s.intExt, tod: s.tod });
  }
  events.sort((a,b) => a.pos !== b.pos ? a.pos - b.pos : (a.type[1]==='e' ? -1 : 1));

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let html = '', pos = 0;
  let activeTags = [], inHeading = false, currentSceneStart = null, currentIntExt = null, currentTod = null;

  const openAll = () => {
    let out = inHeading ? `<span class="bd-scene-heading" data-scene-start="${currentSceneStart}" data-int-ext="${currentIntExt||''}" data-tod="${currentTod||''}">` : '';
    if (activeTags.length) {
      const cats = activeTags.map(t => BREAKDOWN_CATEGORIES.find(c => c.id === t.category) || { color:'#aaa', textColor:'#000', label:'?' });
      const bg = cats.length === 1 ? cats[0].color
        : `linear-gradient(to right, ${cats.map((c,i) => `${c.color} ${i*100/cats.length}% ${(i+1)*100/cats.length}%`).join(',')})`;
      const ids = activeTags.map(t => t.id).join(',');
      out += `<mark class="bd-tag" data-tag-ids="${ids}" onclick="onBdTagClick(this,event)" style="background:${bg};color:${cats[0].textColor};cursor:pointer" title="${cats.map(c=>c.label).join(' + ')}">`;
    }
    return out;
  };
  const closeAll = () => (activeTags.length ? '</mark>' : '') + (inHeading ? '</span>' : '');

  for (const ev of events) {
    if (ev.pos > pos) html += esc(text.slice(pos, ev.pos));
    pos = ev.pos;
    html += closeAll();
    if      (ev.type === 'ts') activeTags.push({ id: ev.id, category: ev.category });
    else if (ev.type === 'te') activeTags = activeTags.filter(t => t.id !== ev.id);
    else if (ev.type === 'hs') { inHeading = true; currentSceneStart = ev.sceneStart; currentIntExt = ev.intExt; currentTod = ev.tod; }
    else if (ev.type === 'he') {
      if (ev.intExt) html += _bdBadge(ev.intExt, 'intExt');
      if (ev.tod)    html += _bdBadge(ev.tod, 'tod');
      inHeading = false; currentSceneStart = null; currentIntExt = null; currentTod = null;
    }
    html += openAll();
  }
  if (pos < text.length) html += esc(text.slice(pos));
  html += closeAll();
  return html;
}

function _bdFilterBar(scenes) {
  const intExts = [...new Set(scenes.map(s => s.intExt).filter(Boolean))].sort();
  const tods    = [...new Set(scenes.map(s => s.tod).filter(Boolean))].sort();
  if (!intExts.length && !tods.length) return '';
  const chip = (field, val) =>
    `<span class="bd-filter-chip${_bdFilter[field]===val?' active':''}" onclick="_bdApplyFilter('${field}','${val}')">${val}</span>`;
  return `<div class="bd-filter-bar" id="bd-filter-bar">
    ${intExts.length ? `<span class="bd-filter-label">INT/EXT</span>${intExts.map(v=>chip('intExt',v)).join('')}` : ''}
    ${intExts.length && tods.length ? '<span style="width:1px;height:16px;background:var(--border);margin:0 3px"></span>' : ''}
    ${tods.length ? `<span class="bd-filter-label">TIME</span>${tods.map(v=>chip('tod',v)).join('')}` : ''}
    ${(_bdFilter.intExt||_bdFilter.tod) ? '<span class="bd-filter-chip" style="opacity:0.5" onclick="_bdApplyFilter(null,null)">✕ Clear</span>' : ''}
  </div>`;
}

function _bdApplyFilter(field, value) {
  if (field === null) { _bdFilter = { intExt: null, tod: null }; }
  else { _bdFilter[field] = _bdFilter[field] === value ? null : value; }
  const p = currentProject();
  const bd = _getActiveBd(p);
  const scenes = parseBreakdownScenes(bd.rawText);
  // Refresh filter bar chips
  const bar = document.getElementById('bd-filter-bar');
  if (bar) bar.outerHTML = _bdFilterBar(scenes);
  // Refresh report
  const rep = document.getElementById('bd-report');
  if (rep) rep.innerHTML = renderBreakdownReport(p, scenes);
}

function renderBreakdownReport(p, scenes) {
  const bd = _getActiveBd(p);
  if (!bd) return '';
  const text = bd.rawText;
  const tags = bd.tags || [];
  if (!scenes) scenes = parseBreakdownScenes(text);
  // Apply active filters
  if (_bdFilter.intExt) scenes = scenes.filter(s => s.intExt === _bdFilter.intExt);
  if (_bdFilter.tod)    scenes = scenes.filter(s => s.tod    === _bdFilter.tod);

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const parts = scenes.map(scene => {
    const st = tags.filter(t => t.start >= scene.start && t.end <= scene.end);
    const byCat = {};
    for (const t of st) { (byCat[t.category] = byCat[t.category]||[]).push({ id: t.id, text: esc(text.slice(t.start, t.end)) }); }
    const body = st.length
      ? BREAKDOWN_CATEGORIES.filter(c => byCat[c.id]).map(cat => `
          <div>
            <span style="display:inline-block;background:${cat.color};color:${cat.textColor};border-radius:3px;padding:0 5px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px">${cat.label}</span>
            <div style="display:flex;flex-wrap:wrap;gap:3px">
              ${byCat[cat.id].map(item => `<span style="display:inline-flex;align-items:center;background:var(--surface);border:1px solid var(--border2);border-radius:4px;padding:1px 3px 1px 6px;font-size:11px;gap:0;color:var(--text2)"><span onclick="showTagActionMenu('${item.id}',event.clientX,event.clientY,false)" style="cursor:pointer;padding-right:3px" title="Add to / Move to">${item.text}</span><button onclick="event.stopPropagation();removeBreakdownTag('${item.id}')" style="background:none;border:none;color:#E74C3C;cursor:pointer;font-size:13px;padding:0 2px;line-height:1;font-weight:700" title="Remove">×</button></span>`).join('')}
            </div>
          </div>`).join('')
      : `<span style="font-size:11px;color:var(--text3);opacity:0.5">No elements tagged</span>`;
    const pageLen = _sbPageEighths(scene);
    return `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px">
      <div onclick="scrollBreakdownToScene(${scene.start})" style="background:var(--surface2);padding:6px 10px;font-size:11px;font-weight:700;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:5px" title="Jump to scene in script">
        <span style="opacity:0.5;font-size:10px">↗</span>${esc(scene.heading)}<span style="margin-left:auto;font-size:10px;color:#E5C07B;font-weight:600">${pageLen} pgs</span>
      </div>
      <div style="padding:8px 10px;display:flex;flex-direction:column;gap:6px">${body}</div>
    </div>`;
  });

  if (!parts.length) return `<div style="color:var(--text3);font-size:12px;padding:16px;text-align:center;background:var(--surface2);border:1px solid var(--border);border-radius:8px;line-height:1.6">No elements tagged yet.<br>Select text in the script to begin.</div>`;
  return parts.join('');

}

function onBreakdownMouseup(e) {
  if (e.target.classList.contains('bd-tag')) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) { hideBdPopover(); return; }
  const container = document.getElementById('bd-script-view');
  if (!container) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) { hideBdPopover(); return; }
  const start = getTextOffsetInBd(container, range.startContainer, range.startOffset);
  const end   = getTextOffsetInBd(container, range.endContainer,   range.endOffset);
  if (start === end) { hideBdPopover(); return; }
  _bdPendingSelection = { start: Math.min(start, end), end: Math.max(start, end) };
  if (_bdActiveCategory) applyBreakdownTag(_bdActiveCategory);
  else showBdPopover(range.getBoundingClientRect());
}

function getTextOffsetInBd(container, node, offset) {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode === node) return total + offset;
    // Skip badge nodes — their text ("INT", "DAY" etc.) is not in bd.rawText
    const parent = walker.currentNode.parentElement;
    if (parent && parent.classList.contains('bd-scene-badge')) continue;
    total += walker.currentNode.textContent.length;
  }
  return total + offset;
}

function getBdPopover() {
  let pop = document.getElementById('bd-popover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'bd-popover';
    pop.className = 'bd-popover';
    document.body.appendChild(pop);
  }
  return pop;
}

function positionBdPopover(x, y) {
  const pop = document.getElementById('bd-popover');
  if (!pop) return;
  const pw = 240, ph = 180;
  let left = x + 10, top = y + 10;
  if (left + pw > window.innerWidth)  left = x - pw - 10;
  if (top  + ph > window.innerHeight) top  = y - ph - 10;
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.top  = Math.max(8, top)  + 'px';
}

function showBdPopover(rect) {
  const pop = getBdPopover();
  pop.style.flexDirection = 'row';
  pop.innerHTML = `<div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;width:100%;margin-bottom:3px">Tag as:</div>
    ${BREAKDOWN_CATEGORIES.map(cat =>
      `<button onclick="applyBreakdownTag('${cat.id}')" style="background:${cat.color};color:${cat.textColor};border:none;border-radius:5px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">${cat.label}</button>`
    ).join('')}`;
  const pw = 340, ph = 120;
  let top  = rect.bottom + 6, left = rect.left;
  if (top  + ph > window.innerHeight) top  = rect.top - ph - 6;
  if (left + pw > window.innerWidth)  left = window.innerWidth - pw - 8;
  pop.style.top = Math.max(8, top) + 'px';
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.display = 'flex';
}

function hideBdPopover() {
  const pop = document.getElementById('bd-popover');
  if (pop) pop.style.display = 'none';
  _bdPendingSelection = null;
}

function setBdActiveCat(catId) {
  _bdActiveCategory = _bdActiveCategory === catId ? null : catId;
  BREAKDOWN_CATEGORIES.forEach(cat => {
    const btn = document.getElementById('bd-key-' + cat.id);
    if (!btn) return;
    if (cat.id === _bdActiveCategory) {
      btn.style.outline = '2px solid #fff';
      btn.style.outlineOffset = '2px';
      btn.style.boxShadow = '0 0 0 5px rgba(255,255,255,0.18)';
      btn.style.transform = 'scale(1.08)';
    } else {
      btn.style.outline = btn.style.outlineOffset = btn.style.boxShadow = btn.style.transform = '';
    }
  });
  const sv = document.getElementById('bd-script-view');
  const hint = document.getElementById('bd-active-hint');
  if (_bdActiveCategory) {
    const cat = BREAKDOWN_CATEGORIES.find(c => c.id === _bdActiveCategory);
    if (sv) { sv.style.borderColor = cat.color; sv.style.borderWidth = '2px'; }
    if (hint) {
      hint.style.cssText = `background:${cat.color}25;border:1px solid ${cat.color}88;border-radius:6px;padding:5px 10px;font-size:11px`;
      hint.innerHTML = `<span style="background:${cat.color};color:${cat.textColor};border-radius:3px;padding:0 6px;font-weight:600">${cat.label}</span> <strong>Multi-Tagging Mode Active</strong> — select text to tag as ${cat.label}. Click the category again to deactivate.`;
    }
  } else {
    if (sv) { sv.style.borderColor = sv.style.borderWidth = ''; }
    if (hint) { hint.style.cssText = ''; hint.textContent = ''; }
  }
}

function scrollBreakdownToScene(sceneStart) {
  const sv = document.getElementById('bd-script-view');
  if (!sv) return;
  const heading = sv.querySelector(`[data-scene-start="${sceneStart}"]`);
  if (!heading) return;
  sv.scrollTop = heading.offsetTop;
}

// Tag context menu
function onBdTagClick(el, event) {
  event.stopPropagation();
  const ids = (el.dataset.tagIds || '').split(',').filter(Boolean);
  if (!ids.length) return;
  if (ids.length === 1) showTagActionMenu(ids[0], event.clientX, event.clientY, true);
  else showTagPickMenu(ids, event.clientX, event.clientY);
}

function showTagPickMenu(ids, x, y) {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const pop = getBdPopover();
  pop.style.flexDirection = 'column';
  const tagItems = ids.map(id => bd.tags.find(t => t.id === id)).filter(Boolean);
  pop.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">Which tag?</div>
    ${tagItems.map(tag => {
      const cat = BREAKDOWN_CATEGORIES.find(c => c.id === tag.category) || { color:'#aaa', textColor:'#000', label:'?' };
      return `<button onclick="showTagActionMenu('${tag.id}',null,null,true)" style="background:${cat.color};color:${cat.textColor};border:none;border-radius:5px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;text-align:left">${cat.label}</button>`;
    }).join('')}`;
  positionBdPopover(x, y);
  pop.style.display = 'flex';
}

function showTagActionMenu(tagId, x, y, fromScript) {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const tag = bd.tags.find(t => t.id === tagId);
  if (!tag) { hideBdPopover(); return; }
  const cat = BREAKDOWN_CATEGORIES.find(c => c.id === tag.category) || { color:'#aaa', textColor:'#000', label:'?' };
  if (fromScript !== undefined) _bdCtxFromScript = !!fromScript;
  const pop = getBdPopover();
  pop.style.flexDirection = 'column';
  pop.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding-bottom:6px;margin-bottom:4px;border-bottom:1px solid var(--border)">
      <span style="background:${cat.color};color:${cat.textColor};border-radius:3px;padding:1px 7px;font-size:11px;font-weight:700">${cat.label}</span>
    </div>
    <button onclick="showTagCategoryPicker('${tagId}','add')" style="background:none;border:none;color:var(--text);cursor:pointer;padding:5px 4px;font-size:12px;text-align:left;width:100%;border-radius:4px">➕  Add to another category</button>
    <button onclick="showTagCategoryPicker('${tagId}','move')" style="background:none;border:none;color:var(--text);cursor:pointer;padding:5px 4px;font-size:12px;text-align:left;width:100%;border-radius:4px">↔  Change category</button>
    ${_bdCtxFromScript ? `<button onclick="removeBreakdownTag('${tagId}')" style="background:none;border:none;color:#E74C3C;cursor:pointer;padding:5px 4px;font-size:12px;text-align:left;width:100%;border-radius:4px">✕  Remove tag</button>` : ''}`;
  if (x != null) positionBdPopover(x, y);
  pop.style.display = 'flex';
}

function showTagCategoryPicker(tagId, action) {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const tag = bd.tags.find(t => t.id === tagId);
  if (!tag) { hideBdPopover(); return; }
  const cats = BREAKDOWN_CATEGORIES.filter(c => c.id !== tag.category);
  const pop = getBdPopover();
  pop.style.flexDirection = 'column';
  pop.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <button onclick="showTagActionMenu('${tagId}',null,null)" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0;line-height:1">←</button>
      <span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em">${action === 'add' ? 'Add to:' : 'Change to:'}</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${cats.map(cat => `<button onclick="executeTagAction('${tagId}','${action}','${cat.id}')" style="background:${cat.color};color:${cat.textColor};border:none;border-radius:5px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">${cat.label}</button>`).join('')}
    </div>`;
  pop.style.display = 'flex';
}

function executeTagAction(tagId, action, toCategory) {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const tag = bd.tags.find(t => t.id === tagId);
  if (!tag) { hideBdPopover(); return; }
  if (action === 'move') {
    tag.category = toCategory;
  } else if (action === 'add') {
    bd.tags.push({ id: makeId(), category: toCategory, start: tag.start, end: tag.end });
  }
  hideBdPopover();
  saveStore();
  updateBreakdownView(p);
}

function applyBreakdownTag(category) {
  if (!_bdPendingSelection) return;
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const { start, end } = _bdPendingSelection;
  if (!bd.tags) bd.tags = [];
  bd.tags.push({ id: makeId(), category, start, end });
  window.getSelection()?.removeAllRanges();
  hideBdPopover();
  saveStore();
  updateBreakdownView(p);
}

function removeBreakdownTag(tagId) {
  hideBdPopover();
  showConfirmDialog('Remove this tag?', 'Remove', () => {
    const p = currentProject();
    const bd = _getActiveBd(p);
    if (!bd) return;
    bd.tags = bd.tags.filter(t => t.id !== tagId);
    saveStore();
    updateBreakdownView(p);
  });
}

function updateBreakdownView(p) {
  const bd = _getActiveBd(p);
  if (!bd) return;
  const scenes = parseBreakdownScenes(bd.rawText);
  const sv = document.getElementById('bd-script-view');
  if (sv) { const st = sv.scrollTop; sv.innerHTML = buildBreakdownHtml(bd.rawText, bd.tags||[]); sv.scrollTop = st; }
  const rv = document.getElementById('bd-report');
  if (rv) rv.innerHTML = renderBreakdownReport(p, scenes);
  const counter = document.querySelector('[data-bd-counter]');
  if (counter) counter.textContent = `${scenes.length} scene${scenes.length!==1?'s':''} · ${(bd.tags||[]).length} tag${(bd.tags||[]).length!==1?'s':''}`;
}

async function loadBreakdownFile(input) {
  const file = input.files[0];
  if (!file) return;
  const p = currentProject();
  if (!p) return;

  if (file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Reading PDF…', 'info');
    try {
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Failed to load PDF.js'));
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY = null;
        let line = '';
        for (const item of content.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
            text += line.trimEnd() + '\n';
            line = '';
          }
          line += item.str;
          lastY = item.transform[5];
        }
        if (line.trim()) text += line.trimEnd() + '\n';
        text += '\n';
      }
      _pendingBdText = text.trim();
      // Also read as dataUrl for storage in Script & Docs
      const dataUrl = await new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(file);
      });
      _pendingScriptFile = { file, dataUrl };
      openScriptUploadModal(p, file, 'breakdown');
    } catch (e) {
      showToast('Could not read PDF: ' + e.message, 'error');
    }
    return;
  }

  // Non-PDF: read as dataUrl, decode text
  const dataUrl = await new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
  let text = '';
  try {
    const b64 = dataUrl.split(',')[1];
    text = decodeURIComponent(escape(atob(b64)));
  } catch(e) { try { text = atob(dataUrl.split(',')[1]); } catch(e2) { text = ''; } }
  if (file.name.toLowerCase().endsWith('.fdx')) {
    try {
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const extracted = Array.from(xml.querySelectorAll('Paragraph'))
        .map(par => Array.from(par.querySelectorAll('Text')).map(t => t.textContent).join(''))
        .filter(s => s.trim()).join('\n');
      if (extracted.trim()) text = extracted;
    } catch(e) {}
  } else {
    text = _stripFountainMarkup(text);
  }
  _pendingBdText = text.trim();
  _pendingScriptFile = { file, dataUrl };
  openScriptUploadModal(p, file, 'breakdown');
}

function loadBreakdownPastedText() {
  const ta = document.getElementById('bd-paste-input');
  if (!ta?.value.trim()) { showToast('Please paste some script text first', 'error'); return; }
  const p = currentProject();
  if (!p) return;
  _createBreakdown(p, 'Pasted Script', '', _stripFountainMarkup(ta.value.trim()));
  saveStore();
  renderBreakdown(p);
}

function clearBreakdownTags() {
  showConfirmDialog('Clear all tags? This cannot be undone.', 'Clear Tags', () => {
    const p = currentProject();
    const bd = _getActiveBd(p);
    if (!bd) return;
    bd.tags = [];
    saveStore();
    renderBreakdown(p);
  });
}

function clearBreakdownScript() {
  showConfirmDialog('Delete this breakdown and all tags? This cannot be undone.', 'Delete', () => {
    const p = currentProject();
    const bd = _getActiveBd(p);
    if (!p || !bd) return;
    p.scriptBreakdowns = (p.scriptBreakdowns || []).filter(b => b.id !== bd.id);
    _activeBreakdownId = null;
    saveStore();
    renderBreakdown(p);
  });
}

function viewBreakdownReport() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const { rawText: text, tags = [] } = bd;
  const scenes = parseBreakdownScenes(text);
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

  const scenesHtml = scenes.map(scene => {
    const st = tags.filter(t => t.start >= scene.start && t.end <= scene.end);
    const byCat = {};
    for (const t of st) { (byCat[t.category] = byCat[t.category]||[]).push(esc(text.slice(t.start, t.end))); }
    const hasTags = Object.keys(byCat).length > 0;
    return `
      <div style="margin-bottom:18px;break-inside:avoid">
        <div style="background:#1a1a2e;color:#e8e0ff;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:6px 6px 0 0">${esc(scene.heading)}</div>
        <div style="border:1px solid #333;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
          ${hasTags
            ? `<table style="width:100%;border-collapse:collapse">
                ${BREAKDOWN_CATEGORIES.filter(c => byCat[c.id]).map((cat, i) => `
                  <tr style="${i % 2 === 0 ? 'background:#111' : 'background:#161616'}">
                    <td style="padding:5px 10px;width:130px;vertical-align:top">
                      <span style="display:inline-block;background:${cat.color};color:${cat.textColor};border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap">${cat.label}</span>
                    </td>
                    <td style="padding:5px 10px;font-size:12px;color:#ccc;line-height:1.6">${byCat[cat.id].join(', ')}</td>
                  </tr>`).join('')}
              </table>`
            : `<div style="padding:8px 14px;font-size:12px;color:#555;font-style:italic">No tagged elements</div>`}
        </div>
      </div>`;
  }).join('');

  const ovId = '_bd-report-view';
  document.getElementById(ovId)?.remove();
  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;flex-direction:column;align-items:center;padding:16px;overflow-y:auto';
  overlay.innerHTML = `
    <div style="width:min(820px,96vw);background:#0d0d0d;border:1px solid #333;border-radius:12px;overflow:hidden;margin:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#111;border-bottom:1px solid #333;position:sticky;top:0;z-index:1">
        <div>
          <div style="font-size:14px;font-weight:700;color:#e8e0ff;letter-spacing:0.05em">SCRIPT BREAKDOWN REPORT</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${esc(p.title)} · ${scenes.length} scenes · ${tags.length} tags</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="printBreakdownReport()" style="background:#222;border:1px solid #444;color:#ccc;border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer">⎙ Print</button>
          <button onclick="document.getElementById('${ovId}').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;cursor:pointer;font-size:20px;border-radius:6px;padding:2px 10px;line-height:1.4">✕</button>
        </div>
      </div>
      <div style="padding:18px 20px">
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #222">
          <span style="font-size:10px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;align-self:center;margin-right:4px">KEY:</span>
          ${BREAKDOWN_CATEGORIES.map(cat => `<span style="background:${cat.color};color:${cat.textColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${cat.label}</span>`).join('')}
        </div>
        ${scenesHtml}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function exportBreakdownReport(format = 'txt') {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const { rawText: text, tags = [] } = bd;
  const scenes = parseBreakdownScenes(text);
  
  if (format === 'pdf') {
    // Use print-friendly HTML for PDF
    printBreakdownReport();
    return;
  }
  
  if (format === 'html') {
    // Generate HTML breakdown
    const html = _generateBreakdownHtml(p, scenes, tags);
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title.replace(/[^a-z0-9]/gi,'_')}_breakdown.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  
  if (format === 'doc') {
    // Generate DOC-compatible HTML
    const html = _generateBreakdownHtml(p, scenes, tags, true);
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title.replace(/[^a-z0-9]/gi,'_')}_breakdown.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  
  // Default: TXT format
  const lines = [
    'SCRIPT BREAKDOWN REPORT',
    `Project: ${p.title}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    `Scenes: ${scenes.length}  |  Elements tagged: ${tags.length}`,
    '', '='.repeat(60), ''
  ];
  for (const scene of scenes) {
    const st = tags.filter(t => t.start >= scene.start && t.end <= scene.end);
    if (!st.length) continue;
    const byCat = {};
    for (const t of st) { (byCat[t.category] = byCat[t.category]||[]).push(text.slice(t.start, t.end)); }
    lines.push(scene.heading.toUpperCase(), '-'.repeat(Math.min(scene.heading.length, 60)));
    for (const cat of BREAKDOWN_CATEGORIES) {
      if (byCat[cat.id]) lines.push(`  ${(cat.label + ':').padEnd(16)} ${byCat[cat.id].join(', ')}`);
    }
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.title.replace(/[^a-z0-9]/gi,'_')}_breakdown.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function _generateBreakdownHtml(p, scenes, tags, forDoc = false) {
  const bd = _getActiveBd(p);
  const text = bd?.rawText || '';
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const docHeader = forDoc ? '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body>' : '';
  const docFooter = forDoc ? '</body></html>' : '';
  
  let html = docHeader;
  html += '<h1>Script Breakdown Report</h1>';
  html += `<p><strong>Project:</strong> ${esc(p.title)}</p>`;
  html += `<p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>`;
  html += `<p><strong>Scenes:</strong> ${scenes.length} | <strong>Elements tagged:</strong> ${tags.length}</p>`;
  html += '<hr>';
  
  for (const scene of scenes) {
    const st = tags.filter(t => t.start >= scene.start && t.end <= scene.end);
    if (!st.length) continue;
    const byCat = {};
    for (const t of st) { (byCat[t.category] = byCat[t.category]||[]).push(esc(text.slice(t.start, t.end))); }
    
    html += `<h3>${esc(scene.heading)}</h3>`;
    html += '<table border="0" cellpadding="5" style="width:100%">';
    for (const cat of BREAKDOWN_CATEGORIES) {
      if (byCat[cat.id]) {
        html += `<tr><td style="background:${cat.color};color:${cat.textColor};font-weight:bold;padding:3px 8px;border-radius:4px;white-space:nowrap">${cat.label}</td><td>${byCat[cat.id].join(', ')}</td></tr>`;
      }
    }
    html += '</table>';
  }
  
  html += docFooter;
  return html;
}

function printBreakdownReport() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const { rawText: text, tags = [] } = bd;
  const scenes = parseBreakdownScenes(text);
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

  const scenesHtml = scenes.map(scene => {
    const st = tags.filter(t => t.start >= scene.start && t.end <= scene.end);
    const byCat = {};
    for (const t of st) { (byCat[t.category] = byCat[t.category]||[]).push(esc(text.slice(t.start, t.end))); }
    const hasTags = Object.keys(byCat).length > 0;
    return `<div class="scene">
      <div class="scene-heading">${esc(scene.heading)}</div>
      <table class="scene-table">
        ${hasTags
          ? BREAKDOWN_CATEGORIES.filter(c => byCat[c.id]).map(cat => `
              <tr>
                <td class="cat-cell"><span class="cat-pill" style="background:${cat.color};color:${cat.textColor}">${cat.label}</span></td>
                <td class="items-cell">${byCat[cat.id].join(', ')}</td>
              </tr>`).join('')
          : `<tr><td colspan="2" class="empty-cell">No tagged elements</td></tr>`}
      </table>
    </div>`;
  }).join('');

  const keyHtml = BREAKDOWN_CATEGORIES.map(cat =>
    `<span class="cat-pill" style="background:${cat.color};color:${cat.textColor}">${cat.label}</span>`
  ).join('');

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(p.title)} — Script Breakdown</title>
  <style>
    @page { margin: 1.8cm 2cm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 2px solid #111; }
    .header-title { font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
    .header-meta { font-size: 11px; color: #555; margin-top: 4px; }
    .key { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 20px; align-items: center; }
    .key-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin-right: 4px; }
    .cat-pill { display: inline-block; border-radius: 3px; padding: 1px 7px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
    .scene { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
    .scene-heading { background: #1a1a2e; color: #e8e0ff; padding: 6px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .scene-table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; border-top: none; }
    .scene-table tr:nth-child(even) { background: #f7f7f7; }
    .cat-cell { padding: 5px 10px; width: 130px; vertical-align: top; border-right: 1px solid #e0e0e0; }
    .items-cell { padding: 5px 12px; color: #222; line-height: 1.5; }
    .empty-cell { padding: 6px 12px; color: #aaa; font-style: italic; }
    .bf-footer { position: fixed; bottom: 6mm; right: 12mm; font-size: 9px; color: #bbb; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">${esc(p.title)}</div>
      <div class="header-meta">Script Breakdown Report · ${scenes.length} scenes · ${tags.length} tags · Generated ${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  ${scenesHtml}
  <div class="bf-footer">Powered by Black Fountain · blackfountain.io</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(printHtml);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  iframe.contentWindow.addEventListener('afterprint', () => iframe.remove());
}

// AUTO-SUGGEST
// ══════════════════════════════════════════

// Categories where keywords spoken inside dialogue should be ignored —
// a character saying "I'll fight you" is not a stunt requirement.
const BD_SKIP_DIALOGUE_CATS = new Set(['stunts', 'sfx', 'vehicles', 'extras', 'animals']);

// Identify a character cue line (ALL CAPS name before dialogue block)
function _bdIsCharCue(line) {
  if (!line || line.length > 60) return false;
  if (/^(INT|EXT|I\/E)/i.test(line)) return false;            // scene heading
  if (/^(FADE|CUT |DISSOLVE|SMASH|TITLE|THE END)/i.test(line)) return false; // transition
  const letters = line.match(/[a-zA-Z]/g) || [];
  if (letters.length < 2) return false;
  const upper = line.match(/[A-Z]/g) || [];
  return upper.length / letters.length >= 0.75;
}

// Returns sorted array of [start, end] character offsets that are inside dialogue
// (the text lines that follow a character cue, until a blank line or new char cue)
function _bdDialogueRanges(text) {
  const ranges = [];
  const lines = text.split('\n');
  let offset = 0;
  let expectDialogue = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const lineEnd = offset + line.length;
    if (!trimmed) {
      expectDialogue = false;
    } else if (_bdIsCharCue(trimmed)) {
      // Character cue — check if it looks like a name (not shouted dialogue like "I SAID NO!")
      const stripped = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim();
      const looksLikeName = stripped.length >= 2 && stripped.length <= 35
        && /^[A-Z][A-Z\s\-']*$/.test(stripped) && stripped.split(/\s+/).length <= 3;
      if (looksLikeName) {
        // Valid char cue — (re)start dialogue expectation, do NOT mark this line as dialogue
        expectDialogue = true;
      } else if (expectDialogue) {
        // All-caps but not a clean name (e.g. punctuation in speech) — still dialogue
        ranges.push([offset, lineEnd]);
      }
    } else if (expectDialogue) {
      ranges.push([offset, lineEnd]);
    }
    offset += line.length + 1; // +1 for \n
  }
  return ranges;
}

// Fast check: is character position `pos` inside any dialogue range?
function _bdInDialogue(pos, end, ranges) {
  for (const [ds, de] of ranges) {
    if (ds > end) break; // ranges are in order, no need to look further
    if (pos >= ds && end <= de) return true;
  }
  return false;
}

function detectBreakdownSuggestions(text, existingTags) {
  if (!text) return [];
  const suggestions = [];
  const scenes = parseBreakdownScenes(text);
  const isTagged = (start, end, cat) =>
    (existingTags || []).some(t => t.category === cat && t.start <= start && t.end >= end);

  const wordBoundary = (str, idx, len) => {
    const before = idx > 0 ? str[idx - 1] : ' ';
    const after  = idx + len < str.length ? str[idx + len] : ' ';
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  };

  // ── 1. Character detection ─────────────────────────────────
  const sceneHeadingRe = /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.)\s/i;
  const transitionRe   = /^(FADE|CUT|SMASH|DISSOLVE|WIPE|MATCH|JUMP)\b.*TO:\s*$|^FADE (IN|OUT)[.:]?\s*$|^THE END\s*$|^OVER BLACK\.?\s*$|^CONTINUED:?\s*$/i;
  const validNameRe    = /^[A-Z][A-Z\s\-']*$/;
  const nonCharWords   = new Set([
    'BANG','BOOM','CRASH','POW','WHAM','SMASH','CRACK','SNAP',
    'REVEAL','NOTE','BEAT','PAUSE','SILENCE','CONTINUED','MORE','OVER',
    'BLACK','WHITE','COLOR','COLOUR','SCREEN','TITLES','END TITLES',
    'MUSIC','SOUND','LATER','MOMENTS LATER','TITLE','CARD','TITLE CARD',
    'OLD','NEW','CUT','JUMP','FADE','END','THE END','AND',
    // Camera shot types
    'WIDE','CLOSE','CLOSE UP','CLOSE-UP','WIDE ANGLE',
    'EXTREME CLOSE UP','EXTREME CLOSE-UP','EXTREME CLOSEUP',
    'MEDIUM SHOT','MID SHOT','MEDIUM CLOSE UP','MEDIUM WIDE','MEDIUM',
    'TWO SHOT','2 SHOT','TWO-SHOT',
    'LOW ANGLE','HIGH ANGLE','DUTCH ANGLE','DUTCH TILT',
    'BIRD\'S EYE','BIRD\'S EYE VIEW','WORM\'S EYE','WORM\'S EYE VIEW',
    'OVER THE SHOULDER','OTS','ECU','MCU','BCU','CU','WS','MS',
    // Camera movement
    'TRACKING SHOT','DOLLY SHOT','DOLLY','DOLLY IN','DOLLY OUT',
    'PAN','PAN LEFT','PAN RIGHT','TILT','TILT UP','TILT DOWN',
    'ZOOM','ZOOM IN','ZOOM OUT','CRANE SHOT','CRANE',
    'STEADICAM','GIMBAL','HANDHELD','HAND HELD','HANDHELD SHOT',
    'WHIP PAN','RACK FOCUS','PUSH IN','PULL BACK','PULL OUT',
    'TRACKING','DOLLY PUSH','BOOM UP','BOOM DOWN',
    // Frame descriptions
    'AERIAL','AERIAL SHOT','OVERHEAD','OVERHEAD SHOT',
    'ESTABLISHING','ESTABLISHING SHOT',
    'INSERT','INSERT SHOT','CUTAWAY','CUTAWAY SHOT','REACTION SHOT',
    'POV','POV SHOT','POINT OF VIEW',
    // General camera/direction terms
    'ANGLE','SHOT','FRAME','LENS','CAMERA',
    'FOREGROUND','BACKGROUND','MIDGROUND',
    'ON','OFF','BACK','SIDE','FRONT',
    // Script format / direction terms
    'SUPER','LOWER THIRD','INTERCUT','QUICK CUTS','MONTAGE',
    'FREEZE FRAME','SLOW MOTION','SLOW MO','SLO MO','SLO-MO',
    'TIME LAPSE','TIMELAPSE','FAST MOTION',
    'B ROLL','B-ROLL','PICKUP','PICKUP SHOT',
    'FLASHBACK','FLASH CUT','SERIES OF SHOTS',
    // Sound / SFX direction
    'SFX','VFX','MOS','PLAYBACK',
  ]);
  // Group-indicator words → Extras rather than Cast
  const groupWords = new Set(['ARTISTS','PEOPLE','CROWD','GROUP','OFFICERS','SOLDIERS','GUARDS','EXTRAS','AUDIENCE','SPECTATORS','MEMBERS','STUDENTS','WORKERS','PATRONS','GUESTS','BYSTANDERS','PEDESTRIANS','ONLOOKERS']);
  const charCategory = name => name.split(/\s+/).some(w => groupWords.has(w)) ? 'extras' : 'cast';

  const isValidName = s =>
    s.length >= 2 && s.length <= 35
    && validNameRe.test(s)
    && s.split(/\s+/).length <= 3
    && !nonCharWords.has(s);

  // Precompute dialogue ranges once — used in character detection and keyword matching
  const dialogueRanges = _bdDialogueRanges(text);

  // Precompute scene heading ranges — nothing should be tagged inside a heading
  const headingRanges = scenes.map(s => [s.start, s.start + s.heading.length]);
  const inHeading = (pos, end) => headingRanges.some(([hs, he]) => pos < he && end > hs);

  // Pass A: standalone character cue lines (speakers)
  // Use _bdIsCharCue (≥75% uppercase ratio) — same heuristic as _bdDialogueRanges,
  // so the two systems stay in sync regardless of script indentation style.
  const charNames = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || sceneHeadingRe.test(trimmed) || transitionRe.test(trimmed)) continue;
    const stripped = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (isValidName(stripped)) charNames.add(stripped);
  }

  // Pass B: ALL-CAPS words/phrases inside *mixed-case* action lines (non-speaking characters e.g. BARTENDER)
  // Pure all-caps lines and dialogue lines are skipped — we don't want character mentions in speech tagged.
  const allCapsRe = /\b([A-Z]{2,}(?:\s[A-Z]{2,}){0,2})\b/g;
  const nameStopWords = new Set(['NO','NOT','THE','A','AN','OF','IN','TO','AT','BY','FOR','BUT','AND','OR','IS','IT','AS','BE','DO','GO','IF','ON','UP','SO','MY','WE']);
  let passBOffset = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const lineStart = passBOffset;
    const lineEnd   = passBOffset + line.length;
    passBOffset += line.length + 1;
    if (!trimmed || sceneHeadingRe.test(trimmed) || transitionRe.test(trimmed)) continue;
    if (!/[a-z]/.test(trimmed)) continue; // skip pure all-caps direction lines
    if (_bdInDialogue(lineStart, lineEnd, dialogueRanges)) continue; // skip dialogue lines
    const strippedLine = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (isValidName(strippedLine)) continue; // already a cue line, handled in Pass A
    let m;
    allCapsRe.lastIndex = 0;
    while ((m = allCapsRe.exec(trimmed)) !== null) {
      const candidate = m[1].trim();
      const firstWord = candidate.split(/\s+/)[0];
      if (isValidName(candidate) && !nameStopWords.has(firstWord)) charNames.add(candidate);
    }
  }

  // Process longest names first per scene so "MIME ARTISTS" claims its position before "MIME" can.
  // Within each name, prefer the first ALL-CAPS occurrence (character introduction) over mixed-case.
  const sortedNames = [...charNames].sort((a, b) => b.length - a.length);
  for (const scene of scenes) {
    const st = text.slice(scene.start, scene.end).toLowerCase();
    const usedRanges = [];
    for (const name of sortedNames) {
      const cat = charCategory(name);
      const nameLower = name.toLowerCase();
      const nameUpper = name.toUpperCase();

      // Pass 1: first ALL-CAPS occurrence not overlapping an already-claimed range
      const notOverlapping = absStart => {
        const e = absStart + name.length;
        return !usedRanges.some(r => r[0] < e && r[1] > absStart);
      };
      let best = null;
      let idx = st.indexOf(nameLower);
      while (idx !== -1) {
        if (wordBoundary(st, idx, nameLower.length)) {
          const absStart = scene.start + idx;
          if (text.slice(absStart, absStart + name.length) === nameUpper && notOverlapping(absStart) && !_bdInDialogue(absStart, absStart + name.length, dialogueRanges) && !inHeading(absStart, absStart + name.length)) {
            best = absStart; break;
          }
        }
        idx = st.indexOf(nameLower, idx + 1);
      }
      // Pass 2: fall back to first uppercase-starting occurrence not already claimed
      if (best === null) {
        idx = st.indexOf(nameLower);
        while (idx !== -1) {
          if (wordBoundary(st, idx, nameLower.length)) {
            const absStart = scene.start + idx;
            if (/[A-Z]/.test(text[absStart]) && notOverlapping(absStart) && !_bdInDialogue(absStart, absStart + name.length, dialogueRanges) && !inHeading(absStart, absStart + name.length)) { best = absStart; break; }
          }
          idx = st.indexOf(nameLower, idx + 1);
        }
      }
      if (best === null) continue;
      const end = best + name.length;
      usedRanges.push([best, end]);
      if (!isTagged(best, end, cat)) {
        suggestions.push({ id: 's_' + Math.random().toString(36).slice(2), category: cat, text: text.slice(best, end), start: best, end, sceneHeading: scene.heading });
      }
    }
  }

  // ── 2. Keyword matching ────────────────────────────────────
  // Keywords are only matched in action lines — never inside dialogue or scene headings
  for (const [category, keywords] of Object.entries(BD_SUGGEST_KEYWORDS)) {
    for (const scene of scenes) {
      const st     = text.slice(scene.start, scene.end);
      const stLow  = st.toLowerCase();
      const claimed = []; // avoid double-counting overlapping keywords in same scene+category
      for (const kw of keywords) {
        const kwLow = kw.toLowerCase();
        let idx = stLow.indexOf(kwLow);
        while (idx !== -1) {
          const end = idx + kwLow.length;
          if (wordBoundary(stLow, idx, kwLow.length)
              && !claimed.some(r => r[0] < end && r[1] > idx)) {
            const start = scene.start + idx;
            const tagEnd = start + kw.length;
            if (!isTagged(start, tagEnd, category)
                && !_bdInDialogue(start, tagEnd, dialogueRanges)
                && !inHeading(start, tagEnd)) {
              claimed.push([idx, end]);
              suggestions.push({ id: 's_' + Math.random().toString(36).slice(2), category, text: text.slice(start, tagEnd), start, end: tagEnd, sceneHeading: scene.heading });
            }
            break; // first match per keyword per scene
          }
          idx = stLow.indexOf(kwLow, idx + 1);
        }
      }
    }
  }

  suggestions.sort((a, b) => a.start - b.start);
  return suggestions;
}

function showBdSuggestPanel() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const { rawText: text, tags = [] } = bd;

  const all = detectBreakdownSuggestions(text, tags);
  _bdSuggestions = all;
  _bdSuggestSelected = new Set(all.map(s => s.id));

  if (!all.length) {
    const m = document.createElement('div');
    m.id = 'bd-suggest-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center';
    m.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px 36px;max-width:400px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px">✓</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:8px">Nothing new found</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:20px">All detected elements are already tagged, or no recognisable elements were found in the script.</div>
      <button class="btn btn-sm" onclick="closeBdSuggestModal()">Close</button>
    </div>`;
    document.body.appendChild(m);
    return;
  }

  const byCat = {};
  for (const s of all) (byCat[s.category] = byCat[s.category] || []).push(s);

  const catSections = BREAKDOWN_CATEGORIES.filter(c => byCat[c.id]).map(cat => {
    const items = byCat[cat.id];
    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="background:${cat.color};color:${cat.textColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${cat.label}</span>
        <span style="font-size:11px;color:var(--text3)">${items.length} suggestion${items.length!==1?'s':''}</span>
        <button onclick="toggleBdCatSuggestions('${cat.id}',true)" style="background:none;border:none;color:var(--accent);font-size:10px;cursor:pointer;padding:0 4px">All</button>
        <button onclick="toggleBdCatSuggestions('${cat.id}',false)" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer;padding:0 4px">None</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${items.map(s => `<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;background:var(--surface2);border:1px solid var(--border)" onmouseenter="_bdShowSugTooltip(this,'${s.id}')" onmouseleave="_bdHideSugTooltip()">
          <input type="checkbox" id="sug_cb_${s.id}" checked onchange="toggleBdSuggestion('${s.id}',this.checked)" style="cursor:pointer;accent-color:${cat.color};flex-shrink:0">
          <span style="font-size:12px;font-family:'Courier New',monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.text}</span>
          <span style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;flex-shrink:0" title="${s.sceneHeading}">${s.sceneHeading}</span>
        </label>`).join('')}
      </div>
    </div>`;
  }).join('');

  const existing = document.getElementById('bd-suggest-modal');
  if (existing) existing.remove();

  const m = document.createElement('div');
  m.id = 'bd-suggest-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center';
  m.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(640px,92vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0">
        <div>
          <div style="font-size:15px;font-weight:700">✦ Auto-suggest Tags</div>
          <div id="bd-sug-count" style="font-size:11px;color:var(--text3);margin-top:3px">${all.length} suggestion${all.length!==1?'s':''} found — deselect any you don't want</div>
        </div>
        <button onclick="closeBdSuggestModal()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0 0 0 16px;line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;padding:16px 20px;flex:1">${catSections}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <button onclick="toggleAllBdSuggestions(true)" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:0">Select all</button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" style="opacity:0.7" onclick="closeBdSuggestModal()">Cancel</button>
          <button class="btn btn-sm" id="bd-sug-apply-btn" onclick="applySelectedBdSuggestions()">Apply ${all.length} Tag${all.length!==1?'s':''}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
}

function toggleBdSuggestion(id, checked) {
  checked ? _bdSuggestSelected.add(id) : _bdSuggestSelected.delete(id);
  updateBdSuggestCount();
}

function toggleBdCatSuggestions(catId, checked) {
  for (const s of _bdSuggestions) {
    if (s.category !== catId) continue;
    checked ? _bdSuggestSelected.add(s.id) : _bdSuggestSelected.delete(s.id);
    const cb = document.getElementById(`sug_cb_${s.id}`);
    if (cb) cb.checked = checked;
  }
  updateBdSuggestCount();
}

function toggleAllBdSuggestions(checked) {
  for (const s of _bdSuggestions) {
    checked ? _bdSuggestSelected.add(s.id) : _bdSuggestSelected.delete(s.id);
    const cb = document.getElementById(`sug_cb_${s.id}`);
    if (cb) cb.checked = checked;
  }
  updateBdSuggestCount();
}

function updateBdSuggestCount() {
  const n = _bdSuggestSelected.size;
  const countEl = document.getElementById('bd-sug-count');
  const btnEl   = document.getElementById('bd-sug-apply-btn');
  if (countEl) countEl.textContent = `${n} of ${_bdSuggestions.length} selected`;
  if (btnEl)   btnEl.textContent   = `Apply ${n} Tag${n!==1?'s':''}`;
}

function closeBdSuggestModal() {
  const m = document.getElementById('bd-suggest-modal');
  if (m) m.remove();
  const tip = document.getElementById('bd-sug-tip');
  if (tip) tip.remove();
}

function _bdSuggestContext(text, start, end) {
  const lines = text.split('\n');
  let offset = 0, targetLine = -1;
  const lineOffsets = [];
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(offset);
    if (targetLine === -1 && offset + lines[i].length >= start) targetLine = i;
    offset += lines[i].length + 1;
  }
  if (targetLine === -1) return '';
  const from = Math.max(0, targetLine - 1);
  const to   = Math.min(lines.length - 1, targetLine + 1);
  const contextStart = lineOffsets[from];
  const contextText  = lines.slice(from, to + 1).join('\n');
  const rel0 = start - contextStart, rel1 = end - contextStart;
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (rel0 < 0 || rel1 > contextText.length) return esc(contextText);
  return esc(contextText.slice(0, rel0)) +
    '<mark style="background:rgba(255,200,50,0.32);color:inherit;border-radius:2px;padding:0 1px">' +
    esc(contextText.slice(rel0, rel1)) +
    '</mark>' +
    esc(contextText.slice(rel1));
}

function _bdShowSugTooltip(el, sugId) {
  const s = _bdSuggestions.find(x => x.id === sugId);
  if (!s) return;
  const bd = _getActiveBd(currentProject());
  if (!bd?.rawText) return;
  let tip = document.getElementById('bd-sug-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'bd-sug-tip';
    tip.style.cssText = 'position:fixed;z-index:9300;background:#16161f;border:1px solid rgba(255,255,255,0.13);border-radius:7px;padding:9px 12px;font-family:"Courier New",monospace;font-size:11px;line-height:1.75;white-space:pre-wrap;max-width:380px;word-break:break-word;box-shadow:0 4px 22px rgba(0,0,0,0.75);pointer-events:none;color:var(--text)';
    document.body.appendChild(tip);
  }
  tip.innerHTML = _bdSuggestContext(bd.rawText, s.start, s.end);
  tip.style.display = 'block';
  const modal = document.getElementById('bd-suggest-modal')?.firstElementChild;
  const elRect = el.getBoundingClientRect();
  const tipW = 380;
  if (modal) {
    const mr = modal.getBoundingClientRect();
    tip.style.left = (window.innerWidth - mr.right > tipW + 16)
      ? (mr.right + 10) + 'px'
      : Math.max(8, mr.left - tipW - 10) + 'px';
  } else {
    tip.style.left = '8px';
  }
  const tipH = tip.offsetHeight || 80;
  const top = Math.max(8, Math.min(window.innerHeight - tipH - 8,
    elRect.top + elRect.height / 2 - tipH / 2));
  tip.style.top = top + 'px';
}

function _bdHideSugTooltip() {
  const tip = document.getElementById('bd-sug-tip');
  if (tip) tip.style.display = 'none';
}

function applySelectedBdSuggestions() {
  const p = currentProject();
  if (!p) return;
  const toApply = _bdSuggestions.filter(s => _bdSuggestSelected.has(s.id));
  if (!toApply.length) { closeBdSuggestModal(); return; }
  const bd = _getActiveBd(p);
  if (!bd) { closeBdSuggestModal(); return; }
  if (!bd.tags) bd.tags = [];
  for (const s of toApply) {
    bd.tags.push({ id: 'tag_' + Date.now() + '_' + Math.random().toString(36).slice(2), category: s.category, start: s.start, end: s.end });
  }
  saveStore();
  closeBdSuggestModal();
  const sv = document.getElementById('bd-script-view');
  if (sv) { const st = sv.scrollTop; sv.innerHTML = buildBreakdownHtml(bd.rawText, bd.tags); sv.scrollTop = st; }
  const rp = document.getElementById('bd-report');
  if (rp) rp.innerHTML = renderBreakdownReport(p);
  const ct = document.querySelector('[data-bd-counter]');
  if (ct) { const sc = parseBreakdownScenes(bd.rawText).length; const n = bd.tags.length; ct.textContent = sc+' scene'+(sc!==1?'s':'')+' · '+n+' tag'+(n!==1?'s':''); }
}

