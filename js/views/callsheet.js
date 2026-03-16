// CALLSHEET
// ══════════════════════════════════════════

function renderCallsheet(p) {
  const el = document.getElementById('callsheet-list');
  if (!p || !p.callsheets) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>No project selected</h4><p>Select a project to view callsheets</p></div>';
    return;
  }
  if (!p.callsheets.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>No callsheets yet</h4><p>Create a callsheet for each shoot day</p></div>';
    return;
  }
  el.innerHTML = p.callsheets.map((c, i) => buildCallsheetCard(p, c, i)).join('');
  initCallsheetDragDrop(p);
  // Attach location and hospital autocomplete to any new inputs
  setTimeout(() => {
    el.querySelectorAll('[data-loc-auto]:not([data-loc-auto-attached])').forEach(inp => {
      if (window.attachLocAuto) window.attachLocAuto(inp);
    });
    el.querySelectorAll('[data-hosp-auto]:not([data-hosp-auto-attached])').forEach(inp => {
      if (window.attachHospAuto) window.attachHospAuto(inp);
    });
  }, 100);
}

// ── Schedule time helpers ─────────────────────────────────────────────────────
function _parseEstMins(val) {
  if (!val) return 0;
  val = String(val).trim().toLowerCase();
  if (/^\d+$/.test(val)) return parseInt(val); // plain number = minutes
  // legacy formats for backwards compat: "1h30m", "1:30", "90m", "1.5h"
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

function _addMinsToTime(timeStr, mins) {
  if (!timeStr || !mins) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const total = h * 60 + m + mins;
  return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function _csNextTime(rows) {
  // Calculate what the next row's time should be based on the last row with a time + est
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].time && rows[i].est) {
      const mins = _parseEstMins(rows[i].est);
      if (mins > 0) return _addMinsToTime(rows[i].time, mins);
    }
    if (rows[i].time) return ''; // has time but no est — can't calculate
  }
  return '';
}

function _csRecalcTimes(csIdx, fromRow) {
  const p = currentProject();
  if (!p) return;
  const c = p.callsheets[csIdx];
  if (!c || !c.schedRows) return;
  const rows = c.schedRows;
  let changed = false;
  for (let i = fromRow; i < rows.length; i++) {
    if (rows[i].time) continue; // don't overwrite manually-set times
    const prev = rows[i - 1];
    if (prev && prev.time && prev.est) {
      const mins = _parseEstMins(prev.est);
      if (mins > 0) { rows[i].time = _addMinsToTime(prev.time, mins); changed = true; }
    }
  }
  if (changed) { saveStore(); renderCallsheet(p); }
}

function _csAddSchedShot(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = p.callsheets[csIdx]?.schedRows || [];
  addCSRow(csIdx, 'schedRows', { time: _csNextTime(rows), scene: '', shot: '', shotType: '', desc: '', cast: '', est: '' });
}

function _csAddSchedBreak(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = p.callsheets[csIdx]?.schedRows || [];
  addCSRow(csIdx, 'schedRows', { time: _csNextTime(rows), scene: '', shot: '', shotType: '', desc: 'BREAK', cast: '', est: '30' });
}

function _csAddSchedMisc(csIdx) {
  const p = currentProject();
  if (!p) return;
  const rows = p.callsheets[csIdx]?.schedRows || [];
  addCSRow(csIdx, 'schedRows', { time: _csNextTime(rows), scene: '', shot: '', shotType: '', desc: '', cast: '', est: '' });
}

// Escape a value for use inside an HTML attribute value (double-quoted)
function _csEscVal(v) {
  return (v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _csImportFromDay(csIdx, dayId) {
  if (!dayId) return;
  const p = currentProject();
  if (!p) return;
  const day = (p.stripboard?.days || []).find(d => d.id === dayId);
  if (!day) return;
  const sceneKeys = day.sceneKeys || [];
  if (!sceneKeys.length) {
    showToast('This shoot day has no scenes — drag scenes onto it in the Stripboard first', 'info');
    return;
  }
  const sceneData = _sbBuildSceneData(p);

  // Build schedRows: one row per shot, or one per scene if no shots
  const schedRows = [];
  for (const key of sceneKeys) {
    const entry = sceneData[key];
    const sceneNum = entry?.scene?.sceneNumber || key;
    const sceneCast = entry?.cast || [];
    const shots = (p.shots || []).filter(s => s.sceneKey === key);
    if (shots.length) {
      for (const s of shots) {
        schedRows.push({
          time: '',
          scene: sceneNum,
          shot: s.setup ? s.setup + '.' + (s.num || '') : (s.num || ''),
          shotType: s.type || '',
          desc: s.desc || s.movement || '',
          cast: s.cast || sceneCast.join(', '),
          est: String(_parseEstMins(s.length) || '')
        });
      }
    } else {
      schedRows.push({
        time: '',
        scene: sceneNum,
        shot: '',
        shotType: '',
        desc: entry?.scene?.location || '',
        cast: sceneCast.join(', '),
        est: ''
      });
    }
  }

  // Build castRows — from breakdown tags first, fall back to project cast list
  const allCast = new Set();
  for (const key of sceneKeys) {
    const entry = sceneData[key];
    (entry?.cast || []).forEach(name => allCast.add(name));
  }
  let castRows;
  if (allCast.size > 0) {
    castRows = [...allCast].map(name => ({ actor: name, character: '', callTime: '', wrapTime: '', poc: '', contact: '', socials: '' }));
  } else {
    // No breakdown tags — use the project's cast list
    castRows = (p.cast || []).map(m => ({
      actor: m.name || '',
      character: m.role || '',
      callTime: '',
      wrapTime: '',
      poc: '',
      contact: [m.number, m.email].filter(Boolean).join(' / '),
      socials: m.social || ''
    })).filter(r => r.actor);
  }

  // Build customFields (crew) from project unit list — only if not already populated
  const crewFields = (p.unit || []).map(m => ({
    label: m.role || m.dept || 'Crew',
    value: m.name || '',
    phone: m.number || ''
  })).filter(f => f.value);

  // Build locRows: prefer custom shootLoc saved on strip, fall back to script location
  const shootLocs = new Set();
  for (const key of sceneKeys) {
    const custom = p.stripboard?.sceneData?.[key];
    const loc = custom?.shootLoc || sceneData[key]?.scene?.location;
    if (loc) shootLocs.add(loc);
  }
  const locRows = [...shootLocs].map(loc => ({ loc, city: '', parking: '', hospital: '' }));

  const doImport = () => {
    const c = p.callsheets[csIdx];
    if (!c) return;
    if (schedRows.length) c.schedRows = schedRows;
    if (castRows.length) c.castRows = castRows;
    if (locRows.length) c.locRows = locRows;
    if (crewFields.length && !(c.customFields || []).length) c.customFields = crewFields;
    if (day.date) c.date = day.date;
    c.shootDayId = dayId;
    saveStore();
    renderCallsheet(p);
    const crewNote = crewFields.length ? `, ${crewFields.length} crew` : '';
    showToast(`Imported ${schedRows.length} schedule row${schedRows.length !== 1 ? 's' : ''}, ${castRows.length} cast${crewNote}, ${locRows.length} location${locRows.length !== 1 ? 's' : ''}`, 'success');
  };

  const c = p.callsheets[csIdx];
  // Only confirm if there's meaningful existing data (ignore the default empty location row)
  const hasData = c && (
    (c.schedRows?.length || 0) > 0 ||
    (c.castRows?.length || 0) > 0 ||
    (c.locRows || []).some(r => r.loc || r.city)
  );
  if (hasData) {
    showConfirmDialog(
      `Replace this callsheet's schedule, cast, and locations with data from "${day.label}"?`,
      'Import',
      doImport
    );
  } else {
    doImport();
  }
}

function buildCallsheetCard(p, c, i) {
  const d = c.date ? new Date(c.date + 'T12:00:00') : null;
  const dayNum = d ? d.getDate() : '—';
  const monthStr = d ? d.toLocaleDateString('en-GB', {month:'short'}).toUpperCase() : 'DATE';
  const yearStr = d ? d.getFullYear() : '2025';

  // Default section order
  if (!c.sectionOrder) c.sectionOrder = ['crew', 'locations', 'cast', 'schedule', 'notes'];

  const sectionDefs = {
    crew:      { label: 'Crew & Call Times', hideKey: 'hideCrewCall',   renderFn: () => buildCrewSection(c, i) },
    locations: { label: 'Locations',         hideKey: 'hideLocations',  renderFn: () => buildLocationsSection(c, i) },
    cast:      { label: 'Cast',              hideKey: 'hideCast',       renderFn: () => buildCastSection(c, i) },
    schedule:  { label: 'Schedule',          hideKey: 'hideSchedule',   renderFn: () => buildScheduleSection(c, i) },
    notes:     { label: 'Notes',             hideKey: 'hideNotes',      renderFn: () => buildNotesSection(c, i) },
  };

  const toggleBtns = c.sectionOrder.map(key => {
    const def = sectionDefs[key];
    const isActive = !c[def.hideKey];
    return `<button class="cs-ctrl-btn${isActive ? ' active' : ''}" onclick="toggleCSectionVisibility(${i},'${def.hideKey}');renderCallsheet(currentProject());">${def.label}</button>`;
  }).join('');

  const sbDays = p.stripboard?.days || [];
  const importDayBtn = sbDays.length ? `
    <select class="cs-ctrl-btn pdf-hide" style="cursor:pointer;max-width:180px" onchange="_csImportFromDay(${i},this.value);this.value='';" title="Import scenes, shots, cast & locations from a stripboard day">
      <option value="">↓ Import Shoot Day…</option>
      ${sbDays.map(d => `<option value="${d.id}">${d.label}${d.date ? ' · ' + d.date : ''}</option>`).join('')}
    </select>` : '';

  const sections = c.minimized ? '' : `
    <div class="cs-toggle-bar">
      ${toggleBtns}
      ${importDayBtn}
      <button class="cs-ctrl-btn right pdf-hide" onclick="emailCallsheet('${c.id}')" title="Email this callsheet">✉️ Email</button>
      <button class="cs-ctrl-btn right danger pdf-hide" onclick="confirmDeleteCallsheet(${i})">🗑 Delete</button>
    </div>
    <div class="cs-content" id="cs-sections-${i}">
      ${c.sectionOrder.map(key => {
        const def = sectionDefs[key];
        if (c[def.hideKey]) return '';
        return `<div class="cs-draggable-section" data-section="${key}" data-csidx="${i}">
          ${def.renderFn()}
        </div>`;
      }).join('')}
    </div>`;

  return `
  <div class="cs-page" id="cs-page-${i}">
    <div class="cs-top-bar">
      <div class="cs-logo-section">
        <div class="cs-logo-drop" onclick="uploadCallsheetLogo(${i})" title="Click to upload logo">
          ${c.logoDataUrl
            ? `<img src="${c.logoDataUrl}" alt="logo">`
            : '<span style="color:#888;font-size:9px;text-align:center;line-height:1.3;">CLICK<br>TO ADD<br>LOGO</span>'}
        </div>
      </div>
      <div class="cs-header-main">
        <div class="cs-header-row">
          <div class="cs-header-info">
            <h1>${c.prodTitle || p.title || 'PRODUCTION TITLE'}</h1>
            <div class="cs-prod-info">Production ${c.prodNum || p.num || '001'} &nbsp;•&nbsp; ${c.company || p.company || '—'}</div>
            <div class="cs-header-meta">
              <div class="cs-meta-item">
                <span class="cs-meta-label">Shoot Day</span>
                <input class="cs-meta-input" type="number" min="1" style="width:48px" value="${c.shootDay || i + 1}" onchange="updateCSF(${i},'shootDay',this.value)">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Date</span>
                <input class="cs-meta-input" type="date" style="width:130px" value="${c.date || ''}" onchange="updateCSF(${i},'date',this.value);renderCallsheet(currentProject());">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Director</span>
                <input class="cs-meta-input" style="width:110px" value="${c.dirProd || p.director || ''}" placeholder="Director" onchange="updateCSF(${i},'dirProd',this.value)">
              </div>
              <div class="cs-meta-item">
                <span class="cs-meta-label">Producer</span>
                <input class="cs-meta-input" style="width:110px" value="${c.producer || p.producer || ''}" placeholder="Producer" onchange="updateCSF(${i},'producer',this.value)">
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
      <div class="cs-date-box">
        <input type="date" value="${c.date || ''}" onchange="updateCSF(${i},'date',this.value);renderCallsheet(currentProject());" title="Click to set date">
        <div class="cs-date-day">${dayNum}</div>
        <div class="cs-date-month">${monthStr}</div>
        <div class="cs-date-year">${yearStr}</div>
      </div>
    </div>
    ${sections}
  </div>`;
}

function buildCrewSection(c, i) {
  return `
    <div class="cs-heading" draggable="false">
      <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
      CREW &amp; CALL TIMES
      <div class="cs-section-actions pdf-hide">
        <button class="cs-section-btn" onclick="toggleSectionMinimize(${i},'crew');renderCallsheet(currentProject());">${c.minimizedCrew ? '+ Expand' : '− Hide'}</button>
      </div>
    </div>
    <div style="display:${c.minimizedCrew ? 'none' : 'block'};">
      <div class="cs-call-times">
        <div class="cs-call-card highlight">
          <div class="cs-call-label">Crew Call</div>
          <input class="cs-call-input" value="${c.crewCall || ''}" placeholder="00:00" onchange="updateCSF(${i},'crewCall',this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">First Shot</div>
          <input class="cs-call-input" value="${c.shootCall || ''}" placeholder="00:00" onchange="updateCSF(${i},'shootCall',this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">Est. Wrap</div>
          <input class="cs-call-input" value="${c.estWrap || ''}" placeholder="00:00" onchange="updateCSF(${i},'estWrap',this.value)">
        </div>
        <div class="cs-call-card">
          <div class="cs-call-label">Daylight</div>
          <input class="cs-call-input" value="${c.daylight || ''}" placeholder="07:04 - 18:35" onchange="updateCSF(${i},'daylight',this.value)">
        </div>
      </div>
      <div class="cs-weather-row">
        <div class="cs-weather-item">
          <div class="cs-weather-icon">☁</div>
          <input class="cs-weather-input" value="${c.weather || ''}" placeholder="Weather forecast" onchange="updateCSF(${i},'weather',this.value)">
        </div>
        <div class="cs-weather-item">
          <div class="cs-weather-icon">💧</div>
          <input class="cs-weather-input" value="${c.weatherDetail || ''}" placeholder="Rain / Wind / Temp" onchange="updateCSF(${i},'weatherDetail',this.value)">
        </div>
        ${(() => {
          if (!c.date) return `<span class="pdf-hide" style="margin-left:auto;font-size:11px;color:#aaa;white-space:nowrap">Set a date to fetch weather</span>`;
          const daysAway = Math.round((new Date(c.date + 'T12:00:00') - new Date()) / 86400000);
          if (daysAway > 16) return `<span class="pdf-hide" title="Open-Meteo forecasts up to 16 days ahead — check back closer to the shoot date" style="margin-left:auto;font-size:11px;color:#aaa;white-space:nowrap;cursor:help">⛅ Forecast available in ~${daysAway - 16} days</span>`;
          if (daysAway < -1) return `<button class="cs-section-btn pdf-hide" onclick="fetchCallsheetWeather(${i})" style="margin-left:auto;white-space:nowrap;padding:4px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;opacity:0.7">📅 Get Historical</button>`;
          return `<button class="cs-section-btn pdf-hide" onclick="fetchCallsheetWeather(${i})" style="margin-left:auto;white-space:nowrap;padding:4px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;">⛅ Get Weather</button>`;
        })()}
      </div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:10px;">Key Crew Contacts</div>
      <div class="cs-crew-grid">
        ${(c.customFields || []).map((cf, fi) => `
          <div class="cs-crew-item">
            <div class="cs-crew-role" title="${cf.label}">${cf.label}</div>
            <div class="cs-crew-inputs">
              <input class="cs-crew-field" value="${cf.value || ''}" placeholder="Name" data-crew-auto autocomplete="off" onchange="updateCSCustomField(${i},${fi},this.value)">
              <input class="cs-crew-field" value="${cf.phone || ''}" placeholder="Phone" onchange="updateCSCustomField(${i},${fi},this.value,'phone')">
            </div>
            <button class="cs-section-btn pdf-hide" style="flex-shrink:0;color:#c44444" onclick="removeCSCustomField(${i},${fi})">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSCustomField(${i})" style="margin-top:10px;">+ Add Crew</button>
    </div>`;
}

function buildLocationsSection(c, i) {
  return `
    <div class="cs-heading" draggable="false">
      <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
      LOCATIONS
      <div class="cs-section-actions pdf-hide">
        <button class="cs-section-btn" onclick="toggleSectionMinimize(${i},'locations');renderCallsheet(currentProject());">${c.minimizedLocations ? '+ Expand' : '− Hide'}</button>
      </div>
    </div>
    <div style="display:${c.minimizedLocations ? 'none' : 'block'};">
      <table class="cs-table">
        <thead><tr><th>Venue / Address</th><th>City</th><th>Parking &amp; Notes</th><th>Nearest A&amp;E</th><th class="pdf-hide"></th></tr></thead>
        <tbody>
          ${(c.locRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" value="${r.loc || ''}" placeholder="Venue, street address…" autocomplete="off" data-loc-auto onchange="updateCSRow(${i},'locRows',${ri},'loc',this.value)"></td>
              <td><input class="cs-table-input" value="${r.city || ''}" placeholder="City" onchange="updateCSRow(${i},'locRows',${ri},'city',this.value)" style="max-width:120px"></td>
              <td><input class="cs-table-input" value="${r.parking || ''}" placeholder="Parking info, restrictions…" onchange="updateCSRow(${i},'locRows',${ri},'parking',this.value)"></td>
              <td><input class="cs-table-input" value="${r.hospital || ''}" placeholder="Hospital name &amp; postcode" autocomplete="off" data-hosp-auto data-row-idx="${ri}" data-cs-idx="${i}" onchange="updateCSRow(${i},'locRows',${ri},'hospital',this.value)"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'locRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button class="cs-add-row-btn pdf-hide" onclick="addCSRow(${i},'locRows',{loc:'',city:'',parking:'',hospital:''})">+ Add Location</button>
    </div>`;
}

function buildCastSection(c, i) {
  const showContact = c.hideContactDetails !== true;
  return `
    <div class="cs-heading" draggable="false">
      <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
      CAST
      <div class="cs-section-actions pdf-hide">
        <button class="cs-section-btn" onclick="toggleSectionMinimize(${i},'cast');renderCallsheet(currentProject());">${c.minimizedCast ? '+ Expand' : '− Hide'}</button>
        <button class="cs-section-btn" onclick="updateCSF(${i},'hideContactDetails',${showContact});renderCallsheet(currentProject());" title="${showContact ? 'Hide' : 'Show'} contact details">${showContact ? '🔒 Hide Contacts' : '👁 Show Contacts'}</button>
      </div>
    </div>
    <div style="display:${c.minimizedCast ? 'none' : 'block'};">
      <div class="cs-note">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;white-space:nowrap;">Actors POC:</span>
        <input class="cs-note-input" value="${c.actorsContact || ''}" placeholder="Name / Number" onchange="updateCSF(${i},'actorsContact',this.value)">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;white-space:nowrap;margin-left:16px;">SA POC:</span>
        <input class="cs-note-input" value="${c.sasContact || ''}" placeholder="Name / Number" onchange="updateCSF(${i},'sasContact',this.value)">
      </div>
      <table class="cs-table">
        <thead><tr>
          <th>Actor</th><th>Character</th><th>Call</th><th>Est. Wrap</th><th>POC</th>
          ${showContact ? '<th>Contact</th><th>Socials</th>' : ''}
          <th class="pdf-hide"></th>
        </tr></thead>
        <tbody>
          ${(c.castRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" value="${r.actor || ''}" placeholder="Name" data-actor-auto autocomplete="off" onchange="updateCSRow(${i},'castRows',${ri},'actor',this.value)"></td>
              <td><input class="cs-table-input" value="${r.character || ''}" placeholder="Character" data-char-auto autocomplete="off" onchange="updateCSRow(${i},'castRows',${ri},'character',this.value)"></td>
              <td><input class="cs-table-input" value="${r.callTime || ''}" placeholder="00:00" style="width:52px" onchange="updateCSRow(${i},'castRows',${ri},'callTime',this.value)"></td>
              <td><input class="cs-table-input" value="${r.wrapTime || ''}" placeholder="00:00" style="width:52px" onchange="updateCSRow(${i},'castRows',${ri},'wrapTime',this.value)"></td>
              <td><input class="cs-table-input" value="${r.poc || ''}" placeholder="Name / Num" onchange="updateCSRow(${i},'castRows',${ri},'poc',this.value)"></td>
              ${showContact ? `
              <td><input class="cs-table-input" value="${r.contact || ''}" placeholder="Phone / Email" onchange="updateCSRow(${i},'castRows',${ri},'contact',this.value)"></td>
              <td><input class="cs-table-input" value="${r.socials || ''}" placeholder="@handle" onchange="updateCSRow(${i},'castRows',${ri},'socials',this.value)"></td>` : ''}
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'castRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button class="cs-add-row-btn pdf-hide" onclick="openAddCastModal(${i})">+ Add Cast</button>
    </div>`;
}

function buildScheduleSection(c, i) {
  return `
    <div class="cs-heading" draggable="false">
      <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
      ESTIMATED SCHEDULE
      <div class="cs-section-actions pdf-hide">
        <button class="cs-section-btn" onclick="toggleSectionMinimize(${i},'schedule');renderCallsheet(currentProject());">${c.minimizedSchedule ? '+ Expand' : '− Hide'}</button>
      </div>
    </div>
    <div style="display:${c.minimizedSchedule ? 'none' : 'block'};">
      <table class="cs-table">
        <thead><tr>
          <th>Time</th><th>Scene</th><th>Shot</th><th>Type</th>
          <th>Description</th><th>Cast</th><th style="width:52px">Est. (mins)</th>
          <th class="pdf-hide"></th>
        </tr></thead>
        <tbody>
          ${(c.schedRows || []).map((r, ri) => `
            <tr>
              <td><input class="cs-table-input" type="time" value="${r.time || ''}" style="width:78px;cursor:pointer" onchange="updateCSRow(${i},'schedRows',${ri},'time',this.value);_csRecalcTimes(${i},${ri+1})"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.scene)}" placeholder="1A" style="width:36px" onchange="updateCSRow(${i},'schedRows',${ri},'scene',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.shot)}" placeholder="1" style="width:30px" onchange="updateCSRow(${i},'schedRows',${ri},'shot',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.shotType)}" placeholder="WS" list="shot-types-datalist" style="width:68px" onchange="updateCSRow(${i},'schedRows',${ri},'shotType',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.desc)}" placeholder="Description" onchange="updateCSRow(${i},'schedRows',${ri},'desc',this.value)"></td>
              <td><input class="cs-table-input" value="${_csEscVal(r.cast)}" placeholder="Cast" data-cast-auto autocomplete="off" onchange="updateCSRow(${i},'schedRows',${ri},'cast',this.value)"></td>
              <td><input class="cs-table-input" type="number" min="0" step="5" value="${r.est || ''}" placeholder="mins" style="width:52px" onchange="updateCSRow(${i},'schedRows',${ri},'est',this.value);_csRecalcTimes(${i},${ri+1})" onkeydown="if(event.key==='Enter'){event.preventDefault();updateCSRow(${i},'schedRows',${ri},'est',this.value);_csAddSchedShot(${i});}"></td>
              <td class="pdf-hide"><button class="cs-section-btn" style="color:#c44444" onclick="removeCSRow(${i},'schedRows',${ri})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="pdf-hide" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button class="cs-add-row-btn" onclick="_csAddSchedShot(${i})">+ Add Shot</button>
        <button class="cs-add-row-btn" onclick="_csAddSchedBreak(${i})">+ Break</button>
        <button class="cs-add-row-btn" onclick="_csAddSchedMisc(${i})">+ Misc / Note</button>
      </div>
    </div>`;
}

function buildNotesSection(c, i) {
  return `
    <div class="cs-heading" draggable="false">
      <span class="cs-drag-handle pdf-hide" draggable="true" title="Drag to reorder">⠿</span>
      NOTES &amp; INFORMATION
      <div class="cs-section-actions pdf-hide">
        <button class="cs-section-btn" onclick="toggleSectionMinimize(${i},'notes');renderCallsheet(currentProject());">${c.minimizedNotes ? '+ Expand' : '− Hide'}</button>
      </div>
    </div>
    <div style="display:${c.minimizedNotes ? 'none' : 'block'};">
      <textarea class="cs-notes-area" placeholder="Enter any important notes, safety info, production updates…" onchange="updateCSF(${i},'generalNotes',this.value)">${c.generalNotes || ''}</textarea>
    </div>`;
}

// Drag-and-drop section reordering
function initCallsheetDragDrop(p) {
  document.querySelectorAll('.cs-draggable-section').forEach(section => {
    section.addEventListener('dragstart', handleSectionDragStart);
    section.addEventListener('dragover', handleSectionDragOver);
    section.addEventListener('dragleave', handleSectionDragLeave);
    section.addEventListener('drop', handleSectionDrop);
    section.addEventListener('dragend', handleSectionDragEnd);
  });
  // Also attach to drag handles for better reliability
  document.querySelectorAll('.cs-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', handleSectionDragStart);
    handle.addEventListener('dragend', handleSectionDragEnd);
  });
}

let _dragSrcSection = null;
let _dragSrcCsIdx = null;
let _dragSrcKey = null;

function handleSectionDragStart(e) {
  // Get the section from the drag handle (the handle is now the draggable element)
  const section = e.target.closest('.cs-draggable-section');
  if (!section) {
    e.preventDefault();
    return;
  }
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
function handleSectionDragLeave(e) {
  this.classList.remove('drag-over');
}
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
}
function handleSectionDragEnd(e) {
  document.querySelectorAll('.cs-draggable-section').forEach(s => {
    s.classList.remove('dragging', 'drag-over');
  });
  _dragSrcSection = null;
}

// For PDF export — render a static (non-interactive) version of a callsheet
function renderSingleCallsheet(c, i) {
  const p = currentProject();
  const d = c.date ? new Date(c.date + 'T12:00:00') : null;
  const dayNum = d ? d.getDate() : '—';
  const monthStr = d ? d.toLocaleDateString('en-GB', {month:'short'}).toUpperCase() : 'DATE';
  const yearStr = d ? d.getFullYear() : '2025';
  const showContact = c.hideContactDetails !== true;

  const sectionOrder = c.sectionOrder || ['crew', 'locations', 'cast', 'schedule', 'notes'];

  const sectionHTML = {
    crew: !c.hideCrewCall ? buildCrewSection(c, i) : '',
    locations: !c.hideLocations ? buildLocationsSection(c, i) : '',
    cast: !c.hideCast ? buildCastSection(c, i) : '',
    schedule: !c.hideSchedule ? buildScheduleSection(c, i) : '',
    notes: !c.hideNotes ? buildNotesSection(c, i) : '',
  };

  const sections = sectionOrder.map(key => sectionHTML[key] || '').join('');

  return `
  <div class="cs-page">
    <div class="cs-top-bar">
      <div class="cs-logo-section">
        <div class="cs-logo-drop" style="border:none;background:transparent;">
          ${c.logoDataUrl ? `<img src="${c.logoDataUrl}" alt="logo">` : '<span style="color:#888;font-size:9px;text-align:center;line-height:1.3;">LOGO</span>'}
        </div>
      </div>
      <div class="cs-header-main">
        <div class="cs-header-info">
          <h1>${c.prodTitle || p.title || 'PRODUCTION TITLE'}</h1>
          <div class="cs-prod-info">Production ${c.prodNum || p.num || '001'} &nbsp;•&nbsp; ${c.company || p.company || '—'}</div>
          <div class="cs-header-meta">
            <div class="cs-meta-item"><span class="cs-meta-label">Shoot Day</span><span class="cs-meta-value">Day ${c.shootDay || i + 1}</span></div>
            <div class="cs-meta-item"><span class="cs-meta-label">Date</span><span class="cs-meta-value">${d ? d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'}) : 'TBD'}</span></div>
            <div class="cs-meta-item"><span class="cs-meta-label">Director</span><span class="cs-meta-value">${c.dirProd || p.director || '—'}</span></div>
            <div class="cs-meta-item"><span class="cs-meta-label">Producer</span><span class="cs-meta-value">${c.producer || p.producer || '—'}</span></div>
          </div>
        </div>
      </div>
      <div class="cs-date-box">
        <div class="cs-date-day">${dayNum}</div>
        <div class="cs-date-month">${monthStr}</div>
        <div class="cs-date-year">${yearStr}</div>
      </div>
    </div>
    <div class="cs-content">${sections}</div>
  </div>`;
}

// ── CALLSHEET HELPERS ──────────────────────────────────────────────────────

function updateCSF(idx, field, val) {
  const p = currentProject();
  p.callsheets[idx][field] = val;
  saveStore();
}

function updateCSRow(csIdx, arrayKey, rowIdx, field, val) {
  const p = currentProject();
  if (!p.callsheets[csIdx][arrayKey]) p.callsheets[csIdx][arrayKey] = [];
  if (!p.callsheets[csIdx][arrayKey][rowIdx]) p.callsheets[csIdx][arrayKey][rowIdx] = {};
  p.callsheets[csIdx][arrayKey][rowIdx][field] = val;
  saveStore();
}

function addCSRow(csIdx, arrayKey, template) {
  const p = currentProject();
  if (!p.callsheets[csIdx][arrayKey]) p.callsheets[csIdx][arrayKey] = [];
  p.callsheets[csIdx][arrayKey].push({...template});
  saveStore();
  renderCallsheet(p);
}

// Remove a name from p.contacts[] only if they're no longer referenced anywhere in the project
function isPersonStillInProject(p, name) {
  const key = name.toLowerCase();
  return (
    (p.cast || []).some(r => r.name?.toLowerCase() === key) ||
    (p.extras || []).some(r => r.name?.toLowerCase() === key) ||
    (p.unit || []).some(r => r.name?.toLowerCase() === key) ||
    (p.callsheets || []).some(cs =>
      (cs.castRows || []).some(r => r.actor?.toLowerCase() === key) ||
      (cs.customFields || []).some(cf => cf.value?.toLowerCase() === key)
    )
  );
}

function isPersonAnywhereOnSite(name) {
  const key = name.toLowerCase();
  return store.projects.some(p =>
    (p.cast || []).some(r => r.name?.toLowerCase() === key) ||
    (p.extras || []).some(r => r.name?.toLowerCase() === key) ||
    (p.unit || []).some(r => r.name?.toLowerCase() === key) ||
    (p.contacts || []).some(c => c.name?.toLowerCase() === key) ||
    (p.callsheets || []).some(cs =>
      (cs.castRows || []).some(r => r.actor?.toLowerCase() === key) ||
      (cs.customFields || []).some(cf => cf.value?.toLowerCase() === key)
    )
  );
}

// Gather whatever info we know about a person from live project data
function gatherPersonInfo(name) {
  const key = name.toLowerCase();
  let phone = '', email = '', roles = [], socials = '';
  store.projects.forEach(p => {
    (p.contacts || []).forEach(c => {
      if (c.name?.toLowerCase() === key) {
        if (c.phone) phone = c.phone;
        if (c.email) email = c.email;
        if (c.socials) socials = c.socials;
        (c.roles || []).forEach(r => { if (!roles.includes(r)) roles.push(r); });
      }
    });
    [...(p.cast||[]), ...(p.extras||[]), ...(p.unit||[])].forEach(r => {
      if (r.name?.toLowerCase() === key) {
        if (r.number || r.phone) phone = r.number || r.phone || phone;
        if (r.email) email = r.email;
      }
    });
    (p.callsheets||[]).forEach(cs => {
      (cs.castRows||[]).forEach(r => { if (r.actor?.toLowerCase() === key && r.contact) phone = r.contact; });
      (cs.customFields||[]).forEach(cf => {
        if (cf.value?.toLowerCase() === key) {
          if (cf.phone) phone = cf.phone;
          if (cf.email) email = cf.email;
        }
      });
    });
  });
  if (!roles.length) roles = ['Contact'];
  return { phone, email, socials, roles };
}

function maybePromptOrphanContact(p, name) {
  if (!name) return;
  if (isPersonStillInProject(p, name)) return;
  if (isPersonAnywhereOnSite(name)) return;
  // Before prompting, ensure a p.contacts[] entry exists so "Keep" preserves them
  p.contacts = p.contacts || [];
  const key = name.toLowerCase();
  if (!p.contacts.some(c => c.name?.toLowerCase() === key)) {
    const info = gatherPersonInfo(name);
    p.contacts.push({ name, roles: info.roles, phone: info.phone, email: info.email, socials: info.socials });
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
      p.contacts = (p.contacts || []).filter(c => c.name?.toLowerCase() !== key);
    });
    saveStore();
    if (document.getElementById('contacts-list')) renderContacts();
  }
  closeModal('modal-orphan-contact');
}

function removeCSRow(csIdx, arrayKey, rowIdx) {
  showConfirmDialog('Remove this row?', 'Remove', () => {
    const p = currentProject();
    if (!p.callsheets[csIdx][arrayKey]) return;
    const row = p.callsheets[csIdx][arrayKey][rowIdx];
    const removedName = arrayKey === 'castRows' ? row?.actor : row?.value;
    p.callsheets[csIdx][arrayKey].splice(rowIdx, 1);
    saveStore();
    renderCallsheet(p);
    if (removedName) maybePromptOrphanContact(p, removedName);
  });
}

function removePersonnel(type, i) {
  showConfirmDialog('Remove this person?', 'Remove', () => {
    const p = currentProject();
    const removedName = p[type][i]?.name;
    p[type].splice(i, 1);
    saveStore();
    if (type === 'cast' || type === 'extras') renderCast(p);
    else renderCrew(p);
    if (removedName) maybePromptOrphanContact(p, removedName);
  });
}
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
  populateContactSelect('custom-field-contact-select');
  document.getElementById('modal-customfield').dataset.csIdx = csIdx;
  openModal('modal-customfield');
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

function removeCSCustomField(csIdx, fieldIdx) {
  showConfirmDialog('Remove this custom field?', 'Remove', () => {
    const p = currentProject();
    if (p.callsheets[csIdx].customFields) {
      p.callsheets[csIdx].customFields.splice(fieldIdx, 1);
      saveStore();
      renderCallsheet(p);
    }
  });
}

function updateCSCustomField(csIdx, fieldIdx, val, extra) {
  const p = currentProject();
  const cf = p.callsheets[csIdx].customFields && p.callsheets[csIdx].customFields[fieldIdx];
  if (!cf) return;
  if (extra === 'phone') cf.phone = val;
  else if (extra === 'email') cf.email = val;
  else if (extra === 'socials') cf.socials = val;
  else cf.value = val;
  saveStore();
}

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
  populateContactSelect('add-cast-contact-select');
  openModal('modal-add-cast');
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
  p.callsheets[csIdx].castRows.push({ actor: name, character, callTime, wrapTime, poc, contact, socials, email });
  saveContactToProject(p, name, 'Cast', phone, email, socials);
  saveStore();
  closeModal('modal-add-cast');
  renderCallsheet(p);
  showToast('Cast member added', 'success');
}

function addCallsheet() {
  const p = currentProject();
  if (!p) { showToast('No project selected', 'info'); return; }
  p.callsheets.push({
    date: '', prodNum: p.num, prodTitle: p.title, company: p.company || '',
    dirProd: p.director || '', producer: p.producer || '',
    crewCall: '', shootCall: '', estWrap: '', daylight: '', weather: '', weatherDetail: '',
    actorsContact: '', sasContact: '',
    locRows: [{loc:'', city:'', parking:'', hospital:''}],
    castRows: [], schedRows: [], generalNotes: '',
    logoDataUrl: null, customFields: [],
    sectionOrder: ['crew','locations','cast','schedule','notes'],
    hideContactDetails: true,
    hideCrewCall: false, hideLocations: false, hideCast: false, hideSchedule: false, hideNotes: false,
    minimized: false,
    minimizedCrew: false, minimizedLocations: false, minimizedCast: false,
    minimizedSchedule: false, minimizedNotes: false,
    exportSelected: true
  });
  saveStore();
  renderCallsheet(p);
}

function toggleCSectionVisibility(csIdx, sectionKey) {
  const p = currentProject();
  p.callsheets[csIdx][sectionKey] = !p.callsheets[csIdx][sectionKey];
  saveStore();
}

function toggleCallsheetMinimize(csIdx) {
  const p = currentProject();
  p.callsheets[csIdx].minimized = !p.callsheets[csIdx].minimized;
  saveStore();
  renderCallsheet(p);
}

function toggleSectionMinimize(csIdx, section) {
  const p = currentProject();
  const key = 'minimized' + section.charAt(0).toUpperCase() + section.slice(1);
  p.callsheets[csIdx][key] = !p.callsheets[csIdx][key];
  saveStore();
  renderCallsheet(p);
}

function uploadCallsheetLogo(csIdx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const p = currentProject();
      p.callsheets[csIdx].logoDataUrl = ev.target.result;
      saveStore();
      renderCallsheet(p);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function confirmDeleteCallsheet(i) {
  document.getElementById('modal-delete-cs-idx').value = i;
  openModal('modal-delete-cs');
}

function doDeleteCallsheet() {
  const i = parseInt(document.getElementById('modal-delete-cs-idx').value, 10);
  const p = currentProject();
  p.callsheets.splice(i, 1);
  saveStore();
  closeModal('modal-delete-cs');
  renderCallsheet(p);
}

function openExportModal() {
  const p = currentProject();
  if (!p.callsheets || !p.callsheets.length) { showToast('No callsheets to export', 'info'); return; }
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
  const toExport = p.callsheets.filter((c, i) => {
    const cb = document.getElementById('export-check-' + i);
    return cb ? cb.checked : c.exportSelected !== false;
  });
  if (!toExport.length) { showToast('Select at least one callsheet', 'info'); return; }
  closeModal('modal-export');

  // Build raw HTML then sanitise it for print:
  // 1. Strip .pdf-hide and buttons
  // 2. Replace <input> with <span> and <textarea> with <div> so no placeholder bleed
  const rawHTML = toExport.map((c) => renderSingleCallsheet(c, p.callsheets.indexOf(c))).join('');
  const tmp = document.createElement('div');
  tmp.innerHTML = rawHTML;
  tmp.querySelectorAll('.pdf-hide, button, input[type="date"]').forEach(el => el.remove());
  // Replace inputs with spans carrying the same value/text
  tmp.querySelectorAll('input').forEach(el => {
    const span = document.createElement('span');
    span.className = el.className;
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
  const callsheetHTML = tmp.innerHTML;

  document.getElementById('print-iframe')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${(p.title||'Call Sheet').replace(/</g,'&lt;')} — Call Sheet</title><style>
@page{margin:12mm;size:A4;}
@media print{
  html,body{margin:0!important;padding:0!important;}
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:Arial,"Helvetica Neue",sans-serif;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}

/* Callsheet page */
.cs-page{background:#fff;color:#1a1a1a;margin:0 0 20px;width:100%;font-family:Arial,sans-serif;page-break-after:always;break-after:page;}
.cs-page:last-child{page-break-after:auto;break-after:auto;}

/* Header */
.cs-top-bar{display:flex;flex-direction:row;align-items:stretch;border-bottom:3px solid #1a1a1a;width:100%;}
.cs-logo-section{width:120px;min-width:120px;max-width:120px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;padding:14px;}
.cs-logo-drop{width:80px;height:80px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.cs-logo-drop img{width:100%;height:100%;object-fit:contain;}
.cs-header-main{flex:1;padding:16px 20px;display:flex;flex-direction:column;justify-content:center;}
.cs-header-info h1{font-size:24px;font-weight:900;letter-spacing:1px;margin-bottom:3px;color:#1a1a1a;text-transform:uppercase;line-height:1.1;}
.cs-prod-info{font-size:11px;color:#666;font-weight:500;margin-bottom:2px;}
.cs-header-meta{display:flex;gap:14px;margin-top:8px;padding-top:8px;border-top:1px solid #eee;flex-wrap:wrap;}
.cs-meta-item{display:flex;flex-direction:column;gap:2px;}
.cs-meta-label{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#999;font-weight:700;}
.cs-meta-value,.cs-meta-input{font-size:12px;font-weight:700;color:#1a1a1a;}
.cs-date-box{background:#1a1a1a;color:#fff;padding:14px 18px;text-align:center;min-width:90px;display:flex;flex-direction:column;justify-content:center;align-items:center;flex-shrink:0;}
.cs-date-day{font-size:28px;font-weight:900;line-height:1;color:#fff;}
.cs-date-month{font-size:9px;text-transform:uppercase;letter-spacing:2px;margin-top:3px;color:rgba(255,255,255,0.8);}
.cs-date-year{font-size:10px;color:rgba(255,255,255,0.6);margin-top:1px;}
/* Hide the toggle bar entirely */
.cs-toggle-bar,.cs-header-controls,.cs-ctrl-btn,.cs-section-btn,.cs-drag-handle,.cs-add-row-btn{display:none!important;}

/* Content */
.cs-content{padding:20px 24px;}
.cs-draggable-section{margin-bottom:22px;page-break-inside:avoid;break-inside:avoid;}
.cs-heading{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #e0e0e0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;page-break-after:avoid;break-after:avoid;}
.cs-heading::before{content:'';display:block;width:4px;height:14px;background:#d4aa2c;border-radius:2px;flex-shrink:0;}

/* Call times */
.cs-call-times{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;}
.cs-call-card{background:#f8f9fa;border:1px solid #e5e5e5;border-radius:4px;padding:10px 12px;text-align:center;}
.cs-call-card.highlight{background:#1a1a1a!important;border-color:#1a1a1a;}
.cs-call-label{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:4px;font-weight:700;display:block;}
.cs-call-card.highlight .cs-call-label{color:rgba(255,255,255,0.65)!important;}
.cs-call-input,.cs-call-value{font-size:16px;font-weight:800;color:#1a1a1a;display:block;text-align:center;width:100%;}
.cs-call-card.highlight .cs-call-input,.cs-call-card.highlight .cs-call-value{color:#fff!important;}

/* Weather */
.cs-weather-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8f9fa;border-radius:4px;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;}
.cs-weather-item{display:flex;align-items:center;gap:6px;}
.cs-weather-icon{width:20px;height:20px;background:#1a1a1a;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;flex-shrink:0;}
.cs-weather-input{font-size:11px;color:#555;width:auto;}

/* Crew grid */
.cs-crew-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;page-break-inside:avoid;break-inside:avoid;}
.cs-crew-item{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:#f8f9fa;border-left:3px solid #5bc0eb;border-radius:0 4px 4px 0;page-break-inside:avoid;break-inside:avoid;}
.cs-crew-role{font-size:9px;font-weight:800;text-transform:uppercase;color:#5bc0eb;letter-spacing:0.8px;width:88px;min-width:88px;flex-shrink:0;padding-top:2px;}
.cs-crew-inputs{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
.cs-crew-field{font-size:11px;color:#1a1a1a;font-weight:500;display:block;padding:1px 0;border-bottom:1px solid #e8e8e8;width:100%;}
.cs-crew-field:last-child{border-bottom:none;}

/* Tables */
.cs-table{width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #e8e8e8;}
.cs-table th{text-align:left;padding:7px 9px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#666;background:#f5f5f5;border-bottom:2px solid #e0e0e0;white-space:nowrap;}
.cs-table td{padding:6px 9px;border-bottom:1px solid #f0f0f0;vertical-align:middle;font-size:11.5px;}
.cs-table tr{page-break-inside:avoid;break-inside:avoid;}
.cs-table tr:last-child td{border-bottom:none;}
.cs-table-input{font-size:11.5px;color:#1a1a1a;font-weight:500;display:block;width:100%;}

/* Cast note row */
.cs-note{font-size:11px;color:#555;padding:7px 10px;background:#f8f9fa;border-left:3px solid #d4aa2c;border-radius:0 4px 4px 0;margin-bottom:8px;display:flex;align-items:center;gap:8px;page-break-inside:avoid;break-inside:avoid;}
.cs-note-input{font-size:11px;color:#1a1a1a;font-weight:600;flex:1;}
.cs-notes-area{width:100%;padding:10px 12px;border:1px solid #e5e5e5;border-radius:4px;background:#fafafa;font-size:12px;line-height:1.6;color:#333;white-space:pre-wrap;}
.bf-footer{position:fixed;bottom:6mm;right:12mm;font-size:9px;color:#bbb;font-family:Arial,sans-serif;}
</style></head><body>${callsheetHTML}<div class="bf-footer">Powered by Black Fountain · blackfountain.io</div></body></html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(e) {
      console.error('Print failed:', e);
      showToast('Print failed — try right-clicking and Print', 'info');
    }
  }, 500);

  showToast('Opening print dialog…', 'info');
}



function addSocialField(containerId, platform = 'instagram', handle = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'social-field-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = `
    <select class="form-select" style="width:100px;background:transparent;border:none;border-bottom:1px solid var(--border);border-radius:0;padding:4px 0" data-platform>
      <option value="instagram" ${platform==='instagram'?'selected':''}>📸 IG</option>
      <option value="facebook"  ${platform==='facebook' ?'selected':''}>📘 FB</option>
      <option value="twitter"   ${platform==='twitter'  ?'selected':''}>🐦 X</option>
      <option value="bluesky"   ${platform==='bluesky'  ?'selected':''}>☁️ BSky</option>
      <option value="tiktok"    ${platform==='tiktok'   ?'selected':''}>🎵 TT</option>
      <option value="youtube"   ${platform==='youtube'  ?'selected':''}>▶️ YT</option>
      <option value="linkedin"  ${platform==='linkedin' ?'selected':''}>💼 LI</option>
      <option value="website"   ${platform==='website'  ?'selected':''}>🌐 Web</option>
    </select>
    <input class="form-input-minimal" placeholder="@handle or URL" value="${handle}" data-handle style="flex:1">
    <button type="button" class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 8px">✕</button>`;
  container.appendChild(row);
}

function collectSocials(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return '';
  return Array.from(container.querySelectorAll('.social-field-row')).map(row => {
    const platform = row.querySelector('[data-platform]').value;
    const handle   = row.querySelector('[data-handle]').value.trim();
    return handle ? platform + '||' + handle : '';
  }).filter(Boolean).join(',');
}

function populateContactSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">— Select existing contact —</option>';
  const seen = new Set();
  // Get current project first for priority, then others
  const currentP = currentProject();
  if (currentP && currentP.contacts) {
    currentP.contacts.forEach(c => {
      if (c.name && !seen.has(c.name.toLowerCase())) {
        seen.add(c.name.toLowerCase());
        const opt = document.createElement('option');
        opt.value = JSON.stringify({name:c.name, phone:c.phone||'', email:c.email||'', socials:c.socials||''});
        opt.textContent = c.name + (c.role ? ' (' + c.role + ')' : '');
        select.appendChild(opt);
      }
    });
  }
  store.projects.forEach(p => {
    if (p.id === currentP?.id) return; // skip current project already added
    (p.contacts || []).forEach(c => {
      if (c.name && !seen.has(c.name.toLowerCase())) {
        seen.add(c.name.toLowerCase());
        const opt = document.createElement('option');
        opt.value = JSON.stringify({name:c.name, phone:c.phone||'', email:c.email||'', socials:c.socials||''});
        opt.textContent = c.name + (c.role ? ' (' + c.role + ')' : '') + ' - ' + p.title;
        select.appendChild(opt);
      }
    });
  });
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

function autofillPersonnelFromContact() {
  const data = document.getElementById('pers-contact-select').value;
  if (!data) return;
  try {
    const c = JSON.parse(data);
    document.getElementById('pers-name').value   = c.name;
    document.getElementById('pers-number').value = c.phone  || '';
    document.getElementById('pers-email').value  = c.email  || '';
    document.getElementById('pers-social').value = c.socials|| '';
  } catch(e) {}
}

function saveContactToProject(project, name, role, phone, email, socials) {
  if (!project.contacts) project.contacts = [];
  const idx = project.contacts.findIndex(c => c.name && c.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    if (phone)  project.contacts[idx].phone  = phone;
    if (email)  project.contacts[idx].email  = email;
    if (socials)project.contacts[idx].socials = socials;
    if (role && !project.contacts[idx].roles.includes(role)) project.contacts[idx].roles.push(role);
    project.contacts[idx].manual = true; // mark as explicitly saved
  } else {
    project.contacts.push({ name, roles:[role], phone:phone||'', email:email||'', socials:socials||'', manual: true });
  }
}

function removeContactFromProject(project, name) {
  if (!project.contacts) return;
  project.contacts = project.contacts.filter(c => !c.name || c.name.toLowerCase() !== name.toLowerCase());
}

function renderSocialLinks(socialsStr) {
  if (!socialsStr) return '—';
  const icons = {instagram:'📸',facebook:'📘',twitter:'🐦',bluesky:'☁️',tiktok:'🎵',youtube:'▶️',linkedin:'💼',website:'🌐'};
  const bases  = {instagram:'https://instagram.com/',facebook:'https://facebook.com/',twitter:'https://twitter.com/',bluesky:'https://bsky.app/profile/',tiktok:'https://tiktok.com/@',youtube:'https://youtube.com/',linkedin:'https://linkedin.com/in/',website:'https://'};
  return socialsStr.split(',').map(s => {
    if (!s.trim()) return '';
    const [platform, handle] = s.includes('||') ? s.split('||') : ['website', s];
    const clean = (handle||'').replace(/^[@\s]+/,'').trim();
    if (!clean) return '';
    const url = clean.match(/^https?:\/\//) ? clean : (bases[platform]||'https://') + clean;
    return `${icons[platform]||'🌐'} <a href="${url}" target="_blank" style="color:var(--accent2)">${clean}</a>`;
  }).filter(Boolean).join(' ');
}

