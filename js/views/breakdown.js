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

// Export a single prop from breakdown to props section
function _bdExportProp(propName) {
  const p = currentProject();
  if (!p.props) p.props = [];
  // Check if prop already exists (case-insensitive)
  if (p.props.some(pr => (pr.name || '').toLowerCase() === propName.toLowerCase())) {
    return false;
  }
  p.props.push({
    name: propName,
    qty: 1,
    chars: '',
    scenes: '',
    locs: '',
    pgs: '',
    notes: ''
  });
  return true;
}

// Export all props from breakdown to Props section (manual export button)
function importBdPropsToSection() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const text = bd.rawText;
  const tags = bd.tags || [];
  const propItems = [...new Set(tags.filter(t => t.category === 'props').map(t => text.slice(t.start, t.end).trim()).filter(Boolean))];
  if (!propItems.length) { showToast('No props tagged in breakdown yet', 'info'); return; }
  if (!p.props) p.props = [];
  let added = 0;
  for (const prop of propItems) {
    if (_bdExportProp(prop)) {
      added++;
    }
  }
  if (!added) { showToast('All tagged props already in Props section', 'info'); return; }
  saveStore();
  showToast(`${added} prop${added !== 1 ? 's' : ''} added to Props section`, 'success');
}

// Auto-export prop when tagged in breakdown
// CHANGE [4]: Added `silent` parameter — when true, suppresses the individual toast.
// Used during bulk apply (applySelectedBdSuggestions) to avoid toast flooding.
function _bdAutoExportProp(tagText, bd, silent = false) {
  const text = bd.rawText;
  const propName = text.slice(tagText.start, tagText.end).trim();
  if (!propName) return;
  const added = _bdExportProp(propName);
  if (added && !silent) {
    saveStore();
    showToast(`Prop "${propName}" added to Props section`, 'success');
  }
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
  const el = document.getElementById('stripboard-content');
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
  const ext     = (s.origExt || s.name.toLowerCase().split('.').pop() || 'txt');

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
  if (ext === 'pdf' || (s.type && s.type.includes('pdf'))) {
    showToast('Reading PDF for breakdown…', 'info');
    try {
      const res  = await fetch(s.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], s.name, { type: s.type || 'application/pdf' });
      
      // For large files, warn user and set a longer timeout
      if (file.size > 1024 * 1024) {
        showToast('Processing large PDF - please wait…', 'info');
      }
      
      // Use timeout for large files
      const timeoutMs = file.size > 5 * 1024 * 1024 ? 120000 : 60000; // 2 min for files >5MB, 1 min otherwise
      
      try {
        await Promise.race([
          _extractTextForBreakdown(p, file, name, version, scriptId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PDF processing timed out - file may be too large or complex')), timeoutMs))
        ]);
      } catch (timeoutError) {
        showToast('PDF processing is taking too long. Try using a smaller file or converting to text format.', 'error');
        return;
      }
      
      showSection('breakdown');
    } catch(e) {
      showToast('Could not read PDF: ' + e.message, 'error');
    }
    return;
  }

  // Text-based formats: decode base64 or use text property
  let text = '';
  if (s.dataUrl) {
    try {
      const b64 = s.dataUrl.split(',')[1];
      text = decodeURIComponent(escape(atob(b64)));
    } catch(e) {
      try { text = atob(s.dataUrl.split(',')[1]); } catch(e2) { text = ''; }
    }
  } else if (s.text) {
    text = s.text;
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

        <button class="btn btn-sm" onclick="viewBreakdownReport()">⊞ View Report</button>
        <button class="btn btn-sm" onclick="_triggerHandoffCheck()" title="Add tagged items to project sections">+ Add to Project</button>
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
      <div onclick="scrollBreakdownToScene(${scene.start}); event.preventDefault()" style="background:var(--surface2);padding:6px 10px;font-size:11px;font-weight:700;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:5px" title="Jump to scene in script">
        <span style="opacity:0.5;font-size:10px">↗</span>${esc(scene.heading)}<span style="margin-left:auto;display:flex;align-items:center;gap:6px">${typeof _sbSceneBadge === 'function' ? _sbSceneBadge(p, scene.heading) : ''}<span style="font-size:10px;color:#E5C07B;font-weight:600">${pageLen} pgs</span></span>
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
  if (!heading) {
    console.warn('Scene heading not found for sceneStart:', sceneStart);
    return;
  }
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

// Helper to check if a cast tag already exists in the same scene
function _isCastTagDuplicate(bd, start, end, excludeTagId = null) {
  if (!bd.rawText || !bd.tags) return false;
  const scenes = parseBreakdownScenes(bd.rawText);
  const newTagText = bd.rawText.slice(start, end).trim().toLowerCase();
  if (!newTagText) return false;
  
  // Find which scene this tag belongs to
  const scene = scenes.find(s => start >= s.start && start < s.end);
  if (!scene) return false;
  
  // Check all existing cast tags in the same scene
  const existingCastTags = bd.tags.filter(t => 
    t.category === 'cast' && 
    t.id !== excludeTagId &&
    t.start >= scene.start && 
    t.start < scene.end
  );
  
  for (const tag of existingCastTags) {
    const existingText = bd.rawText.slice(tag.start, tag.end).trim().toLowerCase();
    if (existingText === newTagText) {
      return true;
    }
  }
  return false;
}

function executeTagAction(tagId, action, toCategory) {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd) return;
  const tag = bd.tags.find(t => t.id === tagId);
  if (!tag) { hideBdPopover(); return; }
  if (action === 'move') {
    // Check for duplicate cast tag when moving to cast category
    if (toCategory === 'cast' && _isCastTagDuplicate(bd, tag.start, tag.end, tag.id)) {
      showToast('This cast member is already tagged in this scene', 'error');
      return;
    }
    tag.category = toCategory;
    if (toCategory === 'props') {
      _bdAutoExportProp(tag, bd);
    }
  } else if (action === 'add') {
    // Check for duplicate cast tag when adding as cast
    if (toCategory === 'cast' && _isCastTagDuplicate(bd, tag.start, tag.end)) {
      showToast('This cast member is already tagged in this scene', 'error');
      return;
    }
    const newTag = { id: makeId(), category: toCategory, start: tag.start, end: tag.end };
    bd.tags.push(newTag);
    if (toCategory === 'props') {
      _bdAutoExportProp(newTag, bd);
    }
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
  
  // Check for duplicate cast tag when adding a cast tag
  if (category === 'cast' && _isCastTagDuplicate(bd, start, end)) {
    showToast('This cast member is already tagged in this scene', 'error');
    window.getSelection()?.removeAllRanges();
    hideBdPopover();
    return;
  }
  
  const newTag = { id: makeId(), category, start, end };
  bd.tags.push(newTag);
  if (category === 'props') {
    _bdAutoExportProp(newTag, bd);
  }
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
      // For large files, show progress
      if (file.size > 1024 * 1024) {
        showToast('Processing large PDF (this may take a while)…', 'info');
      }
      const arrayBuffer = await file.arrayBuffer();
      if (file.size > 1024 * 1024) {
        showToast('Extracting text from PDF…', 'info');
      }
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      let hasTextContent = false;
      for (let i = 1; i <= pdf.numPages; i++) {
        // Show progress every 10 pages for large PDFs
        if (file.size > 1024 * 1024 && i % 10 === 0) {
          showToast(`Processing page ${i} of ${pdf.numPages}…`, 'info');
        }
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Check if this page has any text content (indicates not a scanned doc)
        if (content.items && content.items.length > 0) {
          hasTextContent = true;
        }
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
      // If no text content found at all, it's likely a scanned document
      if (!hasTextContent) {
        showToast('This PDF appears to be a scanned document (no text layer found). The breakdown tool requires PDFs with selectable text. Please convert to a text-based PDF or use a plain text file (.fountain, .fdx, .txt).', 'error', true);
        return;
      }
      if (!text.trim()) {
        showToast('No text could be extracted from this PDF. It may be a scanned document or image-only PDF.', 'error');
        return;
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
    printBreakdownReport();
    return;
  }
  
  if (format === 'html') {
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

// CHANGE [3]: Dialogue coverage safety valve.
// If detected dialogue ranges cover more than 40% of the script, the heuristic
// has likely misfired (e.g. inconsistent indentation in a pasted PDF). In that
// case we fall back to an empty range set, which means nothing is suppressed —
// a false positive tag is less harmful than silently killing half the suggestions.
function _bdSafeDialogueRanges(text) {
  const ranges = _bdDialogueRanges(text);
  if (!ranges.length || !text.length) return ranges;
  const covered = ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
  if (covered / text.length > 0.4) {
    console.warn('[BF Breakdown] Dialogue range coverage', (covered / text.length * 100).toFixed(1) + '%', '> 40% — disabling dialogue suppression for this script');
    return [];
  }
  return ranges;
}

function detectBreakdownSuggestions(text, existingTags) {
  if (!text) return [];
  const suggestions = [];
  const scenes = parseBreakdownScenes(text);
  const isTagged = (start, end, cat) => {
    const suggestionText = text.slice(start, end).trim().toLowerCase();
    return (existingTags || []).some(t => {
      if (t.category !== cat) return false;
      // Exact offset match
      if (t.start === start && t.end === end) return true;
      // Same text content anywhere in the script (catches all occurrences)
      const taggedText = text.slice(t.start, t.end).trim().toLowerCase();
      return taggedText === suggestionText;
    });
  };

  const wordBoundary = (str, idx, len) => {
    const before = idx > 0 ? str[idx - 1] : ' ';
    const after  = idx + len < str.length ? str[idx + len] : ' ';
    // Block if preceded or followed by a letter/digit,
    // AND block if followed by any apostrophe variant or hyphen
    // (catches DON'T, DON\u2019T, DON\u02bcT, DON-KEY etc.)
    return !/[a-z0-9]/i.test(before) && !/[a-z0-9'\u2018\u2019\u02bc\u02b9-]/i.test(after);
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
    // CHANGE [1a]: Additional short all-caps words commonly misread as character names
    'HOLD','FREEZE','STOP','WAIT','LOOK','MOVE','STAY','COME','TURN',
    'RUN','GET','GO','YES','NO','OK','HEY',
  ]);
  // Group-indicator words → Extras rather than Cast
  const groupWords = new Set(['ARTISTS','PEOPLE','CROWD','GROUP','OFFICERS','SOLDIERS','GUARDS','EXTRAS','AUDIENCE','SPECTATORS','MEMBERS','STUDENTS','WORKERS','PATRONS','GUESTS','BYSTANDERS','PEDESTRIANS','ONLOOKERS']);
  const charCategory = name => name.split(/\s+/).some(w => groupWords.has(w)) ? 'extras' : 'cast';

  const isValidName = s =>
    s.length >= 2 && s.length <= 35
    && validNameRe.test(s)
    && s.split(/\s+/).length <= 3
    && !nonCharWords.has(s);

  // CHANGE [3]: Use safety-valve dialogue ranges
  const dialogueRanges = _bdSafeDialogueRanges(text);

  // Precompute scene heading ranges — nothing should be tagged inside a heading
  const headingRanges = scenes.map(s => [s.start, s.start + s.heading.length]);
  const inHeading = (pos, end) => headingRanges.some(([hs, he]) => pos < he && end > hs);

  // Pass A: standalone character cue lines (speakers)
  const charNames = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || sceneHeadingRe.test(trimmed) || transitionRe.test(trimmed)) continue;
    const stripped = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (isValidName(stripped)) charNames.add(stripped);
  }

  // Pass B: ALL-CAPS words/phrases inside *mixed-case* action lines (non-speaking characters e.g. BARTENDER)
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

  // CHANGE [1]: Soft recurrence filter.
  // Short names (≤4 chars) are more likely to be direction shorthand slipping through,
  // so we require them to appear at least twice across the whole script before suggesting.
  // Longer names (5+ chars) are trusted on a single occurrence (one-scene characters are valid).
  const textLower = text.toLowerCase();
  const nameOccurrences = name => {
    const nl = name.toLowerCase();
    let count = 0, idx = 0;
    while ((idx = textLower.indexOf(nl, idx)) !== -1) { count++; idx += nl.length; }
    return count;
  };
  const filteredCharNames = [...charNames].filter(name =>
    name.length >= 5 || nameOccurrences(name) >= 2
  );

  // Process longest names first per scene so "MIME ARTISTS" claims its position before "MIME" can.
  const sortedNames = filteredCharNames.sort((a, b) => b.length - a.length);
  for (const scene of scenes) {
    const st = text.slice(scene.start, scene.end).toLowerCase();
    const usedRanges = [];
    const suggestedNames = { cast: new Set(), extras: new Set() };
    for (const name of sortedNames) {
      const cat = charCategory(name);
      if (suggestedNames[cat].has(name)) continue;
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
        suggestedNames[cat].add(name);
        suggestions.push({ id: 's_' + Math.random().toString(36).slice(2), category: cat, text: text.slice(best, end), start: best, end, sceneHeading: scene.heading,
          // CHANGE [2]: confidence field — used in suggest panel to pre-check/uncheck
          confidence: 'high' });
      }
    }
  }

  // ── 2. Keyword matching ─────────────────────────────────────────────────────
  // CHANGE [5]: Pre-compile one regex per category rather than iterating keyword-by-keyword.
  // Each keyword is escaped and joined into a single alternation, longest first so that
  // multi-word phrases match before their component words can.
  // CHANGE [2]: Keywords split into high/medium confidence tiers.
  //   high   — specific, unambiguous terms unlikely to be noise
  //   medium — short/common words that may fire on almost any script
  const BD_SUGGEST_KEYWORDS_HIGH = {
    cast:        ['man with a gun','woman with a gun','man with a knife','woman with a knife','kid with a gun','boy with a gun','girl with a gun','man in suit','woman in dress','man in coat','woman in coat','police officer','detective','detective with badge','doctor','nurse','waiter','bartender','waitress'],
    extras:      ['background artists','passersby','pedestrians','bystanders','spectators','onlookers','commuters','congregation'],
    stunts:      ['car chase','gun fight','fist fight','hand to hand','shootout','gunfight','fistfight','brawl','combat','struggle','wrestle','tackle','stunt','chase','fight'],
    props:       ['mobile phone','police badge','id card','gun holster','wedding ring','debit card','credit card','wine glass','shot glass','wine bottle','cigarette pack','briefcase','suitcase','backpack','flashlight','handcuffs','cigarette','newspaper','document','passport','crowbar','lockpick','syringe','camera','lighter','wallet','laptop','tablet','acorn','action figure','air conditioner','air purifier','amulet','anklet','armor','arrowhead','ashtray','automaton','baby carriage','backpack','backsaw','bag','balloon','ball','bamboo stick','bangle','bar stool','bar','baseball bat & cricket bat','baseball cap','basket','bath mat','battery','bead','bean bag','beauty supply','bedding','bed','beehive','bell','belt buckle','bench','beverage','bicycle','bike','binder clip','binder','binocular','birdhouse','blanket & comforter','board game','boat','bobsled','bolt cutter','bookcase','bookend','bookmark','book','bottle cap','bottle opener','bottle','bowl & dish','bracelet','brochure','brooch','broom','bucket','bullet train','bunk bed','buoy','bus','button','cd player','cd','cabinet','cable car','calendar','calligraphy','camera','candlestick','cane','canoe','caravan','card','carpenter\'s square','car','cart','carving','cash & payment card','cassette tape','ceramic','chainsaw','chair','chalkboard','champagne glass','chandelier','charm bracelet','chess set','chest of drawers & dresser','chest','chisel','clamp','clipboard','clock','clothesline','clothing','coaster','coat rack','coffee maker','coffee table','coffeepot','coin bank','coin','colored pencil','comb & hairbrush','comic book','compass','coral fragment','cord','corkscrew','cosmetic','costume','cowboy boot','cowboy hat','crayon','crib & cradle','crown','crystal','cufflink','cutlery','cutting board','dvd player','dart','data storage device','decanter','decoy','desk','desktop computer','diamond','dining table','dinosaur bone','divider','dollhouse','doll','doorbell','doorstop','driftwood','drill & drill bit','drone','earring','electric bike','envelope','eraser','extension cord','fan','fashion accessory','feather','ferry','figurine','file','filing cabinet','fire detector','fire extinguisher','firewood','fishing rod','fishing tackle','flag','flashlight','flask','flint','flower vase','flower','folder','footwear','forklift','fossil','fridge magnet','furniture','futon','game & card','gaming console','garden shear','gem','geode','glass & mug','glass & sunglass','glider','globe','glove','glue stick','goblet','goggle','guitar pick','hacksaw','hailstone','hairband','hairpin','hammer','hammock','hand fan','handbag','handsaw','hanger','hard hat','hat','hay bale','headphone & earphone','heater','helicopter','helmet','highlighter','hopper','horseshoe','hose','hot air balloon','humidifier & dehumidifier','icicle','jet aircraft','journal & planner','jump rope','kettle','key chain','keyboard','kimono','kitchen cabinet','kitchen shear','kitchen table','kite','ladder','ladle','lamp','lantern','lapel pin','laptop','laundry hamper','lava rock','lawn mower','leaf','letter opener','level','lifejacket','light bulb','lighter','light','locket','lock','log','loveseat','luggage','magazine','mail','mailbox','mallet','map','marble','marker','mask','match book','match','mat','mechanical pencil','meteorite','microphone','microscope','mirror','model train','monitor','monorail','moped','motorcycle','music box','nail & screw','necklace','nest','net','newspaper','nightstand','nose ring','notebook','notepad','nutcracker','office chair','paddle','paint palette','painting','paper','paper clip','paperweight','pastel','pebble','pencil case','pencil sharpener','pencil','pendant','pen','perfume bottle','phonograph & gramophone','picture frame','piggy bank','pillow cover','pillow','pine needle','pinecone','pin','pitchfork','pizza pan','plate','pliers','plunger','pocket watch','pocketknife','pole','postcard','poster','pot & pan','pottery','printer & 3d printer','projector','protractor','pry bar','puck','punch bowl','puppet','purse','puzzle','quilt','racquet','radio','raft','rain barrel','raincoat','rake','recycling box','remote control','ribbon','rickshaw','ring','robot','rocket','rocking chair','rock','rope','rowboat','rubber band','rug','ruler','saddle','safe','sailboat','sail','salt & pepper shaker','satellite','scale','scissor','scooter','screwdriver','sculpture','seal stamp','seashell','security camera','sensor','sewing machine','sheet','shelf','shelving','ship','shovel','shower curtain','sign','skateboard','skate','sketchbook','ski','sledgehammer','sled','sleeping bag','smart speaker','smartphone','smartwatch','smoke detector','snack','snowflake','snowmobile','snowshoe','sofa','spaceship','spade','spatula','speaker','spinning top','spittoon','spoon','stamp','stapler','statue','stein','stencil','stepladder','stereo system','sticker','stick','stirrup','stool','stove','straw hat','streaming device','stuffed animal','submarine','suitcase','surfboard','swimwear','tv','table','tablet','tack & push pin','tape','tape measure','tapestry','tea towel','teapot','telescope','tent','thermometer','thermostat','thimble','throw pillow','tiara','tie clip','tie','timer','toaster','tongs','toolbox','towel','tractor','trading card','train set','train','trampoline','tram','trash can','tricycle','trowel','truck','trunk','turntable & record player','tweezers','twig','typewriter','umbrella stand','umbrella','unicycle','uniform','utensil','vacuum cleaner','vase','video game cartridge','vine','vinyl record','wagon','walkie-talkie','wallet','wardrobe','watch','water bottle','weather instrument','weather vane','welcome mat','wetsuit','wheelbarrow','whistle','wifi router','wine glass','wood stove','woodcraft','workbench','wristband','yo-yo'],
    vehicles:    ['pickup truck','police car','fire truck','limousine','motorcycle','motorbike','helicopter','submarine','aircraft','bicycle','chopper','forklift','tractor','convertible','ambulance','sports car'],
    sfx:         ['explosion','explodes','detonation','gunfire','gunshot','lightning','thunder','collision','blast','smoke','crash','alarm','siren'],
    wardrobe:    ['wedding dress','tuxedo','uniform','disguise','costume','armour','jacket','helmet','gloves','armor','dress','coat','robe','vest'],
    makeup:      ['face paint','black eye','greasepaint','aged makeup','prosthetic','prosthesis','bleeding','bruised','injured','wounded'],
    setdressing: ['bookshelf','whiteboard','chalkboard','curtains','painting','portrait','cabinet','trophy'],
    vfx:         ['force field','laser beam','materializes','hologram','invisible','teleports','digital screen','morphs','transforms','glows','portal','cgi'],
    animals:     ['gorilla','elephant','parrot','chicken','rabbit','monkey','snake','horse','tiger','bear','wolf','deer','duck'],
    sound:       ['phone rings','on the radio','voiceover','ringtone','doorbell','narration','singing','melody'],
  };
  const BD_SUGGEST_KEYWORDS_MEDIUM = {
    extras:      ['crowd','extras','audience','mob'],
    stunts:      ['punch','kick','leap','dive','roll'],
    props:       ['bottle','letter','radio','flask','badge','torch','money','chain','photo','knife','rope','book','cash','axe','key','bag','bat','map','glass','wine'],
    vehicles:    ['train','truck','plane','yacht','boat','ship','taxi','limo','jeep','bus','van','suv','cab','jet','car'],
    sfx:         ['storm','flood','fire'],
    wardrobe:    ['mask','suit','hat','cap'],
    makeup:      ['blood','bruise','wound','scar','burn'],
    setdressing: ['mirror','table','couch','clock','sofa','desk','lamp','safe','bed'],
    vfx:         [],
    animals:     ['bird','fish','lion','fox','dog','cat','rat','pig','cow'],
    sound:       ['music','song','v.o.','o.s.'],
  };

  // Helper: escape a keyword for use in a regex
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Build compiled regex maps — longest keywords first within each category so phrases
  // match before their component words.
  const _buildCatRegex = kwMap => {
    const out = {};
    for (const [cat, kws] of Object.entries(kwMap)) {
      if (!kws.length) { out[cat] = null; continue; }
      const sorted = [...kws].sort((a, b) => b.length - a.length);
      const expanded = [];
      for (const kw of sorted) {
        expanded.push(reEsc(kw));
        // Add plural form if not already ending with s
        if (!kw.endsWith('s')) {
          expanded.push(reEsc(kw + 's'));
        }
      }
      out[cat] = new RegExp('(?<![a-z0-9])(' + expanded.join('|') + ')(?![a-z0-9])', 'gi');
    }
    return out;
  };
  const highRegexes   = _buildCatRegex(BD_SUGGEST_KEYWORDS_HIGH);
  const mediumRegexes = _buildCatRegex(BD_SUGGEST_KEYWORDS_MEDIUM);

  const claimed = []; // prevent double-counting overlapping matches within same scene (any category)

  const _runKeywordRegex = (cat, re, confidence) => {
    if (!re) return;
    for (const scene of scenes) {
      const sceneText = text.slice(scene.start, scene.end);
      re.lastIndex = 0;
      const sceneClaimed = []; // track claimed ranges within this scene
      const suggestedTexts = new Set(); // track suggested texts to prevent duplicates
      let m;
      while ((m = re.exec(sceneText)) !== null) {
        const idx    = m.index;
        const kwText = m[0].toLowerCase();
        const end    = idx + kwText.length;
        // Skip if any part of this match overlaps with already-claimed text in this scene
        if (sceneClaimed.some(r => r.start < end && r.end > idx)) continue;
        const absStart = scene.start + idx;
        const absEnd   = absStart + m[0].length;
        const matchedText = text.slice(absStart, absEnd).trim().toLowerCase();
        // Skip if this normalised text has already been suggested in this scene
        if (suggestedTexts.has(matchedText)) continue;
        if (!isTagged(absStart, absEnd, cat)
             && !_bdInDialogue(absStart, absEnd, dialogueRanges)
             && !inHeading(absStart, absEnd)) {
          sceneClaimed.push({text: kwText, start: idx, end, category: cat});
          suggestedTexts.add(matchedText);
          suggestions.push({
            id: 's_' + Math.random().toString(36).slice(2),
            category: cat,
            text: text.slice(absStart, absEnd),
            start: absStart,
            end: absEnd,
            sceneHeading: scene.heading,
            confidence,
          });
        }
      }
    }
  };

  for (const cat of Object.keys(BD_SUGGEST_KEYWORDS_HIGH)) {
    _runKeywordRegex(cat, highRegexes[cat],   'high');
    _runKeywordRegex(cat, mediumRegexes[cat], 'medium');
  }

  suggestions.sort((a, b) => a.start - b.start);
  return suggestions;
}

// ── NLP ENRICHMENT (compromise) ────────────────────────────────────────────
// CHANGE [7]: Compromise-based noun phrase extraction to improve prop suggestions.
// Runs AFTER the keyword scan. Role is strictly to EXPAND existing vague keyword
// matches to their full noun phrase context — e.g. "bag" → "bag of cocaine".
// It does NOT invent new prop suggestions from scratch; the keyword list acts as
// the gate so we don't get hundreds of random nouns tagged as props.
// Gracefully falls back to keyword-only results if compromise isn't available.

// Relational head nouns that are not themselves physical objects.
// "end of the gun" should not be suggested — "end" is relational, "gun" is incidental.
const _BD_RELATIONAL_HEADS = new Set([
  'end','back','side','top','bottom','front','middle','inside','outside',
  'edge','corner','part','piece','bit','lot','rest','base','centre','center',
  'surface','area','section','half','length','width','height','size','number',
  'amount','kind','sort','type','pair','set','group','bunch','row','line',
]);

// Extract clean noun phrases from a single action line using compromise.
// Splits on conjunctions so "shot glass and a bottle" → ["shot glass","bottle"].
function _bdNlpExtractLine(line) {
  if (!window.nlp) return [];
  // Skip scene headings
  if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.)\s/i.test(line.trim())) return [];
  // Skip pure ALL-CAPS lines (character cues / direction headers)
  const letters = (line.match(/[a-zA-Z]/g) || []);
  const uppers  = (line.match(/[A-Z]/g) || []);
  if (letters.length > 3 && uppers.length / letters.length > 0.75) return [];

  try {
    const doc = window.nlp(line);
    const raw = doc.nouns()
      .not('#Pronoun')
      .not('#Person')
      .not('#Place')
      .json({ normal: true, terms: false })
      .map(n => (n.normal || '').trim().replace(/[.,!?;:''\u2018\u2019]+$/, '').trim())
      .filter(p => p && p.length >= 3);

    // Split any phrase that contains " and " or " or " into sub-phrases,
    // then strip leading articles from each
    const phrases = [];
    for (const p of raw) {
      const parts = p.split(/\s+(?:and|or)\s+/i);
      for (const part of parts) {
        const clean = part.replace(/^(the|a|an) /, '').trim();
        if (clean.length >= 3) phrases.push(clean);
      }
    }

    // Filter out phrases whose head noun (first word) is relational
    return phrases.filter(phrase => {
      const headWord = phrase.split(/\s+/)[0].toLowerCase();
      return !_BD_RELATIONAL_HEADS.has(headWord);
    });
  } catch(e) {
    return [];
  }
}

// Main enrichment function: called after detectBreakdownSuggestions.
// EXPANSION ONLY — finds existing keyword-matched prop suggestions and widens
// them to their full NLP noun phrase if the phrases overlap meaningfully.
function _bdEnrichWithNlp(suggestions, text, _unused, existingTags) {
  if (!window.nlp) return suggestions;

  // We only care about expanding existing prop suggestions
  const propSuggestions = suggestions.filter(s => s.category === 'props');
  if (!propSuggestions.length) return suggestions;

  // Build dialogue ranges so we don't expand into dialogue
  const dialogueRanges = _bdSafeDialogueRanges(text);

  const lines = text.split('\n');
  let offset = 0;

  for (const line of lines) {
    const lineEnd = offset + line.length;

    // Only process lines that contain at least one existing prop suggestion
    const lineProps = propSuggestions.filter(
      s => s.start >= offset && s.end <= lineEnd
    );

    if (lineProps.length) {
      const phrases = _bdNlpExtractLine(line);
      const lineLower = line.toLowerCase();

      for (const existing of lineProps) {
        const existingText = existing.text.toLowerCase().trim();

        // Find an NLP phrase that OVERLAPS with the keyword match:
        // either the phrase contains the keyword, or the keyword contains the phrase,
        // or they share a significant word. We prefer longer phrases.
        const expansion = phrases
          .filter(phrase => {
            if (phrase.length <= existingText.length) return false; // must be longer
            const phraseLower = phrase.toLowerCase();
            // Direct containment
            if (phraseLower.includes(existingText)) return true;
            if (existingText.includes(phraseLower)) return false; // phrase is subset, skip
            // Word overlap: any word from keyword appears in phrase
            const kwWords = existingText.split(/\s+/).filter(w => w.length > 2);
            return kwWords.some(w => phraseLower.includes(w));
          })
          .sort((a, b) => b.length - a.length)[0]; // prefer longest match

        if (!expansion) continue;

        // Find the expanded phrase's position in the original line
        const expansionLower = expansion.toLowerCase();
        const idx = lineLower.indexOf(expansionLower);
        if (idx === -1) continue;

        const newStart = offset + idx;
        const newEnd   = newStart + expansion.length;

        // Don't expand into dialogue or beyond line
        if (_bdInDialogue(newStart, newEnd, dialogueRanges)) continue;
        if (newStart < offset || newEnd > lineEnd) continue;

        // Apply the expansion
        existing.text       = text.slice(newStart, newEnd);
        existing.start      = newStart;
        existing.end        = newEnd;
        existing.confidence = 'high';
      }
    }

    offset += line.length + 1; // +1 for \n
  }

  return suggestions;
}

// CHANGE [8]: Community + personal keyword voting system
// ══════════════════════════════════════════════════════
// Votes are stored as: store.bdVotes["term:category"] = 1 (up) | -1 (down) | 0 (cleared)
// Community scores are fetched from a hosted JSON file (stub URL — wire up later).
// Local votes always override community scores for the individual user.

let _bdCommunityScores = null;    // fetched once per session, null = not yet loaded
let _bdCommunityFetching = false; // prevent duplicate fetches

// STUB: Replace this URL with your actual hosted community scores JSON.
// Format: { "cocaine:props": 47, "balloon:props": 31, "circus:props": -23 }
const BD_COMMUNITY_SCORES_URL = 'https://zeojevfruuqjhwycnnan.supabase.co';
const BD_SUPABASE_ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplb2pldmZydXVxamh3eWNubmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTI4MzEsImV4cCI6MjA4OTc2ODgzMX0.5_OPK0d_gwWgDzZ_dHwYjTQM_plftBr2XR14nzQoSh4';

// Thresholds for community promotion/suppression
const BD_COMMUNITY_PROMOTE_THRESHOLD  =  10; // net upvotes → high-confidence for everyone
const BD_COMMUNITY_SUPPRESS_THRESHOLD = -10; // net downvotes → hidden for everyone

function _bdGetVotes() {
  if (!store.bdVotes) store.bdVotes = {};
  return store.bdVotes;
}

function _bdVoteKey(text, category) {
  return `${text.toLowerCase().trim()}:${category}`;
}

// Get the current local vote for a term+category: 1, -1, or 0
function _bdGetLocalVote(text, category) {
  return _bdGetVotes()[_bdVoteKey(text, category)] || 0;
}

// Cast or toggle a local vote. Clicking the same direction again clears it.
function _bdVote(sugId, direction) {
  const s = _bdSuggestions.find(x => x.id === sugId);
  if (!s) return;
  const key      = _bdVoteKey(s.text, s.category);
  const votes    = _bdGetVotes();
  const prevVote = votes[key] || 0;
  const cat      = BREAKDOWN_CATEGORIES.find(c => c.id === s.category);
  const catLabel = cat ? cat.label : s.category;

  // Toggle: clicking same direction clears the vote
  const newVote = prevVote === direction ? 0 : direction;
  votes[key] = newVote;
  saveStore();

  // Re-render just this row
  const row = document.getElementById(`sug_row_${sugId}`);
  if (row) {
    const catObj = BREAKDOWN_CATEGORIES.find(c => c.id === s.category) || { color:'#aaa' };
    row.outerHTML = _bdRenderSuggestItem(s, catObj);
  }

  // Contextual toast
  if (newVote === -1) {
    showToast(`"${s.text}" won't be suggested to you again in ${catLabel}`, 'info');
  } else if (newVote === 1) {
    showToast(`"${s.text}" will always be suggested in ${catLabel} — thanks!`, 'success');
  } else {
    showToast(`Vote cleared for "${s.text}"`, 'info');
  }

  // Submit delta to community Supabase backend
  _bdSubmitCommunityVote(s.text, s.category, newVote, prevVote);
}

// ── VOTE QUEUE: batch + throttle community submissions ───────────────────────
// Votes accumulate in _bdVoteQueue (delta per key). Flushed:
//   a) 5 minutes after the first queued vote (debounced timer)
//   b) On page unload (beforeunload)
// Per-term throttle: skip submitting a term if it was last sent < 24h ago.
// This dramatically reduces Supabase Disk IO on the free tier.

const BD_VOTE_THROTTLE_MS  = 24 * 60 * 60 * 1000; // 24 hours per term
const BD_VOTE_FLUSH_DELAY  =  5 * 60 * 1000;       // flush queue after 5 min idle

let _bdVoteQueue   = {};   // { "term:category": delta } accumulated since last flush
let _bdFlushTimer  = null;

function _bdSubmitCommunityVote(text, category, newVote, previousVote) {
  if (!BD_COMMUNITY_SCORES_URL) return;
  const delta = newVote - (previousVote || 0);
  if (delta === 0) return;
  const key = `${text.toLowerCase().trim()}:${category}`;
  // Accumulate delta — if user votes then unvotes, net delta is 0 → nothing sent
  _bdVoteQueue[key] = (_bdVoteQueue[key] || 0) + delta;
  // Schedule a flush in 5 minutes (reset timer each vote)
  clearTimeout(_bdFlushTimer);
  _bdFlushTimer = setTimeout(_bdFlushVoteQueue, BD_VOTE_FLUSH_DELAY);
}

async function _bdFlushVoteQueue() {
  if (!BD_COMMUNITY_SCORES_URL) return;
  const queue = _bdVoteQueue;
  _bdVoteQueue = {};
  clearTimeout(_bdFlushTimer);
  _bdFlushTimer = null;
  if (!Object.keys(queue).length) return;

  // Per-term throttle: skip terms submitted too recently
  if (!store.bdVoteSubmitted) store.bdVoteSubmitted = {};
  const now      = Date.now();
  const toSend   = {};
  for (const [key, delta] of Object.entries(queue)) {
    if (delta === 0) continue; // net zero — skip
    const lastSent = store.bdVoteSubmitted[key] || 0;
    if (now - lastSent < BD_VOTE_THROTTLE_MS) continue; // throttled
    toSend[key] = delta;
  }
  if (!Object.keys(toSend).length) return;

  // Send one RPC call per unique term (still far fewer than one-per-click)
  const promises = Object.entries(toSend).map(([key, delta]) => {
    const [term, category] = key.split(':');
    return fetch(`${BD_COMMUNITY_SCORES_URL}/rest/v1/rpc/bd_cast_vote`, {
      method: 'POST',
      headers: {
        'apikey': BD_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${BD_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_term: term, p_category: category, p_delta: delta }),
    }).then(res => {
      if (res.ok) store.bdVoteSubmitted[key] = Date.now();
    }).catch(() => {
      // On failure, put back in queue for next flush
      _bdVoteQueue[key] = (_bdVoteQueue[key] || 0) + delta;
    });
  });
  await Promise.allSettled(promises);
  saveStore(); // persist bdVoteSubmitted timestamps
}

// Flush on page unload — sendBeacon for reliability
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (!BD_COMMUNITY_SCORES_URL || !Object.keys(_bdVoteQueue).length) return;
    if (!store.bdVoteSubmitted) store.bdVoteSubmitted = {};
    const now = Date.now();
    for (const [key, delta] of Object.entries(_bdVoteQueue)) {
      if (delta === 0) continue;
      const lastSent = store.bdVoteSubmitted[key] || 0;
      if (now - lastSent < BD_VOTE_THROTTLE_MS) continue;
      const [term, category] = key.split(':');
      const payload = JSON.stringify({ p_term: term, p_category: category, p_delta: delta });
      navigator.sendBeacon(
        `${BD_COMMUNITY_SCORES_URL}/rest/v1/rpc/bd_cast_vote`,
        new Blob([payload], { type: 'application/json' })
      );
    }
  });
}

// Fetch community scores once per session, merge into _bdCommunityScores
async function _bdLoadCommunityScores() {
  if (_bdCommunityScores !== null || _bdCommunityFetching) return;
  if (!BD_COMMUNITY_SCORES_URL) { _bdCommunityScores = {}; return; }
  _bdCommunityFetching = true;
  try {
    const res  = await fetch(
      `${BD_COMMUNITY_SCORES_URL}/rest/v1/bd_votes?select=term,category,score`,
      { headers: {
        'apikey': BD_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${BD_SUPABASE_ANON_KEY}`,
      }}
    );
    const rows = await res.json();
    // Convert array of {term, category, score} into flat key→score map
    _bdCommunityScores = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        _bdCommunityScores[`${row.term}:${row.category}`] = row.score;
      }
    }
  } catch(e) {
    _bdCommunityScores = {}; // silently fall back to empty
  }
  _bdCommunityFetching = false;
}

// Apply votes to a suggestions array:
// - Local downvote  → remove from list entirely (this user never sees it)
// - Local upvote    → promote to high confidence (pre-checked)
// - Community score below suppress threshold → remove for everyone
// - Community score above promote threshold  → promote to high confidence for everyone
function _bdApplyVotesToSuggestions(suggestions) {
  const votes     = store.bdVotes || {};
  const community = _bdCommunityScores || {};
  return suggestions.filter(s => {
    const key          = _bdVoteKey(s.text, s.category);
    const localVote    = votes[key] || 0;
    const communityScore = community[key] || 0;
    // Local downvote always suppresses for this user
    if (localVote === -1) return false;
    // Community suppression (enough users downvoted)
    if (communityScore <= BD_COMMUNITY_SUPPRESS_THRESHOLD) return false;
    // Promote if locally or community upvoted
    if (localVote === 1 || communityScore >= BD_COMMUNITY_PROMOTE_THRESHOLD) {
      s.confidence = 'high';
    }
    return true;
  });
}

// Render a single suggestion row with vote buttons
function _bdRenderSuggestItem(s, cat) {
  const isMedium  = s.confidence === 'medium';
  const isChecked = _bdSuggestSelected.has(s.id);
  const localVote = _bdGetLocalVote(s.text, s.category);
  const community = _bdCommunityScores || {};
  const commScore = community[_bdVoteKey(s.text, s.category)] || 0;
  const catLabel  = cat.label || s.category;

  const upActive   = localVote === 1;
  const downActive = localVote === -1;

  const upBtn = `<button
    onclick="event.stopPropagation();_bdVote('${s.id}',1)"
    title="${upActive ? 'Click to clear — currently always suggested' : `Always suggest "${s.text}" in ${catLabel}`}"
    style="background:${upActive ? 'rgba(95,196,96,0.18)' : 'none'};border:1px solid ${upActive ? '#5fc460' : 'rgba(95,196,96,0.25)'};border-radius:4px;cursor:pointer;padding:2px 6px;font-size:11px;color:${upActive ? '#5fc460' : 'rgba(95,196,96,0.45)'};line-height:1.4;flex-shrink:0"
    onmouseenter="this.style.borderColor='#5fc460';this.style.color='#5fc460';this.style.background='rgba(95,196,96,0.12)'"
    onmouseleave="this.style.borderColor='${upActive ? '#5fc460' : 'rgba(95,196,96,0.25)'}';this.style.color='${upActive ? '#5fc460' : 'rgba(95,196,96,0.45)'}';this.style.background='${upActive ? 'rgba(95,196,96,0.18)' : 'none'}'"
  >👍</button>`;

  const downBtn = `<button
    onclick="event.stopPropagation();_bdVote('${s.id}',-1)"
    title="${downActive ? 'Click to clear — currently never suggested' : `Never suggest "${s.text}" in ${catLabel} again`}"
    style="background:${downActive ? 'rgba(231,76,60,0.13)' : 'none'};border:1px solid ${downActive ? '#E74C3C' : 'rgba(231,76,60,0.25)'};border-radius:4px;cursor:pointer;padding:2px 6px;font-size:11px;color:${downActive ? '#E74C3C' : 'rgba(231,76,60,0.4)'};line-height:1.4;flex-shrink:0"
    onmouseenter="this.style.borderColor='#E74C3C';this.style.color='#E74C3C';this.style.background='rgba(231,76,60,0.1)'"
    onmouseleave="this.style.borderColor='${downActive ? '#E74C3C' : 'rgba(231,76,60,0.25)'}';this.style.color='${downActive ? '#E74C3C' : 'rgba(231,76,60,0.4)'}';this.style.background='${downActive ? 'rgba(231,76,60,0.13)' : 'none'}'"
  >👎</button>`;

  const commBadge = commScore !== 0
    ? `<span title="Community score" style="font-size:9px;color:${commScore>0?'#5fc460':'#E74C3C'};opacity:0.6;flex-shrink:0">${commScore>0?'+':''}${commScore}</span>`
    : '';

  return `<div id="sug_row_${s.id}" style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);${isMedium?'opacity:0.7':''}">
    <input type="checkbox" id="sug_cb_${s.id}" ${isChecked?'checked':''} onchange="toggleBdSuggestion('${s.id}',this.checked)" style="cursor:pointer;accent-color:${cat.color};flex-shrink:0">
    <span onmouseenter="_bdShowSugTooltip(this,'${s.id}')" onmouseleave="_bdHideSugTooltip()" style="font-size:12px;font-family:'Courier New',monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default">${s.text}</span>
    ${isMedium ? `<span style="font-size:9px;color:var(--text3);background:var(--surface3);border-radius:3px;padding:1px 4px;flex-shrink:0">common</span>` : ''}
    <span style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;flex-shrink:0" title="${s.sceneHeading}">${s.sceneHeading}</span>
    ${commBadge}
    <span style="display:flex;gap:3px;flex-shrink:0">${upBtn}${downBtn}</span>
  </div>`;
}
function _bdSuggestSceneStats(suggestions) {
  // Build a map: sceneHeading → { total, byCategory }
  const sceneMap = new Map();
  for (const s of suggestions) {
    if (!sceneMap.has(s.sceneHeading)) sceneMap.set(s.sceneHeading, { total: 0, cats: new Map() });
    const entry = sceneMap.get(s.sceneHeading);
    entry.total++;
    entry.cats.set(s.category, (entry.cats.get(s.category) || 0) + 1);
  }
  if (!sceneMap.size) return '';
  const rows = [...sceneMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5) // show top 5 busiest scenes
    .map(([heading, { total, cats }]) => {
      const catPills = [...cats.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([catId, count]) => {
          const cat = BREAKDOWN_CATEGORIES.find(c => c.id === catId);
          if (!cat) return '';
          return `<span style="background:${cat.color};color:${cat.textColor};border-radius:3px;padding:0 5px;font-size:9px;font-weight:700;white-space:nowrap">${count} ${cat.label}</span>`;
        }).join('');
      return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;color:var(--text3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${heading.replace(/"/g,'&quot;')}">${heading}</span>
        <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:flex-end">${catPills}</div>
      </div>`;
    }).join('');

  return `<details style="margin-top:8px;margin-bottom:2px">
    <summary style="font-size:10px;color:var(--accent);cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:4px">
      <span>▸</span><span>Scene breakdown (top ${Math.min(5, sceneMap.size)} by suggestion count)</span>
    </summary>
    <div style="margin-top:6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px">${rows}</div>
  </details>`;
}

function showBdSuggestPanel() {
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (!bd?.rawText) return;
  const { rawText: text, tags = [] } = bd;
  console.log('[BD Suggest] bdVotes at panel open:', JSON.stringify(store.bdVotes));

  let all = detectBreakdownSuggestions(text, tags);
  // CHANGE [7]: Enrich with compromise NLP — expands vague keyword matches to full noun phrases
  all = _bdEnrichWithNlp(all, text, null, tags);
  // CHANGE [8]: Load community scores (async, non-blocking) then apply local + community votes
  _bdLoadCommunityScores();
  all = _bdApplyVotesToSuggestions(all);
  const nlpActive = !!window.nlp;

  _bdSuggestions = all;
  // CHANGE [2]: Pre-check high confidence, leave medium unchecked by default
  _bdSuggestSelected = new Set(all.filter(s => s.confidence === 'high').map(s => s.id));

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

  const highCount   = all.filter(s => s.confidence === 'high').length;
  const mediumCount = all.filter(s => s.confidence === 'medium').length;

  const byCat = {};
  for (const s of all) (byCat[s.category] = byCat[s.category] || []).push(s);

  // CHANGE [2]: Render medium-confidence items with a distinct style and unchecked by default
  // CHANGE [8]: renderItem now delegates to _bdRenderSuggestItem which includes vote arrows
  const catSections = BREAKDOWN_CATEGORIES.filter(c => byCat[c.id]).map(cat => {
    const items = byCat[cat.id];
    const highItems   = items.filter(s => s.confidence === 'high');
    const mediumItems = items.filter(s => s.confidence === 'medium');

    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="background:${cat.color};color:${cat.textColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${cat.label}</span>
        <span style="font-size:11px;color:var(--text3)">${items.length} suggestion${items.length!==1?'s':''}</span>
        <button onclick="toggleBdCatSuggestions('${cat.id}',true)" style="background:none;border:none;color:var(--accent);font-size:10px;cursor:pointer;padding:0 4px">All</button>
        <button onclick="toggleBdCatSuggestions('${cat.id}',false)" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer;padding:0 4px">None</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${highItems.map(s => _bdRenderSuggestItem(s, cat)).join('')}
        ${mediumItems.length ? `
          <div style="font-size:9px;color:var(--text3);padding:4px 2px 2px;letter-spacing:0.04em;text-transform:uppercase">Common words — review carefully</div>
          ${mediumItems.map(s => _bdRenderSuggestItem(s, cat)).join('')}
        ` : ''}
      </div>
    </div>`;
  }).join('');

  // CHANGE [6]: Scene stats summary
  const sceneStatsHtml = _bdSuggestSceneStats(all);

  const existing = document.getElementById('bd-suggest-modal');
  if (existing) existing.remove();

  const selectedCount = _bdSuggestSelected.size;
  const m = document.createElement('div');
  m.id = 'bd-suggest-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center';
  m.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(640px,92vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:15px;font-weight:700">✦ Auto-suggest Tags</span>
            ${nlpActive ? `<span style="font-size:9px;font-weight:700;background:rgba(91,179,240,0.15);color:#5bb3f0;border:1px solid rgba(91,179,240,0.4);border-radius:4px;padding:1px 6px;letter-spacing:0.04em">NLP</span>` : ''}
          </div>
          <div id="bd-sug-count" style="font-size:11px;color:var(--text3);margin-top:3px">
            ${selectedCount} of ${all.length} selected
            ${mediumCount ? `<span style="margin-left:6px;font-size:10px;color:var(--text3);opacity:0.7">(${highCount} high confidence pre-checked · ${mediumCount} common words unchecked)</span>` : ''}
          </div>
          ${sceneStatsHtml}
        </div>
        <button onclick="closeBdSuggestModal()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0 0 0 16px;line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;padding:16px 20px;flex:1">${catSections}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <button onclick="toggleAllBdSuggestions(true)" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:0">Select all</button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" style="opacity:0.7" onclick="closeBdSuggestModal()">Cancel</button>
          <button class="btn btn-sm" id="bd-sug-apply-btn" onclick="applySelectedBdSuggestions()">Apply ${selectedCount} Tag${selectedCount!==1?'s':''}</button>
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
  if (countEl) {
    const highCount   = _bdSuggestions.filter(s => s.confidence === 'high').length;
    const mediumCount = _bdSuggestions.filter(s => s.confidence === 'medium').length;
    countEl.innerHTML = `${n} of ${_bdSuggestions.length} selected`
      + (mediumCount ? ` <span style="margin-left:6px;font-size:10px;color:var(--text3);opacity:0.7">(${highCount} high confidence · ${mediumCount} common words)</span>` : '');
  }
  if (btnEl) btnEl.textContent = `Apply ${n} Tag${n!==1?'s':''}`;
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

// CHANGE [4]: Batch prop export during bulk apply.
// Individual _bdAutoExportProp toasts are suppressed (silent=true); instead we
// collect the count and show one summary toast after all tags are applied.
function applySelectedBdSuggestions() {
  const p = currentProject();
  if (!p) return;
  const toApply = _bdSuggestions.filter(s => _bdSuggestSelected.has(s.id));
  if (!toApply.length) { closeBdSuggestModal(); return; }
  const bd = _getActiveBd(p);
  if (!bd) { closeBdSuggestModal(); return; }
  if (!bd.tags) bd.tags = [];

  let propsAdded = 0;
  for (const s of toApply) {
    // Check for duplicate cast tag when applying a cast tag
    if (s.category === 'cast' && _isCastTagDuplicate(bd, s.start, s.end)) {
      continue; // Skip this tag, it's a duplicate
    }
    const newTag = { id: 'tag_' + Date.now() + '_' + Math.random().toString(36).slice(2), category: s.category, start: s.start, end: s.end };
    bd.tags.push(newTag);
    // Prop export — silent during bulk, we'll show one summary toast below
    if (s.category === 'props') {
      const propName = (bd.rawText || '').slice(s.start, s.end).trim();
      if (propName && _bdExportProp(propName)) propsAdded++;
    }
  }

  saveStore();
  closeBdSuggestModal();

  const sv = document.getElementById('bd-script-view');
  if (sv) { const st = sv.scrollTop; sv.innerHTML = buildBreakdownHtml(bd.rawText, bd.tags); sv.scrollTop = st; }
  const rp = document.getElementById('bd-report');
  if (rp) rp.innerHTML = renderBreakdownReport(p);
  const ct = document.querySelector('[data-bd-counter]');
  if (ct) { const sc = parseBreakdownScenes(bd.rawText).length; const n = bd.tags.length; ct.textContent = sc+' scene'+(sc!==1?'s':'')+' · '+n+' tag'+(n!==1?'s':''); }

  // Single summary toast instead of one per prop
  if (propsAdded > 0) {
    showToast(`${toApply.length} tag${toApply.length!==1?'s':''} applied · ${propsAdded} prop${propsAdded!==1?'s':''} added to Props section`, 'success');
  } else {
    showToast(`${toApply.length} tag${toApply.length!==1?'s':''} applied`, 'success');
  }
}