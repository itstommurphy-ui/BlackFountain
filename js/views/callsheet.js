// ══════════════════════════════════════════
// CALLSHEET — FULL OVERHAUL
// Replaces js/views/callsheet.js entirely
// ══════════════════════════════════════════

// ── Data helpers ──────────────────────────────────────────────────────────────

function _csEscVal(v) {
  return (v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Normalise any time string to HH:mm (24-hour) for use in <input type="time">.
 * Handles: "09:30", "9:30 AM", "9:30 PM", "9:30am", "9:30PM", "930", "" etc.
 * Returns "" if unparseable.
 */
function _csTo24h(t) {
  if (!t) return '';
  t = String(t).trim();
  // Already HH:mm 24-hour
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  // H:mm 24-hour (no leading zero)
  if (/^\d:\d{2}$/.test(t)) return t.padStart(5, '0');
  // 12-hour with am/pm — e.g. "9:30 AM", "11:18 AM", "3:45PM"
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1]);
    const min = m12[2];
    const pm = m12[3].toLowerCase() === 'pm';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return String(h).padStart(2,'0') + ':' + min;
  }
  // 12-hour without colon — e.g. "930 AM"
  const m12b = t.match(/^(\d{3,4})\s*(am|pm)$/i);
  if (m12b) {
    const raw = m12b[1].padStart(4, '0');
    let h = parseInt(raw.slice(0,2));
    const min = raw.slice(2);
    const pm = m12b[2].toLowerCase() === 'pm';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return String(h).padStart(2,'0') + ':' + min;
  }
  // Plain digits like "0930"
  if (/^\d{3,4}$/.test(t)) {
    const padded = t.padStart(4,'0');
    return padded.slice(0,2) + ':' + padded.slice(2);
  }
  return '';
}

function _parseTimeToMins(t) {
  const norm = _csTo24h(t);
  if (!norm) return 0;
  const m = norm.match(/^(\d{2}):(\d{2})$/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

function _minsToTimeStr(m) {
  const h = Math.floor(m / 60) % 24;
  const min = ((m % 60) + 60) % 60;
  return String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0');
}

function _parseEstMins(val) {
  if (!val) return 0;
  val = String(val).trim().toLowerCase();
  if (/^\d+$/.test(val)) return parseInt(val);
  const hrMin = val.match(/(\d+)\s*h[^\d]*(\d+)/);
  if (hrMin) return parseInt(hrMin[1]) * 60 + parseInt(hrMin[2]);
  const colon = val.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  const hrs = val.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hrs) return Math.round(parseFloat(hrs[1]) * 60);
  const mins = val.match(/(\d+)\s*m/);
  if (mins) return parseInt(mins[1]);
  return 0;
}

function _csNextTime(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].time && rows[i].est) {
      const mins = _parseEstMins(rows[i].est);
      if (mins > 0) return _minsToTimeStr(_parseTimeToMins(rows[i].time) + mins);
    }
    if (rows[i].time) return '';
  }
  return '';
}

// Round minutes value down to nearest 15-min boundary
function _roundDownQtr(mins) { return Math.floor(mins / 15) * 15; }

function _csRecalcTimes(csIdx, fromRow) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c || !c.schedRows) return;
  const rows = c.schedRows;
  let changed = false;
  for (let i = fromRow; i < rows.length; i++) {
    if (rows[i].time) continue;
    const prev = rows[i - 1];
    if (prev && prev.time && prev.est) {
      const mins = _parseEstMins(prev.est);
      if (mins > 0) { rows[i].time = _minsToTimeStr(_parseTimeToMins(prev.time) + mins); changed = true; }
    }
  }
  if (changed) { saveStore(); renderCallsheet(p); }
}

// ── Default callsheet factory ─────────────────────────────────────────────────

function _defaultCallsheet(p, i) {
  const directors = Array.isArray(p.directors) && p.directors.length ? p.directors[0] : (p.director || '');
  const producers = Array.isArray(p.producers) && p.producers.length ? p.producers[0] : (p.producer || '');
  return {
    id: makeId(),
    date: '', prodNum: p.num || '', prodTitle: p.title || '',
    company: p.company || '', dirProd: directors, producer: producers,
    shootDay: i + 1,
    crewCall: '', shootCall: '', estWrap: '', daylight: '',
    weather: '', weatherDetail: '',
    // Logos
    logoDataUrl: null,        // film/project logo (per callsheet)
    // Notices
    notices: [],              // array of {text, bold}
    // Scene strip
    sceneRows: [],            // [{sceneNum, intExt, location, dn, synopsis, pages, castNums}]
    // Cast (main + supporting)
    castRows: [],             // [{num, actor, character, pu, arrive, mu, cos, onset, ready, poc, contact}]
    extrasRows: [],           // [{description, called, holdingRoom, mu, hair, ward, onSet, total, notes}]
    actorsContact: '', sasContact: '',
    hideContactDetails: true,
    // Stunts
    stuntRows: [],            // [{character, stuntPerformer, dn, pu, arrive, notes}]
    // Crew
    customFields: [],
    // Requirements
    reqRows: [],              // [{dept, detail}]  e.g. {dept:'Camera/Video', detail:'...'}
    // Locations
    locRows: [{ loc:'', city:'', parking:'', hospital:'' }],
    // Schedule
    schedRows: [],
    // Notes
    generalNotes: '',
    // Section visibility
    hideNotices: false, hideScenes: false, hideCast: false, hideExtras: false,
    hideStunts: true, hideCrewCall: false, hideLocations: false,
    hideSchedule: false, hideRequirements: true, hideNotes: false,
    sectionOrder: ['notices','scenes','cast','extras','stunts','crew','locations','schedule','requirements','notes'],
    minimized: false,
    exportSelected: true,
  };
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderCallsheet(p) {
  const el = document.getElementById('callsheet-list');
  if (!p || !p.callsheets) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>No project selected</h4></div>';
    return;
  }
  if (!p.callsheets.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>No callsheets yet</h4><p>Create a callsheet for each shoot day, or use Smart Generate.</p></div>';
    return;
  }
  // Migrate legacy callsheets
  p.callsheets.forEach(c => _migrateCallsheet(c));
  el.innerHTML = p.callsheets.map((c, i) => buildCallsheetCard(p, c, i)).join('');
  initCallsheetDragDrop(p);
  setTimeout(() => {
    el.querySelectorAll('[data-loc-auto]:not([data-loc-auto-attached])').forEach(inp => {
      if (window.attachLocAuto) window.attachLocAuto(inp);
    });
    el.querySelectorAll('[data-hosp-auto]:not([data-hosp-auto-attached])').forEach(inp => {
      if (window.attachHospAuto) window.attachHospAuto(inp);
    });
  }, 100);
}

function _migrateCallsheet(c) {
  if (!c.id) c.id = makeId();
  if (!c.notices)      c.notices = [];
  if (!c.sceneRows)    c.sceneRows = [];
  if (!c.extrasRows)   c.extrasRows = [];
  if (!c.stuntRows)    c.stuntRows = [];
  if (!c.reqRows)      c.reqRows = [];
  if (!c.castRows)     c.castRows = [];
  if (!c.schedRows)    c.schedRows = [];
  if (!c.locRows)      c.locRows = [{ loc:'', city:'', parking:'', hospital:'' }];
  if (!c.castHiddenCols)   c.castHiddenCols = [];
  if (!c.extrasHiddenCols) c.extrasHiddenCols = [];
  if (!c.scenesHiddenCols) c.scenesHiddenCols = [];
  if (!c.weatherByLoc)     c.weatherByLoc = [];
  if (!c.customFields) c.customFields = [];
  if (c.hideStunts     === undefined) c.hideStunts = true;
  if (c.hideExtras     === undefined) c.hideExtras = false;
  if (c.hideRequirements === undefined) c.hideRequirements = true;
  if (c.hideNotices    === undefined) c.hideNotices = false;
  if (c.hideScenes     === undefined) c.hideScenes = false;
  if (!c.sectionOrder) c.sectionOrder = ['notices','scenes','cast','extras','stunts','crew','locations','schedule','requirements','notes'];
  // Migrate old castRows that might lack new fields
  c.castRows.forEach(r => {
    if (r.pu     === undefined) r.pu     = '';
    if (r.arrive === undefined) r.arrive = r.callTime || '';
    if (r.mu     === undefined) r.mu     = '';
    if (r.cos    === undefined) r.cos    = '';
    if (r.onset  === undefined) r.onset  = '';
    if (r.ready  === undefined) r.ready  = r.wrapTime || '';
    if (r.num    === undefined) r.num    = '';
  });
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCallsheetCard(p, c, i) {
  const d = c.date ? new Date(c.date + 'T12:00:00') : null;
  const dayNum   = d ? d.getDate() : '—';
  const monthStr = d ? d.toLocaleDateString('en-GB', { month:'short' }).toUpperCase() : 'DATE';
  const yearStr  = d ? d.getFullYear() : new Date().getFullYear();
  const companyLogo = p.companyLogoDataUrl || null;
  const filmLogo    = c.logoDataUrl || null;

  const sectionDefs = {
    notices:      { label: 'Notices',       hideKey: 'hideNotices',      renderFn: () => buildNoticesSection(c, i) },
    scenes:       { label: 'Scenes',        hideKey: 'hideScenes',       renderFn: () => buildScenesSection(c, i) },
    cast:         { label: 'Cast',          hideKey: 'hideCast',         renderFn: () => buildCastSection(c, i) },
    extras:       { label: 'Extras',        hideKey: 'hideExtras',       renderFn: () => buildExtrasSection(c, i) },
    stunts:       { label: 'Stunts',        hideKey: 'hideStunts',       renderFn: () => buildStuntsSection(c, i) },
    crew:         { label: 'Crew & Calls',  hideKey: 'hideCrewCall',     renderFn: () => buildCrewSection(c, i) },
    locations:    { label: 'Locations',     hideKey: 'hideLocations',    renderFn: () => buildLocationsSection(c, i) },
    schedule:     { label: 'Schedule',      hideKey: 'hideSchedule',     renderFn: () => buildScheduleSection(c, i) },
    requirements: { label: 'Requirements',  hideKey: 'hideRequirements', renderFn: () => buildRequirementsSection(c, i) },
    notes:        { label: 'Notes',         hideKey: 'hideNotes',        renderFn: () => buildNotesSection(c, i) },
  };

  const toggleBtns = c.sectionOrder.map(key => {
    const def = sectionDefs[key];
    if (!def) return '';
    const isActive = !c[def.hideKey];
    return `<button class="cs-ctrl-btn${isActive ? ' active' : ''}" onclick="toggleCSectionVisibility(${i},'${def.hideKey}');renderCallsheet(currentProject());">${def.label}</button>`;
  }).join('');

  // Stripboard day import
  const sbDays = p.stripboard?.days || [];
  const importDayBtn = sbDays.length ? `
    <select class="cs-ctrl-btn pdf-hide" style="cursor:pointer;max-width:180px" onchange="_csImportFromDay(${i},this.value);this.value='';" title="Import from stripboard day">
      <option value="">↓ Import Shoot Day…</option>
      ${sbDays.map(d => `<option value="${d.id}">${d.label}${d.date ? ' · '+d.date : ''}</option>`).join('')}
    </select>` : '';

  const sections = c.minimized ? '' : `
    <div class="cs-toggle-bar pdf-hide">
      ${toggleBtns}
      ${importDayBtn}
      <button class="cs-ctrl-btn right pdf-hide" onclick="emailCallsheetAll(${i})" title="Email all cast &amp; crew">✉ Email All</button>
      <button class="cs-ctrl-btn right pdf-hide" onclick="emailCallsheetCast(${i})" title="Email cast only">✉ Email Cast</button>
      <button class="cs-ctrl-btn right danger pdf-hide" onclick="confirmDeleteCallsheet(${i})">🗑 Delete</button>
    </div>
    <div class="cs-content" id="cs-sections-${i}">
      ${c.sectionOrder.map(key => {
        const def = sectionDefs[key];
        if (!def || c[def.hideKey]) return '';
        return `<div class="cs-draggable-section" data-section="${key}" data-csidx="${i}">
          ${def.renderFn()}
        </div>`;
      }).join('')}
    </div>`;

  // Header: left=company logo, centre=info, right=film logo + date
  const companyLogoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="company logo">`
    : `<span style="color:#888;font-size:8px;text-align:center;line-height:1.4;max-width:80px">CLICK TO ADD<br>COMPANY LOGO</span>`;

  const filmLogoHtml = filmLogo
    ? `<img src="${filmLogo}" alt="film logo">`
    : `<span style="color:#888;font-size:8px;text-align:center;line-height:1.4;max-width:70px">CLICK FOR<br>FILM LOGO</span>`;

  return `
  <div class="cs-page" id="cs-page-${i}">
    <div class="cs-top-bar">
      <div class="cs-logo-section" style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:6px;">
        <div class="cs-logo-drop" onclick="uploadCompanyLogo()" title="Company logo (all projects)" style="width:86px;height:50px;">
          ${companyLogoHtml}
        </div>
        <div style="font-size:8px;color:#666;letter-spacing:1px;text-transform:uppercase;text-align:center;">Co. Logo</div>
      </div>
      <div class="cs-header-main">
        <div class="cs-header-row">
          <div class="cs-header-info" style="flex:1">
            <h1 style="font-size:22px">${_csEscVal(c.prodTitle || p.title || 'PRODUCTION TITLE')}</h1>
            <div class="cs-prod-info">Production ${_csEscVal(c.prodNum || p.num || '001')} &nbsp;•&nbsp; ${_csEscVal(c.company || p.company || '—')}</div>
            <div class="cs-header-meta">
              <div class="cs-meta-item">
                <span class="cs-meta-label">Call Sheet</span>
                <input class="cs-meta-input" type="number" min="1" style="width:48px" value="${c.callSheetNum || i+1}" onchange="updateCSF(${i},'callSheetNum',this.value)">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Shoot Day</span>
                <input class="cs-meta-input" type="number" min="1" style="width:48px" value="${c.shootDay || i+1}" onchange="updateCSF(${i},'shootDay',this.value)">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Date</span>
                <input class="cs-meta-input" type="date" style="width:130px" value="${c.date || ''}" onchange="updateCSF(${i},'date',this.value);renderCallsheet(currentProject());">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Director</span>
                <input class="cs-meta-input" style="width:110px" value="${_csEscVal(c.dirProd || (Array.isArray(p.directors) && p.directors.length ? p.directors[0] : p.director) || '')}" placeholder="Director" onchange="updateCSF(${i},'dirProd',this.value)">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Producer</span>
                <input class="cs-meta-input" style="width:110px" value="${_csEscVal(c.producer || (Array.isArray(p.producers) && p.producers.length ? p.producers[0] : p.producer) || '')}" placeholder="Producer" onchange="updateCSF(${i},'producer',this.value)">
              </div>
            </div>
          </div>
          <div class="cs-header-controls pdf-hide">
            <button class="cs-ctrl-btn" style="border-radius:4px;border:1px solid #ddd;" onclick="toggleCallsheetMinimize(${i});renderCallsheet(currentProject());">${c.minimized ? '▼ Expand' : '▲ Collapse'}</button>
            <label style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;cursor:pointer;">
              <input type="checkbox" ${c.exportSelected !== false ? 'checked' : ''} onchange="updateCSF(${i},'exportSelected',this.checked)" style="width:14px;height:14px;"> Export
            </label>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:0">
        <div class="cs-logo-drop" onclick="uploadCallsheetLogo(${i})" title="Film logo (this callsheet)" style="width:70px;height:50px;background:#2a2a2a;border-color:#555;">
          ${filmLogoHtml}
        </div>
        <div class="cs-date-box" style="min-width:90px;">
          <input type="date" value="${c.date || ''}" onchange="updateCSF(${i},'date',this.value);renderCallsheet(currentProject());" title="Set date">
          <div class="cs-date-day">${dayNum}</div>
          <div class="cs-date-month">${monthStr}</div>
          <div class="cs-date-year">${yearStr}</div>
        </div>
      </div>
    </div>
    ${sections}
  </div>`;
}

// ── Section builders ──────────────────────────────────────────────────────────

function _csSectionHead(label, csIdx, sectionKey, minimizedKey) {
  const p = currentProject();
  const c = p?.callsheets[csIdx];
  const isMin = c ? !!c[minimizedKey] : false;
  const order = c?.sectionOrder || [];
  const pos = order.indexOf(sectionKey);
  const isFirst = pos <= 0;
  const isLast  = pos >= order.length - 1;
  return `<div class="cs-heading" draggable="false">
    <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
    <span class="pdf-hide" style="display:inline-flex;gap:1px;margin-right:4px;">
      ${isFirst ? '' : `<button class="cs-section-btn" title="Move up" onclick="csMoveSection(${csIdx},'${sectionKey}',-1)" style="padding:0 4px;font-size:10px;">↑</button>`}
      ${isLast  ? '' : `<button class="cs-section-btn" title="Move down" onclick="csMoveSection(${csIdx},'${sectionKey}',1)"  style="padding:0 4px;font-size:10px;">↓</button>`}
    </span>
    ${label}
    <div class="cs-section-actions pdf-hide">
      <button class="cs-section-btn" onclick="toggleSectionMinimize(${csIdx},'${sectionKey}');renderCallsheet(currentProject());">${isMin ? '+ Expand' : '− Hide'}</button>
    </div>
  </div>`;
}

// GENERAL NOTICES
function buildNoticesSection(c, i) {
  const notices = c.notices || [];
  return `
    ${_csSectionHead('GENERAL NOTICES', i, 'notices', 'minimizedNotices')}
    <div style="display:${c.minimizedNotices ? 'none' : 'block'}">
      <div style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;margin-bottom:8px;">
        ${notices.map((n, ni) => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #f0f0f0;background:${ni % 2 === 0 ? '#fff' : '#fafafa'}">
            <label class="pdf-hide" style="display:flex;align-items:center;gap:4px;font-size:9px;color:#888;flex-shrink:0;cursor:pointer;">
              <input type="checkbox" ${n.bold ? 'checked' : ''} onchange="updateCSNotice(${i},${ni},'bold',this.checked)" style="width:12px;height:12px;"> Bold
            </label>
            <input class="cs-table-input ${n.bold ? 'cs-notice-bold' : 'cs-notice-normal'}" style="flex:1;font-weight:${n.bold ? '700' : '400'};font-size:${n.bold ? '12px' : '11px'};text-transform:${n.bold ? 'uppercase' : 'none'}"
              value="${_csEscVal(n.text)}" placeholder="Notice text…"
              onchange="updateCSNotice(${i},${ni},'text',this.value)">
            <button class="cs-section-btn pdf-hide" style="color:#c44444;flex-shrink:0" onclick="removeCSNotice(${i},${ni})">✕</button>
          </div>`).join('')}
        ${!notices.length ? '<div style="padding:12px;color:#aaa;font-size:12px;text-align:center;font-style:italic">No notices — add important safety &amp; logistics info below</div>' : ''}
      </div>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSNotice(${i})">+ Add Notice</button>
    </div>`;
}

// SCENE SYNOPSIS STRIP
function buildScenesSection(c, i) {
  const hiddenCols = c.scenesHiddenCols || [];
  const colVis = col => !hiddenCols.includes(col);
  const colHead = (id, label, title, w) => colVis(id)
    ? `<th style="${w?'width:'+w+';':''}" title="${title}" class="cs-col-head" data-csidx="${i}" data-arraykey="sceneRows" data-colid="${id}">${label} <span class="cs-col-hide pdf-hide" onclick="csHideCol(${i},'sceneRows','${id}')" title="Hide column">✕</span></th>`
    : '';
  return `
    ${_csSectionHead('SCENES', i, 'scenes', 'minimizedScenes')}
    <div style="display:${c.minimizedScenes ? 'none' : 'block'}">
      ${hiddenCols.length ? `<div class="pdf-hide" style="margin-bottom:8px"><button class="cs-section-btn" onclick="csRestoreCols(${i},'sceneRows')">↺ Restore hidden columns</button></div>` : ''}
      <table class="cs-table" style="font-size:11px;">
        <thead><tr>
          ${colHead('sceneNum','Sc.','Scene number','48px')}
          ${colHead('intExt','I/E','Interior or Exterior','36px')}
          ${colHead('location','Set / Location','Set or location name','')}
          ${colHead('dn','D/N','Day or Night','36px')}
          ${colHead('synopsis','Synopsis','Brief description of the scene','')}
          ${colHead('pages','Pages','Page count (e.g. 1⅛)','52px')}
          ${colHead('castNums','Cast #','Cast numbers from cast section below','58px')}
          <th class="pdf-hide" style="width:32px"></th>
        </tr></thead>
        <tbody>
          ${(c.sceneRows || []).map((r, ri) => `
            <tr>
              ${colVis('sceneNum')  ? `<td><input class="cs-table-input" value="${_csEscVal(r.sceneNum)}" placeholder="1A" style="width:40px" onchange="updateCSRow(${i},'sceneRows',${ri},'sceneNum',this.value)"></td>` : ''}
              ${colVis('intExt')   ? `<td>
                <select class="cs-table-input" style="width:34px;padding:0;" onchange="updateCSRow(${i},'sceneRows',${ri},'intExt',this.value)">
                  <option value="" ${!r.intExt?'selected':''}>—</option>
                  <option value="INT" ${r.intExt==='INT'?'selected':''}>INT</option>
                  <option value="EXT" ${r.intExt==='EXT'?'selected':''}>EXT</option>
                </select></td>` : ''}
              ${colVis('location') ? `<td><input class="cs-table-input" value="${_csEscVal(r.location)}" placeholder="Location name" onchange="updateCSRow(${i},'sceneRows',${ri},'location',this.value)"></td>` : ''}
              ${colVis('dn')       ? `<td>
                <select class="cs-table-input" style="width:34px;padding:0;" onchange="updateCSRow(${i},'sceneRows',${ri},'dn',this.value)">
                  <option value="" ${!r.dn?'selected':''}>—</option>
                  <option value="D" ${r.dn==='D'?'selected':''}>D</option>
                  <option value="N" ${r.dn==='N'?'selected':''}>N</option>
                  <option value="D/N" ${r.dn==='D/N'?'selected':''}>D/N</option>
                </select></td>` : ''}
              ${colVis('synopsis') ? `<td><input class="cs-table-input" value="${_csEscVal(r.synopsis)}" placeholder="Brief scene description" onchange="updateCSRow(${i},'sceneRows',${ri},'synopsis',this.value)"></td>` : ''}
              ${colVis('pages')    ? `<td><input class="cs-table-input" value="${_csEscVal(r.pages)}" placeholder="1⅛" style="width:46px" onchange="updateCSRow(${i},'sceneRows',${ri},'pages',this.value)"></td>` : ''}
              ${colVis('castNums') ? `<td><input class="cs-table-input" value="${_csEscVal(r.castNums)}" placeholder="1,3,8" onchange="updateCSRow(${i},'sceneRows',${ri},'castNums',this.value)"></td>` : ''}
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'sceneRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="pdf-hide" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button class="cs-add-row-btn" onclick="_csAddSceneRow(${i})">+ Add Scene</button>
        <button class="cs-add-row-btn" onclick="csSmartSyncScenes(${i})" title="Sync scenes for this shoot day from Breakdown / Schedule">⚡ Sync Scenes</button>
      </div>
    </div>`;
}

// CAST (full QoS-style with pickup, arrive, M/U, costume, on set, ready)
function buildCastSection(c, i) {
  const showContact = c.hideContactDetails !== true;
  // Column visibility state per callsheet
  const hiddenCols = c.castHiddenCols || [];
  const colVis = col => !hiddenCols.includes(col);
  const colHead = (id, label, title, w) => colVis(id)
    ? `<th style="${w?'width:'+w+';':''}" title="${title}" class="cs-col-head" data-csidx="${i}" data-arraykey="castRows" data-colid="${id}">${label} <span class="cs-col-hide pdf-hide" onclick="csHideCol(${i},'castRows','${id}')" title="Hide column">✕</span></th>`
    : '';

  return `
    ${_csSectionHead('CAST', i, 'cast', 'minimizedCast')}
    <div style="display:${c.minimizedCast ? 'none' : 'block'}">
      <div class="cs-note" style="margin-bottom:10px">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;white-space:nowrap;">Actors POC:</span>
        <input class="cs-note-input" value="${_csEscVal(c.actorsContact)}" placeholder="Name / Number" onchange="updateCSF(${i},'actorsContact',this.value)">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;white-space:nowrap;margin-left:16px;">SA POC:</span>
        <input class="cs-note-input" value="${_csEscVal(c.sasContact)}" placeholder="Name / Number" onchange="updateCSF(${i},'sasContact',this.value)">
        <button class="cs-section-btn pdf-hide" style="margin-left:auto" onclick="updateCSF(${i},'hideContactDetails',${showContact});renderCallsheet(currentProject());">${showContact ? '🔒 Hide Contacts' : '👁 Show Contacts'}</button>
        ${hiddenCols.length ? `<button class="cs-section-btn pdf-hide" onclick="csRestoreCols(${i},'castRows')" title="Restore hidden columns">↺ Restore Cols</button>` : ''}
      </div>
      <div style="overflow-x:auto">
      <table class="cs-table" style="font-size:11px;min-width:400px">
        <thead><tr>
          ${colHead('num','#','Cast number',   '28px')}
          ${colHead('actor','Actor','Full name of actor','')}
          ${colHead('character','Character','Character name','')}
          ${colHead('pu','P/U','Pick Up — transport collection time','60px')}
          ${colHead('arrive','Arrive','Arrival time on location','60px')}
          ${colHead('mu','M/U','Make-Up call time','60px')}
          ${colHead('cos','Cos.','Costume / Wardrobe call time','60px')}
          ${colHead('onset','On Set','Time required on set','60px')}
          ${colHead('ready','Ready','Ready for first shot','60px')}
          ${colHead('poc','POC','Point of Contact — person responsible for this actor','')}
          ${showContact && colVis('contact') ? `<th title="Contact details (phone / email)" class="cs-col-head" data-csidx="${i}" data-arraykey="castRows" data-colid="contact">Contact <span class="cs-col-hide pdf-hide" onclick="csHideCol(${i},'castRows','contact')" title="Hide column">✕</span></th>` : ''}
          <th class="pdf-hide" style="width:32px"></th>
        </tr></thead>
        <tbody>
          ${(c.castRows || []).map((r, ri) => `
            <tr>
              ${colVis('num')       ? `<td><input class="cs-table-input" value="${_csEscVal(r.num)}" placeholder="1" style="width:24px;text-align:center" onchange="updateCSRow(${i},'castRows',${ri},'num',this.value)"></td>` : ''}
              ${colVis('actor')     ? `<td><input class="cs-table-input" value="${_csEscVal(r.actor)}" placeholder="Name" data-actor-auto autocomplete="off" onchange="updateCSRow(${i},'castRows',${ri},'actor',this.value)"></td>` : ''}
              ${colVis('character') ? `<td><input class="cs-table-input" value="${_csEscVal(r.character)}" placeholder="Character" data-char-auto autocomplete="off" onchange="updateCSRow(${i},'castRows',${ri},'character',this.value)"></td>` : ''}
              ${colVis('pu')        ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.pu)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'pu',this.value)"></td>` : ''}
              ${colVis('arrive')    ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.arrive)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'arrive',this.value)"></td>` : ''}
              ${colVis('mu')        ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.mu)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'mu',this.value)"></td>` : ''}
              ${colVis('cos')       ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.cos)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'cos',this.value)"></td>` : ''}
              ${colVis('onset')     ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.onset)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'onset',this.value)"></td>` : ''}
              ${colVis('ready')     ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.ready)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'castRows',${ri},'ready',this.value)"></td>` : ''}
              ${colVis('poc')       ? `<td><input class="cs-table-input" value="${_csEscVal(r.poc)}" placeholder="Name / Num" onchange="updateCSRow(${i},'castRows',${ri},'poc',this.value)"></td>` : ''}
              ${showContact && colVis('contact') ? `<td><input class="cs-table-input" value="${_csEscVal(r.contact)}" placeholder="Phone / Email" onchange="updateCSRow(${i},'castRows',${ri},'contact',this.value)"></td>` : ''}
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'castRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <div class="pdf-hide" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button class="cs-add-row-btn" onclick="openAddCastModal(${i})">+ Add Cast</button>
        <button class="cs-add-row-btn" onclick="csSmartSyncCast(${i})" title="Sync cast from schedule for this shoot day">⚡ Sync from Schedule</button>
      </div>
    </div>`;
}

// SUPPORTING ARTISTS / EXTRAS
function buildExtrasSection(c, i) {
  const hiddenCols = c.extrasHiddenCols || [];
  const colVis = col => !hiddenCols.includes(col);
  const colHead = (id, label, title, w) => colVis(id)
    ? `<th style="${w?'width:'+w+';':''}" title="${title}">${label} <span class="cs-col-hide pdf-hide" onclick="csHideCol(${i},'extrasRows','${id}')" title="Hide column">✕</span></th>`
    : '';

  return `
    ${_csSectionHead('SUPPORTING ARTISTS / EXTRAS', i, 'extras', 'minimizedExtras')}
    <div style="display:${c.minimizedExtras ? 'none' : 'block'}">
      ${hiddenCols.length ? `<div class="pdf-hide" style="margin-bottom:8px"><button class="cs-section-btn" onclick="csRestoreCols(${i},'extrasRows')">↺ Restore hidden columns</button></div>` : ''}
      <div style="overflow-x:auto">
      <table class="cs-table" style="font-size:11px;min-width:500px">
        <thead><tr>
          ${colHead('description','Description','Role/type description','')}
          ${colHead('called','Called','Call time','58px')}
          ${colHead('holdingRoom','Holding / Room','Holding room or location','')}
          ${colHead('mu','M/U','Make-Up time','52px')}
          ${colHead('hair','Hair','Hair call time','52px')}
          ${colHead('ward','Ward.','Wardrobe call time','52px')}
          ${colHead('onSet','On Set','Time required on set','52px')}
          ${colHead('total','Total','Total number of extras','46px')}
          ${colHead('notes','Notes','Additional notes','')}
          <th class="pdf-hide" style="width:32px"></th>
        </tr></thead>
        <tbody>
          ${(c.extrasRows || []).map((r, ri) => `
            <tr>
              ${colVis('description') ? `<td><input class="cs-table-input" value="${_csEscVal(r.description)}" placeholder="e.g. Government Officials" onchange="updateCSRow(${i},'extrasRows',${ri},'description',this.value)"></td>` : ''}
              ${colVis('called')      ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.called)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'extrasRows',${ri},'called',this.value)"></td>` : ''}
              ${colVis('holdingRoom') ? `<td><input class="cs-table-input" value="${_csEscVal(r.holdingRoom)}" placeholder="Holding room TBA" onchange="updateCSRow(${i},'extrasRows',${ri},'holdingRoom',this.value)"></td>` : ''}
              ${colVis('mu')          ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.mu)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'extrasRows',${ri},'mu',this.value)"></td>` : ''}
              ${colVis('hair')        ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.hair)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'extrasRows',${ri},'hair',this.value)"></td>` : ''}
              ${colVis('ward')        ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.ward)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'extrasRows',${ri},'ward',this.value)"></td>` : ''}
              ${colVis('onSet')       ? `<td><input class="cs-table-input" type="time" value="${_csTo24h(r.onSet)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'extrasRows',${ri},'onSet',this.value)"></td>` : ''}
              ${colVis('total')       ? `<td><input class="cs-table-input" value="${_csEscVal(r.total)}" placeholder="10" style="width:38px;text-align:center" onchange="updateCSRow(${i},'extrasRows',${ri},'total',this.value)"></td>` : ''}
              ${colVis('notes')       ? `<td><input class="cs-table-input" value="${_csEscVal(r.notes)}" placeholder="Notes…" onchange="updateCSRow(${i},'extrasRows',${ri},'notes',this.value)"></td>` : ''}
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'extrasRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <div class="pdf-hide" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
        <button class="cs-add-row-btn" onclick="addCSRow(${i},'extrasRows',{description:'',called:'',holdingRoom:'',mu:'',hair:'',ward:'',onSet:'',total:'',notes:''})">+ Add Extras Row</button>
        <button class="cs-add-row-btn" onclick="csSmartSyncExtras(${i})" title="Sync extras from project">⚡ Sync from Project</button>
      </div>
    </div>`;
}

// STUNTS
function buildStuntsSection(c, i) {
  return `
    ${_csSectionHead('STUNTS', i, 'stunts', 'minimizedStunts')}
    <div style="display:${c.minimizedStunts ? 'none' : 'block'}">
      <table class="cs-table" style="font-size:11px;">
        <thead><tr>
          <th>Character</th>
          <th>Stunt Performer</th>
          <th style="width:36px">D/N</th>
          <th style="width:52px">P/U</th>
          <th style="width:52px">Arrive</th>
          <th>Notes</th>
          <th class="pdf-hide" style="width:32px"></th>
        </tr></thead>
        <tbody>
          ${(c.stuntRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" value="${_csEscVal(r.character)}" placeholder="Character" onchange="updateCSRow(${i},'stuntRows',${ri},'character',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.stuntPerformer)}" placeholder="Performer name" onchange="updateCSRow(${i},'stuntRows',${ri},'stuntPerformer',this.value)"></td>
              <td>
                <select class="cs-table-input" style="width:40px;padding:0;" onchange="updateCSRow(${i},'stuntRows',${ri},'dn',this.value)">
                  <option value="">—</option>
                  <option value="D" ${r.dn==='D'?'selected':''}>D</option>
                  <option value="N" ${r.dn==='N'?'selected':''}>N</option>
                </select>
              </td>
              <td><input class="cs-table-input" type="time" value="${_csTo24h(r.pu)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'stuntRows',${ri},'pu',this.value)"></td>
              <td><input class="cs-table-input" type="time" value="${_csTo24h(r.arrive)}" style="width:60px;cursor:pointer" onchange="updateCSRow(${i},'stuntRows',${ri},'arrive',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.notes)}" placeholder="Notes…" onchange="updateCSRow(${i},'stuntRows',${ri},'notes',this.value)"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'stuntRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSRow(${i},'stuntRows',{character:'',stuntPerformer:'',dn:'',pu:'',arrive:'',notes:''})">+ Add Stunt Row</button>
    </div>`;
}

// CREW & CALL TIMES (department-grouped, existing pattern)
const CREW_DEPT_MAP = {
  'producer':'Production','line producer':'Production','prod manager':'Production','production manager':'Production',
  'prod coordinator':'Production','production coordinator':'Production','ap':'Production','assistant producer':'Production',
  'executive producer':'Production','ep':'Production','unit manager':'Production','production supervisor':'Production',
  'director':'Direction','dir':'Direction','assistant director':'Direction','ad':'Direction','2nd ad':'Direction',
  '2nd assistant director':'Direction','script supervisor':'Direction',
  'writer':'Script','screenwriter':'Script','story editor':'Script','script editor':'Script',
  'dp':'Camera','director of photography':'Camera','cinematographer':'Camera','camera operator':'Camera',
  'cam op':'Camera','1st ac':'Camera','first ac':'Camera','2nd ac':'Camera','second ac':'Camera',
  'dit':'Camera','digital imaging technician':'Camera','camera pa':'Camera','steadicam':'Camera','camera trainee':'Camera','video assist':'Camera',
  'sound mixer':'Sound','sound recordist':'Sound','audio':'Sound','boom operator':'Sound',
  'gaffer':'Lights','best boy':'Lights','electric':'Lights','electrician':'Lights','lighting':'Lights',
  'grip':'Lights','key grip':'Lights','best boy grip':'Lights','dolly grip':'Lights',
  'makeup':'Makeup','makeup artist':'Makeup','mua':'Makeup','hair':'Makeup','hair stylist':'Makeup',
  'production designer':'Behind-the-Scenes','art director':'Behind-the-Scenes','set designer':'Behind-the-Scenes',
  'set decorator':'Behind-the-Scenes','prop master':'Behind-the-Scenes','props':'Behind-the-Scenes',
  'costume designer':'Behind-the-Scenes','wardrobe':'Behind-the-Scenes','costumer':'Behind-the-Scenes',
  'catering':'Behind-the-Scenes','location manager':'Behind-the-Scenes','transport':'Behind-the-Scenes','driver':'Behind-the-Scenes',
  'editor':'Post-Production','assistant editor':'Post-Production','colorist':'Post-Production',
  'vfx':'Post-Production','composer':'Post-Production',
};

function _getCrewDept(role) {
  if (!role) return 'Other';
  return CREW_DEPT_MAP[role.toLowerCase().trim()] || 'Other';
}

function buildCrewSection(c, i) {
  const crew = c.customFields || [];
  const deptOrder = ['Production','Direction','Script','Camera','Sound','Lights','Makeup','Behind-the-Scenes','Post-Production','Other'];
  const deptGroups = {};
  deptOrder.forEach(d => deptGroups[d] = []);
  crew.forEach((cf, fi) => {
    const dept = cf.dept || _getCrewDept(cf.label);
    if (!deptGroups[dept]) deptGroups[dept] = [];
    deptGroups[dept].push({ ...cf, _idx: fi });
  });

  const deptTables = deptOrder.filter(d => deptGroups[d].length > 0).map(dept => `
    <div class="cs-dept-section">
      <div class="cs-dept-header">${dept}</div>
      <table class="cs-crew-table">
        <thead><tr><th>Role</th><th>Name</th><th>Phone</th><th class="pdf-hide"></th></tr></thead>
        <tbody>${deptGroups[dept].map(m => `
          <tr>
            <td class="cs-crew-role-cell">${_csEscVal(m.label)}</td>
            <td><input class="cs-crew-field" value="${_csEscVal(m.value)}" placeholder="Name" data-crew-auto autocomplete="off" onchange="updateCSCustomField(${i},${m._idx},this.value)"></td>
            <td><input class="cs-crew-field cs-crew-phone" value="${_csEscVal(m.phone)}" placeholder="Phone" onchange="updateCSCustomField(${i},${m._idx},this.value,'phone')"></td>
            <td class="pdf-hide"><button class="cs-section-btn cs-remove-btn" onclick="removeCSCustomField(${i},${m._idx})">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');

  return `
    ${_csSectionHead('CREW &amp; CALL TIMES', i, 'crew', 'minimizedCrew')}
    <div style="display:${c.minimizedCrew ? 'none' : 'block'}">
      <div class="cs-call-times">
        <div class="cs-call-card highlight">
          <div class="cs-call-label">Crew Call</div>
          <input class="cs-call-input" type="time" value="${_csTo24h(c.crewCall)}" onchange="updateCSF(${i},'crewCall',this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">First Shot</div>
          <input class="cs-call-input" type="time" value="${_csTo24h(c.shootCall)}" onchange="updateCSF(${i},'shootCall',this.value);_csCascadeFirstShot(${i},this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">Est. Wrap</div>
          <input class="cs-call-input" type="time" value="${_csTo24h(c.estWrap)}" onchange="updateCSF(${i},'estWrap',this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">Daylight</div>
          <input class="cs-call-input" value="${_csEscVal(c.daylight)}" placeholder="07:04 – 18:35" onchange="updateCSF(${i},'daylight',this.value)">
        </div>
      </div>
      <div class="cs-weather-row" style="flex-wrap:wrap;gap:8px;">
        ${(() => {
          const items = (c.weatherByLoc && c.weatherByLoc.length > 0) ? c.weatherByLoc : null;
          if (items) {
            // Multi-location: one column per location
            return items.map((w, wi) => `
              <div style="display:flex;flex-direction:column;gap:3px;min-width:160px;">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;">${_csEscVal(w.loc)}</div>
                <div class="cs-weather-item" style="margin:0">
                  <div class="cs-weather-icon">☁</div>
                  <input class="cs-weather-input" value="${_csEscVal(w.summary)}" placeholder="Weather" onchange="_csUpdateWeatherLoc(${i},${wi},'summary',this.value)">
                </div>
                <div class="cs-weather-item" style="margin:0">
                  <div class="cs-weather-icon">💧</div>
                  <input class="cs-weather-input" value="${_csEscVal(w.detail)}" placeholder="Temp / Rain / Wind" onchange="_csUpdateWeatherLoc(${i},${wi},'detail',this.value)">
                </div>
              </div>`).join('');
          }
          // Single / no data
          return `
            <div class="cs-weather-item">
              <div class="cs-weather-icon">☁</div>
              <input class="cs-weather-input" value="${_csEscVal(c.weather)}" placeholder="Weather forecast" onchange="updateCSF(${i},'weather',this.value)">
            </div>
            <div class="cs-weather-item">
              <div class="cs-weather-icon">💧</div>
              <input class="cs-weather-input" value="${_csEscVal(c.weatherDetail)}" placeholder="Rain / Wind / Temp" onchange="updateCSF(${i},'weatherDetail',this.value)">
            </div>`;
        })()}
        ${(() => {
          if (!c.date) return `<span class="pdf-hide" style="margin-left:auto;font-size:11px;color:#aaa">Set a date to fetch weather</span>`;
          const daysAway = Math.round((new Date(c.date + 'T12:00:00') - new Date()) / 86400000);
          if (daysAway > 16) return `<span class="pdf-hide" style="margin-left:auto;font-size:11px;color:#aaa">Forecast available in ~${daysAway-16}d</span>`;
          return `<div class="pdf-hide" style="margin-left:auto;display:flex;gap:6px;flex-shrink:0;">
            <button class="cs-section-btn" onclick="fetchCallsheetWeather(${i})" style="white-space:nowrap;padding:4px 10px">⛅ Get Weather</button>
            <button class="cs-section-btn" onclick="fetchCallsheetDaylight(${i})" style="white-space:nowrap;padding:4px 10px">🌅 Get Daylight</button>
          </div>`;
        })()}
      </div>
      ${deptTables}
      <div class="pdf-hide" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center;">
        <button class="cs-add-row-btn" onclick="addCSCustomField(${i})">+ Add Crew</button>
        <button class="cs-add-row-btn" onclick="csImportCrewFromProject(${i})" title="Import crew from project unit list">⚡ Sync from Project</button>
        <select class="cs-add-row-btn" style="cursor:pointer;background:#fff;border:1px dashed #ccc;" onchange="csImportCrewDept(${i},this.value);this.value='';" title="Import a specific department">
          <option value="">+ Import dept…</option>
          ${['Production','Direction','Script','Camera','Sound','Lights','Makeup','Behind-the-Scenes','Post-Production','Other'].map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

// LOCATIONS
function buildLocationsSection(c, i) {
  return `
    ${_csSectionHead('LOCATIONS', i, 'locations', 'minimizedLocations')}
    <div style="display:${c.minimizedLocations ? 'none' : 'block'}">
      <table class="cs-table">
        <thead><tr><th>Venue / Address</th><th>City</th><th>Parking &amp; Notes</th><th>Nearest A&amp;E</th><th class="pdf-hide"></th></tr></thead>
        <tbody>
          ${(c.locRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" value="${_csEscVal(r.loc)}" placeholder="Venue, street address…" data-loc-auto autocomplete="off" onchange="updateCSRow(${i},'locRows',${ri},'loc',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.city)}" placeholder="City" onchange="updateCSRow(${i},'locRows',${ri},'city',this.value)" style="max-width:120px"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.parking)}" placeholder="Parking info, restrictions…" onchange="updateCSRow(${i},'locRows',${ri},'parking',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.hospital)}" placeholder="Hospital name &amp; postcode" data-hosp-auto onchange="updateCSRow(${i},'locRows',${ri},'hospital',this.value)"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'locRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSRow(${i},'locRows',{loc:'',city:'',parking:'',hospital:''})">+ Add Location</button>
    </div>`;
}

// SCHEDULE
function buildScheduleSection(c, i) {
  return `
    ${_csSectionHead('ESTIMATED SCHEDULE', i, 'schedule', 'minimizedSchedule')}
    <div style="display:${c.minimizedSchedule ? 'none' : 'block'}">
      <table class="cs-table">
        <thead><tr>
          <th style="width:70px">Time</th><th style="width:40px">Sc.</th><th style="width:34px">Shot</th><th style="width:68px">Type</th>
          <th>Description</th><th>Cast</th><th style="width:52px">Est. (m)</th>
          <th class="pdf-hide" style="width:32px"></th>
        </tr></thead>
        <tbody>
          ${(c.schedRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" type="time" value="${_csTo24h(r.time)}" style="width:78px;cursor:pointer" onchange="updateCSRow(${i},'schedRows',${ri},'time',this.value);_csRecalcTimes(${i},${ri+1})"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.scene)}" placeholder="1A" style="width:36px" onchange="updateCSRow(${i},'schedRows',${ri},'scene',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.shot)}" placeholder="1" style="width:30px" onchange="updateCSRow(${i},'schedRows',${ri},'shot',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.shotType)}" placeholder="WS" list="shot-types-datalist" style="width:68px" onchange="updateCSRow(${i},'schedRows',${ri},'shotType',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.desc)}" placeholder="Description" onchange="updateCSRow(${i},'schedRows',${ri},'desc',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.cast)}" placeholder="Cast" onchange="updateCSRow(${i},'schedRows',${ri},'cast',this.value)"></td>
              <td><input class="cs-table-input" type="number" min="0" step="5" value="${r.est||''}" placeholder="mins" style="width:52px" onchange="updateCSRow(${i},'schedRows',${ri},'est',this.value);_csRecalcTimes(${i},${ri+1})" onkeydown="if(event.key==='Enter'){event.preventDefault();_csAddSchedShot(${i});}"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'schedRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="pdf-hide" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button class="cs-add-row-btn" onclick="_csAddSchedShot(${i})">+ Add Shot</button>
        <button class="cs-add-row-btn" onclick="addCSRow(${i},'schedRows',{time:_csNextTime(currentProject().callsheets[${i}].schedRows),scene:'',shot:'',shotType:'',desc:'BREAK',cast:'',est:'30'})">+ Break</button>
        <button class="cs-add-row-btn" onclick="_csAddSchedOther(${i})" title="Add non-shot entry (lunch, unit breakdown, travel, etc.)">+ Other</button>
        <button class="cs-add-row-btn" onclick="csSmartSyncSchedule(${i})" title="Sync this day's schedule from the project Schedule section">⚡ Sync from Schedule</button>
      </div>
    </div>`;
}

// REQUIREMENTS
function buildRequirementsSection(c, i) {
  const depts = ['Camera/Video','Grip','Sound','Lighting','Electric','Stunts','Transport','Medical','Catering','Costume','Makeup/Hair','Art Dept','SFX','VFX','Other'];
  return `
    ${_csSectionHead('REQUIREMENTS', i, 'requirements', 'minimizedRequirements')}
    <div style="display:${c.minimizedRequirements ? 'none' : 'block'}">
      <table class="cs-table">
        <thead><tr><th style="width:160px">Department</th><th>Detail</th><th class="pdf-hide" style="width:32px"></th></tr></thead>
        <tbody>
          ${(c.reqRows || []).map((r, ri) => `
            <tr>
              <td>
                <input class="cs-table-input" list="cs-req-depts-${i}" value="${_csEscVal(r.dept)}" placeholder="Department" onchange="updateCSRow(${i},'reqRows',${ri},'dept',this.value)">
                <datalist id="cs-req-depts-${i}">${depts.map(d => `<option value="${d}">`).join('')}</datalist>
              </td>
              <td><input class="cs-table-input" value="${_csEscVal(r.detail)}" placeholder="Per [name], [kit/details]…" onchange="updateCSRow(${i},'reqRows',${ri},'detail',this.value)"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'reqRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSRow(${i},'reqRows',{dept:'',detail:''})">+ Add Requirement</button>
    </div>`;
}

// NOTES
function buildNotesSection(c, i) {
  return `
    ${_csSectionHead('NOTES &amp; INFORMATION', i, 'notes', 'minimizedNotes')}
    <div style="display:${c.minimizedNotes ? 'none' : 'block'}">
      <textarea class="cs-notes-area" placeholder="Enter any important notes, safety info, production updates…" onchange="updateCSF(${i},'generalNotes',this.value)">${_csEscVal(c.generalNotes)}</textarea>
    </div>`;
}

// ── Data mutation helpers ─────────────────────────────────────────────────────

function updateCSF(idx, field, val) {
  const p = currentProject();
  if (!p || !p.callsheets[idx]) return;
  p.callsheets[idx][field] = val;
  saveStore();
}

function updateCSRow(csIdx, arrayKey, rowIdx, field, val) {
  const p = currentProject();
  if (!p || !p.callsheets[csIdx]) return;
  const arr = p.callsheets[csIdx][arrayKey];
  if (!arr || !arr[rowIdx]) return;
  arr[rowIdx][field] = val;
  saveStore();
}

function addCSRow(csIdx, arrayKey, template) {
  const p = currentProject();
  if (!p || !p.callsheets[csIdx]) return;
  if (!p.callsheets[csIdx][arrayKey]) p.callsheets[csIdx][arrayKey] = [];
  p.callsheets[csIdx][arrayKey].push({ ...template });
  saveStore();
  renderCallsheet(p);
}

function removeCSRow(csIdx, arrayKey, rowIdx) {
  showConfirmDialog('Remove this row?', 'Remove', () => {
    const p = currentProject();
    if (!p || !p.callsheets[csIdx]) return;
    p.callsheets[csIdx][arrayKey].splice(rowIdx, 1);
    saveStore();
    renderCallsheet(p);
  });
}

function addCSNotice(csIdx) {
  const p = currentProject();
  if (!p) return;
  if (!p.callsheets[csIdx].notices) p.callsheets[csIdx].notices = [];
  p.callsheets[csIdx].notices.push({ text: '', bold: false });
  saveStore();
  renderCallsheet(p);
}

function removeCSNotice(csIdx, ni) {
  const p = currentProject();
  if (!p) return;
  p.callsheets[csIdx].notices.splice(ni, 1);
  saveStore();
  renderCallsheet(p);
}

function updateCSNotice(csIdx, ni, field, val) {
  const p = currentProject();
  if (!p) return;
  p.callsheets[csIdx].notices[ni][field] = val;
  saveStore();
  // Re-render the notices section only (not the entire callsheet)
  const sectionsEl = document.getElementById(`cs-sections-${csIdx}`);
  if (!sectionsEl) { renderCallsheet(p); return; }
  const c = p.callsheets[csIdx];
  const noticeSection = sectionsEl.querySelector('.cs-draggable-section[data-section="notices"]');
  if (noticeSection) {
    noticeSection.innerHTML = buildNoticesSection(c, csIdx);
  }
}

function updateCSCustomField(csIdx, fieldIdx, val, extra) {
  const p = currentProject();
  const cf = p.callsheets[csIdx].customFields?.[fieldIdx];
  if (!cf) return;
  if (extra === 'phone') cf.phone = val;
  else if (extra === 'email') cf.email = val;
  else cf.value = val;
  saveStore();
}

function removeCSCustomField(csIdx, fieldIdx) {
  showConfirmDialog('Remove this crew member?', 'Remove', () => {
    const p = currentProject();
    p.callsheets[csIdx].customFields.splice(fieldIdx, 1);
    saveStore();
    renderCallsheet(p);
  });
}

function toggleCSectionVisibility(csIdx, sectionKey) {
  const p = currentProject();
  if (!p) return;
  p.callsheets[csIdx][sectionKey] = !p.callsheets[csIdx][sectionKey];
  saveStore();
}

function toggleCallsheetMinimize(csIdx) {
  const p = currentProject();
  if (!p) return;
  p.callsheets[csIdx].minimized = !p.callsheets[csIdx].minimized;
  saveStore();
}

function toggleSectionMinimize(csIdx, section) {
  const p = currentProject();
  if (!p) return;
  const key = 'minimized' + section.charAt(0).toUpperCase() + section.slice(1);
  p.callsheets[csIdx][key] = !p.callsheets[csIdx][key];
  saveStore();
}

// ── Schedule row helpers ──────────────────────────────────────────────────────

function _csAddSchedShot(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = p.callsheets[csIdx]?.schedRows || [];
  addCSRow(csIdx, 'schedRows', { time: _csNextTime(rows), scene:'', shot:'', shotType:'', desc:'', cast:'', est:'' });
}

// ── Smart sync helpers ────────────────────────────────────────────────────────
// These work on the callsheet's *existing* shootDay/date to pull only the
// relevant data for that specific day from the project.

/**
 * Get the schedule rows that belong to this callsheet's shoot day.
 * Matches by shootDay index or by the rows already in schedRows if no day headers exist.
 */
function _csGetDayScheduleRows(p, csIdx) {
  const c = p.callsheets[csIdx];
  const allRows = p.schedule || [];
  if (!allRows.length) return [];

  // Check if schedule has day headers
  const hasDayHeaders = allRows.some(r => r.isDayHeader);
  if (!hasDayHeaders) {
    // No day headers — all rows belong to everyone
    return allRows.filter(r => !r.isDayHeader);
  }

  // Group by day header
  const days = [];
  let cur = null;
  allRows.forEach(row => {
    if (row.isDayHeader) {
      cur = { rows: [] };
      days.push(cur);
    } else {
      if (!cur) { cur = { rows: [] }; days.push(cur); }
      cur.rows.push(row);
    }
  });

  // Match by shootDay (1-indexed) — callsheet shootDay 1 = days[0]
  const dayIdx = (c.shootDay || csIdx + 1) - 1;
  if (days[dayIdx]) return days[dayIdx].rows;

  // Fallback: return all non-header rows
  return allRows.filter(r => !r.isDayHeader);
}

function csSmartSyncSchedule(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = _csGetDayScheduleRows(p, csIdx);
  if (!rows.length) { showToast('No schedule entries found for this shoot day', 'info'); return; }
  const c = p.callsheets[csIdx];
  c.schedRows = rows.map(s => ({
    time: _csTo24h(s.time)||'', scene: s.scene||'', shot: s.shot||'', shotType: s.type||'',
    desc: s.desc||'', cast: s.cast||'', est: s.est||''
  }));

  // Recalculate call times
  _csRecalcCallTimes(c, csIdx);

  saveStore();
  renderCallsheet(p);
  showToast(`Schedule synced — ${rows.length} row${rows.length !== 1 ? 's' : ''} for shoot day ${c.shootDay || csIdx + 1}`, 'success');
}

function csSmartSyncCast(csIdx) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  const dayRows = _csGetDayScheduleRows(p, csIdx);

  // Gather cast names mentioned in this day's schedule
  const castNames = new Set();
  dayRows.forEach(r => {
    (r.cast || '').split(',').forEach(n => { const t = n.trim(); if (t) castNames.add(t.toLowerCase()); });
  });

  // Also pull all project cast if no schedule cast found
  const projectCast = p.cast || [];
  let merged;
  if (castNames.size) {
    // Filter project cast to those mentioned in the schedule, or include all if no names matched
    const matched = projectCast.filter(m => castNames.has((m.name||'').toLowerCase()) || castNames.has((m.role||'').toLowerCase()));
    merged = matched.length ? matched : projectCast;
  } else {
    merged = projectCast;
  }

  if (!merged.length) { showToast('No cast found for this shoot day', 'info'); return; }

  // Calculate arrive time = 30 mins before first shot
  const crewCall = c.crewCall || '';
  const arriveTime = crewCall ? _minsToTimeStr(_parseTimeToMins(crewCall) + 30) : '';

  // Find first scene each cast member appears in, to calculate their earliest call
  const castFirstScene = {};
  dayRows.forEach(r => {
    if (!r.time) return;
    (r.cast||'').split(',').forEach(n => {
      const key = n.trim().toLowerCase();
      if (!castFirstScene[key] || _parseTimeToMins(r.time) < _parseTimeToMins(castFirstScene[key])) {
        castFirstScene[key] = r.time;
      }
    });
  });

  c.castRows = merged.map((m, idx) => {
    const nameKey = (m.name||'').toLowerCase();
    const roleKey = (m.role||'').toLowerCase();
    // Arrive 30 mins before their first scene, or default arrive time
    const firstScene = castFirstScene[nameKey] || castFirstScene[roleKey];
    const castArrive = firstScene
      ? _minsToTimeStr(_parseTimeToMins(firstScene) - 30)
      : arriveTime;
    // On Set = first scene time, rounded DOWN to nearest 15 min
    const onSetMins = firstScene ? _roundDownQtr(_parseTimeToMins(firstScene)) : null;
    const existing = (c.castRows||[]).find(r => r.actor?.toLowerCase() === nameKey);
    return {
      num:       existing?.num || String(idx + 1),
      actor:     m.name || '',
      character: m.role || '',
      pu:        existing?.pu || '',
      arrive:    existing?.arrive || castArrive,
      mu:        existing?.mu || '',
      cos:       existing?.cos || '',
      onset:     existing?.onset || (onSetMins !== null ? _minsToTimeStr(onSetMins) : ''),
      ready:     existing?.ready || '',
      poc:       existing?.poc || '',
      contact:   existing?.contact || [m.number||m.phone, m.email].filter(Boolean).join(' / '),
    };
  });

  saveStore();
  renderCallsheet(p);
  showToast(`Cast synced — ${merged.length} member${merged.length !== 1 ? 's' : ''} for shoot day ${c.shootDay || csIdx + 1}`, 'success');
}

function csSmartSyncExtras(csIdx) {
  const p = currentProject();
  if (!p) return;
  const extras = p.extras || [];
  if (!extras.length) { showToast('No extras in project', 'info'); return; }
  const c = p.callsheets[csIdx];
  // Merge: keep any existing extras rows that have been manually filled
  const existing = (c.extrasRows||[]).reduce((acc, r) => { acc[r.description?.toLowerCase()||''] = r; return acc; }, {});
  c.extrasRows = extras.map(m => {
    const key = (m.role||m.name||'').toLowerCase();
    const ex = existing[key] || {};
    return {
      description: m.role || m.name || '',
      called:      ex.called || '',
      holdingRoom: ex.holdingRoom || '',
      mu:          ex.mu || '',
      hair:        ex.hair || '',
      ward:        ex.ward || '',
      onSet:       ex.onSet || '',
      total:       ex.total || '1',
      notes:       ex.notes || m.notes || '',
    };
  });
  saveStore();
  renderCallsheet(p);
  showToast(`Extras synced — ${extras.length} group${extras.length !== 1 ? 's' : ''} from project`, 'success');
}

function csImportCrewFromProject(csIdx) {
  const p = currentProject();
  if (!p) return;
  const unit = p.unit || [];
  if (!unit.length) { showToast('No crew in project unit list', 'info'); return; }
  _csMergeCrewFromUnit(csIdx, unit);
  showToast(`Crew synced — ${unit.length} member${unit.length !== 1 ? 's' : ''} from project`, 'success');
}

function csImportCrewDept(csIdx, dept) {
  if (!dept) return;
  const p = currentProject();
  if (!p) return;
  const unit = (p.unit || []).filter(m => {
    const d = m.dept || _getCrewDept(m.role||'');
    return d === dept;
  });
  if (!unit.length) { showToast(`No ${dept} crew in project`, 'info'); return; }
  _csMergeCrewFromUnit(csIdx, unit);
  showToast(`${dept} synced — ${unit.length} member${unit.length !== 1 ? 's' : ''}`, 'success');
}

function _csMergeCrewFromUnit(csIdx, unit) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c.customFields) c.customFields = [];
  unit.forEach(m => {
    const existing = c.customFields.find(cf => cf.value?.toLowerCase() === (m.name||'').toLowerCase() && cf.label === (m.role||'Crew'));
    if (!existing) {
      c.customFields.push({ label: m.role||'Crew', value: m.name||'', phone: m.number||m.phone||'', email: m.email||'' });
    } else {
      // Update phone/email if they've changed
      existing.phone = m.number||m.phone||existing.phone;
      existing.email = m.email||existing.email;
    }
  });
  saveStore();
  renderCallsheet(p);
}

/**
 * Recalculate crewCall, shootCall, estWrap from schedule rows.
 * Pass csIdx=-1 to operate directly on the cs object (e.g. during smart generate).
 */
function _csRecalcCallTimes(cOrIdx, csIdx) {
  // Support both calling styles: _csRecalcCallTimes(c, -1) and _csRecalcCallTimes(c, idx)
  const c = (typeof cOrIdx === 'object') ? cOrIdx : (currentProject()?.callsheets[cOrIdx]);
  if (!c) return;
  const rows = (c.schedRows || []).filter(r => r.time);
  if (!rows.length) return;

  const firstRow = rows[0];
  const firstMins = _parseTimeToMins(firstRow.time);
  c.shootCall = firstRow.time;
  c.crewCall  = _minsToTimeStr(firstMins - 60);

  const lastRow = rows[rows.length - 1];
  const lastMins = _parseTimeToMins(lastRow.time);
  const lastEst = _parseEstMins(lastRow.est) || 45;
  c.estWrap = _minsToTimeStr(lastMins + lastEst);
}

// Keep old function names as aliases for any remaining callsites
function csImportCastFromProject(csIdx) { csSmartSyncCast(csIdx); }
function csImportExtrasFromProject(csIdx) { csSmartSyncExtras(csIdx); }
function csImportScheduleFromProject(csIdx) { csSmartSyncSchedule(csIdx); }

function csSmartSyncScenes(csIdx) {
  const p = currentProject();
  if (!p) return;
  _migrateBreakdowns(p);
  const bd = _getActiveBd(p);
  const c = p.callsheets[csIdx];
  const dayRows = _csGetDayScheduleRows(p, csIdx);
  const daySceneNums = new Set(dayRows.map(r => r.scene).filter(Boolean));

  if (bd && bd.rawText) {
    const allScenes = parseBreakdownScenes(bd.rawText);
    const sceneData = _sbBuildSceneData(p);
    const scenes = daySceneNums.size
      ? allScenes.filter(s => daySceneNums.has(s.sceneNumber) || daySceneNums.has(s.heading))
      : allScenes;
    if (scenes.length) {
      c.sceneRows = scenes.map(s => {
        const data = sceneData[s.heading] || {};
        // Resolve cast names to their # in the callsheet cast table
        const castNums = (data.cast || []).map(charName => {
          const cr = (c.castRows || []).find(cr2 =>
            cr2.character?.toLowerCase() === charName.toLowerCase() ||
            cr2.actor?.toLowerCase() === charName.toLowerCase()
          );
          return cr?.num || '';
        }).filter(Boolean).join(', ');
        // Find the matching schedule row — try scene number, then heading/location match
        const schedRow = dayRows.find(r => r.scene === s.sceneNumber)
          || dayRows.find(r => r.desc && s.location && r.desc.toLowerCase().includes(s.location.toLowerCase()));
        return {
          sceneNum: s.sceneNumber || '', intExt: s.intExt || '', location: s.location || '',
          dn: s.timeOfDay ? (s.timeOfDay.match(/night/i) ? 'N' : s.timeOfDay.match(/day/i) ? 'D' : '') : '',
          synopsis: schedRow?.desc || '', pages: s.pages || '', castNums,
        };
      });
      saveStore(); renderCallsheet(p);
      showToast(`Scenes synced — ${scenes.length} scene${scenes.length !== 1 ? 's' : ''} for shoot day ${c.shootDay||csIdx+1}`, 'success');
      return;
    }
  }
  // Fallback from schedule
  if (dayRows.length) {
    const seenScenes = new Set();
    c.sceneRows = dayRows.filter(r => r.scene && !seenScenes.has(r.scene) && seenScenes.add(r.scene))
      .map(r => {
        const descUpper = (r.desc || '').toUpperCase();
        let intExt = '';
        if (descUpper.includes('INT.') || descUpper.startsWith('INT ')) intExt = 'INT';
        else if (descUpper.includes('EXT.') || descUpper.startsWith('EXT ')) intExt = 'EXT';
        let dn = '';
        if (/\bDAY\b/i.test(r.desc)) dn = 'D';
        else if (/\bNIGHT\b/i.test(r.desc)) dn = 'N';
        // Cast #: map character names to their # in the cast table
        const castNums = (r.cast || '').split(',').map(n => n.trim()).filter(Boolean)
          .map(charName => {
            const cr = (c.castRows || []).find(cr2 =>
              cr2.character?.toLowerCase() === charName.toLowerCase() ||
              cr2.actor?.toLowerCase() === charName.toLowerCase()
            );
            return cr?.num || '';
          }).filter(Boolean).join(', ');
        return {
          sceneNum: r.scene, intExt, location: r.location || '',
          dn, synopsis: r.desc || '', pages: '', castNums,
        };
      });
    saveStore(); renderCallsheet(p);
    showToast(`Scenes synced from schedule — ${c.sceneRows.length} scene${c.sceneRows.length !== 1 ? 's' : ''}`, 'success');
    return;
  }
  showToast('No scene data found — add a Script Breakdown or schedule entries first', 'info');
}

function csImportScenesFromBreakdown(csIdx) { csSmartSyncScenes(csIdx); }

// ── Column hide / restore ─────────────────────────────────────────────────────

function csHideCol(csIdx, arrayKey, colId) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  // Key mapping: castRows→castHiddenCols, extrasRows→extrasHiddenCols, sceneRows→scenesHiddenCols
  const keyMap = { castRows:'castHiddenCols', extrasRows:'extrasHiddenCols', sceneRows:'scenesHiddenCols' };
  const key = keyMap[arrayKey] || (arrayKey.replace('Rows','') + 'HiddenCols');
  if (!c[key]) c[key] = [];
  if (!c[key].includes(colId)) c[key].push(colId);
  saveStore();
  renderCallsheet(p);
}

function csRestoreCols(csIdx, arrayKey) {
  const p = currentProject();
  if (!p) return;
  const keyMap = { castRows:'castHiddenCols', extrasRows:'extrasHiddenCols', sceneRows:'scenesHiddenCols' };
  const key = keyMap[arrayKey] || (arrayKey.replace('Rows','') + 'HiddenCols');
  p.callsheets[csIdx][key] = [];
  saveStore();
  renderCallsheet(p);
}

// ── Smart generate: one callsheet per schedule day ───────────────────────────

async function smartGenerateCallsheet() {
  const p = currentProject();
  if (!p) { showToast('No project selected', 'info'); return; }
  const schedule = p.schedule || [];
  if (!schedule.length) { showToast('No schedule entries found — add entries in the Schedule section first', 'info'); return; }

  // Group schedule by day headers
  const days = [];
  let current = null;
  schedule.forEach(row => {
    if (row.isDayHeader) {
      current = { label: row.desc || row.dayLabel || ('Shoot Day ' + (days.length + 1)), date: row.date || '', rows: [] };
      days.push(current);
    } else {
      if (!current) { current = { label: 'Shoot Day 1', date: '', rows: [] }; days.push(current); }
      current.rows.push(row);
    }
  });

  if (!days.length) {
    // No day headers — treat everything as one day
    days.push({ label: 'Shoot Day 1', date: '', rows: schedule.filter(s => !s.isDayHeader) });
  }

  if (!p.callsheets) p.callsheets = [];
  const existing = p.callsheets.length;

  days.forEach((day, di) => {
    const cs = _defaultCallsheet(p, existing + di);
    cs.date = day.date || '';
    cs.shootDay = existing + di + 1;

    // Schedule rows
    cs.schedRows = day.rows.map(s => ({
      time: _csTo24h(s.time)||'', scene: s.scene||'', shot: s.shot||'', shotType: s.type||'',
      desc: s.desc||'', cast: s.cast||'', est: s.est||''
    }));

    // Derive call times from schedule
    _csRecalcCallTimes(cs, -1); // -1 = use cs.schedRows directly (no csIdx needed)

    // Cast: gather character names from schedule, look up actor names from project cast
    const castNames = new Set();
    day.rows.forEach(r => { (r.cast || '').split(',').forEach(n => { const t = n.trim(); if (t) castNames.add(t); }); });
    cs.castRows = [...castNames].map((characterName, idx) => {
      // Schedule cast column holds character names — look up the actor by role
      const pc = (p.cast || []).find(c =>
        (c.role  && c.role.toLowerCase()  === characterName.toLowerCase()) ||
        (c.name  && c.name.toLowerCase()  === characterName.toLowerCase())
      );
      return {
        num: String(idx+1),
        actor:     pc?.name      || '',          // real actor name
        character: pc?.role      || characterName, // character name from schedule
        pu:'', arrive: cs.crewCall ? _minsToTimeStr(_parseTimeToMins(cs.crewCall) + 30) : '',
        mu:'', cos:'', onset:'', ready:'',
        poc:'', contact: pc ? [pc.number||pc.phone, pc.email].filter(Boolean).join(' / ') : '',
      };
    });

    // Extras from project
    cs.extrasRows = (p.extras || []).map(m => ({
      description: m.role || m.name || '', called:'', holdingRoom:'', mu:'', hair:'', ward:'', onSet:'', total:'', notes:''
    }));

    // Crew
    cs.customFields = (p.unit || []).map(m => ({
      label: m.role || 'Crew', value: m.name || '', phone: m.number||m.phone||'', email: m.email||''
    }));

    // Locations from schedule rows — only populate venue if project location has an address
    const locs = new Set();
    day.rows.forEach(r => { if (r.location) locs.add(r.location); });
    cs.locRows = locs.size ? [...locs].map(loc => {
      const pl = (p.locations||[]).find(l => l.name === loc);
      // Only use address field — location name goes in parking/notes, not venue
      return { loc: pl?.address || '', city: pl?.city || '', parking: pl?.access || loc, hospital:'' };
    }) : [{ loc:'', city:'', parking:'', hospital:'' }];

    // Default notices
    cs.notices = [
      { text: 'ALL CREW TO WEAR ID BADGES AT ALL TIMES', bold: true },
      { text: 'NO PERSONAL CAMERAS OR VIDEO DEVICES ON SET', bold: false },
    ];

    // Scenes: build from schedule rows for this day
    // (deduplicated by scene number; synopsis from desc field, D/N from desc pattern)
    const seenScNums = new Set();
    cs.sceneRows = day.rows
      .filter(r => r.scene && !seenScNums.has(r.scene) && seenScNums.add(r.scene))
      .map(r => {
        const descUpper = (r.desc || '').toUpperCase();
        let intExt = '';
        if (descUpper.includes('INT.') || descUpper.startsWith('INT ')) intExt = 'INT';
        else if (descUpper.includes('EXT.') || descUpper.startsWith('EXT ')) intExt = 'EXT';
        let dn = '';
        if (/\bDAY\b/i.test(r.desc)) dn = 'D';
        else if (/\bNIGHT\b/i.test(r.desc) || /\bNIGHT\b/i.test(r.desc)) dn = 'N';
        // Cast #: look up cast row nums for this scene's characters
        const castNums = (r.cast || '').split(',').map(n => n.trim()).filter(Boolean)
          .map(charName => {
            const cr = cs.castRows.find(cr2 =>
              cr2.character?.toLowerCase() === charName.toLowerCase() ||
              cr2.actor?.toLowerCase() === charName.toLowerCase()
            );
            return cr?.num || '';
          }).filter(Boolean).join(', ');
        return {
          sceneNum: r.scene, intExt, location: r.location || '',
          dn, synopsis: r.desc || '', pages: '', castNums,
        };
      });

    p.callsheets.push(cs);
  });

  saveStore();
  renderCallsheet(p);
  showToast(`Generated ${days.length} callsheet${days.length !== 1 ? 's' : ''} from schedule`, 'success');
}

// ── Company logo (per project) ────────────────────────────────────────────────

function uploadCompanyLogo() {
  const p = currentProject();
  if (!p) return;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      p.companyLogoDataUrl = ev.target.result;
      saveStore();
      renderCallsheet(p);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function uploadCallsheetLogo(csIdx) {
  const p = currentProject(); if (!p) return;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      p.callsheets[csIdx].logoDataUrl = ev.target.result;
      saveStore(); renderCallsheet(p);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── Add callsheet ─────────────────────────────────────────────────────────────

function addCallsheet() {
  const p = currentProject();
  if (!p) { showToast('No project selected', 'info'); return; }
  if (!p.callsheets) p.callsheets = [];
  const cs = _defaultCallsheet(p, p.callsheets.length);
  p.callsheets.push(cs);
  saveStore();
  renderCallsheet(p);
}

// ── Email ─────────────────────────────────────────────────────────────────────

function emailCallsheetAll(csIdx) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  const emails = new Set();
  // Cast emails
  (c.castRows || []).forEach(r => {
    if (r.contact) {
      const m = r.contact.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (m) emails.add(m[0]);
    }
  });
  // Crew emails
  (c.customFields || []).forEach(f => {
    if (f.email) emails.add(f.email);
  });
  // Project unit
  (p.unit || []).forEach(m => { if (m.email) emails.add(m.email); });
  if (!emails.size) { showToast('No email addresses found in cast or crew', 'info'); return; }
  const date = c.date || 'Shoot Day';
  const subj = encodeURIComponent(`${p.title} — Call Sheet for ${date}`);
  const body = encodeURIComponent(`Hi,\n\nPlease find the call sheet for ${p.title} (${date}) attached.\n\nBest regards`);
  window.location.href = `mailto:${[...emails].join(',')}?subject=${subj}&body=${body}`;
}

function emailCallsheetCast(csIdx) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  const emails = new Set();
  (c.castRows || []).forEach(r => {
    if (r.contact) { const m = r.contact.match(/[\w.+-]+@[\w.-]+\.\w+/); if (m) emails.add(m[0]); }
  });
  (p.cast || []).forEach(m => { if (m.email) emails.add(m.email); });
  if (!emails.size) { showToast('No cast email addresses found', 'info'); return; }
  const date = c.date || 'Shoot Day';
  const subj = encodeURIComponent(`${p.title} — Call Sheet for ${date}`);
  const body = encodeURIComponent(`Hi,\n\nPlease find your call sheet for ${p.title} (${date}).\n\nBest regards`);
  window.location.href = `mailto:${[...emails].join(',')}?subject=${subj}&body=${body}`;
}

// ── Cast modal ────────────────────────────────────────────────────────────────

function openAddCastModal(csIdx) {
  document.getElementById('add-cast-csidx').value = csIdx;
  document.getElementById('add-cast-name').value = '';
  document.getElementById('add-cast-character').value = '';
  document.getElementById('add-cast-phone').value = '';
  document.getElementById('add-cast-email').value = '';
  const sc = document.getElementById('add-cast-socials-container');
  sc.innerHTML = '';
  addSocialField('add-cast-socials-container', 'instagram', '');
  document.getElementById('add-cast-calltime').value = '';
  document.getElementById('add-cast-wrap').value = '';
  document.getElementById('add-cast-poc').value = '';

  // Populate dropdown using ContactAnchor for reliability, fallback to populateContactSelect
  _csPopulateAddCastSelect();

  openModal('modal-add-cast');

  // Wire up autocomplete on the name field after modal opens
  setTimeout(() => {
    const nameInput = document.getElementById('add-cast-name');
    if (nameInput && typeof ContactAnchor !== 'undefined') {
      ContactAnchor.attachPicker(nameInput, contact => {
        nameInput.value = contact.name;
        document.getElementById('add-cast-phone').value = contact.phone || '';
        document.getElementById('add-cast-email').value = contact.email || '';
      });
    }
  }, 80);
}

function _csPopulateAddCastSelect() {
  const select = document.getElementById('add-cast-contact-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Select existing contact —</option>';

  // Use ContactAnchor if available — covers all projects
  if (typeof ContactAnchor !== 'undefined') {
    const contacts = ContactAnchor.searchContacts('', 200);
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    contacts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ name: c.name, phone: c.phone||'', email: c.email||'', socials: '' });
      opt.textContent = c.name + (c.phone ? ' — ' + c.phone : '');
      select.appendChild(opt);
    });
    return;
  }

  // Fallback: scan projects manually
  const seen = new Set();
  const addPerson = (name, phone, email) => {
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ name, phone: phone||'', email: email||'', socials: '' });
    opt.textContent = name + (phone ? ' — ' + phone : '');
    select.appendChild(opt);
  };
  (store.projects || []).forEach(p => {
    (p.contacts || []).forEach(c => addPerson(c.name, c.phone, c.email));
    (p.cast     || []).forEach(r => addPerson(r.name, r.number||r.phone, r.email));
    (p.extras   || []).forEach(r => addPerson(r.name, r.number||r.phone, r.email));
    (p.unit     || []).forEach(r => addPerson(r.name, r.number||r.phone, r.email));
  });
  (store.contacts || []).forEach(c => addPerson(c.name, c.phone, c.email));
}

function saveAddCast() {
  const csIdx     = parseInt(document.getElementById('add-cast-csidx').value);
  const name      = document.getElementById('add-cast-name').value.trim();
  if (!name) { showToast('Name is required', 'info'); return; }
  const character = document.getElementById('add-cast-character').value.trim();
  const phone     = document.getElementById('add-cast-phone').value.trim();
  const email     = document.getElementById('add-cast-email').value.trim();
  const socials   = collectSocials('add-cast-socials-container');
  const callTime  = document.getElementById('add-cast-calltime').value.trim();
  const wrapTime  = document.getElementById('add-cast-wrap').value.trim();
  const poc       = document.getElementById('add-cast-poc').value.trim();
  const contact   = [phone, email].filter(Boolean).join(' / ');
  const p = currentProject();
  if (!p.callsheets[csIdx].castRows) p.callsheets[csIdx].castRows = [];
  const idx = p.callsheets[csIdx].castRows.length + 1;
  p.callsheets[csIdx].castRows.push({
    num: String(idx), actor: name, character,
    pu:'', arrive: callTime, mu:'', cos:'', onset:'', ready: wrapTime,
    poc, contact, socials, email
  });
  saveContactToProject(p, name, 'Cast', phone, email, socials);
  saveStore();
  closeModal('modal-add-cast');
  renderCallsheet(p);
  showToast('Cast member added', 'success');
}

function autofillCastFromContact() {
  const data = document.getElementById('add-cast-contact-select').value;
  if (!data) return;
  try {
    const c = JSON.parse(data);
    document.getElementById('add-cast-name').value  = c.name;
    document.getElementById('add-cast-phone').value = c.phone;
    document.getElementById('add-cast-email').value = c.email;
    const container = document.getElementById('add-cast-socials-container');
    container.innerHTML = '';
    if (c.socials) {
      c.socials.split(',').forEach(s => {
        const [plat, handle] = s.split('||');
        addSocialField('add-cast-socials-container', plat||'instagram', handle||'');
      });
    } else { addSocialField('add-cast-socials-container'); }
  } catch(e) {}
}

// ── Crew modal ────────────────────────────────────────────────────────────────

function addCSCustomField(csIdx) {
  document.getElementById('custom-field-select').value = '';
  document.getElementById('custom-field-label').value = '';
  document.getElementById('custom-field-name').value = '';
  document.getElementById('custom-field-phone').value = '';
  document.getElementById('custom-field-email').value = '';
  const sc = document.getElementById('custom-field-socials-container');
  sc.innerHTML = '';
  addSocialField('custom-field-socials-container', 'instagram', '');
  document.getElementById('custom-field-other-group').style.display = 'none';

  // Populate contact dropdown
  const crewSelect = document.getElementById('custom-field-contact-select');
  if (crewSelect) {
    crewSelect.innerHTML = '<option value="">— Select existing contact —</option>';
    if (typeof ContactAnchor !== 'undefined') {
      ContactAnchor.searchContacts('', 200).sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ name: c.name, phone: c.phone||'', email: c.email||'', socials: '' });
        opt.textContent = c.name + (c.phone ? ' — '+c.phone : '');
        crewSelect.appendChild(opt);
      });
    } else {
      populateContactSelect('custom-field-contact-select');
    }
  }

  document.getElementById('modal-customfield').dataset.csIdx = csIdx;
  openModal('modal-customfield');

  // Wire autocomplete on name field
  setTimeout(() => {
    const nameInput = document.getElementById('custom-field-name');
    if (nameInput && typeof ContactAnchor !== 'undefined') {
      ContactAnchor.attachPicker(nameInput, contact => {
        nameInput.value = contact.name;
        document.getElementById('custom-field-phone').value = contact.phone || '';
        document.getElementById('custom-field-email').value = contact.email || '';
      });
    }
  }, 80);
}

function onCustomFieldSelectChange() {
  const select = document.getElementById('custom-field-select');
  const otherGroup = document.getElementById('custom-field-other-group');
  if (select.value === 'Other') {
    otherGroup.style.display = 'block';
    document.getElementById('custom-field-label').value = '';
    document.getElementById('custom-field-label').focus();
  } else if (select.value) {
    otherGroup.style.display = 'none';
    document.getElementById('custom-field-label').value = select.value;
  } else {
    otherGroup.style.display = 'none';
    document.getElementById('custom-field-label').value = '';
  }
}

function saveCSCustomField() {
  const select = document.getElementById('custom-field-select');
  let label = (select.value && select.value !== 'Other')
    ? select.value
    : document.getElementById('custom-field-label').value.trim();
  if (!label) { showToast('Please select or enter a role', 'info'); return; }
  const name   = document.getElementById('custom-field-name').value.trim();
  const phone  = document.getElementById('custom-field-phone').value.trim();
  const email  = document.getElementById('custom-field-email').value.trim();
  const socials = collectSocials('custom-field-socials-container');
  const csIdx  = parseInt(document.getElementById('modal-customfield').dataset.csIdx);
  const p = currentProject();
  if (!p.callsheets[csIdx].customFields) p.callsheets[csIdx].customFields = [];
  p.callsheets[csIdx].customFields.push({ label, value: name, phone, email, socials });
  if (name) saveContactToProject(p, name, label, phone, email, socials);
  saveStore();
  closeModal('modal-customfield');
  renderCallsheet(p);
}

function autofillCrewFromContact() {
  const data = document.getElementById('custom-field-contact-select').value;
  if (!data) return;
  try {
    const c = JSON.parse(data);
    document.getElementById('custom-field-name').value  = c.name;
    document.getElementById('custom-field-phone').value = c.phone;
    document.getElementById('custom-field-email').value = c.email;
  } catch(e) {}
}

// ── Delete callsheet ──────────────────────────────────────────────────────────

function confirmDeleteCallsheet(i) {
  document.getElementById('modal-delete-cs-idx').value = i;
  openModal('modal-delete-cs');
}

function doDeleteCallsheet() {
  const i = parseInt(document.getElementById('modal-delete-cs-idx').value, 10);
  const p = currentProject();
  if (!p) return;
  p.callsheets.splice(i, 1);
  saveStore();
  closeModal('modal-delete-cs');
  renderCallsheet(p);
}

// ── Export modal ──────────────────────────────────────────────────────────────

function openExportModal() {
  const p = currentProject();
  if (!p?.callsheets?.length) { showToast('No callsheets to export', 'info'); return; }
  const list = document.getElementById('export-callsheet-list');
  list.innerHTML = p.callsheets.map((c, i) => {
    const d = c.date ? new Date(c.date + 'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) : 'TBD';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface2);border-radius:4px;margin-bottom:8px">
      <input type="checkbox" id="export-check-${i}" ${c.exportSelected!==false?'checked':''} style="width:16px;height:16px;cursor:pointer">
      <label for="export-check-${i}" style="flex:1;cursor:pointer;font-size:13px">
        <strong>Day ${c.shootDay||i+1}</strong> — ${d}${c.company?' — '+c.company:''}
      </label>
    </div>`;
  }).join('');
  openModal('modal-export');
}

function doExportPDF() {
  const p = currentProject();
  if (!p) return;
  const toExport = p.callsheets.filter((c, i) => {
    const cb = document.getElementById('export-check-' + i);
    return cb ? cb.checked : c.exportSelected !== false;
  });
  if (!toExport.length) { showToast('Select at least one callsheet', 'info'); return; }
  closeModal('modal-export');

  const rawHTML = toExport.map((c, idx) => renderSingleCallsheet(c, p.callsheets.indexOf(c))).join('');
  const tmp = document.createElement('div');
  tmp.innerHTML = rawHTML;
  tmp.querySelectorAll('.pdf-hide, button').forEach(el => el.remove());
  tmp.querySelectorAll('input[type="date"]').forEach(el => el.remove());
  tmp.querySelectorAll('input, select').forEach(el => {
    const span = document.createElement('span');
    span.className = el.className;
    // Preserve inline styles (e.g. font-weight on bold notices)
    if (el.style.cssText) span.style.cssText = el.style.cssText;
    span.textContent = el.value || '';
    el.replaceWith(span);
  });
  tmp.querySelectorAll('textarea').forEach(el => {
    const div = document.createElement('div');
    div.className = el.className;
    div.style.cssText = 'white-space:pre-wrap;';
    div.textContent = el.value || '';
    el.replaceWith(div);
  });

  document.getElementById('print-iframe')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;pointer-events:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(_callsheetPrintDoc(tmp.innerHTML, p.title));
  doc.close();
  setTimeout(() => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) { showToast('Print failed', 'info'); } }, 500);
  showToast('Opening print dialog…', 'info');
}

function _callsheetPrintDoc(html, title) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${(title||'Callsheet').replace(/</g,'&lt;')} — Call Sheet</title>
<style>
@page{margin:10mm;size:A4;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:Arial,"Helvetica Neue",sans-serif;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:10px;}
.cs-page{background:#fff;margin:0 0 20px;width:100%;page-break-after:always;break-after:page;}
.cs-page:last-child{page-break-after:auto;break-after:auto;}
.cs-top-bar{display:flex;align-items:stretch;border-bottom:3px solid #1a1a1a;}
.cs-logo-section{width:110px;min-width:110px;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10px;}
.cs-logo-drop{width:80px;height:44px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.cs-logo-drop img{width:100%;height:100%;object-fit:contain;}
.cs-header-main{flex:1;padding:12px 16px;}
.cs-header-info h1{font-size:20px;font-weight:900;letter-spacing:1px;text-transform:uppercase;}
.cs-prod-info{font-size:10px;color:#666;margin-bottom:2px;}
.cs-header-meta{display:flex;gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid #eee;flex-wrap:wrap;}
.cs-meta-item{display:flex;flex-direction:column;gap:1px;}
.cs-meta-label{font-size:7px;text-transform:uppercase;letter-spacing:1.5px;color:#999;font-weight:700;}
.cs-meta-input,.cs-meta-value{font-size:11px;font-weight:700;color:#1a1a1a;}
.cs-date-box{background:#1a1a1a;color:#fff;padding:10px 14px;text-align:center;min-width:80px;display:flex;flex-direction:column;justify-content:center;align-items:center;}
.cs-date-day{font-size:26px;font-weight:900;line-height:1;color:#fff;}
.cs-date-month{font-size:8px;text-transform:uppercase;letter-spacing:2px;margin-top:2px;color:rgba(255,255,255,0.8);}
.cs-date-year{font-size:9px;color:rgba(255,255,255,0.6);margin-top:1px;}
.cs-toggle-bar,.cs-header-controls,.cs-ctrl-btn,.cs-section-btn,.cs-drag-handle,.cs-add-row-btn,.pdf-hide{display:none!important;}
.cs-content{padding:14px 18px;}
.cs-draggable-section{margin-bottom:18px;page-break-inside:avoid;break-inside:avoid;}
.cs-heading{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #ddd;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;page-break-after:avoid;}
.cs-heading::before{content:'';display:block;width:3px;height:12px;background:#d4aa2c;border-radius:2px;}
/* Notices */
.cs-notice-bold{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 8px;background:#f0f0f0;margin-bottom:2px;}
.cs-notice-normal{font-size:10px;padding:3px 8px;margin-bottom:2px;}
/* Call times */
.cs-call-times{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
.cs-call-card{background:#f8f9fa;border:1px solid #e5e5e5;border-radius:3px;padding:8px;text-align:center;}
.cs-call-card.highlight{background:#1a1a1a!important;border-color:#1a1a1a;}
.cs-call-label{font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px;font-weight:700;display:block;}
.cs-call-card.highlight .cs-call-label{color:rgba(255,255,255,0.65)!important;}
.cs-call-input{font-size:14px;font-weight:800;color:#1a1a1a;display:block;text-align:center;width:100%;}
.cs-call-card.highlight .cs-call-input{color:#fff!important;}
.cs-weather-row{display:flex;gap:8px;padding:6px 10px;background:#f8f9fa;border-radius:3px;margin-bottom:14px;}
/* Tables */
.cs-table{width:100%;border-collapse:collapse;margin-bottom:8px;border:1px solid #e0e0e0;font-size:9px;}
.cs-table th{text-align:left;padding:5px 7px;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#666;background:#f5f5f5;border-bottom:2px solid #ddd;}
.cs-table td{padding:4px 6px;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
.cs-table-input{font-size:9px;color:#1a1a1a;display:block;width:100%;}
.cs-note{font-size:9px;color:#555;padding:5px 8px;background:#f8f9fa;border-left:3px solid #d4aa2c;border-radius:0 3px 3px 0;margin-bottom:6px;display:flex;gap:6px;}
.cs-notes-area{width:100%;padding:8px;border:1px solid #e5e5e5;border-radius:3px;font-size:10px;line-height:1.5;color:#333;white-space:pre-wrap;}
/* Dept */
.cs-dept-section{margin-bottom:10px;}
.cs-dept-header{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#5bc0eb;margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #e8e8e8;}
.cs-crew-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:4px;}
.cs-crew-table th{font-size:7px;font-weight:700;text-transform:uppercase;padding:3px 5px;background:#f8f9fa;border-bottom:1px solid #e8e8e8;}
.cs-crew-table td{padding:3px 5px;border-bottom:1px solid #f5f5f5;}
.cs-crew-role-cell{font-size:8px;font-weight:600;color:#666;}
.bf-footer{position:fixed;bottom:5mm;right:10mm;font-size:8px;color:#bbb;}
</style></head><body>${html}<div class="bf-footer">Powered by Black Fountain · blackfountain.io</div></body></html>`;
}

// ── Static render for PDF export ──────────────────────────────────────────────

function renderSingleCallsheet(c, idx) {
  const p = currentProject();
  _migrateCallsheet(c);
  const d = c.date ? new Date(c.date + 'T12:00:00') : null;
  const dayNum   = d ? d.getDate() : '—';
  const monthStr = d ? d.toLocaleDateString('en-GB', {month:'short'}).toUpperCase() : 'DATE';
  const yearStr  = d ? d.getFullYear() : new Date().getFullYear();
  const companyLogo = p.companyLogoDataUrl;
  const filmLogo    = c.logoDataUrl;

  const sectionDefs = {
    notices:      { hideKey: 'hideNotices',      renderFn: () => buildNoticesSection(c, idx) },
    scenes:       { hideKey: 'hideScenes',       renderFn: () => buildScenesSection(c, idx) },
    cast:         { hideKey: 'hideCast',         renderFn: () => buildCastSection(c, idx) },
    extras:       { hideKey: 'hideExtras',       renderFn: () => buildExtrasSection(c, idx) },
    stunts:       { hideKey: 'hideStunts',       renderFn: () => buildStuntsSection(c, idx) },
    crew:         { hideKey: 'hideCrewCall',     renderFn: () => buildCrewSection(c, idx) },
    locations:    { hideKey: 'hideLocations',    renderFn: () => buildLocationsSection(c, idx) },
    schedule:     { hideKey: 'hideSchedule',     renderFn: () => buildScheduleSection(c, idx) },
    requirements: { hideKey: 'hideRequirements', renderFn: () => buildRequirementsSection(c, idx) },
    notes:        { hideKey: 'hideNotes',        renderFn: () => buildNotesSection(c, idx) },
  };

  const sectionsHTML = (c.sectionOrder || Object.keys(sectionDefs)).map(key => {
    const def = sectionDefs[key];
    if (!def || c[def.hideKey]) return '';
    return `<div class="cs-draggable-section">${def.renderFn()}</div>`;
  }).join('');

  return `<div class="cs-page">
    <div class="cs-top-bar">
      <div class="cs-logo-section">
        <div class="cs-logo-drop">${companyLogo ? `<img src="${companyLogo}" alt="">` : ''}</div>
        <div style="color:#888;font-size:7px;text-align:center;margin-top:4px;opacity:0.5">${c.company||p.company||''}</div>
      </div>
      <div class="cs-header-main">
        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:1px">${_csEscVal(c.prodTitle||p.title||'')}</h1>
        <div class="cs-prod-info">Production ${_csEscVal(c.prodNum||p.num||'001')} &nbsp;•&nbsp; ${_csEscVal(c.company||p.company||'—')}</div>
        <div class="cs-header-meta">
          <div class="cs-meta-item"><span class="cs-meta-label">Call Sheet</span><span class="cs-meta-value">#${c.callSheetNum||idx+1}</span></div>
          <div class="cs-meta-item"><span class="cs-meta-label">Shoot Day</span><span class="cs-meta-value">Day ${c.shootDay||idx+1}</span></div>
          <div class="cs-meta-item"><span class="cs-meta-label">Date</span><span class="cs-meta-value">${d ? d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'}) : 'TBD'}</span></div>
          <div class="cs-meta-item"><span class="cs-meta-label">Director</span><span class="cs-meta-value">${_csEscVal(c.dirProd || (Array.isArray(p.directors) && p.directors.length ? p.directors.join(', ') : p.director) || '—')}</span></div>
          <div class="cs-meta-item"><span class="cs-meta-label">Producer</span><span class="cs-meta-value">${_csEscVal(c.producer || (Array.isArray(p.producers) && p.producers.length ? p.producers.join(', ') : p.producer) || '—')}</span></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="cs-logo-drop" style="background:#2a2a2a;width:60px;height:44px;">${filmLogo ? `<img src="${filmLogo}" alt="">` : ''}</div>
        <div class="cs-date-box" style="min-width:80px">
          <div class="cs-date-day">${dayNum}</div>
          <div class="cs-date-month">${monthStr}</div>
          <div class="cs-date-year">${yearStr}</div>
        </div>
      </div>
    </div>
    <div class="cs-content">${sectionsHTML}</div>
  </div>`;
}

// ── Drag and drop section reordering ─────────────────────────────────────────

function initCallsheetDragDrop(p) {
  document.querySelectorAll('.cs-draggable-section').forEach(section => {
    section.addEventListener('dragstart', handleSectionDragStart);
    section.addEventListener('dragover',  handleSectionDragOver);
    section.addEventListener('dragleave', handleSectionDragLeave);
    section.addEventListener('drop',      handleSectionDrop);
    section.addEventListener('dragend',   handleSectionDragEnd);
  });
}

let _dragSrcSection = null;
let _dragSrcCsIdx = null;
let _dragSrcKey = null;

function handleSectionDragStart(e) {
  const section = e.target.closest('.cs-draggable-section');
  if (!section) { e.preventDefault(); return; }
  _dragSrcSection = section;
  _dragSrcCsIdx = parseInt(section.dataset.csidx);
  _dragSrcKey = section.dataset.section;
  section.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _dragSrcKey);
}

function handleSectionDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this !== _dragSrcSection) this.classList.add('drag-over');
}

function handleSectionDragLeave(e) { this.classList.remove('drag-over'); }

function handleSectionDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (this === _dragSrcSection) return;
  const targetKey = this.dataset.section;
  const targetCsIdx = parseInt(this.dataset.csidx);
  if (targetCsIdx !== _dragSrcCsIdx) return;
  const p = currentProject();
  const order = p.callsheets[_dragSrcCsIdx].sectionOrder;
  if (!order) return;
  const srcIdx = order.indexOf(_dragSrcKey);
  const tgtIdx = order.indexOf(targetKey);
  if (srcIdx === -1 || tgtIdx === -1) return;
  order.splice(srcIdx, 1);
  order.splice(tgtIdx, 0, _dragSrcKey);
  saveStore();
  renderCallsheet(p);
  // If there are multiple callsheets, offer to apply to all
  if (p.callsheets.length > 1) {
    setTimeout(() => _csMaybeApplyOrderToAll(_dragSrcCsIdx), 200);
  }
}

function handleSectionDragEnd(e) {
  document.querySelectorAll('.cs-draggable-section').forEach(s => s.classList.remove('dragging','drag-over'));
  _dragSrcSection = null;
}

// ── _csImportFromDay (stripboard → callsheet) ─────────────────────────────────

function _csImportFromDay(csIdx, dayId) {
  if (!dayId) return;
  const p = currentProject();
  if (!p) return;
  const day = (p.stripboard?.days || []).find(d => d.id === dayId);
  if (!day) return;
  const sceneKeys = day.sceneKeys || day.sceneIds || [];
  if (!sceneKeys.length) { showToast('This shoot day has no scenes', 'info'); return; }

  const sceneData = _sbBuildSceneData(p);
  const schedRows = [];
  const allCast = new Set();
  const shootLocs = new Set();

  for (const key of sceneKeys) {
    const entry = sceneData[key] || {};
    const sceneNum = entry.scene?.sceneNumber || key;
    const cast = entry.cast || [];
    cast.forEach(n => allCast.add(n));
    const shots = (p.shots || []).filter(s => s.sceneKey === key);
    if (shots.length) {
      shots.forEach(s => schedRows.push({
        time:'', scene: sceneNum, shot: s.setup ? s.setup+'.'+s.num : s.num||'',
        shotType: s.type||'', desc: s.desc||'', cast: s.cast||cast.join(', '),
        est: String(_parseEstMins(s.length)||'')
      }));
    } else {
      schedRows.push({ time:'', scene: sceneNum, shot:'', shotType:'', desc: entry.scene?.location||'', cast: cast.join(', '), est:'' });
    }
    const custom = p.stripboard?.sceneData?.[key];
    const loc = custom?.shootLoc || entry.scene?.location;
    if (loc) shootLocs.add(loc);
  }

  const castRows = allCast.size
    ? [...allCast].map((name, idx) => {
        const pc = (p.cast||[]).find(c => (c.role||'').toLowerCase() === name.toLowerCase());
        return { num: String(idx+1), actor: pc?.name||name, character: name, pu:'', arrive:'', mu:'', cos:'', onset:'', ready:'', poc:'', contact: pc ? [pc.number||pc.phone,pc.email].filter(Boolean).join(' / ') : '' };
      })
    : (p.cast||[]).map((m,idx) => ({ num: String(idx+1), actor: m.name||'', character: m.role||'', pu:'', arrive:'', mu:'', cos:'', onset:'', ready:'', poc:'', contact: [m.number||m.phone,m.email].filter(Boolean).join(' / ') })).filter(r => r.actor);

  const locRows = [...shootLocs].map(loc => ({ loc, city:'', parking:'', hospital:'' }));
  const crewFields = (p.unit||[]).map(m => ({ label: m.role||'Crew', value: m.name||'', phone: m.number||'' })).filter(f => f.value);

  const doImport = () => {
    const c = p.callsheets[csIdx];
    if (!c) return;
    if (schedRows.length) c.schedRows = schedRows;
    if (castRows.length)  c.castRows  = castRows;
    if (locRows.length)   c.locRows   = locRows;
    if (crewFields.length && !(c.customFields||[]).length) c.customFields = crewFields;
    if (day.date) c.date = day.date;
    c.shootDayId = dayId;
    saveStore(); renderCallsheet(p);
    showToast(`Imported ${schedRows.length} rows, ${castRows.length} cast, ${locRows.length} locations`, 'success');
  };

  const c = p.callsheets[csIdx];
  const hasData = c && ((c.schedRows?.length||0) > 0 || (c.castRows?.length||0) > 0 || (c.locRows||[]).some(r => r.loc||r.city));
  hasData ? showConfirmDialog(`Replace this callsheet's data from "${day.label}"?`, 'Import', doImport) : doImport();
}

// ── Orphan contact helpers (kept for compatibility) ───────────────────────────

function isPersonStillInProject(p, name) {
  const key = name.toLowerCase();
  return (
    (p.cast   || []).some(r => r.name?.toLowerCase() === key) ||
    (p.extras || []).some(r => r.name?.toLowerCase() === key) ||
    (p.unit   || []).some(r => r.name?.toLowerCase() === key) ||
    (p.callsheets || []).some(cs =>
      (cs.castRows    || []).some(r => r.actor?.toLowerCase() === key) ||
      (cs.customFields|| []).some(cf => cf.value?.toLowerCase() === key)
    )
  );
}

function maybePromptOrphanContact(p, name) {
  if (!name || isPersonStillInProject(p, name)) return;
  p.contacts = p.contacts || [];
  const key = name.toLowerCase();
  if (!p.contacts.some(c => c.name?.toLowerCase() === key)) {
    p.contacts.push({ name, roles:['Contact'], phone:'', email:'' });
    saveStore();
  }
  document.getElementById('orphan-contact-name').value = name;
  document.getElementById('orphan-contact-display').textContent = name;
  openModal('modal-orphan-contact');
}

function confirmOrphanRemove() {
  const name = document.getElementById('orphan-contact-name').value;
  if (name) {
    const key = name.toLowerCase();
    store.projects.forEach(p => {
      p.contacts = (p.contacts||[]).filter(c => c.name?.toLowerCase() !== key);
    });
    saveStore();
    if (document.getElementById('contacts-list')) renderContacts();
  }
  closeModal('modal-orphan-contact');
}

// ── Weather fetch ─────────────────────────────────────────────────────────────

async function fetchCallsheetWeather(csIdx) {
  const p = currentProject();
  const c = p.callsheets[csIdx];
  if (!c || !c.date) { showToast('Set a date first', 'info'); return; }

  const WMO   = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Heavy thunderstorm'};
  const EMOJI = {0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'🌨',80:'🌦',81:'🌧',82:'⛈',95:'⛈',96:'⛈',99:'⛈'};

  // Collect DOM-geocoded inputs for this callsheet
  const locInputEls = document.querySelectorAll(`#cs-page-${csIdx} [data-loc-auto]`);
  const domLocMap = {};
  locInputEls.forEach(inp => {
    if (inp.dataset.lat && inp.dataset.lon)
      domLocMap[inp.value] = { lat: parseFloat(inp.dataset.lat), lon: parseFloat(inp.dataset.lon) };
  });

  // Unique location names from loc rows
  const locRows = (c.locRows || []).filter(r => r.loc || r.city || r.parking);
  const locNames = [...new Set(locRows.map(r => r.city || r.loc || r.parking).filter(Boolean))];
  if (!locNames.length) { showToast('Add a location first so we know where to check', 'info'); return; }

  // Helper: geocode one name, showing disambiguation if needed
  async function resolveOne(name) {
    if (domLocMap[name]) return { lat: domLocMap[name].lat, lon: domLocMap[name].lon, label: name };
    try {
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(name)}`);
      const geoData = await geo.json();
      if (!geoData.length) return null;
      if (geoData.length === 1) {
        const r = geoData[0]; const a = r.address;
        return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: [r.name, a?.county||a?.state_district, a?.country].filter(Boolean).join(', ') };
      }
      // Multiple results — show picker
      const candidates = geoData.slice(0,5).map(r => {
        const a = r.address;
        return { label: [r.name, a?.county||a?.state_district, a?.state, a?.country].filter(Boolean).join(', '), lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
      });
      return await confirmWeatherLocation(candidates, name);
    } catch(e) { return null; }
  }

  // Fetch weather for one resolved location
  async function fetchOne(lat, lon, label) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${c.date}&end_date=${c.date}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.daily?.weathercode) return null;
    const code = data.daily.weathercode[0];
    const tMax = Math.round(data.daily.temperature_2m_max[0]);
    const tMin = Math.round(data.daily.temperature_2m_min[0]);
    const rain = data.daily.precipitation_sum[0]?.toFixed(1);
    const wind = Math.round(data.daily.windspeed_10m_max[0]);
    return { loc: label, summary: `${EMOJI[code]||'🌡'} ${WMO[code]||'Unknown'}`, detail: `${tMin}°C – ${tMax}°C · Rain ${rain}mm · Wind ${wind}km/h` };
  }

  showToast(`Fetching weather for ${locNames.length} location${locNames.length > 1 ? 's' : ''}…`, 'info');

  const weatherByLoc = [];
  for (let i = 0; i < locNames.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/s
    const resolved = await resolveOne(locNames[i]);
    if (!resolved) continue;
    const result = await fetchOne(resolved.lat, resolved.lon, resolved.label || locNames[i]);
    if (result) weatherByLoc.push(result);
  }

  if (!weatherByLoc.length) { showToast('No forecast data available', 'info'); return; }

  c.weatherByLoc  = weatherByLoc;
  c.weather       = weatherByLoc[0].summary;
  c.weatherDetail = weatherByLoc[0].detail;
  saveStore(); renderCallsheet(p);
  showToast(`Weather updated for ${weatherByLoc.length} location${weatherByLoc.length > 1 ? 's' : ''} ✓`, 'success');
}

function _csUpdateWeatherLoc(csIdx, wi, field, val) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c.weatherByLoc?.[wi]) return;
  c.weatherByLoc[wi][field] = val;
  if (wi === 0) { if (field === 'summary') c.weather = val; else if (field === 'detail') c.weatherDetail = val; }
  saveStore();
}

// ── Daylight (sunrise/sunset) fetch ──────────────────────────────────────────

async function fetchCallsheetDaylight(csIdx) {
  const p = currentProject();
  const c = p.callsheets[csIdx];
  if (!c || !c.date) { showToast('Set a date first', 'info'); return; }

  let lat, lon;

  // Try geocoded location from input data-lat/lon
  const locInputs = document.querySelectorAll(`#cs-page-${csIdx} [data-loc-auto]`);
  for (const inp of locInputs) {
    if (inp.dataset.lat && inp.dataset.lon) {
      lat = parseFloat(inp.dataset.lat);
      lon = parseFloat(inp.dataset.lon);
      break;
    }
  }

  // Fallback: geocode first non-empty loc row
  if (!lat || !lon) {
    const locRows = c.locRows || [];
    const firstLocStr = locRows.find(r => r.city || r.loc)?.city || locRows.find(r => r.loc)?.loc || '';
    if (firstLocStr) {
      try {
        const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(firstLocStr)}`);
        const geoData = await geo.json();
        if (geoData.length) { lat = parseFloat(geoData[0].lat); lon = parseFloat(geoData[0].lon); }
      } catch(e) {}
    }
  }

  if (!lat || !lon) { showToast('Add a location first so we know where to check', 'info'); return; }

  try {
    showToast('Fetching sunrise/sunset…', 'info');
    const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${c.date}&formatted=0`);
    const data = await res.json();
    if (data.status !== 'OK') { showToast('Could not get daylight data', 'info'); return; }
    const fmt = iso => {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    };
    const rise = fmt(data.results.sunrise);
    const set  = fmt(data.results.sunset);
    c.daylight = `${rise} – ${set}`;
    saveStore(); renderCallsheet(p);
    showToast(`Daylight: ${c.daylight} ✓`, 'success');
  } catch(e) { showToast('Could not fetch daylight data', 'info'); }
}

// ── Section move (up/down arrows) ─────────────────────────────────────────────

function csMoveSection(csIdx, sectionKey, direction) {
  const p = currentProject();
  if (!p) return;
  const order = p.callsheets[csIdx].sectionOrder;
  const idx = order.indexOf(sectionKey);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= order.length) return;
  order.splice(idx, 1);
  order.splice(newIdx, 0, sectionKey);
  saveStore();
  renderCallsheet(p);
  if (p.callsheets.length > 1) {
    setTimeout(() => _csMaybeApplyOrderToAll(csIdx), 200);
  }
}

// Apply one callsheet's section order to all callsheets in the project
function csApplyOrderToAll(csIdx) {
  const p = currentProject();
  if (!p) return;
  const order = [...p.callsheets[csIdx].sectionOrder];
  p.callsheets.forEach((c, i) => { if (i !== csIdx) c.sectionOrder = [...order]; });
  saveStore();
  renderCallsheet(p);
  showToast(`Section order applied to all ${p.callsheets.length} callsheets`, 'success');
}

// ── Scene row helpers ─────────────────────────────────────────────────────────

function _csAddSceneRow(csIdx) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c.sceneRows) c.sceneRows = [];
  const nextNum = String(c.sceneRows.length + 1);
  addCSRow(csIdx, 'sceneRows', { sceneNum: nextNum, intExt:'', location:'', dn:'', synopsis:'', pages:'', castNums:'' });
}

// ── Schedule: Add Other row ───────────────────────────────────────────────────

function _csAddSchedOther(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = p.callsheets[csIdx]?.schedRows || [];
  addCSRow(csIdx, 'schedRows', {
    time: _csNextTime(rows), scene:'', shot:'', shotType:'OTHER',
    desc:'', cast:'', est:'', isOther: true
  });
}

// ── First Shot cascade: shift all schedule times ──────────────────────────────

function _csCascadeFirstShot(csIdx, newFirstShot) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c || !c.schedRows?.length) return;
  const newFirstMins = _parseTimeToMins(newFirstShot);
  if (!newFirstMins && newFirstMins !== 0) return;

  // Find the current first timed row
  const firstTimed = c.schedRows.find(r => r.time);
  if (!firstTimed) {
    c.schedRows[0].time = newFirstShot;
    _csRecalcTimes(csIdx, 1);
    saveStore();
    return;
  }

  const oldFirstMins = _parseTimeToMins(firstTimed.time);
  const delta = newFirstMins - oldFirstMins;
  if (delta === 0) return;

  // Shift every timed row by delta
  c.schedRows.forEach(r => {
    if (r.time) r.time = _minsToTimeStr(Math.max(0, _parseTimeToMins(r.time) + delta));
  });

  // Recalc crew call (first shot − 60m) and est. wrap (last row time + est)
  c.crewCall = _minsToTimeStr(newFirstMins - 60);
  const timedRows = c.schedRows.filter(r => r.time);
  if (timedRows.length) {
    const last = timedRows[timedRows.length - 1];
    const lastMins = _parseTimeToMins(last.time);
    const lastEst  = _parseEstMins(last.est) || 0;
    c.estWrap = _minsToTimeStr(lastMins + lastEst);
  }

  saveStore();
  renderCallsheet(p);
}

// ── handleSectionDrop extended: prompt to apply to all ───────────────────────

function _csMaybeApplyOrderToAll(csIdx) {
  const p = currentProject();
  if (!p || p.callsheets.length <= 1) return;
  showConfirmDialog(
    `Apply this section order to all ${p.callsheets.length} callsheets?`,
    'Apply to All',
    () => csApplyOrderToAll(csIdx)
  );
}

// ══════════════════════════════════════════
// END CALLSHEET
// ══════════════════════════════════════════