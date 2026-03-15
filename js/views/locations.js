// LOCATIONS
function renderProjectLocations(p) {
  const tbody = document.getElementById('locations-body');
  const suitMap = {suitable:'loc-suitable',possible:'loc-possible',unsuitable:'loc-unsuitable'};
  const suitLabel = {suitable:'Suitable',possible:'Possibly Suitable',unsuitable:'Unsuitable'};
  // Reset select-all and remove-selected button
  const selAll = document.getElementById('loc-select-all');
  if (selAll) selAll.checked = false;
  const selBtn = document.getElementById('loc-remove-sel-btn');
  if (selBtn) selBtn.style.display = 'none';
  if (!p.locations.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state" style="padding:20px"><div class="icon">📍</div><h4>No locations yet</h4></div></td></tr>`;
  } else {
    tbody.innerHTML = p.locations.map((l,i) => `
      <tr data-ctx="proj-loc:${i}:${encodeURIComponent(l.name||'')}">
        <td style="padding:6px 8px"><input type="checkbox" class="loc-cb" data-idx="${i}" onchange="updateLocSelBtn()" style="cursor:pointer"></td>
        <td style="white-space:nowrap"><strong>${l.name}</strong>${_scoutIconHtml(l.name||'')}</td>
        <td><span class="loc-suitability ${suitMap[l.suit]||'loc-possible'}">${suitLabel[l.suit]||'—'}</span></td>
        <td>${l.contacted||'—'}</td>
        <td>${l.avail||'—'}</td>
        <td>${l.cost ? (l.costPeriod ? l.cost+' '+l.costPeriod : l.cost) : '—'}</td>
        <td>${l.access||'—'}</td>
        <td>${l.recce||'—'}</td>
        <td>${l.decision||'TBD'}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="editLocation(${i})">✎</button>
          <button class="btn btn-sm btn-ghost btn-danger" onclick="removeLocation(${i})">✕</button>
        </td>
      </tr>
    `).join('');
  }
  renderScoutingList(p);
  renderTechScouts(p);
}
function addLocation() {
  document.getElementById('loc-edit-idx').value='';
  ['name','avail','rules','cost','access','light','power','problems','notes'].forEach(f=>{const el=document.getElementById('loc-'+f);if(el)el.value='';});
  document.getElementById('loc-suit').value='suitable';
  document.getElementById('loc-contacted').value='no';
  document.getElementById('loc-recce').value='no';
  document.getElementById('loc-decision').value='';
  document.getElementById('loc-cost-period').value='';
  openModal('modal-location');
  setTimeout(() => {
    const inp = document.getElementById('loc-name');
    if (inp && window.attachLocAuto) window.attachLocAuto(inp);
  }, 80);
}
function openImportLocationModal() {
  document.getElementById('import-loc-search').value = '';
  renderImportLocationList();
  openModal('modal-import-location');
}

function renderImportLocationList() {
  const p = currentProject();
  if (!p) return;
  const q = (document.getElementById('import-loc-search').value || '').toLowerCase();
  const existing = new Set((p.locations || []).map(l => l.name.toLowerCase()));

  // Gather all locations from other projects + global store
  const candidates = [];
  store.projects.forEach(proj => {
    if (proj.id === p.id) return;
    (proj.locations || []).forEach(l => {
      if (l.name && !existing.has(l.name.toLowerCase()) && !candidates.some(c => c.name.toLowerCase() === l.name.toLowerCase())) {
        candidates.push({ ...l, _from: proj.title });
      }
    });
  });
  (store.locations || []).forEach(l => {
    if (l.name && !existing.has(l.name.toLowerCase()) && !candidates.some(c => c.name.toLowerCase() === l.name.toLowerCase())) {
      candidates.push({ ...l, _from: 'Global database' });
    }
  });

  const filtered = q ? candidates.filter(l => l.name.toLowerCase().includes(q)) : candidates;
  const list = document.getElementById('import-loc-list');
  const empty = document.getElementById('import-loc-empty');

  if (!filtered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(l => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface2)">
      <div>
        <strong style="font-size:13px">${l.name.replace(/</g,'&lt;')}</strong>
        <span style="font-size:11px;color:var(--text3);margin-left:8px">from ${l._from}</span>
        ${l.suit ? `<span style="font-size:10px;margin-left:6px" class="loc-suitability loc-${l.suit==='suitable'?'suitable':l.suit==='unsuitable'?'unsuitable':'possible'}">${l.suit}</span>` : ''}
      </div>
      <button class="btn btn-sm btn-primary" onclick="importLocationEntry(${JSON.stringify(l).replace(/"/g,'&quot;')})">Import</button>
    </div>
  `).join('');
}

function importLocationEntry(l) {
  const p = currentProject();
  if (!p) return;
  const { _from, ...locationData } = l;
  if (!p.locations) p.locations = [];
  if (p.locations.some(x => x.name.toLowerCase() === locationData.name.toLowerCase())) {
    showToast(`"${locationData.name}" is already in this project's locations`, 'info');
    return;
  }
  p.locations.push(locationData);
  saveStore();
  renderProjectLocations(p);
  renderImportLocationList(); // refresh to remove imported item
  showToast(`"${locationData.name}" imported`, 'success');
}

function editLocation(i) {
  const l=currentProject().locations[i];
  document.getElementById('loc-edit-idx').value=i;
  document.getElementById('loc-name').value=l.name||'';
  document.getElementById('loc-suit').value=l.suit||'suitable';
  document.getElementById('loc-contacted').value=l.contacted||'no';
  document.getElementById('loc-avail').value=l.avail||'';
  document.getElementById('loc-rules').value=l.rules||'';
  document.getElementById('loc-cost').value=l.cost||'';
  document.getElementById('loc-cost-period').value=l.costPeriod||'';
  document.getElementById('loc-access').value=l.access||'';
  document.getElementById('loc-recce').value=l.recce||'no';
  document.getElementById('loc-light').value=l.light||'';
  document.getElementById('loc-power').value=l.power||'';
  document.getElementById('loc-problems').value=l.problems||'';
  document.getElementById('loc-decision').value=l.decision||'';
  document.getElementById('loc-notes').value=l.notes||'';
  openModal('modal-location');
}
function removeLocation(i) {
  showConfirmDialog('Remove this location from the project? It will be kept in the global Locations database.', 'Remove from Project', () => {
    const p = currentProject();
    const loc = p.locations[i];
    // Preserve in global database (store.locations) if not already there
    if (loc && loc.name) {
      if (!store.locations) store.locations = [];
      const alreadyGlobal = store.locations.some(l => l.name && l.name.toLowerCase() === loc.name.toLowerCase());
      if (!alreadyGlobal) {
        const { suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, name, contactName, contactPhone, contactEmail } = loc;
        store.locations.push({ name, suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, contactName, contactPhone, contactEmail });
      }
    }
    p.locations.splice(i, 1);
    saveStore();
    renderProjectLocations(p);
  });
}
function updateLocSelBtn() {
  const cbs = [...document.querySelectorAll('.loc-cb')];
  const n = cbs.filter(c => c.checked).length;
  const btn = document.getElementById('loc-remove-sel-btn');
  if (btn) { btn.style.display = n ? '' : 'none'; btn.textContent = `✕ Remove Selected (${n})`; }
  const all = document.getElementById('loc-select-all');
  if (all) all.checked = n > 0 && n === cbs.length;
}
function locSelectAll(checked) {
  document.querySelectorAll('.loc-cb').forEach(c => c.checked = checked);
  updateLocSelBtn();
}
function removeSelectedLocations() {
  const selected = [...document.querySelectorAll('.loc-cb:checked')].map(c => parseInt(c.dataset.idx));
  if (!selected.length) return;
  showConfirmDialog(`Remove ${selected.length} location${selected.length > 1 ? 's' : ''} from this project?`, 'Remove', () => {
    const p = currentProject();
    // Preserve removed locations in global store
    selected.forEach(i => {
      const loc = p.locations[i];
      if (loc?.name && !store.locations?.some(l => l.name?.toLowerCase() === loc.name.toLowerCase())) {
        if (!store.locations) store.locations = [];
        const { suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, name, contactName, contactPhone, contactEmail } = loc;
        store.locations.push({ name, suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, contactName, contactPhone, contactEmail });
      }
    });
    const idxSet = new Set(selected);
    p.locations = p.locations.filter((_, i) => !idxSet.has(i));
    saveStore();
    renderProjectLocations(p);
  });
}
function removeAllLocations() {
  const p = currentProject();
  if (!p?.locations?.length) return;
  showConfirmDialog(`Remove all ${p.locations.length} location${p.locations.length > 1 ? 's' : ''} from this project?`, 'Remove All', () => {
    // Preserve in global store
    (p.locations || []).forEach(loc => {
      if (loc?.name && !store.locations?.some(l => l.name?.toLowerCase() === loc.name.toLowerCase())) {
        if (!store.locations) store.locations = [];
        const { suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, name, contactName, contactPhone, contactEmail } = loc;
        store.locations.push({ name, suit, contacted, avail, cost, costPeriod, access, recce, decision, notes, contactName, contactPhone, contactEmail });
      }
    });
    p.locations = [];
    saveStore();
    renderProjectLocations(p);
  });
}
function saveLocation() {
  const p=currentProject();
  const name=document.getElementById('loc-name').value.trim();
  if(!name){showToast('Location name required','info');return;}
  const l={
    name,
    suit:document.getElementById('loc-suit').value,
    contacted:document.getElementById('loc-contacted').value,
    avail:document.getElementById('loc-avail').value,
    rules:document.getElementById('loc-rules').value,
    cost:document.getElementById('loc-cost').value,
    costPeriod:document.getElementById('loc-cost-period').value,
    access:document.getElementById('loc-access').value,
    recce:document.getElementById('loc-recce').value,
    light:document.getElementById('loc-light').value,
    power:document.getElementById('loc-power').value,
    problems:document.getElementById('loc-problems').value,
    decision:document.getElementById('loc-decision').value,
    notes:document.getElementById('loc-notes').value
  };
  const idx=document.getElementById('loc-edit-idx').value;
  if(idx!=='') p.locations[parseInt(idx)]=l; else p.locations.push(l);
  saveStore(); closeModal('modal-location'); renderProjectLocations(p); showToast('Location saved','success');
}

function addLocationGlobal() {
  // Populate project selector with all projects (blank = unlinked)
  const projSelect = document.getElementById('gloc-project-select');
  projSelect.innerHTML = `<option value="">— No Project —</option>` +
    store.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  // Clear all fields
  document.getElementById('gloc-project-id').value = '';
  document.getElementById('gloc-loc-idx').value = '-1';
  ['gloc-name','gloc-cost','gloc-access','gloc-avail','gloc-light','gloc-power','gloc-problems','gloc-rules','gloc-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('gloc-suit').value = '';
  document.getElementById('gloc-recce').value = 'no';
  document.getElementById('gloc-cost-period').value = '';
  document.getElementById('gloc-contacted').value = 'no';
  document.getElementById('gloc-decision').value = '';
  document.getElementById('gloc-contact-name').value = '';
  document.getElementById('gloc-contact-phone').value = '';
  document.getElementById('gloc-contact-email').value = '';
  openModal('modal-edit-location-global');
}

function editLocationGlobal(projectId, locIdx) {
  let l;
  if (projectId === '_global') {
    l = (store.locations || [])[locIdx];
  } else {
    const p = store.projects.find(proj => proj.id === projectId);
    l = p && p.locations[locIdx];
  }
  if (!l) return;
  // Populate project selector (with blank "no project" option)
  const projSelect = document.getElementById('gloc-project-select');
  projSelect.innerHTML = `<option value="">— No Project —</option>` +
    store.projects.map(proj =>
      `<option value="${proj.id}" ${proj.id === projectId ? 'selected' : ''}>${proj.title}</option>`
    ).join('');
  document.getElementById('gloc-project-id').value = projectId;
  document.getElementById('gloc-loc-idx').value = locIdx;
  document.getElementById('gloc-name').value = l.name || '';
  document.getElementById('gloc-suit').value = l.suit || '';
  document.getElementById('gloc-recce').value = l.recce || 'no';
  document.getElementById('gloc-cost').value = l.cost || '';
  document.getElementById('gloc-cost-period').value = l.costPeriod || '';
  document.getElementById('gloc-access').value = l.access || '';
  document.getElementById('gloc-avail').value = l.avail || '';
  document.getElementById('gloc-contacted').value = l.contacted || 'no';
  document.getElementById('gloc-decision').value = l.decision || '';
  document.getElementById('gloc-light').value = l.light || '';
  document.getElementById('gloc-power').value = l.power || '';
  document.getElementById('gloc-problems').value = l.problems || '';
  document.getElementById('gloc-rules').value = l.rules || '';
  document.getElementById('gloc-notes').value = l.notes || '';
  document.getElementById('gloc-contact-name').value = l.contactName || '';
  document.getElementById('gloc-contact-phone').value = l.contactPhone || '';
  document.getElementById('gloc-contact-email').value = l.contactEmail || '';
  openModal('modal-edit-location-global');
}

function deleteLocationGlobal(projectId, locIdx) {
  if (!confirm('Delete this location?')) return;
  if (projectId === '_global') {
    if (store.locations) store.locations.splice(locIdx, 1);
  } else {
    const p = store.projects.find(proj => proj.id === projectId);
    if (p && p.locations) p.locations.splice(locIdx, 1);
  }
  saveStore();
  renderLocations();
  showToast('Location deleted', 'success');
}

function saveLocationGlobal() {
  const projectId = document.getElementById('gloc-project-id').value;
  const rawIdx = document.getElementById('gloc-loc-idx').value;
  const locIdx = parseInt(rawIdx);
  const isNew = rawIdx === '-1' || rawIdx === '';
  const name = document.getElementById('gloc-name').value.trim();
  if (!name) { showToast('Location name required', 'info'); return; }
  const targetProjectId = document.getElementById('gloc-project-select').value;

  const locationData = {
    name,
    suit: document.getElementById('gloc-suit').value,
    recce: document.getElementById('gloc-recce').value,
    cost: document.getElementById('gloc-cost').value,
    costPeriod: document.getElementById('gloc-cost-period').value,
    access: document.getElementById('gloc-access').value,
    avail: document.getElementById('gloc-avail').value,
    contacted: document.getElementById('gloc-contacted').value,
    decision: document.getElementById('gloc-decision').value,
    light: document.getElementById('gloc-light').value,
    power: document.getElementById('gloc-power').value,
    problems: document.getElementById('gloc-problems').value,
    rules: document.getElementById('gloc-rules').value,
    notes: document.getElementById('gloc-notes').value,
    contactName: document.getElementById('gloc-contact-name').value.trim(),
    contactPhone: document.getElementById('gloc-contact-phone').value.trim(),
    contactEmail: document.getElementById('gloc-contact-email').value.trim()
  };

  if (isNew) {
    if (targetProjectId) {
      // Link to a project
      const destProject = store.projects.find(p => p.id === targetProjectId);
      if (!destProject) { showToast('Project not found', 'error'); return; }
      if (!destProject.locations) destProject.locations = [];
      destProject.locations.push(locationData);
    } else {
      // No project — save as unlinked location
      if (!store.locations) store.locations = [];
      store.locations.push(locationData);
    }
  } else if (projectId === '_global') {
    // Editing an unlinked location from store.locations
    const gIdx = parseInt(locIdx);
    if (!store.locations || !store.locations[gIdx]) { showToast('Location not found', 'error'); return; }
    if (targetProjectId) {
      // Move to a project
      store.locations.splice(gIdx, 1);
      const destProject = store.projects.find(p => p.id === targetProjectId);
      if (destProject) {
        if (!destProject.locations) destProject.locations = [];
        destProject.locations.push(locationData);
      }
    } else {
      store.locations[gIdx] = { ...store.locations[gIdx], ...locationData };
    }
  } else {
    const sourceProject = store.projects.find(p => p.id === projectId);
    if (!sourceProject || !sourceProject.locations[locIdx]) { showToast('Location not found', 'error'); return; }
    if (!targetProjectId || targetProjectId === projectId) {
      sourceProject.locations[locIdx] = { ...sourceProject.locations[locIdx], ...locationData };
    } else {
      // Move to a different project
      sourceProject.locations.splice(locIdx, 1);
      const destProject = store.projects.find(p => p.id === targetProjectId);
      if (destProject) {
        if (!destProject.locations) destProject.locations = [];
        destProject.locations.push(locationData);
      }
    }
  }

  saveStore();
  closeModal('modal-edit-location-global');
  renderLocations();
  showToast(isNew ? 'Location added' : 'Location updated', 'success');
}

// SCOUTING SHEETS
let _activeScoutIdx = 0;
let _activeTechScoutIdx = 0;
let _scoutMinimized = false;
let _techScoutMinimized = false;

function _applySuitStyle(el) {
  const m = {'Not Suitable':'var(--red)','Poor':'#e06c00','Fair':'#d4a017','Good':'var(--green)','Excellent':'#0088ff'};
  el.style.cssText = m[el.value] ? `color:${m[el.value]};font-weight:600` : '';
}

function _scoutingSheetContent(s, i) {
  const suitOpts = ['','Not Suitable','Poor','Fair','Good','Excellent'];
  const suitColorMap = {'Not Suitable':'var(--red)','Poor':'#e06c00','Fair':'#d4a017','Good':'var(--green)','Excellent':'#0088ff'};
  const suit = s.suitability || '';
  const suitStyle = suitColorMap[suit] ? `color:${suitColorMap[suit]};font-weight:600` : '';
  const sectionHead = (label, color) => `<div style="font-family:var(--font-display);font-size:11px;letter-spacing:1.5px;color:${color||'var(--accent2)'};margin-bottom:10px;text-transform:uppercase">${label}</div>`;
  const panel = (content) => `<div style="background:var(--surface2);border-radius:8px;padding:12px">${content}</div>`;
  const field = (label, input, mb) => `<div class="form-group" style="margin-bottom:${mb||'8'}px"><label class="form-label">${label}</label>${input}</div>`;
  const ta = (key, minH) => `<textarea class="form-textarea" style="min-height:${minH||50}px" onchange="updateScouting(${i},'${key}',this.value)">${s[key]||''}</textarea>`;
  const inp = (key, extra) => `<input class="form-input" value="${(s[key]||'').replace(/"/g,'&quot;')}" ${extra||''} onchange="updateScouting(${i},'${key}',this.value)">`;
  return `
    <div style="display:grid;grid-template-columns:1fr 160px 160px;gap:10px;margin-bottom:14px;align-items:end">
      ${field('Location Name', `<input class="form-input" value="${(s.name||'').replace(/"/g,'&quot;')}" onchange="updateScouting(${i},'name',this.value);renderScoutingTabs(currentProject())">`, 0)}
      ${field('Date of Visit', `<input class="form-input" type="date" value="${s.date||''}" onchange="updateScouting(${i},'date',this.value)">`, 0)}
      ${field('Scouted By', inp('scoutedBy'), 0)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      ${panel(sectionHead('Site Info') + field('Address', ta('address',50)) + field('Contact Person', inp('contact'), 0))}
      ${panel(sectionHead('Evaluation') +
        `<div class="form-group" style="margin-bottom:8px"><label class="form-label">Overall Suitability</label>
          <select class="form-select" style="${suitStyle}" onchange="updateScouting(${i},'suitability',this.value);_applySuitStyle(this)">
            ${suitOpts.map(o=>`<option value="${o}"${o===suit?' selected':''}>${o||'— select —'}</option>`).join('')}
          </select></div>` +
        field('General Notes', ta('info', 60), 0))}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      ${panel(sectionHead('Technical') + field('Lighting Conditions', ta('lighting')) + field('Sound Considerations', ta('sound')) + field('Power & Electrical', ta('power'), 0))}
      ${panel(sectionHead('Production') + field('Accessibility', ta('accessibility')) + field('Permissions / Legal', ta('permissions')) + field('Logistics', ta('logistics'), 0))}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="background:rgba(0,180,100,.06);border:1px solid rgba(0,180,100,.2);border-radius:8px;padding:12px">
        ${sectionHead('Pros','var(--green)')}
        <textarea class="form-textarea" style="min-height:70px;background:transparent;border-color:rgba(0,180,100,.25)" onchange="updateScouting(${i},'pros',this.value)">${s.pros||''}</textarea>
      </div>
      <div style="background:rgba(220,50,50,.06);border:1px solid rgba(220,50,50,.2);border-radius:8px;padding:12px">
        ${sectionHead('Cons','var(--red)')}
        <textarea class="form-textarea" style="min-height:70px;background:transparent;border-color:rgba(220,50,50,.25)" onchange="updateScouting(${i},'cons',this.value)">${s.cons||''}</textarea>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      ${field('Set Dressing Notes', ta('setDressing', 55))}
      ${field('Networking Notes', ta('networking', 55))}
    </div>
    <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap">
      <button class="btn btn-sm btn-primary" onclick="_scoutMinimized=true;renderScoutingList(currentProject())" title="Auto-saves on every change">✓ Save &amp; Collapse</button>
      <button class="btn btn-sm btn-ghost" onclick="_printScoutingSheet(${i})">⎙ Print</button>
      <button class="btn btn-sm btn-ghost" onclick="_downloadScoutingSheet(${i})">⬇ Export HTML</button>
    </div>`;
}

function renderScoutingTabs(p) {
  const tabBar = document.getElementById('scouting-tabs');
  if (tabBar) tabBar.innerHTML = _scoutingTabsHtml(p);
}

function _scoutingTabsHtml(p) {
  const sheets = p.scoutingSheets || [];
  const tabs = sheets.map((s, i) =>
    `<button class="btn btn-sm${i === _activeScoutIdx ? ' btn-primary' : ''}" onclick="_selectScoutingSheet(${i})">${(s.name||'Sheet '+(i+1)).slice(0,22)}</button>`
  ).join('');
  const delBtn = sheets.length > 0 ? `<button class="btn btn-sm btn-ghost btn-danger" onclick="removeScoutingSheet(${_activeScoutIdx})" title="Delete this sheet" style="margin-left:4px">🗑</button>` : '';
  const minBtn = sheets.length > 0 ? `<button class="btn btn-sm btn-ghost" onclick="_scoutMinimized=!_scoutMinimized;renderScoutingList(currentProject())" style="margin-left:auto" title="${_scoutMinimized?'Expand':'Collapse'}">${_scoutMinimized ? '▸ Expand' : '▾ Collapse'}</button>` : '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%">${tabs}${delBtn}${minBtn}</div>`;
}

function renderScoutingList(p) {
  const el = document.getElementById('scouting-list');
  if (!el) return;
  if (!p.scoutingSheets || !p.scoutingSheets.length) {
    el.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">No scouting sheets yet — click "+ New Sheet" to add one.</p>`;
    return;
  }
  _activeScoutIdx = Math.min(_activeScoutIdx, p.scoutingSheets.length - 1);
  const s = p.scoutingSheets[_activeScoutIdx];
  el.innerHTML = `
    <div id="scouting-tabs" style="margin-bottom:${_scoutMinimized ? 4 : 14}px">${_scoutingTabsHtml(p)}</div>
    ${_scoutMinimized ? '' : `<div class="breakdown-card" style="margin-bottom:0">${_scoutingSheetContent(s, _activeScoutIdx)}</div>`}`;
}

function _selectScoutingSheet(i) {
  _activeScoutIdx = i;
  renderScoutingList(currentProject());
  document.getElementById('scouting-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addScoutingSheet() {
  const p = currentProject();
  if (!p.scoutingSheets) p.scoutingSheets = [];
  p.scoutingSheets.push({ name: '', date: '', scoutedBy: '' });
  _activeScoutIdx = p.scoutingSheets.length - 1;
  saveStore();
  renderScoutingList(p);
}
function removeScoutingSheet(i) {
  showConfirmDialog('Remove this scouting sheet?', 'Remove', () => {
    const p = currentProject();
    p.scoutingSheets.splice(i, 1);
    _activeScoutIdx = Math.max(0, i - 1);
    saveStore();
    renderScoutingList(p);
  });
}
function updateScouting(i, field, val) { const p = currentProject(); p.scoutingSheets[i][field] = val; saveStore(); }
function openScoutingSheetForLocation(locName) {
  const p = currentProject();
  if (!p) return;
  if (!p.scoutingSheets) p.scoutingSheets = [];
  // Find sheet matching location name, or create one
  let idx = p.scoutingSheets.findIndex(s => s.name && s.name.toLowerCase() === locName.toLowerCase());
  if (idx === -1) {
    p.scoutingSheets.push({ name: locName, date: '', scoutedBy: '' });
    idx = p.scoutingSheets.length - 1;
    saveStore();
  }
  _activeScoutIdx = idx;
  renderScoutingList(p);
  setTimeout(() => document.getElementById('scouting-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// TEAM
function renderTeam() {
  const tbody=document.getElementById('team-body');
  if(!store.teamMembers.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state" style="padding:30px"><div class="icon">👥</div><h4>No team members yet</h4><p>Invite collaborators to your projects</p></div></td></tr>`;return;}
  tbody.innerHTML=store.teamMembers.map((m,i)=>`
    <tr><td>${m.name}</td><td>${m.email}</td><td>${m.role||'—'}</td><td>${m.project==='all'?'All':store.projects.find(p=>p.id===m.project)?.title||'—'}</td>
    <td><span class="tag">${m.access}</span></td>
    <td><button class="btn btn-sm btn-danger" onclick="removeTeamMember(${i})">✕</button></td></tr>
  `).join('');
}
function inviteTeamMember() {
  const sel=document.getElementById('inv-project');
  sel.innerHTML='<option value="all">All Projects</option>'+store.projects.map(p=>`<option value="${p.id}">${p.title}</option>`).join('');
  ['name','email'].forEach(f=>document.getElementById('inv-'+f).value='');
  openModal('modal-invite');
}
function saveInvite() {
  const name=document.getElementById('inv-name').value.trim();
  const email=document.getElementById('inv-email').value.trim();
  if(!name||!email){showToast('Name and email required','info');return;}
  store.teamMembers.push({name,email,access:document.getElementById('inv-access').value,project:document.getElementById('inv-project').value});
  saveStore();closeModal('modal-invite');renderTeam();showToast('Member invited','success');
}
function removeTeamMember(i){showConfirmDialog('Remove this team member?','Remove',()=>{store.teamMembers.splice(i,1);saveStore();renderTeam();});}

// CONTACTS
let contactTypeFilter = 'all';
let contactRoleFilter = 'all';
let contactSubView = 'all';
let contactsSubNavExpanded = false;
let _cachedContacts = [];
let _pendingFullRemovals = []; // populated by renderContacts, used by editContact
const CONTACT_BUILTIN_COLS = [
  { id: 'type',     label: 'Type' },
  { id: 'role',     label: 'Role / Dept' },
  { id: 'projects', label: 'Projects' },
  { id: 'phone',    label: 'Phone' },
  { id: 'email',    label: 'Email' },
  { id: 'socials',  label: 'Socials' },
  { id: 'photos',   label: 'Photos' },
];
const LOCATION_BUILTIN_COLS = [
  { id: 'project',       label: 'Project' },
  { id: 'contact',       label: 'Contact' },
  { id: 'dateScouted',   label: 'Date Scouted' },
  { id: 'suitability',   label: 'Suitability' },
  { id: 'cost',          label: 'Cost' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'status',        label: 'Status' },
  { id: 'notes',         label: 'Notes' },
  { id: 'photos',        label: 'Photos' },
];
let contactSort = { col: 'name', dir: 'asc' };
let locationSort = { col: 'name', dir: 'asc' };
let contactSearch = '';
let locationSearch = '';
let _refocusContactSearch = false;
let _refocusLocationSearch = false;
let _locNavSel = new Set();
let _contactNavSel = new Set();

function setContactSort(col) {
  if (contactSort.col === col && col === 'name') {
    const cycle = ['asc', 'desc', 'surname-asc', 'surname-desc'];
    contactSort.dir = cycle[(cycle.indexOf(contactSort.dir) + 1) % cycle.length];
  } else if (contactSort.col === col) {
    contactSort.dir = contactSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    contactSort.col = col;
    contactSort.dir = col === 'name' ? 'asc' : 'desc';
  }
  renderContacts();
}

function sortIcon(col, st) {
  st = st || contactSort;
  if (st.col !== col) return '<span style="opacity:0.3;font-size:10px;margin-left:3px">⇅</span>';
  const d = st.dir;
  const arrow = (d === 'asc' || d === 'surname-asc') ? '↑' : '↓';
  const sn = (d === 'surname-asc' || d === 'surname-desc')
    ? '<sup style="font-size:8px;opacity:0.7">Sn</sup>' : '';
  return `<span style="font-size:10px;margin-left:3px" title="${sn ? 'Sorted by surname' : ''}">${arrow}${sn}</span>`;
}

function setLocationSort(col) {
  if (locationSort.col === col) locationSort.dir = locationSort.dir === 'asc' ? 'desc' : 'asc';
  else { locationSort.col = col; locationSort.dir = 'asc'; }
  renderLocations();
}

function toggleContactsSubNav() {
  contactsSubNavExpanded = !contactsSubNavExpanded;
  const subnav = document.getElementById('contacts-subnav');
  const arrow = document.getElementById('contacts-subnav-arrow');
  if (subnav) subnav.style.display = contactsSubNavExpanded ? '' : 'none';
  if (arrow) arrow.style.transform = contactsSubNavExpanded ? '' : 'rotate(-90deg)';
}

function setContactTypeFilter(type) {
  contactTypeFilter = type;
  renderContacts();
}

function showContactsView(subview) {
  contactSubView = subview;
  _contactNavSel.clear();
  if (subview === 'crew') contactTypeFilter = 'crew';
  else if (subview === 'talent') contactTypeFilter = 'cast';
  else contactTypeFilter = 'all';
  showView('contacts'); // clears project-items, nav-items, nav-subitems; sets contacts nav-item active
  if (subview !== 'all') {
    const sub = document.querySelector(`.nav-subitem[data-subview="${subview}"]`);
    if (sub) sub.classList.add('active');
  }
}

function renderContacts() {
  const el = document.getElementById('contacts-list');

  // Get current filters
  const filterSelect = document.getElementById('contacts-filter');
  const filterProject = filterSelect ? filterSelect.value : 'all';
  const roleFilterSelect = document.getElementById('contacts-role-filter');
  if (roleFilterSelect) contactRoleFilter = roleFilterSelect.value;

  // Helper: merge type strings e.g. 'cast' + 'crew' → 'cast,crew'
  function mergeContactType(existing, incoming) {
    if (!incoming) return existing || '';
    if (!existing) return incoming;
    const cur = existing.split(',').map(t => t.trim()).filter(Boolean);
    incoming.split(',').forEach(t => { if (t && !cur.includes(t)) cur.push(t); });
    return cur.join(',');
  }

  // Gather all contacts from all projects - merge roles properly
  const contactsMap = {};
  store.projects.forEach(p => {
    // From persistent contacts
    (p.contacts || []).forEach(c => {
      if (c.name) {
        const key = c.name.toLowerCase();
        if (!contactsMap[key]) {
          contactsMap[key] = { name: c.name, roles: [], projects: [], projectIds: [], phone: c.phone || '', email: c.email || '', socials: c.socials || '', type: c.type || '', defaultRole: c.defaultRole || '', castRoles: c.castRoles || [], crewRoles: c.crewRoles || [] };
        }
        if (!contactsMap[key].projects.includes(p.title)) {
          contactsMap[key].projects.push(p.title);
          contactsMap[key].projectIds.push(p.id);
        }
        (c.roles || ['Contact']).forEach(r => {
          if (!contactsMap[key].roles.includes(r)) contactsMap[key].roles.push(r);
        });
        if (c.phone) contactsMap[key].phone = c.phone;
        if (c.email) contactsMap[key].email = c.email;
        if (c.socials) contactsMap[key].socials = c.socials;
        if (c.type && !contactsMap[key].type) contactsMap[key].type = c.type;
        if (c.defaultRole && !contactsMap[key].defaultRole) contactsMap[key].defaultRole = c.defaultRole;
        if (c.castRoles && c.castRoles.length && !contactsMap[key].castRoles.length) contactsMap[key].castRoles = c.castRoles;
        if (c.crewRoles && c.crewRoles.length && !contactsMap[key].crewRoles.length) contactsMap[key].crewRoles = c.crewRoles;
      }
    });

    // Also check callsheet data
    (p.callsheets || []).forEach(cs => {
      (cs.castRows || []).forEach(r => {
        if (r.actor) {
          const key = r.actor.toLowerCase();
          if (!contactsMap[key]) {
            contactsMap[key] = { name: r.actor, roles: [], projects: [], projectIds: [], phone: '', email: '', socials: '', type: 'cast' };
          }
          if (!contactsMap[key].projects.includes(p.title)) {
            contactsMap[key].projects.push(p.title);
            contactsMap[key].projectIds.push(p.id);
          }
          if (!contactsMap[key].roles.includes('Cast')) contactsMap[key].roles.push('Cast');
          contactsMap[key].type = mergeContactType(contactsMap[key].type, 'cast');
        }
      });
      (cs.customFields || []).forEach(cf => {
        if (cf.value) {
          const key = cf.value.toLowerCase();
          if (!contactsMap[key]) {
            contactsMap[key] = { name: cf.value, roles: [], projects: [], projectIds: [], phone: '', email: '', socials: '', type: '' };
          }
          if (!contactsMap[key].projects.includes(p.title)) {
            contactsMap[key].projects.push(p.title);
            contactsMap[key].projectIds.push(p.id);
          }
          if (!contactsMap[key].roles.includes(cf.label)) contactsMap[key].roles.push(cf.label);
          if (cf.phone) contactsMap[key].phone = cf.phone;
          if (cf.email) contactsMap[key].email = cf.email;
        }
      });
    });
    // From personnel
    (p.cast || []).forEach(r => {
      if (r.name) {
        const key = r.name.toLowerCase();
        if (!contactsMap[key]) {
          contactsMap[key] = { name: r.name, roles: [], projects: [], projectIds: [], phone: '', email: '', socials: '', type: 'cast' };
        }
        if (!contactsMap[key].projects.includes(p.title)) {
          contactsMap[key].projects.push(p.title);
          contactsMap[key].projectIds.push(p.id);
        }
        if (!contactsMap[key].roles.includes('Cast')) contactsMap[key].roles.push('Cast');
        contactsMap[key].type = mergeContactType(contactsMap[key].type, 'cast');
        if (r.number) contactsMap[key].phone = r.number;
        if (r.email) contactsMap[key].email = r.email;
      }
    });
    (p.extras || []).forEach(r => {
      if (r.name) {
        const key = r.name.toLowerCase();
        if (!contactsMap[key]) {
          contactsMap[key] = { name: r.name, roles: [], projects: [], projectIds: [], phone: '', email: '', socials: '', type: '' };
        }
        if (!contactsMap[key].projects.includes(p.title)) {
          contactsMap[key].projects.push(p.title);
          contactsMap[key].projectIds.push(p.id);
        }
        if (!contactsMap[key].roles.includes('Extra')) contactsMap[key].roles.push('Extra');
        contactsMap[key].type = mergeContactType(contactsMap[key].type, 'cast');
        if (r.number) contactsMap[key].phone = r.number;
        if (r.email) contactsMap[key].email = r.email;
      }
    });
    (p.unit || []).forEach(r => {
      if (r.name) {
        const key = r.name.toLowerCase();
        if (!contactsMap[key]) {
          contactsMap[key] = { name: r.name, roles: [], projects: [], projectIds: [], phone: '', email: '', socials: '', type: '' };
        }
        if (!contactsMap[key].projects.includes(p.title)) {
          contactsMap[key].projects.push(p.title);
          contactsMap[key].projectIds.push(p.id);
        }
        const role = r.role || 'Crew';
        if (!contactsMap[key].roles.includes(role)) contactsMap[key].roles.push(role);
        contactsMap[key].type = mergeContactType(contactsMap[key].type, 'crew');
        if (r.number) contactsMap[key].phone = r.number;
        if (r.email) contactsMap[key].email = r.email;
      }
    });
  });

  // Also pull in global contacts not linked to any project
  (store.contacts || []).forEach(c => {
    if (!c.name) return;
    const key = c.name.toLowerCase();
    if (!contactsMap[key]) {
      contactsMap[key] = { name: c.name, roles: [], projects: [], projectIds: [], phone: c.phone || '', email: c.email || '', socials: c.socials || '', type: c.type || '', defaultRole: c.defaultRole || '', castRoles: c.castRoles || [], crewRoles: c.crewRoles || [] };
    } else {
      if (c.phone) contactsMap[key].phone = c.phone;
      if (c.email) contactsMap[key].email = c.email;
      if (c.socials) contactsMap[key].socials = c.socials;
      if (c.type) contactsMap[key].type = mergeContactType(contactsMap[key].type, c.type);
      if (c.defaultRole && !contactsMap[key].defaultRole) contactsMap[key].defaultRole = c.defaultRole;
      if (c.castRoles && c.castRoles.length && !contactsMap[key].castRoles.length) contactsMap[key].castRoles = c.castRoles;
      if (c.crewRoles && c.crewRoles.length && !contactsMap[key].crewRoles.length) contactsMap[key].crewRoles = c.crewRoles;
    }
  });

  // Convert to array
  let contacts = Object.values(contactsMap).map(c => ({
    name: c.name,
    role: c.roles.join(', '),
    roles: c.roles,
    defaultRole: c.defaultRole || '',
    castRoles: c.castRoles || [],
    crewRoles: c.crewRoles || [],
    projects: c.projects.join(', '),
    projectIds: c.projectIds,
    projectId: c.projectIds[0] || null,
    phone: c.phone,
    email: c.email,
    socials: c.socials,
    type: c.type || ''
  }));

  // Cache for use by editContact
  _cachedContacts = contacts;

  // Build unique roles list — crew roles only, exclude cast character names
  const allRoles = new Set();
  contacts
    .filter(c => c.type !== 'cast')
    .forEach(c => c.roles.forEach(r => { if (r && r !== 'Cast' && r !== 'Extra') allRoles.add(r); }));
  const uniqueRoles = Array.from(allRoles).sort();

  // Apply type filter
  let filteredContacts = contacts;
  if (contactTypeFilter === 'cast') filteredContacts = filteredContacts.filter(c => (c.type||'').includes('cast'));
  else if (contactTypeFilter === 'crew') filteredContacts = filteredContacts.filter(c => (c.type||'').includes('crew'));

  // Apply role filter
  if (contactRoleFilter && contactRoleFilter !== 'all') {
    filteredContacts = filteredContacts.filter(c => c.roles.includes(contactRoleFilter));
  }

  // Apply project filter
  if (filterProject === 'none') {
    filteredContacts = filteredContacts.filter(c => c.projectIds.length === 0);
  } else if (filterProject !== 'all') {
    filteredContacts = filteredContacts.filter(c => c.projectIds.includes(filterProject));
  }

  // Apply search
  if (contactSearch.trim()) {
    const q = contactSearch.trim().toLowerCase();
    filteredContacts = filteredContacts.filter(c => c.name.toLowerCase().includes(q));
  }

  // Apply sort
  const _surname = n => { const p = (n || '').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).toLowerCase(); };
  const _sortAsc = contactSort.dir === 'asc' || contactSort.dir === 'surname-asc';
  filteredContacts = [...filteredContacts].sort((a, b) => {
    let av, bv;
    if (contactSort.col === 'name') {
      if (contactSort.dir === 'surname-asc' || contactSort.dir === 'surname-desc') {
        av = _surname(a.name); bv = _surname(b.name);
      } else {
        av = a.name.toLowerCase(); bv = b.name.toLowerCase();
      }
    } else if (contactSort.col === 'photos') {
      av = getFilesForPerson(a.name).length; bv = getFilesForPerson(b.name).length;
    } else {
      av = parseInt((store.contactCustomData[a.name.toLowerCase()] || {})[contactSort.col]) || 0;
      bv = parseInt((store.contactCustomData[b.name.toLowerCase()] || {})[contactSort.col]) || 0;
    }
    if (av < bv) return _sortAsc ? -1 : 1;
    if (av > bv) return _sortAsc ? 1 : -1;
    return 0;
  });

  // Location Contacts sub-view — show only that section
  if (contactSubView === 'locations') {
    el.innerHTML = '';
    renderLocationContactsSection(el);
    return;
  }

  // Render filter bar
  const typeBtnStyle = (t) => contactTypeFilter === t
    ? 'btn btn-sm btn-primary'
    : 'btn btn-sm';

  const typeButtons = contactSubView === 'all'
    ? `<div style="display:flex;gap:4px">
        <button class="${typeBtnStyle('all')}" onclick="setContactTypeFilter('all')">All</button>
        <button class="${typeBtnStyle('cast')}" onclick="setContactTypeFilter('cast')">Cast / Talent</button>
        <button class="${typeBtnStyle('crew')}" onclick="setContactTypeFilter('crew')">Crew</button>
       </div>`
    : '';

  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px">
    ${typeButtons}
    <input class="form-input" placeholder="Search contacts…" value="${contactSearch.replace(/"/g,'&quot;')}"
      oninput="contactSearch=this.value;_refocusContactSearch=true;renderContacts()" style="max-width:200px;font-size:12px;">
    <select id="contacts-role-filter" onchange="renderContacts()" class="form-select" style="max-width:200px">
      <option value="all" ${contactRoleFilter === 'all' ? 'selected' : ''}>All Roles / Depts</option>
      ${uniqueRoles.map(r => `<option value="${r}" ${contactRoleFilter === r ? 'selected' : ''}>${r}</option>`).join('')}
    </select>
    <select id="contacts-filter" onchange="renderContacts()" class="form-select" style="max-width:220px">
      <option value="all" ${filterProject === 'all' ? 'selected' : ''}>All Projects</option>
      <option value="none" ${filterProject === 'none' ? 'selected' : ''}>No Linked Project</option>
      ${store.projects.map(p => `<option value="${p.id}" ${filterProject === p.id ? 'selected' : ''}>${p.title}</option>`).join('')}
    </select>
    <span style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}</span>
    ${_contactNavSel.size > 0 ? `<button class="btn btn-sm btn-danger" onclick="_contactNavRemoveSelected()" style="margin-left:4px">Remove Selected (${_contactNavSel.size})</button>` : ''}
    <button class="btn btn-sm btn-danger" onclick="_contactNavRemoveAll()" style="${_contactNavSel.size > 0 ? '' : 'margin-left:4px'}">Remove All</button>
    <button class="btn btn-sm" onclick="openContactColumnsModal()" style="margin-left:auto" title="Manage custom columns">⊕ Columns${(store.contactColumns||[]).length ? ` <span style="opacity:0.6">(${store.contactColumns.length})</span>` : ''}</button>
  </div>`;

  if (!filteredContacts.length) {
    el.innerHTML += '<div class="empty-state" style="padding:48px;text-align:center"><div style="font-size:48px;margin-bottom:16px">📱</div><h3>No contacts</h3><p style="color:var(--text2);margin-top:8px">No contacts match the current filters</p></div>';
    if (_refocusContactSearch) {
      _refocusContactSearch = false;
      const inp = el.querySelector('input[placeholder="Search contacts…"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
    return;
  }

  // Helper function to convert social handles to clickable links
  function renderSocialLinks(socialsStr) {
    if (!socialsStr) return '—';
    const socials = socialsStr.split(',').map(s => s.trim()).filter(Boolean);
    if (!socials.length) return '—';

    return socials.map(s => {
      let raw = s;
      let handle = raw;
      if (handle.includes('||')) {
        handle = handle.split('||').pop();
      } else if (handle.includes(':') && !handle.includes('://')) {
        handle = handle.split(':').pop();
      }
      const platformNames = ['instagram', 'facebook', 'twitter', 'tiktok', 'bluesky', 'youtube', 'linkedin', 'website'];
      const lowerHandle = handle.toLowerCase();
      for (const platform of platformNames) {
        if (lowerHandle.startsWith(platform)) {
          handle = handle.substring(platform.length);
          break;
        }
      }
      handle = handle.replace(/^[:|@\s]+/, '').trim();
      if (!handle) return '';
      let platform = 'website';
      const lowerRaw = raw.toLowerCase();
      if (lowerRaw.includes('instagram')) platform = 'instagram';
      else if (lowerRaw.includes('facebook')) platform = 'facebook';
      else if (lowerRaw.includes('twitter') || lowerRaw.includes('x.com')) platform = 'twitter';
      else if (lowerRaw.includes('tiktok')) platform = 'tiktok';
      else if (lowerRaw.includes('bluesky')) platform = 'bluesky';
      else if (lowerRaw.includes('youtube')) platform = 'youtube';
      else if (lowerRaw.includes('linkedin')) platform = 'linkedin';
      let url = handle;
      if (!url.match(/^https?:\/\//)) {
        const cleanHandle = handle.replace(/^@/, '');
        switch(platform) {
          case 'instagram': url = 'https://instagram.com/' + cleanHandle; break;
          case 'facebook': url = 'https://facebook.com/' + cleanHandle; break;
          case 'twitter': url = 'https://twitter.com/' + cleanHandle; break;
          case 'bluesky': url = 'https://bsky.app/profile/' + cleanHandle; break;
          case 'tiktok': url = 'https://tiktok.com/@' + cleanHandle; break;
          case 'youtube': url = 'https://youtube.com/' + cleanHandle; break;
          case 'linkedin': url = 'https://linkedin.com/in/' + cleanHandle; break;
          default: url = 'https://' + cleanHandle;
        }
      }
      let icon = '🌐';
      switch(platform) {
        case 'instagram': icon = '📸'; break;
        case 'facebook': icon = '📘'; break;
        case 'twitter': icon = '🐦'; break;
        case 'bluesky': icon = '☁️'; break;
        case 'tiktok': icon = '🎵'; break;
        case 'youtube': icon = '▶️'; break;
        case 'linkedin': icon = '💼'; break;
      }
      return `${icon} <a href="${url}" target="_blank" style="color:var(--accent2);margin-right:8px">${handle}</a>`;
    }).join('');
  }

  function getTypeBadge(type) {
    const types = (type || '').split(',').map(t => t.trim()).filter(Boolean);
    if (!types.length) return '<span style="color:var(--text3);font-size:11px">—</span>';
    return types.map(t => {
      if (t === 'cast') return '<span class="tag" style="background:rgba(91,192,235,0.15);color:var(--accent2);border-color:rgba(91,192,235,0.2)">Cast</span>';
      if (t === 'crew') return '<span class="tag" style="background:rgba(196,86,110,0.15);color:#e08095;border-color:rgba(196,86,110,0.2)">Crew</span>';
      return '';
    }).join(' ');
    // unreachable — keep type-detection in aggregation consistent
    return '<span style="color:var(--text3);font-size:11px">—</span>';
  }

  const custCols = store.contactColumns || [];
  const hidden = store.contactHiddenCols || [];
  const vis = id => !hidden.includes(id);
  const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap';
  const custHeaders = custCols.map(col =>
    col.type === 'stars'
      ? `<th style="${thStyle}" onclick="setContactSort('${col.id}')">${col.label}${sortIcon(col.id)}</th>`
      : `<th>${col.label}</th>`
  ).join('');
  const totalCols = 3 + CONTACT_BUILTIN_COLS.filter(c => vis(c.id)).length + custCols.length;

  const _contactAllSel = filteredContacts.length > 0 && filteredContacts.every(c => _contactNavSel.has(c.name.toLowerCase()));

  el.innerHTML += `<div class="table-container"><table class="data-table contacts-table"><thead><tr>
    <th style="width:32px;padding:6px 4px"><input type="checkbox" title="Select all" ${_contactAllSel ? 'checked' : ''} onchange="_contactNavSelectAll(this.checked)" onclick="event.stopPropagation()"></th>
    <th style="${thStyle}" onclick="setContactSort('name')">Name${sortIcon('name')}</th>
    ${vis('type') ? `<th data-ctx="col-contact:type">Type${colHideBtn('type')}</th>` : ''}
    ${vis('role') ? `<th data-ctx="col-contact:role">Role / Dept${colHideBtn('role')}</th>` : ''}
    ${vis('projects') ? `<th data-ctx="col-contact:projects">Projects${colHideBtn('projects')}</th>` : ''}
    ${vis('phone') ? `<th data-ctx="col-contact:phone">Phone${colHideBtn('phone')}</th>` : ''}
    ${vis('email') ? `<th data-ctx="col-contact:email">Email${colHideBtn('email')}</th>` : ''}
    ${vis('socials') ? `<th data-ctx="col-contact:socials">Socials${colHideBtn('socials')}</th>` : ''}
    ${vis('photos') ? `<th style="${thStyle}" data-ctx="col-contact:photos" onclick="setContactSort('photos')">Photos${sortIcon('photos')}${colHideBtn('photos')}</th>` : ''}
    ${custHeaders}<th></th></tr></thead><tbody>` +
    filteredContacts.map((c, i) => {
      const photos = getFilesForPerson(c.name);
      const isExpanded = expandedContacts.has(c.name.toLowerCase());
      const photosBadge = photos.length
        ? `<span class="photos-badge" onclick="event.stopPropagation();toggleContactExpand('${c.name.replace(/'/g, "\\'")}')">📷 ${photos.length}</span>`
        : '<span style="color:var(--text3);font-size:11px;">—</span>';
      const cNameEsc = c.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const customCells = custCols.map(col => {
        const val = (store.contactCustomData[c.name.toLowerCase()] || {})[col.id];
        if (col.type === 'stars') {
          const rating = parseInt(val) || 0;
          const stars = [1,2,3,4,5].map(n =>
            `<span onclick="event.stopPropagation();setContactRating('${cNameEsc}','${col.id}',${n === rating ? 0 : n})" style="cursor:pointer;font-size:15px;color:${n <= rating ? 'var(--accent)' : 'var(--border2)'}">★</span>`
          ).join('');
          return `<td style="white-space:nowrap">${stars}</td>`;
        } else {
          const text = val || '';
          return `<td onclick="event.stopPropagation();openContactTextEdit(this,'${cNameEsc}','${col.id}')" style="cursor:text;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${text?'var(--text)':'var(--text3)'}"${text ? ` data-tip="${text.replace(/"/g,'&quot;')}"` : ''}>${text ? text.replace(/</g,'&lt;') : '<span style="opacity:0.35">—</span>'}</td>`;
        }
      }).join('');
      const cSelKey = c.name.toLowerCase().replace(/'/g, "\\'");
      const mainRow = `<tr data-ctx="contact:${encodeURIComponent(c.name)}" onclick="editContact('${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer">
        <td style="width:32px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" ${_contactNavSel.has(c.name.toLowerCase()) ? 'checked' : ''} onchange="_contactNavToggle('${cSelKey}')"></td>
        <td style="font-weight:500;white-space:nowrap" title="${c.name}">
          ${c.name}
        </td>
        ${vis('type') ? `<td>${getTypeBadge(c.type)}</td>` : ''}
        ${vis('role') ? `<td title="${c.role || c.defaultRole}">${c.role ? `<span class="tag">${c.role}</span>` : (c.defaultRole ? `<span class="tag" style="opacity:0.7" title="General role">${c.defaultRole}</span>` : '—')}</td>` : ''}
        ${vis('projects') ? `<td title="${c.projects}">${c.projects || '<span style="color:var(--text3);font-size:11px">—</span>'}</td>` : ''}
        ${vis('phone') ? `<td title="${c.phone || ''}">${c.phone ? `<a href="tel:${c.phone}" style="color:var(--accent2)">${c.phone}</a>` : '—'}</td>` : ''}
        ${vis('email') ? `<td title="${c.email || ''}">${c.email ? `<a href="mailto:${c.email}" style="color:var(--accent2)">${c.email}</a>` : '—'}</td>` : ''}
        ${vis('socials') ? `<td title="${c.socials || ''}">${renderSocialLinks(c.socials)}</td>` : ''}
        ${vis('photos') ? `<td>${photosBadge}</td>` : ''}
        ${customCells}
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();toggleContactExpand('${c.name.replace(/'/g, "\\'")}')" title="Photos">${isExpanded ? '▾' : '▸'}</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removeContact('${c.name.replace(/'/g, "\\'")}')">✕</button>
        </td>
      </tr>`;
      return mainRow + (isExpanded ? photoStripContactHTML(photos, c.name, totalCols) : '');
    }).join('') +
    '</tbody></table></div>';

  if (contactSubView === 'all') renderLocationContactsSection(el);
  setTimeout(initTableScrollbars, 0);
  if (_refocusContactSearch) {
    _refocusContactSearch = false;
    const inp = el.querySelector('input[placeholder="Search contacts…"]');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

function _contactNavToggle(nameLower) {
  if (_contactNavSel.has(nameLower)) _contactNavSel.delete(nameLower);
  else _contactNavSel.add(nameLower);
  renderContacts();
}

function _contactNavSelectAll(checked) {
  const el = document.getElementById('contacts-list');
  if (!el) return;
  el.querySelectorAll('tbody td:first-child input[type=checkbox]').forEach(cb => {
    const onch = cb.getAttribute('onchange') || '';
    const m = onch.match(/_contactNavToggle\('([^']+)'\)/);
    if (m) {
      if (checked) _contactNavSel.add(m[1]);
      else _contactNavSel.delete(m[1]);
    }
  });
  renderContacts();
}

function _contactNavRemoveSelected() {
  const count = _contactNavSel.size;
  if (!count) return;
  showConfirmDialog(
    `Remove ${count} contact${count !== 1 ? 's' : ''}?`,
    `This will permanently delete ${count} selected contact${count !== 1 ? 's' : ''} from all projects.`,
    () => {
      for (const nameLower of _contactNavSel) {
        store.projects.forEach(p => fullyRemoveFromProject(nameLower, p.id));
        if (store.contacts) store.contacts = store.contacts.filter(c => !c.name || c.name.toLowerCase() !== nameLower);
      }
      _contactNavSel.clear();
      saveStore();
      renderContacts();
      showToast(`${count} contact${count !== 1 ? 's' : ''} removed`, 'success');
    }
  );
}

function _contactNavRemoveAll() {
  const el = document.getElementById('contacts-list');
  if (!el) return;
  const names = [];
  el.querySelectorAll('tbody td:first-child input[type=checkbox]').forEach(cb => {
    const onch = cb.getAttribute('onchange') || '';
    const m = onch.match(/_contactNavToggle\('([^']+)'\)/);
    if (m) names.push(m[1]);
  });
  if (!names.length) return;
  showConfirmDialog(
    `Remove all ${names.length} contact${names.length !== 1 ? 's' : ''}?`,
    `This will permanently delete all ${names.length} currently visible contact${names.length !== 1 ? 's' : ''} from all projects.`,
    () => {
      for (const nameLower of names) {
        store.projects.forEach(p => fullyRemoveFromProject(nameLower, p.id));
        if (store.contacts) store.contacts = store.contacts.filter(c => !c.name || c.name.toLowerCase() !== nameLower);
      }
      _contactNavSel.clear();
      saveStore();
      renderContacts();
      showToast(`${names.length} contact${names.length !== 1 ? 's' : ''} removed`, 'success');
    }
  );
}

function renderLocationContactsSection(el) {
  const locationContacts = [];
  store.projects.forEach(p => {
    (p.locations || []).forEach(l => {
      if (l.contactName) locationContacts.push({ contactName: l.contactName, contactPhone: l.contactPhone || '', contactEmail: l.contactEmail || '', locationName: l.name, project: p.title });
    });
  });
  (store.locations || []).forEach(l => {
    if (l.contactName) locationContacts.push({ contactName: l.contactName, contactPhone: l.contactPhone || '', contactEmail: l.contactEmail || '', locationName: l.name, project: '—' });
  });

  if (!locationContacts.length) {
    if (contactSubView === 'locations') {
      el.innerHTML = '<div class="empty-state" style="padding:48px;text-align:center"><div style="font-size:48px;margin-bottom:16px">📍</div><h3>No location contacts</h3><p style="color:var(--text2);margin-top:8px">Add a contact name to a location to see it here</p></div>';
    }
    return;
  }

  el.innerHTML += `<div style="margin-top:${contactSubView === 'locations' ? '0' : '32px'}">
    ${contactSubView !== 'locations' ? '<h3 style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border2)">📍 Location Contacts</h3>' : ''}
    <div class="table-container"><table class="data-table"><thead><tr>
      <th>Name</th><th>Location</th><th>Project</th><th>Phone</th><th>Email</th>
    </tr></thead><tbody>` +
    locationContacts.map(lc => `<tr>
      <td style="font-weight:500">${lc.contactName}</td>
      <td>${lc.locationName || '—'}</td>
      <td>${lc.project}</td>
      <td>${lc.contactPhone ? `<a href="tel:${lc.contactPhone}" style="color:var(--accent2)">${lc.contactPhone}</a>` : '—'}</td>
      <td>${lc.contactEmail ? `<a href="mailto:${lc.contactEmail}" style="color:var(--accent2)">${lc.contactEmail}</a>` : '—'}</td>
    </tr>`).join('') +
    '</tbody></table></div></div>';
}

// LOCATIONS (global view)
function renderLocations() {
  const el = document.getElementById('locations-list');

  // Get current filter
  const filterSelect = document.getElementById('locations-filter');
  const filterProject = filterSelect ? filterSelect.value : 'all';

  // Gather all locations from all projects
  const locationsMap = {};
  store.projects.forEach(p => {
    // From locations table
    (p.locations || []).forEach((l, locIdx) => {
      if (l.name) {
        const key = l.name.toLowerCase() + '|' + p.id;
        const costDisplay = l.cost
          ? (l.costPeriod ? `${l.cost} ${l.costPeriod}` : l.cost)
          : '';
        locationsMap[key] = {
          name: l.name,
          project: p.title,
          projectId: p.id,
          locIdx,
          date: l.date || '',
          suitability: l.suit || '',
          cost: costDisplay,
          accessibility: l.access || '',
          decision: l.decision || '',
          notes: (l.notes ? l.notes + (l.rules ? '\n' + l.rules : '') : l.rules) || '',
          contactName: l.contactName || '',
          contactPhone: l.contactPhone || '',
          contactEmail: l.contactEmail || '',
          source: 'location'
        };
      }
    });
    // From scouting sheets
    (p.scoutingSheets || []).forEach(s => {
      if (s.name) {
        const key = s.name.toLowerCase() + '|' + p.id;
        if (!locationsMap[key]) {
          locationsMap[key] = {
            name: s.name,
            project: p.title,
            projectId: p.id,
            locIdx: null,
            date: s.date || '',
            suitability: s.suitability || '',
            cost: s.cost || '',
            accessibility: s.accessibility || '',
            decision: '',
            notes: s.info || '',
            source: 'scouting'
          };
        }
      }
    });
  });

  // Include unlinked locations from store.locations
  (store.locations || []).forEach((l, gIdx) => {
    if (!l.name) return;
    const key = l.name.toLowerCase() + '|_global';
    const costDisplay = l.cost
      ? (l.costPeriod ? `${l.cost} ${l.costPeriod}` : l.cost)
      : '';
    locationsMap[key] = {
      name: l.name,
      project: '—',
      projectId: '_global',
      locIdx: gIdx,
      date: l.date || '',
      suitability: l.suit || '',
      cost: costDisplay,
      accessibility: l.access || '',
      decision: l.decision || '',
      notes: (l.notes ? l.notes + (l.rules ? '\n' + l.rules : '') : l.rules) || '',
      contactName: l.contactName || '',
      contactPhone: l.contactPhone || '',
      contactEmail: l.contactEmail || '',
      source: 'location'
    };
  });

  let locations = Object.values(locationsMap);

  // Sort
  locations.sort((a, b) => {
    const asc = locationSort.dir === 'asc';
    let av, bv;
    if (locationSort.col === 'name') {
      av = a.name; bv = b.name;
    } else if (locationSort.col === 'project') {
      av = a.project; bv = b.project;
    } else if (locationSort.col === 'photos') {
      av = getFilesForLocation(a.name).length; bv = getFilesForLocation(b.name).length;
      return asc ? av - bv : bv - av;
    } else {
      av = a[locationSort.col] || ''; bv = b[locationSort.col] || '';
    }
    return (asc ? 1 : -1) * av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Filter by project
  let filteredLocations = filterProject === 'all'
    ? locations
    : locations.filter(l => l.projectId === filterProject);

  // Filter by search
  const locSearchEl = document.getElementById('locations-search');
  if (locSearchEl) locationSearch = locSearchEl.value;
  if (locationSearch.trim()) {
    const q = locationSearch.trim().toLowerCase();
    filteredLocations = filteredLocations.filter(l => l.name.toLowerCase().includes(q));
  }

  // Filter bar
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px">
    <input class="form-input" id="locations-search" placeholder="Search locations…" value="${locationSearch.replace(/"/g,'&quot;')}"
      oninput="locationSearch=this.value;_refocusLocationSearch=true;renderLocations()" style="max-width:200px;font-size:12px;">
    <select id="locations-filter" onchange="renderLocations()" class="form-select" style="max-width:280px">
      <option value="all" ${filterProject === 'all' ? 'selected' : ''}>All Locations</option>
      ${store.projects.map(p => `<option value="${p.id}" ${filterProject === p.id ? 'selected' : ''}>${p.title}</option>`).join('')}
      ${(store.locations || []).length ? `<option value="_global" ${filterProject === '_global' ? 'selected' : ''}>— Unlinked —</option>` : ''}
    </select>
    <span style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${filteredLocations.length} location${filteredLocations.length !== 1 ? 's' : ''}</span>
    ${_locNavSel.size > 0 ? `<button class="btn btn-sm btn-danger" onclick="_locNavRemoveSelected()"  style="margin-left:4px">Remove Selected (${_locNavSel.size})</button>` : ''}
    <button class="btn btn-sm btn-danger" onclick="_locNavRemoveAll()" style="${_locNavSel.size > 0 ? '' : 'margin-left:4px'}">Remove All</button>
    <button class="btn btn-sm" onclick="openLocationColumnsModal()" style="margin-left:auto" title="Manage columns">⊕ Columns${(store.locationColumns||[]).length ? ` <span style="opacity:0.6">(${store.locationColumns.length})</span>` : ''}</button>
  </div>`;

  if (!filteredLocations.length) {
    el.innerHTML += '<div class="empty-state" style="padding:48px;text-align:center"><div style="font-size:48px;margin-bottom:16px">📍</div><h3>No locations yet</h3><p style="color:var(--text2);margin-top:8px">Add locations to projects to see them here</p></div>';
    if (_refocusLocationSearch) {
      _refocusLocationSearch = false;
      const inp = el.querySelector('input[placeholder="Search locations…"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
    return;
  }

  function getSuitabilityBadge(s) {
    if (s === 'suitable') return '<span class="tag" style="background:rgba(46,168,100,0.2);color:#60d090;border-color:rgba(46,168,100,0.25)">Suitable</span>';
    if (s === 'possible') return '<span class="tag" style="background:rgba(212,136,58,0.2);color:#f0a860;border-color:rgba(212,136,58,0.25)">Possibly Suitable</span>';
    if (s === 'unsuitable') return '<span class="tag" style="background:rgba(196,68,68,0.2);color:#e08080;border-color:rgba(196,68,68,0.25)">Unsuitable</span>';
    return '<span style="color:var(--text3);font-size:11px">—</span>';
  }

  function getDecisionBadge(d) {
    if (d === 'confirmed') return '<span class="tag" style="background:rgba(46,168,100,0.2);color:#60d090;border-color:rgba(46,168,100,0.25)">Confirmed ✓</span>';
    if (d === 'needed') return '<span class="tag" style="background:rgba(230,188,60,0.15);color:var(--accent);border-color:rgba(230,188,60,0.3)">Confirmation Needed</span>';
    if (d === 'backup') return '<span class="tag" style="background:rgba(212,136,58,0.2);color:#f0a860;border-color:rgba(212,136,58,0.25)">Backup</span>';
    if (d === 'rejected') return '<span class="tag" style="background:rgba(196,68,68,0.2);color:#e08080;border-color:rgba(196,68,68,0.25)">Rejected ✗</span>';
    return '<span class="tag" style="color:var(--text3)">TBD</span>';
  }

  const locCustCols = store.locationColumns || [];
  const locHidden = store.locationHiddenCols || [];
  const locVis = id => !locHidden.includes(id);
  const locThStyle = 'cursor:pointer;user-select:none;white-space:nowrap';
  const locCustHeaders = locCustCols.map(col =>
    col.type === 'stars'
      ? `<th style="${locThStyle}" onclick="setLocationSort('${col.id}')">${col.label}${sortIcon(col.id, locationSort)}</th>`
      : `<th>${col.label}</th>`
  ).join('');
  const totalLocCols = 3 + LOCATION_BUILTIN_COLS.filter(c => locVis(c.id)).length + locCustCols.length;

  const _locDeletable = filteredLocations.filter(l => l.locIdx !== null);
  const _locAllSel = _locDeletable.length > 0 && _locDeletable.every(l => _locNavSel.has(l.projectId + '~~' + l.locIdx));

  el.innerHTML += `<div class="table-container"><table class="data-table locations-table"><thead><tr>
    <th style="width:32px;padding:6px 4px"><input type="checkbox" title="Select all" ${_locAllSel ? 'checked' : ''} onchange="_locNavSelectAll(this.checked)" onclick="event.stopPropagation()"></th>
    <th style="${locThStyle}" onclick="setLocationSort('name')">Location${sortIcon('name', locationSort)}</th>
    ${locVis('project')       ? `<th style="${locThStyle}" data-ctx="col-location:project" onclick="setLocationSort('project')">Project${sortIcon('project', locationSort)}${locColHideBtn('project')}</th>` : ''}
    ${locVis('contact')       ? `<th data-ctx="col-location:contact">Contact${locColHideBtn('contact')}</th>` : ''}
    ${locVis('dateScouted')   ? `<th data-ctx="col-location:dateScouted">Date Scouted${locColHideBtn('dateScouted')}</th>` : ''}
    ${locVis('suitability')   ? `<th data-ctx="col-location:suitability">Suitability${locColHideBtn('suitability')}</th>` : ''}
    ${locVis('cost')          ? `<th data-ctx="col-location:cost">Cost <span title="Cost accurate as of date scouted" style="cursor:help;opacity:0.6">ⓘ</span>${locColHideBtn('cost')}</th>` : ''}
    ${locVis('accessibility') ? `<th data-ctx="col-location:accessibility">Accessibility${locColHideBtn('accessibility')}</th>` : ''}
    ${locVis('status')        ? `<th data-ctx="col-location:status">Status${locColHideBtn('status')}</th>` : ''}
    ${locVis('notes')         ? `<th data-ctx="col-location:notes">Notes${locColHideBtn('notes')}</th>` : ''}
    ${locVis('photos')        ? `<th style="${locThStyle}" data-ctx="col-location:photos" onclick="setLocationSort('photos')">Photos${sortIcon('photos', locationSort)}${locColHideBtn('photos')}</th>` : ''}
    ${locCustHeaders}<th></th>
  </tr></thead><tbody>` +
    filteredLocations.map((l) => {
      const photos = getFilesForLocation(l.name);
      const key = l.name + '|' + l.projectId;
      const isExpanded = expandedLocations.has(key);
      const lNameEsc = l.name.replace(/'/g, "\\'");
      const photosBadge = photos.length
        ? `<span class="photos-badge" onclick="event.stopPropagation();toggleLocationExpand('${lNameEsc}','${l.projectId}')">📷 ${photos.length}</span>`
        : '<span style="color:var(--text3);font-size:11px;">—</span>';
      const editBtn = l.locIdx !== null
        ? `<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openMoveLocation('${l.projectId}',${l.locIdx})" title="Move / copy details to another location" style="font-size:13px">⇄</button>
           <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteLocationGlobal('${l.projectId}',${l.locIdx})" title="Delete location">🗑</button>`
        : '';
      const contactCell = l.contactName
        ? `<span style="font-size:12px">${l.contactName}${l.contactPhone ? `<br><a href="tel:${l.contactPhone}" style="color:var(--accent2);font-size:11px">${l.contactPhone}</a>` : ''}${l.contactEmail ? `<br><a href="mailto:${l.contactEmail}" style="color:var(--accent2);font-size:11px">${l.contactEmail}</a>` : ''}</span>`
        : '<span style="color:var(--text3);font-size:11px">—</span>';
      const locCustomCells = locCustCols.map(col => {
        const val = (store.locationCustomData[l.name.toLowerCase()] || {})[col.id];
        if (col.type === 'stars') {
          const rating = parseInt(val) || 0;
          const stars = [1,2,3,4,5].map(n =>
            `<span onclick="event.stopPropagation();setLocationRating('${lNameEsc}','${col.id}',${n === rating ? 0 : n})" style="cursor:pointer;font-size:15px;color:${n <= rating ? 'var(--accent)' : 'var(--border2)'}">★</span>`
          ).join('');
          return `<td style="white-space:nowrap">${stars}</td>`;
        } else {
          const text = val || '';
          return `<td onclick="event.stopPropagation();openLocationTextEdit(this,'${lNameEsc}','${col.id}')" style="cursor:text;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${text?'var(--text)':'var(--text3)'}"${text ? ` data-tip="${text.replace(/"/g,'&quot;')}"` : ''}>${text ? text.replace(/</g,'&lt;') : '<span style="opacity:0.35">—</span>'}</td>`;
        }
      }).join('');
      const ctxLocData = l.locIdx !== null ? `loc-global:${l.projectId}:${l.locIdx}` : '';
      const locSelKey = l.locIdx !== null ? l.projectId + '~~' + l.locIdx : null;
      const locRowClick = l.locIdx !== null ? `onclick="editLocationGlobal('${l.projectId}',${l.locIdx})"` : '';
      const mainRow = `<tr ${ctxLocData ? `data-ctx="${ctxLocData}"` : ''} ${locRowClick} style="${l.locIdx !== null ? 'cursor:pointer' : ''}">
        <td style="width:32px;padding:6px 4px" onclick="event.stopPropagation()">${locSelKey !== null ? `<input type="checkbox" ${_locNavSel.has(locSelKey) ? 'checked' : ''} onchange="_locNavToggle('${locSelKey.replace(/'/g,"\\'")}')">` : ''}</td>
        <td style="font-weight:500;white-space:nowrap">${l.name}${_scoutIconHtml(l.name)}</td>
        ${locVis('project')       ? `<td>${l.project}</td>` : ''}
        ${locVis('contact')       ? `<td>${contactCell}</td>` : ''}
        ${locVis('dateScouted')   ? `<td style="white-space:nowrap">${l.date || '—'}</td>` : ''}
        ${locVis('suitability')   ? `<td>${getSuitabilityBadge(l.suitability)}</td>` : ''}
        ${locVis('cost')          ? `<td style="white-space:nowrap">${l.cost || '—'}</td>` : ''}
        ${locVis('accessibility') ? `<td>${l.accessibility || '—'}</td>` : ''}
        ${locVis('status')        ? `<td>${getDecisionBadge(l.decision)}</td>` : ''}
        ${locVis('notes')         ? `<td style="max-width:180px"${l.notes ? ` data-tip="${l.notes.replace(/"/g,'&quot;')}"` : ''}>${l.notes ? (l.notes.length > 60 ? l.notes.substring(0,60)+'…' : l.notes) : '—'}</td>` : ''}
        ${locVis('photos')        ? `<td>${photosBadge}</td>` : ''}
        ${locCustomCells}
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();toggleLocationExpand('${lNameEsc}','${l.projectId}')" title="Photos">${isExpanded ? '▾' : '▸'}</button>
          ${editBtn}
        </td>
      </tr>`;
      return mainRow + (isExpanded ? photoStripHTML(photos, totalLocCols) : '');
    }).join('') +
    '</tbody></table></div>';

  setTimeout(initTableScrollbars, 0);
  if (_refocusLocationSearch) {
    _refocusLocationSearch = false;
    const inp = el.querySelector('input[placeholder="Search locations…"]');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

function _locNavToggle(key) {
  if (_locNavSel.has(key)) _locNavSel.delete(key);
  else _locNavSel.add(key);
  renderLocations();
}

function _locNavSelectAll(checked) {
  const el = document.getElementById('locations-list');
  if (!el) return;
  el.querySelectorAll('tbody td:first-child input[type=checkbox]').forEach(cb => {
    const onch = cb.getAttribute('onchange') || '';
    const m = onch.match(/_locNavToggle\('([^']+)'\)/);
    if (m) {
      if (checked) _locNavSel.add(m[1]);
      else _locNavSel.delete(m[1]);
    }
  });
  renderLocations();
}

function _locNavRemoveSelected() {
  const count = _locNavSel.size;
  if (!count) return;
  showConfirmDialog(
    `Remove ${count} location${count !== 1 ? 's' : ''}?`,
    `This will permanently delete ${count} selected location${count !== 1 ? 's' : ''}.`,
    () => {
      const byProject = {};
      for (const key of _locNavSel) {
        const tilde = key.indexOf('~~');
        const pid = key.slice(0, tilde);
        const locIdx = parseInt(key.slice(tilde + 2));
        if (!byProject[pid]) byProject[pid] = new Set();
        byProject[pid].add(locIdx);
      }
      for (const [pid, idxSet] of Object.entries(byProject)) {
        if (pid === '_global') {
          store.locations = (store.locations || []).filter((_, i) => !idxSet.has(i));
        } else {
          const p = store.projects.find(proj => proj.id === pid);
          if (p && p.locations) p.locations = p.locations.filter((_, i) => !idxSet.has(i));
        }
      }
      _locNavSel.clear();
      saveStore();
      renderLocations();
      showToast(`${count} location${count !== 1 ? 's' : ''} removed`, 'success');
    }
  );
}

function _locNavRemoveAll() {
  // Collect all currently-visible deletable keys from rendered checkboxes
  const el = document.getElementById('locations-list');
  if (!el) return;
  const keys = [];
  el.querySelectorAll('tbody td:first-child input[type=checkbox]').forEach(cb => {
    const onch = cb.getAttribute('onchange') || '';
    const m = onch.match(/_locNavToggle\('([^']+)'\)/);
    if (m) keys.push(m[1]);
  });
  if (!keys.length) return;
  showConfirmDialog(
    `Remove all ${keys.length} location${keys.length !== 1 ? 's' : ''}?`,
    `This will permanently delete all ${keys.length} currently visible location${keys.length !== 1 ? 's' : ''}.`,
    () => {
      const byProject = {};
      for (const key of keys) {
        const tilde = key.indexOf('~~');
        const pid = key.slice(0, tilde);
        const locIdx = parseInt(key.slice(tilde + 2));
        if (!byProject[pid]) byProject[pid] = new Set();
        byProject[pid].add(locIdx);
      }
      for (const [pid, idxSet] of Object.entries(byProject)) {
        if (pid === '_global') {
          store.locations = (store.locations || []).filter((_, i) => !idxSet.has(i));
        } else {
          const p = store.projects.find(proj => proj.id === pid);
          if (p && p.locations) p.locations = p.locations.filter((_, i) => !idxSet.has(i));
        }
      }
      _locNavSel.clear();
      saveStore();
      renderLocations();
      showToast(`${keys.length} location${keys.length !== 1 ? 's' : ''} removed`, 'success');
    }
  );
}

function showLocationDetails(locationName, projectId) {
  toggleLocationExpand(locationName, projectId);
}

// ══════════════════════════════════════════════════════════════════════════════
