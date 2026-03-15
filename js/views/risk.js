// RISK ASSESSMENT
// ══════════════════════════════════════════
function renderRiskAssessment(p) {
  if(!p.riskMeta) p.riskMeta={pm:'',date:'',location:'',signatory:'',sigdate:''};
  document.getElementById('risk-pm').value=p.riskMeta.pm||'';
  document.getElementById('risk-date').value=p.riskMeta.date||'';
  document.getElementById('risk-location').value=p.riskMeta.location||'';
  document.getElementById('risk-signatory').value=p.riskMeta.signatory||'';
  document.getElementById('risk-sigdate').value=p.riskMeta.sigdate||'';
  const tbody=document.getElementById('risk-body');
  if(!p.risks||!p.risks.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state" style="padding:20px"><div class="icon">⚠️</div><h4>No hazards identified yet</h4></div></td></tr>`;return;}
  const rfColor=(n)=>{if(n<=2)return 'var(--green)';if(n<=3)return 'var(--orange)';return 'var(--red)';};
  tbody.innerHTML=p.risks.map((r,i)=>`
    <tr data-ctx="risk:${i}">
      <td><strong>${r.hazard||'—'}</strong></td>
      <td>${r.who||'—'}</td>
      <td><span style="color:${rfColor(r.factor)};font-weight:700;font-family:var(--font-mono)">${r.factor||'—'}</span></td>
      <td>${r.controls||'—'}</td>
      <td>${r.further||'—'}</td>
      <td><span style="color:${rfColor(r.newfactor)};font-weight:700;font-family:var(--font-mono)">${r.newfactor||'—'}</span></td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editRiskRow(${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removeRiskRow(${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function saveRiskMeta(){
  const p=currentProject();if(!p.riskMeta)p.riskMeta={};
  p.riskMeta.pm=document.getElementById('risk-pm').value;
  p.riskMeta.date=document.getElementById('risk-date').value;
  p.riskMeta.location=document.getElementById('risk-location').value;
  p.riskMeta.signatory=document.getElementById('risk-signatory').value;
  p.riskMeta.sigdate=document.getElementById('risk-sigdate').value;
  saveStore();
}
function addRiskRow(){document.getElementById('risk-edit-idx').value='';['hazard','who','factor','newfactor','controls','further'].forEach(f=>document.getElementById('risk-'+f).value='');openModal('modal-risk');}
function editRiskRow(i){const r=currentProject().risks[i];document.getElementById('risk-edit-idx').value=i;document.getElementById('risk-hazard').value=r.hazard||'';document.getElementById('risk-who').value=r.who||'';document.getElementById('risk-factor').value=r.factor||'';document.getElementById('risk-newfactor').value=r.newfactor||'';document.getElementById('risk-controls').value=r.controls||'';document.getElementById('risk-further').value=r.further||'';openModal('modal-risk');}
function saveRiskRow(){
  const p=currentProject();if(!p.risks)p.risks=[];
  const r={hazard:document.getElementById('risk-hazard').value,who:document.getElementById('risk-who').value,factor:document.getElementById('risk-factor').value,newfactor:document.getElementById('risk-newfactor').value,controls:document.getElementById('risk-controls').value,further:document.getElementById('risk-further').value};
  const idx=document.getElementById('risk-edit-idx').value;
  if(idx!=='')p.risks[parseInt(idx)]=r;else p.risks.push(r);
  saveStore();closeModal('modal-risk');renderRiskAssessment(p);showToast('Saved','success');
}
function removeRiskRow(i){showConfirmDialog('Remove this risk entry?','Remove',()=>{const p=currentProject();p.risks.splice(i,1);saveStore();renderRiskAssessment(p);});}

// ══════════════════════════════════════════
// RELEASE FORMS
// ══════════════════════════════════════════
function renderReleases(p) {
  if(!p.releases) p.releases=[];
  const el=document.getElementById('releases-list');
  if(!p.releases.length){el.innerHTML=`<div class="empty-state"><div class="icon">📝</div><h4>No release forms yet</h4><p>Add talent or location release forms</p></div>`;
  } else {
    el.innerHTML=p.releases.map((r,i)=>`
      <div class="breakdown-card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div><span class="tag">${r.type==='talent'?'TALENT RELEASE':'LOCATION RELEASE'}</span> &nbsp; <strong>${r.name||'Unnamed'}</strong></div>
          <div style="display:flex;gap:8px">
            <span class="chip" style="color:${r.signed?'var(--green)':'var(--orange)'}">${r.signed?'● Signed':'○ Unsigned'}</span>
            <button class="btn btn-sm btn-ghost" onclick="toggleSigned(${i})">${r.signed?'Mark Unsigned':'Mark Signed'}</button>
            <button class="btn btn-sm btn-danger" onclick="removeRelease(${i})">✕</button>
          </div>
        </div>
        ${r.type==='talent'?`
          <div class="form-row">
            <div class="form-group"><label class="form-label">Talent Name</label><input class="form-input" value="${r.talentName||''}" onchange="updateRelease(${i},'talentName',this.value)" placeholder="Full name"></div>
            <div class="form-group"><label class="form-label">Character Name</label><input class="form-input" value="${r.charName||''}" onchange="updateRelease(${i},'charName',this.value)" placeholder="Character"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Address</label><input class="form-input" value="${r.address||''}" onchange="updateRelease(${i},'address',this.value)"></div>
            <div class="form-group"><label class="form-label">Phone</label><input class="form-input" value="${r.phone||''}" onchange="updateRelease(${i},'phone',this.value)"></div>
          </div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" value="${r.email||''}" onchange="updateRelease(${i},'email',this.value)" type="email"></div>
        `:`
          <div class="form-group"><label class="form-label">Property / Location Name</label><input class="form-input" value="${r.property||''}" onchange="updateRelease(${i},'property',this.value)" placeholder="e.g. The Old Mill, Manchester"></div>
          <div class="form-group"><label class="form-label">Property Address</label><input class="form-input" value="${r.address||''}" onchange="updateRelease(${i},'address',this.value)"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Owner / Contact Name</label><input class="form-input" value="${r.owner||''}" onchange="updateRelease(${i},'owner',this.value)"></div>
            <div class="form-group"><label class="form-label">Date Signed</label><input class="form-input" type="date" value="${r.dateSigned||''}" onchange="updateRelease(${i},'dateSigned',this.value)"></div>
          </div>
        `}
        <div class="form-group" style="margin-top:8px"><label class="form-label">Notes</label><input class="form-input" value="${r.notes||''}" onchange="updateRelease(${i},'notes',this.value)" placeholder="Any notes..."></div>
      </div>
    `).join('');
  }
}
function addRelease(type){const p=currentProject();if(!p.releases)p.releases=[];p.releases.push({type,name:type==='talent'?'New Talent':'New Location',signed:false});saveStore();renderReleases(p);}
function toggleSigned(i){const p=currentProject();p.releases[i].signed=!p.releases[i].signed;saveStore();renderReleases(p);}
function removeRelease(i){showConfirmDialog('Remove this release form?','Remove',()=>{const p=currentProject();p.releases.splice(i,1);saveStore();renderReleases(p);});}
function updateRelease(i,field,val){const p=currentProject();p.releases[i][field]=val;if(field==='talentName'||field==='property')p.releases[i].name=val;saveStore();}

// ══════════════════════════════════════════
// TECH SCOUT CHECKLIST
// ══════════════════════════════════════════
const TECH_SCOUT_ITEMS = {
  'Story': ['Storytelling: Does the location meet the scene requirements, and fit the director\'s tone?','Anachronisms: Does the setting fit the time period and story setting?'],
  'Sight': ['Wide Shot Test: Is a wide frame acceptable? Any problematic visual elements?','360 Test: Are there any problematic directions that should be avoided?','Commercial Clearance: Any properties that require commercial clearance?','Indoor Staging: Does your cast, crew and gear fit inside?','Sunlight: Any sunlight considerations? Morning? Noon? Afternoon? Evening?','VFX Needs: Would anything need to be removed or added in post?'],
  'Sound': ['HVAC: Can you turn off heating, ventilation and air conditioning?','Refrigerators: Can you turn off any noisy appliances?','Reverberation: Can you record clean dialogue? Do you need to dampen echoes?'],
  'Surroundings': ['Roads & Traffic: Any traffic concerns? Noise or continuity issues?','Schools: Schoolyard noise? Continuity issues?','Playgrounds: Will playground noise affect sound?','Factories/Warehouses: Any noise from machinery?','Airports: Will airplane noise affect sound?','Air Traffic: Any significant air traffic overhead?','Sufficient Parking: Is there sufficient parking for talent, crew, and vehicles?','Staging Talent: Is there a dedicated quiet space for talent and extras?'],
  'Weather': ['Temperature: Will the location be too hot or cold?','Rain/Snow: Will precipitation have a potential impact?','Indoor Impacts: Will sound from precipitation affect the shoot?'],
  'Power': ['Accessible Outlets: Are there enough outlets? How many? Where?','Access to Breakers: Does the electrical crew have access to the circuit breaker?','Breaker Isolation: How many breaker circuits? What\'s the rating?','Isolation of Hair & Makeup: Is there a dedicated space and breaker for H&M?'],
  'Facilities': ['Bathrooms-to-Person Ratio: How many people on set per bathroom?','Access to Water Shut Off: Do you have access in case of emergency?','Access to Gas Shut Off: Do you have access in case of emergency?'],
  'Contracts': ['Contract Signed: Has the location owner signed a location release?','Insurance/Liability: Does your production insurance cover this location?','Contingency Plans: Are there clauses for date changes in the contract?'],
};

function _techScoutTabsHtml(p) {
  const scouts = p.techScouts || [];
  const tabs = scouts.map((s, i) =>
    `<button class="btn btn-sm${i === _activeTechScoutIdx ? ' btn-primary' : ''}" onclick="_selectTechScout(${i})">${(s.name||'Scout '+(i+1)).slice(0,22)}</button>`
  ).join('');
  const delBtn = scouts.length > 0 ? `<button class="btn btn-sm btn-ghost btn-danger" onclick="removeTechScout(${_activeTechScoutIdx})" title="Delete this checklist" style="margin-left:4px">🗑</button>` : '';
  const minBtn = scouts.length > 0 ? `<button class="btn btn-sm btn-ghost" onclick="_techScoutMinimized=!_techScoutMinimized;renderTechScouts(currentProject())" style="margin-left:auto" title="${_techScoutMinimized?'Expand':'Collapse'}">${_techScoutMinimized ? '▸ Expand' : '▾ Collapse'}</button>` : '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%">${tabs}${delBtn}${minBtn}</div>`;
}

function _techScoutContent(scout, si) {
  const checksDone = Object.values(scout.checks || {}).filter(Boolean).length;
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const pct = checksTotal ? Math.round(checksDone / checksTotal * 100) : 0;
  return `
    <div style="display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:16px;align-items:end">
      <div class="form-group" style="margin:0"><label class="form-label">Location Name</label><input class="form-input" value="${(scout.name||'').replace(/"/g,'&quot;')}" onchange="updateTechScout(${si},'name',this.value);renderTechScoutTabs(currentProject())"></div>
      <div class="form-group" style="margin:0"><label class="form-label">Date</label><input class="form-input" type="date" value="${scout.date||''}" onchange="updateTechScout(${si},'date',this.value)"></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:8px 12px;background:var(--surface2);border-radius:6px">
      <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div id="tech-progress-bar-${si}" style="width:${pct}%;height:100%;background:var(--accent2);border-radius:4px;transition:width .3s"></div></div>
      <span id="tech-progress-label-${si}" style="font-size:12px;color:var(--text2);white-space:nowrap">${checksDone}/${checksTotal} checked (${pct}%)</span>
    </div>
    ${Object.entries(TECH_SCOUT_ITEMS).map(([cat,items])=>`
      <div style="margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:14px;letter-spacing:1px;color:var(--accent2);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${items.map((item,ii)=>{
            const key=cat+'_'+ii;
            const checked=(scout.checks||{})[key];
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:var(--surface2);border-radius:6px;cursor:pointer${checked?';border-left:2px solid var(--accent2)':''}" onclick="toggleTechCheck(${si},'${key}')">
              <div class="equip-check${checked?' checked':''}" style="margin-top:1px;flex-shrink:0"></div>
              <span style="font-size:12px;color:var(--text2);line-height:1.4">${item}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="form-group" style="margin-top:8px"><label class="form-label">Notes — ${cat}</label><textarea class="form-textarea" style="min-height:50px" onchange="updateTechScout(${si},'notes_${cat}',this.value)">${(scout['notes_'+cat])||''}</textarea></div>
      </div>
    `).join('')}
    <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap">
      <button class="btn btn-sm btn-primary" onclick="_techScoutMinimized=true;renderTechScouts(currentProject())" title="Auto-saves on every change">✓ Save &amp; Collapse</button>
      <button class="btn btn-sm btn-ghost" onclick="_printTechScout(${si})">⎙ Print</button>
      <button class="btn btn-sm btn-ghost" onclick="_downloadTechScout(${si})">⬇ Export HTML</button>
    </div>`;
}

function renderTechScoutTabs(p) {
  const tabBar = document.getElementById('techscout-tabs');
  if (tabBar) tabBar.innerHTML = _techScoutTabsHtml(p);
}

function renderTechScouts(p) {
  const el = document.getElementById('techscout-list');
  if (!el) return;
  if (!p.techScouts || !p.techScouts.length) {
    el.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">No tech scout checklists yet — click "+ New Checklist" to add one.</p>`;
    return;
  }
  _activeTechScoutIdx = Math.min(_activeTechScoutIdx, p.techScouts.length - 1);
  const scout = p.techScouts[_activeTechScoutIdx];
  el.innerHTML = `
    <div id="techscout-tabs" style="margin-bottom:${_techScoutMinimized ? 4 : 14}px">${_techScoutTabsHtml(p)}</div>
    ${_techScoutMinimized ? '' : `<div class="breakdown-card" style="margin-bottom:0">${_techScoutContent(scout, _activeTechScoutIdx)}</div>`}`;
}

function _selectTechScout(i) {
  _activeTechScoutIdx = i;
  renderTechScouts(currentProject());
  document.getElementById('techscout-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addTechScout() {
  const p = currentProject();
  if (!p.techScouts) p.techScouts = [];
  p.techScouts.push({ name: '', date: '', checks: {} });
  _activeTechScoutIdx = p.techScouts.length - 1;
  saveStore();
  renderTechScouts(p);
}
function removeTechScout(i) {
  showConfirmDialog('Remove this tech scout checklist?', 'Remove', () => {
    const p = currentProject();
    p.techScouts.splice(i, 1);
    _activeTechScoutIdx = Math.max(0, i - 1);
    saveStore();
    renderTechScouts(p);
  });
}
function updateTechScout(i, field, val) { const p = currentProject(); p.techScouts[i][field] = val; saveStore(); }
function toggleTechCheck(si, key) {
  const p = currentProject();
  if (!p.techScouts[si].checks) p.techScouts[si].checks = {};
  p.techScouts[si].checks[key] = !p.techScouts[si].checks[key];
  saveStore();
  const checkEl = event.currentTarget.querySelector('.equip-check');
  if (checkEl) checkEl.classList.toggle('checked', p.techScouts[si].checks[key]);
  // Update progress bar and counter
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const checksDone = Object.values(p.techScouts[si].checks).filter(Boolean).length;
  const pct = checksTotal ? Math.round(checksDone / checksTotal * 100) : 0;
  const bar = document.getElementById(`tech-progress-bar-${si}`);
  const label = document.getElementById(`tech-progress-label-${si}`);
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `${checksDone}/${checksTotal} checked (${pct}%)`;
}
function openTechScoutForLocation(locName) {
  const p = currentProject();
  if (!p) return;
  if (!p.techScouts) p.techScouts = [];
  let idx = p.techScouts.findIndex(s => s.name && s.name.toLowerCase() === locName.toLowerCase());
  if (idx === -1) {
    p.techScouts.push({ name: locName, date: '', checks: {} });
    idx = p.techScouts.length - 1;
    saveStore();
  }
  _activeTechScoutIdx = idx;
  renderTechScouts(p);
  setTimeout(() => document.getElementById('techscout-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// ── SCOUTING INTERCONNECT HELPERS ────────────────────────────────────────────

function _getScoutStatus(locName) {
  const key = locName.toLowerCase();
  const sheets = [], techSheets = [];
  store.projects.forEach(p => {
    (p.scoutingSheets || []).forEach((s, idx) => {
      if (s.name?.toLowerCase() === key)
        sheets.push({ projectTitle: p.title, projectId: p.id, idx, date: s.date, suitability: s.suitability });
    });
    (p.techScouts || []).forEach((s, idx) => {
      if (s.name?.toLowerCase() === key) {
        const done = Object.values(s.checks || {}).filter(Boolean).length;
        const total = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
        techSheets.push({ projectTitle: p.title, projectId: p.id, idx, date: s.date, done, total });
      }
    });
  });
  return { sheets, techSheets };
}

function _scoutIconHtml(locName) {
  const st = _getScoutStatus(locName);
  const total = st.sheets.length + st.techSheets.length;
  if (!total) return '';
  const safe = locName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button class="btn btn-sm" onclick="event.stopPropagation();openScoutStatusModal('${safe}')" style="margin-left:6px;padding:1px 7px;font-size:11px;line-height:1.6;background:rgba(0,120,220,.15);border-color:rgba(0,120,220,.3);color:#60aaff;vertical-align:middle" title="Scouting data available — click to view">🗺 ${total}</button>`;
}

function openScoutStatusModal(locName) {
  const st = _getScoutStatus(locName);
  document.getElementById('scout-status-modal-name').textContent = locName;
  const suitColorMap = {'Not Suitable':'var(--red)','Poor':'#e06c00','Fair':'#d4a017','Good':'var(--green)','Excellent':'#0088ff'};
  const body = document.getElementById('scout-status-modal-body');
  body.innerHTML = `
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      <strong>${locName}</strong>: ${st.sheets.length} scouting sheet${st.sheets.length!==1?'s':''}, ${st.techSheets.length} tech checklist${st.techSheets.length!==1?'s':''}.
    </p>
    ${st.sheets.length ? `
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-display);font-size:11px;letter-spacing:1.5px;color:var(--accent2);margin-bottom:8px">SCOUTING SHEETS</div>
        ${st.sheets.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${s.projectTitle}</div>
              ${s.date ? `<div style="font-size:11px;color:var(--text3)">${s.date}</div>` : ''}
            </div>
            ${s.suitability ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--surface3);color:${suitColorMap[s.suitability]||'var(--text2)'}">${s.suitability}</span>` : ''}
            <button class="btn btn-sm btn-primary" onclick="closeModal('modal-scout-status');navigateToScoutSheet('${s.projectId}',${s.idx})">View →</button>
          </div>`).join('')}
      </div>` : ''}
    ${st.techSheets.length ? `
      <div>
        <div style="font-family:var(--font-display);font-size:11px;letter-spacing:1.5px;color:var(--accent2);margin-bottom:8px">TECH CHECKLISTS</div>
        ${st.techSheets.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${s.projectTitle}</div>
              ${s.date ? `<div style="font-size:11px;color:var(--text3)">${s.date}</div>` : ''}
            </div>
            <span style="font-size:11px;color:var(--text2)">${s.done}/${s.total}</span>
            <button class="btn btn-sm btn-primary" onclick="closeModal('modal-scout-status');navigateToTechScout('${s.projectId}',${s.idx})">View →</button>
          </div>`).join('')}
      </div>` : ''}`;
  openModal('modal-scout-status');
}

function navigateToScoutSheet(projectId, idx) {
  showProjectView(projectId);
  _activeScoutIdx = idx;
  _scoutMinimized = false;
  showSection('locations');
  setTimeout(() => document.getElementById('scouting-list')?.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function navigateToTechScout(projectId, idx) {
  showProjectView(projectId);
  _activeTechScoutIdx = idx;
  _techScoutMinimized = false;
  showSection('locations');
  setTimeout(() => document.getElementById('techscout-list')?.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function openCreateScoutModal(locName, type) {
  document.getElementById('create-scout-loc-name').value = locName;
  document.getElementById('create-scout-type').value = type;
  document.getElementById('create-scout-modal-title').textContent = type === 'scout' ? 'Create Scouting Sheet' : 'Create Tech Checklist';
  document.getElementById('create-scout-loc-display').textContent = locName;
  const sel = document.getElementById('create-scout-project-select');
  if (!store.projects.length) { showToast('No projects found', 'info'); return; }
  sel.innerHTML = store.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  openModal('modal-create-scout');
}

function confirmCreateScout() {
  const locName = document.getElementById('create-scout-loc-name').value;
  const type = document.getElementById('create-scout-type').value;
  const projectId = document.getElementById('create-scout-project-select').value;
  const p = store.projects.find(pr => pr.id === projectId);
  if (!p) return;
  closeModal('modal-create-scout');
  if (type === 'scout') {
    if (!p.scoutingSheets) p.scoutingSheets = [];
    let idx = p.scoutingSheets.findIndex(s => s.name?.toLowerCase() === locName.toLowerCase());
    if (idx === -1) { p.scoutingSheets.push({ name: locName, date: '', scoutedBy: '' }); idx = p.scoutingSheets.length - 1; saveStore(); }
    navigateToScoutSheet(projectId, idx);
  } else {
    if (!p.techScouts) p.techScouts = [];
    let idx = p.techScouts.findIndex(s => s.name?.toLowerCase() === locName.toLowerCase());
    if (idx === -1) { p.techScouts.push({ name: locName, date: '', checks: {} }); idx = p.techScouts.length - 1; saveStore(); }
    navigateToTechScout(projectId, idx);
  }
  showToast(`Opened for "${locName}" in ${p.title}`, 'success');
}

// ── PRINT / DOWNLOAD ──────────────────────────────────────────────────────────

function _scoutPrintStyles() {
  return `body{font-family:Georgia,serif;color:#111;background:#fff;max-width:900px;margin:0 auto;padding:24px}
    h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;font-weight:normal;color:#555;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .panel{border:1px solid #ccc;border-radius:6px;padding:12px}
    .panel-head{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px;font-family:sans-serif}
    .field{margin-bottom:10px}.label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-family:sans-serif;margin-bottom:2px}
    .value{font-size:13px;line-height:1.5;min-height:20px;border-bottom:1px solid #eee;padding-bottom:4px}
    .pros{border-left:3px solid #2a8;padding-left:8px}.cons{border-left:3px solid #c44;padding-left:8px}
    .suit{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:bold}
    @media print{body{padding:0}button{display:none}}`;
}

function _scoutHtmlDoc(s, projectTitle) {
  const f = (label, val) => `<div class="field"><div class="label">${label}</div><div class="value">${val||''}</div></div>`;
  const suitColor = {'Excellent':'#0088ff','Good':'#2a8a50','Fair':'#b8860b','Poor':'#c04a00','Not Suitable':'#c03030'};
  const suitStyle = suitColor[s.suitability] ? `color:${suitColor[s.suitability]}` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scouting Sheet — ${s.name||'Location'}</title>
    <style>${_scoutPrintStyles()}</style></head><body>
    <h1>Scouting Sheet — ${s.name||'Location'}</h1>
    <h2>${projectTitle || ''} ${s.date ? '| '+s.date : ''} ${s.scoutedBy ? '| Scouted by '+s.scoutedBy : ''}</h2>
    <div class="grid">
      <div class="panel"><div class="panel-head">Site Info</div>${f('Address',s.address)}${f('Contact Person',s.contact)}</div>
      <div class="panel"><div class="panel-head">Evaluation</div>
        <div class="field"><div class="label">Overall Suitability</div><div class="value"><span class="suit" style="${suitStyle}">${s.suitability||'—'}</span></div></div>
        ${f('General Notes',s.info)}</div>
    </div>
    <div class="grid">
      <div class="panel"><div class="panel-head">Technical</div>${f('Lighting',s.lighting)}${f('Sound',s.sound)}${f('Power & Electrical',s.power)}</div>
      <div class="panel"><div class="panel-head">Production</div>${f('Accessibility',s.accessibility)}${f('Permissions / Legal',s.permissions)}${f('Logistics',s.logistics)}</div>
    </div>
    <div class="grid">
      <div class="panel pros"><div class="panel-head">Pros</div><div class="value">${s.pros||''}</div></div>
      <div class="panel cons"><div class="panel-head">Cons</div><div class="value">${s.cons||''}</div></div>
    </div>
    <div class="grid">
      <div class="panel"><div class="panel-head">Set Dressing Notes</div><div class="value">${s.setDressing||''}</div></div>
      <div class="panel"><div class="panel-head">Networking Notes</div><div class="value">${s.networking||''}</div></div>
    </div>
    </body></html>`;
}

function _printScoutingSheet(i) {
  const p = currentProject(); if (!p) return;
  const s = p.scoutingSheets[i]; if (!s) return;
  const w = window.open('', '_blank');
  w.document.write(_scoutHtmlDoc(s, p.title));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function _downloadScoutingSheet(i) {
  const p = currentProject(); if (!p) return;
  const s = p.scoutingSheets[i]; if (!s) return;
  const html = _scoutHtmlDoc(s, p.title);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = `scouting-sheet-${(s.name||'location').replace(/\s+/g,'-').toLowerCase()}.html`;
  a.click();
}

function _techScoutHtmlDoc(scout, projectTitle) {
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const checksDone = Object.values(scout.checks || {}).filter(Boolean).length;
  const cats = Object.entries(TECH_SCOUT_ITEMS).map(([cat, items]) => {
    const rows = items.map((item, ii) => {
      const key = cat+'_'+ii;
      const checked = (scout.checks||{})[key];
      return `<tr><td style="padding:5px 8px;font-size:12px;border-bottom:1px solid #eee">${checked ? '☑' : '☐'} ${item}</td></tr>`;
    }).join('');
    const notes = (scout['notes_'+cat]) || '';
    return `<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#555;border-bottom:2px solid #ccc;padding-bottom:4px;margin-top:20px">${cat}</h3>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${notes ? `<div style="margin-top:6px;font-size:12px;color:#444;padding:6px 8px;background:#f9f9f9;border-radius:4px"><em>Notes: ${notes}</em></div>` : ''}`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tech Scout — ${scout.name||'Location'}</title>
    <style>body{font-family:sans-serif;color:#111;max-width:900px;margin:0 auto;padding:24px}
    h1{font-size:20px}h2{font-weight:normal;color:#555;font-size:13px;margin-bottom:16px}
    @media print{body{padding:0}button{display:none}}</style></head><body>
    <h1>Tech Scout Checklist — ${scout.name||'Location'}</h1>
    <h2>${projectTitle||''} ${scout.date ? '| '+scout.date : ''} &nbsp;|&nbsp; ${checksDone}/${checksTotal} items checked</h2>
    ${cats}
    </body></html>`;
}

function _printTechScout(i) {
  const p = currentProject(); if (!p) return;
  const s = p.techScouts[i]; if (!s) return;
  const w = window.open('', '_blank');
  w.document.write(_techScoutHtmlDoc(s, p.title));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function _downloadTechScout(i) {
  const p = currentProject(); if (!p) return;
  const s = p.techScouts[i]; if (!s) return;
  const html = _techScoutHtmlDoc(s, p.title);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = `tech-scout-${(s.name||'location').replace(/\s+/g,'-').toLowerCase()}.html`;
  a.click();
}

// ── LOCATION AUTOCOMPLETE (Nominatim / OpenStreetMap) ──────────────────────
// Attach to any input with data-loc-auto attribute
// Usage in HTML:  <input data-loc-auto placeholder="Search location…">
// Usage in JS-generated inputs: call attachLocAuto(inputElement) after creation

(function() {
  let _acTimer = null;
  let _acActive = null; // currently open dropdown element

  function buildDropdown() {
    const d = document.createElement('div');
    d.className = 'loc-auto-dropdown';
    d.style.cssText = `
      position:absolute; z-index:9999; background:#fff; color:#111;
      border:1px solid #ccc; border-radius:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.15); max-height:220px;
      overflow-y:auto; width:100%; top:100%; left:0; margin-top:4px;
    `;
    return d;
  }

  function closeDropdown() {
    if (_acActive) { _acActive.remove(); _acActive = null; }
  }

  function search(input, query) {
    if (query.length < 3) { closeDropdown(); return; }
    clearTimeout(_acTimer);
    _acTimer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        renderDropdown(input, data);
      } catch(e) { /* silently fail if offline */ }
    }, 350);
  }

  function renderDropdown(input, results) {
    closeDropdown();
    if (!results || !results.length) return;

    const wrap = input.parentElement;
    const prevPos = getComputedStyle(wrap).position;
    if (prevPos === 'static') wrap.style.position = 'relative';

    const d = buildDropdown();
    results.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;line-height:1.4;color:#111;';
      const main = r.namedetails && r.namedetails.name ? r.namedetails.name : r.display_name.split(',')[0];
      const rest = r.display_name.split(',').slice(1, 4).join(',').trim();
      item.innerHTML = `<strong>${main}</strong><br><span style="font-size:11px;opacity:.6">${rest}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = r.display_name;
        input.dataset.lat = r.lat;
        input.dataset.lon = r.lon;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('loc-selected', { bubbles: true }));
        closeDropdown();
      });
      item.addEventListener('mouseover', () => item.style.background = '#f5f5f5');
      item.addEventListener('mouseout',  () => item.style.background = '');
      d.appendChild(item);
    });
    wrap.appendChild(d);
    _acActive = d;
  }

  function attachLocAuto(input) {
    if (input.dataset.locAutoAttached) return;
    input.dataset.locAutoAttached = '1';
    input.addEventListener('input',  () => search(input, input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
    input.addEventListener('blur',   () => setTimeout(closeDropdown, 150));
  }

  // Attach to static inputs on page load
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-loc-auto]').forEach(attachLocAuto);
  });

  // Expose globally so dynamic inputs (callsheet rows etc) can also use it
  window.attachLocAuto = attachLocAuto;
  document.addEventListener('click', e => { if (_acActive && !_acActive.contains(e.target)) closeDropdown(); });
})();

// ── HOSPITAL AUTOCOMPLETE ───────────────────────────────────────────────────
// Like attachLocAuto but searches specifically for hospitals/A&E near the city

(function() {
  let _hTimer = null;
  let _hActive = null;

  function buildDropdown() {
    const d = document.createElement('div');
    d.style.cssText = `
      position:absolute; z-index:9999; background:#fff; color:#111;
      border:1px solid #ccc; border-radius:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.15); max-height:220px;
      overflow-y:auto; width:100%; top:100%; left:0; margin-top:4px;
    `;
    return d;
  }

  function closeDropdown() {
    if (_hActive) { _hActive.remove(); _hActive = null; }
  }

  function getCityForRow(input) {
    // Walk up to the <tr>, then find the city input in the same row
    const tr = input.closest('tr');
    if (!tr) return '';
    const cityInput = tr.querySelector('td:nth-child(2) input');
    return cityInput ? cityInput.value.trim() : '';
  }

  function search(input, query) {
    if (query.length < 2) { closeDropdown(); return; }
    clearTimeout(_hTimer);
    _hTimer = setTimeout(async () => {
      try {
        const city = getCityForRow(input);
        // Search for hospitals — if we have a city, bias strongly toward it
        const q = city ? `hospital ${query} ${city}` : `hospital ${query}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=6&q=${encodeURIComponent(q)}`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        // Filter to only hospital/clinic type results
        const hospitals = data.filter(r =>
          ['hospital','clinic','doctors','pharmacy','health','emergency'].some(t =>
            (r.type||'').includes(t) || (r.class||'').includes(t) || (r.display_name||'').toLowerCase().includes(t)
          )
        );
        renderDropdown(input, hospitals.length ? hospitals : data.slice(0, 4));
      } catch(e) {}
    }, 350);
  }

  function renderDropdown(input, results) {
    closeDropdown();
    if (!results || !results.length) return;

    const wrap = input.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    const d = buildDropdown();
    results.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;line-height:1.4;color:#111;';
      const name = r.namedetails?.name || r.display_name.split(',')[0];
      const addr = r.address;
      const parts = [addr?.road, addr?.city || addr?.town || addr?.village, addr?.postcode].filter(Boolean);
      item.innerHTML = `<strong>🏥 ${name}</strong><br><span style="font-size:11px;opacity:.5">${parts.join(', ')}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        // Fill with name + postcode — most useful for a callsheet
        const postcode = addr?.postcode ? ` · ${addr.postcode}` : '';
        input.value = name + postcode;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDropdown();
      });
      item.addEventListener('mouseover', () => item.style.background = '#f5f5f5');
      item.addEventListener('mouseout',  () => item.style.background = '');
      d.appendChild(item);
    });
    wrap.appendChild(d);
    _hActive = d;
  }

  function attachHospAuto(input) {
    if (input.dataset.hospAutoAttached) return;
    input.dataset.hospAutoAttached = '1';
    input.addEventListener('input',  () => search(input, input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
    input.addEventListener('blur',   () => setTimeout(closeDropdown, 150));
  }

  window.attachHospAuto = attachHospAuto;
  document.addEventListener('click', e => { if (_hActive && !_hActive.contains(e.target)) closeDropdown(); });
})();

// ── CALLSHEET WEATHER (Open-Meteo, free, no key) ───────────────────────────

async function fetchCallsheetWeather(csIdx) {
  const p = currentProject();
  const c = p.callsheets[csIdx];
  if (!c || !c.date) { showToast('Set a date first', 'info'); return; }

  let lat, lon, resolvedName;
  const firstRow = (c.locRows || [])[0] || {};
  const firstLoc = firstRow.city || firstRow.loc || '';

  // Prefer coords already stored by the autocomplete on a location input
  const locInputs = document.querySelectorAll('[data-loc-auto]');
  for (const inp of locInputs) {
    if (inp.dataset.lat && inp.dataset.lon) {
      lat = parseFloat(inp.dataset.lat);
      lon = parseFloat(inp.dataset.lon);
      resolvedName = inp.value;
      break;
    }
  }

  // Fallback: geocode the freetext location, but confirm with user first
  if ((!lat || !lon) && firstLoc) {
    try {
      showToast('Finding location…', 'info');
      const cc = (navigator.language || 'en-GB').split('-')[1]?.toLowerCase() || 'gb';
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(firstLoc)}`);
      const geoData = await geo.json();

      if (!geoData.length) { showToast('Could not find that location', 'info'); return; }

      // If there are multiple results or the name is ambiguous, confirm with user
      const candidates = geoData.slice(0, 5).map(r => {
        const a = r.address;
        const parts = [r.name, a?.county || a?.state_district, a?.state, a?.country].filter(Boolean);
        return { label: parts.join(', '), lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
      });

      // Show a quick picker toast/modal
      const confirmed = await confirmWeatherLocation(candidates, firstLoc);
      if (!confirmed) return;
      lat = confirmed.lat;
      lon = confirmed.lon;
      resolvedName = confirmed.label;
    } catch(e) {
      showToast('Could not find that location', 'info'); return;
    }
  }

  if (!lat || !lon) { showToast('Add a location first so we know where to check', 'info'); return; }

  try {
    showToast(`Fetching weather for ${resolvedName}…`, 'info');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${c.date}&end_date=${c.date}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.daily?.weathercode) { showToast('No forecast data for that date', 'info'); return; }

    const code = data.daily.weathercode[0];
    const tMax = Math.round(data.daily.temperature_2m_max[0]);
    const tMin = Math.round(data.daily.temperature_2m_min[0]);
    const rain = data.daily.precipitation_sum[0]?.toFixed(1);
    const wind = Math.round(data.daily.windspeed_10m_max[0]);

    const WMO = {
      0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
      61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',
      75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',
      82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',
      95:'Thunderstorm',96:'Thunderstorm + hail',99:'Heavy thunderstorm'
    };
    const EMOJI = {
      0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',
      61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'🌨',77:'🌨',80:'🌦',
      81:'🌧',82:'⛈',85:'🌨',86:'🌨',95:'⛈',96:'⛈',99:'⛈'
    };

    c.weather       = `${EMOJI[code] || '🌡'} ${WMO[code] || 'Unknown'}`;
    c.weatherDetail = `${tMin}°C – ${tMax}°C · Rain ${rain}mm · Wind ${wind}km/h`;
    saveStore();
    renderCallsheet(p);
    showToast(`Weather updated for ${resolvedName} ✓`, 'success');
  } catch(e) {
    showToast('Could not fetch weather — check connection', 'info');
  }
}

// Small inline location picker — returns a promise resolving to {lat,lon,label} or null
function confirmWeatherLocation(candidates, originalQuery) {
  return new Promise(resolve => {
    // Remove any existing picker
    document.getElementById('weather-loc-picker')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'weather-loc-picker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#111;border-radius:10px;padding:24px;max-width:420px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;';
    box.innerHTML = `
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Confirm Location</div>
      <div style="font-size:13px;color:#555;margin-bottom:16px;">We searched for <strong>"${originalQuery}"</strong> — which did you mean?</div>
      <div id="wlp-options" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;"></div>
      <button style="width:100%;padding:8px;background:#f0f0f0;border:none;border-radius:6px;cursor:pointer;font-size:13px;color:#555;" id="wlp-cancel">Cancel</button>
    `;

    candidates.forEach(c => {
      const btn = document.createElement('button');
      btn.style.cssText = 'width:100%;padding:10px 14px;background:#f8f8f8;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;text-align:left;';
      btn.textContent = c.label;
      btn.addEventListener('mouseover', () => btn.style.background = '#e8f0fe');
      btn.addEventListener('mouseout',  () => btn.style.background = '#f8f8f8');
      btn.addEventListener('click', () => { overlay.remove(); resolve(c); });
      box.querySelector('#wlp-options').appendChild(btn);
    });

    box.querySelector('#wlp-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// ══════════════════════════════════════════
