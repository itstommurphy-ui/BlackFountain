// PRODUCTION PLAN
// ══════════════════════════════════════════
function getDefaultProductionPlan() {
  const tpl = [
    { title: 'DEVELOPMENT', color: '#5bc0eb', items: [
      'Write / acquire script', 'Secure rights or option agreement',
      'Develop concept & pitch', 'Prepare pitch deck',
      'Estimate production budget', 'Identify key creatives', 'Attach director'
    ]},
    { title: 'FINANCING & LEGAL', color: '#e6bc3c', items: [
      'Form production company / LLC', 'Open production bank account',
      'Financing plan confirmed', 'Investment agreements signed',
      'Production legal counsel retained', 'Chain of title cleared'
    ]},
    { title: 'PRE-PRODUCTION', color: '#60d090', items: [
      'Full budget locked', 'Principal cast confirmed',
      'Director of Photography hired', 'Production Designer hired',
      'Key crew filled (1st AD, Sound, Editor)',
      'Location scouting complete', 'Location permits obtained',
      'Shooting schedule locked', 'Storyboards & shot lists completed',
      'Equipment list finalised', 'Costume & wardrobe design approved',
      'Production design approved', 'Composer & music plan confirmed',
      'Insurance obtained', 'Safety & risk assessments completed',
      'Call sheet system in place'
    ]},
    { title: 'PRODUCTION', color: '#e06c00', items: [
      'First day of principal photography', 'Daily progress reports issued',
      'All principal scenes completed', 'Pick-up shots completed', 'Production wrap'
    ]},
    { title: 'POST-PRODUCTION', color: '#b88af0', items: [
      'Footage logged and synced', 'Rough cut assembled',
      "Director's cut delivered", 'Picture lock achieved',
      'Visual effects completed', 'Colour grade completed',
      'Sound design completed', 'Music score recorded & mixed',
      'Final mix completed', 'Subtitles & accessibility captions',
      'Legal clearances obtained', 'E&O insurance acquired',
      'DCP / digital master created'
    ]},
    { title: 'MARKETING & RELEASE', color: '#e08095', items: [
      'Trailer cut', 'Poster & key art finalised', 'Press kit assembled',
      'Social media channels set up', 'Festival strategy planned',
      'Festival submissions sent', 'Distributor / sales agent approached',
      'Distribution deal signed', 'Press screenings held',
      'Social media campaign launched', 'Release day', 'Post-release review'
    ]}
  ];
  return { sections: tpl.map(s => ({
    id: makeId(), title: s.title, color: s.color, collapsed: false,
    items: s.items.map(text => ({ id: makeId(), text, checked: false }))
  }))};
}

function _planEsc(v) { return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _planItemHtml(sectionId, item) {
  const esc = _planEsc;
  return `<div class="plan-item" id="plan-item-${item.id}">
    <div class="plan-item-check${item.checked?' checked':''}" onclick="togglePlanItem('${sectionId}','${item.id}')"></div>
    <input class="plan-item-text${item.checked?' done':''}" value="${esc(item.text)}"
      onblur="editPlanItem('${sectionId}','${item.id}',this.value)"
      onkeydown="if(event.key==='Enter')this.blur()">
    <button class="plan-item-del" onclick="deletePlanItem('${sectionId}','${item.id}')" title="Delete item">✕</button>
  </div>`;
}

function _planSectionHtml(section) {
  const done = section.items.filter(i=>i.checked).length;
  const total = section.items.length;
  const esc = _planEsc;
  const pct = total ? Math.round(done/total*100) : 0;
  const body = section.collapsed ? '' : `
    <div class="plan-section-body">
      ${section.items.map(item => _planItemHtml(section.id, item)).join('')}
      <div class="plan-add-row">
        <input class="plan-new-input" placeholder="Add item…"
          onkeydown="if(event.key==='Enter'&&this.value.trim()){addPlanItem('${section.id}',this.value.trim());this.value=''}">
        <button class="btn btn-sm" onclick="const i=this.previousSibling;if(i.value.trim()){addPlanItem('${section.id}',i.value.trim());i.value=''}">+ Add</button>
      </div>
    </div>`;
  return `<div class="plan-section" id="plan-sec-${section.id}">
    <div class="plan-section-header" onclick="togglePlanSection('${section.id}')">
      <label class="plan-color-btn" onclick="event.stopPropagation()" title="Change section colour">
        <input type="color" class="plan-color-dot" value="${section.color}"
          oninput="editPlanSectionColor('${section.id}',this.value)">
        <span>colour</span>
      </label>
      <input class="plan-section-title-input" value="${esc(section.title)}"
        onclick="event.stopPropagation()"
        onblur="editPlanSectionTitle('${section.id}',this.value)"
        onkeydown="if(event.key==='Enter')this.blur()">
      <span class="plan-section-meta">${done}/${total}${total ? ' · ' + pct + '%' : ''}</span>
      <button class="btn btn-sm btn-ghost" style="padding:2px 7px;font-size:11px;margin-left:4px"
        onclick="event.stopPropagation();deletePlanSection('${section.id}')" title="Remove section">✕</button>
      <span style="color:var(--text3);font-size:11px;pointer-events:none">${section.collapsed?'▸':'▾'}</span>
    </div>${body}
  </div>`;
}

function renderProductionPlan(p) {
  if (!p.productionPlan || !p.productionPlan.sections) p.productionPlan = getDefaultProductionPlan();
  const plan = p.productionPlan;
  const total = plan.sections.reduce((a,s)=>a+s.items.length, 0);
  const done  = plan.sections.reduce((a,s)=>a+s.items.filter(i=>i.checked).length, 0);
  const pct   = total ? Math.round(done/total*100) : 0;
  const hasTpl = !!store.productionPlanTemplate;
  document.getElementById('plan-content').innerHTML = `
    <div class="plan-toolbar">
      <h3 class="section-heading">PRODUCTION PLAN</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="saveProductionPlanTemplate()">💾 Save as Template</button>
        <button class="btn btn-sm" onclick="loadProductionPlanTemplate()" ${hasTpl?'':'disabled title="No saved template yet"'}>📥 Load Template</button>
        <button class="btn btn-sm btn-ghost" onclick="resetProductionPlan()">↺ Reset Default</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <div style="flex:1;background:var(--surface2);border-radius:4px;height:8px;overflow:hidden">
        <div id="plan-progress-fill" style="height:100%;background:var(--accent);border-radius:4px;transition:width .3s;width:${pct}%"></div>
      </div>
      <div id="plan-progress-label" style="font-size:12px;color:var(--text3);white-space:nowrap">${done}/${total} complete (${pct}%)</div>
    </div>
    <div id="plan-sections-wrap">${plan.sections.map(s=>_planSectionHtml(s)).join('')}</div>
    <button class="btn btn-sm" style="margin-top:10px" onclick="addPlanSection()">+ Add Section</button>`;
}

function _getPlanSection(p, sid) {
  return p.productionPlan && p.productionPlan.sections.find(s=>s.id===sid);
}
function _updatePlanProgress(p) {
  const plan = p.productionPlan;
  const total = plan.sections.reduce((a,s)=>a+s.items.length, 0);
  const done  = plan.sections.reduce((a,s)=>a+s.items.filter(i=>i.checked).length, 0);
  const pct   = total ? Math.round(done/total*100) : 0;
  const fill  = document.getElementById('plan-progress-fill');
  const label = document.getElementById('plan-progress-label');
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = `${done}/${total} complete (${pct}%)`;
  plan.sections.forEach(s => {
    const meta = document.querySelector(`#plan-sec-${s.id} .plan-section-meta`);
    if (!meta) return;
    const d = s.items.filter(i=>i.checked).length, t = s.items.length;
    meta.textContent = `${d}/${t}${t ? ' · ' + Math.round(d/t*100) + '%' : ''}`;
  });
}

function togglePlanItem(sectionId, itemId) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  const item = s.items.find(i=>i.id===itemId); if (!item) return;
  item.checked = !item.checked; saveStore();
  const el = document.getElementById('plan-item-' + itemId);
  if (el) {
    el.querySelector('.plan-item-check').classList.toggle('checked', item.checked);
    el.querySelector('.plan-item-text').classList.toggle('done', item.checked);
  }
  _updatePlanProgress(p);
}
function editPlanItem(sectionId, itemId, val) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  const item = s.items.find(i=>i.id===itemId); if (!item) return;
  item.text = val; saveStore();
}
function deletePlanItem(sectionId, itemId) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  s.items = s.items.filter(i=>i.id!==itemId); saveStore();
  const el = document.getElementById('plan-item-' + itemId);
  if (el) el.remove();
  _updatePlanProgress(p);
}
function addPlanItem(sectionId, text) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  const item = { id: makeId(), text, checked: false };
  s.items.push(item); saveStore();
  const addRow = document.querySelector(`#plan-sec-${sectionId} .plan-add-row`);
  if (addRow) {
    const tmp = document.createElement('div');
    tmp.innerHTML = _planItemHtml(sectionId, item);
    addRow.parentNode.insertBefore(tmp.firstElementChild, addRow);
  }
  _updatePlanProgress(p);
}
function togglePlanSection(sectionId) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  s.collapsed = !s.collapsed; saveStore();
  const el = document.getElementById('plan-sec-' + sectionId);
  if (el) { const tmp = document.createElement('div'); tmp.innerHTML = _planSectionHtml(s); el.replaceWith(tmp.firstElementChild); }
}
function editPlanSectionTitle(sectionId, val) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  s.title = val; saveStore();
}
function editPlanSectionColor(sectionId, val) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId); if (!s) return;
  s.color = val; saveStore();
}
function deletePlanSection(sectionId) {
  const p = currentProject(); if (!p) return;
  const s = _getPlanSection(p, sectionId);
  showConfirmDialog(`Remove section "${s ? s.title : ''}"? All items in it will be lost.`, 'Remove Section', () => {
    p.productionPlan.sections = p.productionPlan.sections.filter(s=>s.id!==sectionId);
    saveStore();
    const el = document.getElementById('plan-sec-' + sectionId);
    if (el) el.remove();
    _updatePlanProgress(p);
  });
}
function addPlanSection() {
  const p = currentProject(); if (!p) return;
  const COLORS = ['#5bc0eb','#e6bc3c','#60d090','#e06c00','#b88af0','#e08095'];
  const section = {
    id: makeId(), collapsed: false, color: COLORS[p.productionPlan.sections.length % COLORS.length],
    title: 'NEW SECTION', items: []
  };
  p.productionPlan.sections.push(section); saveStore();
  const wrap = document.getElementById('plan-sections-wrap');
  if (wrap) { const tmp = document.createElement('div'); tmp.innerHTML = _planSectionHtml(section); wrap.appendChild(tmp.firstElementChild); }
  setTimeout(() => { const inp = document.querySelector(`#plan-sec-${section.id} .plan-section-title-input`); if (inp) { inp.select(); inp.focus(); } }, 50);
}
function saveProductionPlanTemplate() {
  const p = currentProject(); if (!p || !p.productionPlan) return;
  store.productionPlanTemplate = JSON.parse(JSON.stringify(p.productionPlan));
  saveStore();
  showToast('Plan saved as template — load it in any future project', 'success');
  // Re-enable Load Template button if it was disabled
  const btn = document.querySelector('#plan-content .btn[onclick*="loadProductionPlanTemplate"]');
  if (btn) btn.removeAttribute('disabled');
}
function loadProductionPlanTemplate() {
  const p = currentProject(); if (!p) return;
  if (!store.productionPlanTemplate) { showToast('No saved template yet — save one first', 'info'); return; }
  showConfirmDialog('Load your saved template? The current plan will be replaced.', 'Load Template', () => {
    const tpl = JSON.parse(JSON.stringify(store.productionPlanTemplate));
    tpl.sections.forEach(s => {
      s.id = makeId();
      s.items.forEach(i => { i.id = makeId(); i.checked = false; });
    });
    p.productionPlan = tpl; saveStore();
    renderProductionPlan(p);
    showToast('Template loaded', 'success');
  }, { title: 'Load Template', btnClass: 'btn-primary' });
}
function resetProductionPlan() {
  const p = currentProject(); if (!p) return;
  showConfirmDialog('Reset to the built-in default plan? The current plan will be replaced.', 'Reset', () => {
    p.productionPlan = getDefaultProductionPlan(); saveStore();
    renderProductionPlan(p);
    showToast('Reset to default', 'success');
  }, { title: 'Reset to Default' });
}

function renderSection(name) {
  const p = currentProject();
  if (!p) return;

  if (name === 'overview') renderOverview(p);
  else if (name === 'shotlist') { if(!p.shots) p.shots=[]; renderShotList(p); }
  else if (name === 'props') { if(!p.props) p.props=[]; renderPropTable('props','props-body',p); }
  else if (name === 'wardrobe') { if(!p.wardrobe) p.wardrobe=[]; renderWardrobeTable(p); }
  else if (name === 'soundlog') { if(!p.soundlog) p.soundlog=[]; renderSoundLog(p); }
  else if (name === 'riskassess') { if(!p.risks) p.risks=[]; renderRiskAssessment(p); }
  else if (name === 'releases') { if(!p.releases) p.releases=[]; renderReleases(p); }
  else if (name === 'script') { if(!p.scripts) p.scripts=[]; renderScript(p); }
  else if (name === 'brief') { if(!p.brief) p.brief={template:null,fields:{}}; renderBrief(p); }
  else if (name === 'plan') { if(!p.productionPlan) p.productionPlan = getDefaultProductionPlan(); renderProductionPlan(p); }
  else if (name.startsWith('custom_')) renderCustomSection(name);
  else if (name === 'breakdown') renderBreakdown(p);
  else if (name === 'stripboard') renderStripboard(p);
  else if (name === 'callsheet') renderCallsheet(p);
  else if (name === 'schedule') renderSchedule(p);
  else if (name === 'cast') renderCast(p);
  else if (name === 'unit') renderUnit(p);
  else if (name === 'budget') renderBudget(p);
  else if (name === 'equipment') renderEquipment(p);
  else if (name === 'locations') renderProjectLocations(p);
  setTimeout(initTableScrollbars, 0);
}

// OVERVIEW
function getAllOverviewSections(p) {
  const base = [
    {name:'Budget',          icon:'💷',  count: p.budget.length + ' lines',                                           tab:'budget'},
    {name:'Callsheet',       icon:'📋',  count: p.callsheets.length + ' days',                                        tab:'callsheet'},
    {name:'Cast & Extras',   icon:'🎭',  count: (p.cast.length + p.extras.length) + ' people',                       tab:'cast'},
    {name:'Equipment',       icon:'🎥',  count: Object.values(p.equipment).flat().length + ' items',                  tab:'equipment'},
    {name:'Locations',       icon:'📍',  count: p.locations.length + ' locations',                                    tab:'locations'},
    {name:'Project Brief',   icon:'🗒️', count: (p.brief&&p.brief.template) ? 'Template ' + p.brief.template : '0 fields', tab:'brief'},
    {name:'Props',           icon:'🧳',  count: (p.props||[]).length + ' items',                                      tab:'props'},
    {name:'Release Forms',   icon:'📝',  count: (p.releases||[]).length + ' forms',                                   tab:'releases'},
    {name:'Risk Assessment', icon:'⚠️',  count: (p.risks||[]).length + ' hazards',                                    tab:'riskassess'},
    {name:'Schedule',        icon:'🕐',  count: p.schedule.length + ' entries',                                       tab:'schedule'},
    {name:'Script & Docs',   icon:'📜',  count: (p.scripts||[]).length + ' files',                                    tab:'script', desc:'PDF · DOC · TXT · FDX · RTF'},
    {name:'Script Breakdown',icon:'📄',  count: (() => { _migrateBreakdowns(p); const bds = p.scriptBreakdowns||[]; if (!bds.length) return 'No script loaded'; const bd = _getActiveBd(p); const n=(bd?.tags||[]).length; const sc=bd?.rawText?parseBreakdownScenes(bd.rawText).length:0; return bds.length + ' breakdown' + (bds.length!==1?'s':'') + ' · ' + sc + ' scene' + (sc!==1?'s':''); })(), tab:'breakdown'},
    {name:'Stripboard',      icon:'🎞️', count: (() => { const sb = p.stripboard; if (!sb?.days?.length) return 'No days scheduled'; const total = sb.days.reduce((a,d)=>a+(d.sceneKeys||[]).length,0); return sb.days.length + ' day' + (sb.days.length!==1?'s':'') + ' · ' + total + ' scene' + (total!==1?'s':'') + ' scheduled'; })(), tab:'stripboard'},
    {name:'Shot List',       icon:'🎬',  count: (p.shots||[]).length + ' shots',                                      tab:'shotlist'},
    {name:'Sound Log',       icon:'🎙️', count: (p.soundlog||[]).length + ' entries',                                 tab:'soundlog'},
    {name:'Unit List',       icon:'👥',  count: p.unit.length + ' crew',                                              tab:'unit'},
    {name:'Production Plan', icon:'✅',  count: (() => { if(!p.productionPlan) return '0 tasks'; const t=p.productionPlan.sections.reduce((a,s)=>a+s.items.length,0), d=p.productionPlan.sections.reduce((a,s)=>a+s.items.filter(i=>i.checked).length,0); return `${d}/${t} complete`; })(), tab:'plan'},
    {name:'Wardrobe',        icon:'👗',  count: (p.wardrobe||[]).length + ' items',                                   tab:'wardrobe'},
  ].sort((a,b) => a.name.localeCompare(b.name));
  const custom = (p.customSections || []).map(cs => ({
    name: cs.name, icon: cs.icon || '📌',
    count: (() => { const n = (cs.note ? 1 : 0) + (cs.fields||[]).filter(f=>f.value).length + (cs.files||[]).length; return n + (n===1?' item':' items'); })(),
    tab: 'custom_' + cs.id, desc: cs.desc || ''
  }));
  return [...base, ...custom];
}

function initOverviewLayout(p) {
  if (!p.overviewLayout) {
    p.overviewLayout = getAllOverviewSections(p).map(s => ({ tab: s.tab, visible: true }));
  }
}

function renderOverviewDocs(p) {
  const el = document.getElementById('overview-docs');
  if (!el) return;
  initOverviewLayout(p);
  const sectionMap = {};
  getAllOverviewSections(p).forEach(s => sectionMap[s.tab] = s);
  const cards = p.overviewLayout
    .filter(item => item.visible && sectionMap[item.tab])
    .map(item => sectionMap[item.tab]);
  el.innerHTML = cards.map(s => `
    <div class="doc-card" onclick="showSection('${s.tab}')">
      <div class="doc-card-icon">${s.icon}</div>
      <div class="doc-card-title">${s.name}</div>
      ${s.desc ? `<div class="doc-card-sub">${s.desc}</div>` : ''}
      <div class="doc-card-status ${s.count.startsWith('0') ? 'empty' : 'filled'}">
        ${s.count.startsWith('0') ? '○ Empty' : '● ' + s.count}
      </div>
    </div>
  `).join('');
}

function renderOverview(p) {
  document.getElementById('ov-shoot-days').textContent = p.callsheets.length || '—';
  document.getElementById('ov-cast').textContent = p.cast.length + p.extras.length;
  document.getElementById('ov-crew').textContent = p.unit.length;
  renderOverviewDocs(p);
  renderOverviewFiles();
}

// OVERVIEW CARDS — inline drag/select/add
let overviewSelectedCards = new Set();
let _ovDragTab = null;
let _ovDragging = false;
let overviewSortMode = 'default';

function setOverviewSort(mode) {
  overviewSortMode = mode;
  const p = currentProject();
  if (p) renderOverviewDocs(p);
}

function renderOvToolbar() {
  const el = document.getElementById('ov-toolbar');
  if (!el) return;
  const n = overviewSelectedCards.size;
  if (n > 0) {
    el.innerHTML = `
      <span style="color:var(--text3)">${n} selected</span>
      <button class="btn btn-sm btn-danger" onclick="removeSelectedOverviewCards()">Remove</button>
      <button class="btn btn-sm" onclick="clearOverviewSelection()">Clear</button>`;
  } else {
    el.innerHTML = `<select class="form-select" style="font-size:11px;padding:3px 8px;height:28px" onchange="setOverviewSort(this.value)">
      <option value="default" ${overviewSortMode==='default'?'selected':''}>Custom order</option>
      <option value="az"      ${overviewSortMode==='az'     ?'selected':''}>A → Z</option>
      <option value="za"      ${overviewSortMode==='za'     ?'selected':''}>Z → A</option>
      <option value="recent"  ${overviewSortMode==='recent' ?'selected':''}>Recently opened</option>
      <option value="filled"  ${overviewSortMode==='filled' ?'selected':''}>With content first</option>
    </select>`;
  }
}

function renderOverviewDocs(p) {
  const el = document.getElementById('overview-docs');
  if (!el) return;
  initOverviewLayout(p);
  const sectionMap = {};
  getAllOverviewSections(p).forEach(s => sectionMap[s.tab] = s);
  let cards = p.overviewLayout
    .filter(item => item.visible && sectionMap[item.tab])
    .map(item => sectionMap[item.tab]);

  // Apply sort
  const sa = p.sectionActivity || {};
  if      (overviewSortMode === 'az')     cards = [...cards].sort((a,b) => a.name.localeCompare(b.name));
  else if (overviewSortMode === 'za')     cards = [...cards].sort((a,b) => b.name.localeCompare(a.name));
  else if (overviewSortMode === 'recent') cards = [...cards].sort((a,b) => (sa[b.tab]||0) - (sa[a.tab]||0));
  else if (overviewSortMode === 'filled') cards = [...cards].sort((a,b) => {
    const af = !a.count.startsWith('0'), bf = !b.count.startsWith('0');
    return af === bf ? 0 : (af ? -1 : 1);
  });

  el.innerHTML = cards.map(s => {
    const sel = overviewSelectedCards.has(s.tab);
    const ts  = sa[s.tab] ? relativeTime(sa[s.tab]) : null;
    return `
      <div class="doc-card${sel ? ' ov-selected' : ''}" data-tab="${s.tab}"
        draggable="true"
        ondragstart="ovDragStart(event,'${s.tab}')"
        ondragover="ovDragOver(event,'${s.tab}')"
        ondrop="ovDrop(event,'${s.tab}')"
        ondragend="ovDragEnd()"
        ondragleave="ovDragLeave(event,this)"
        onclick="ovCardClick(event,'${s.tab}')"
      >
        <input type="checkbox" class="ov-checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleOvCard('${s.tab}')">
        <button class="ov-remove-btn" onclick="event.stopPropagation();hideOverviewCard('${s.tab}')" title="Remove">✕</button>
        <div class="doc-card-icon">${s.icon}</div>
        <div class="doc-card-title">${s.name}</div>
        ${s.desc ? `<div class="doc-card-sub">${s.desc}</div>` : ''}
        <div class="doc-card-status ${s.count.startsWith('0') ? 'empty' : 'filled'}">
          ${s.count.startsWith('0') ? '○ Empty' : '● ' + s.count}
        </div>
        ${ts ? `<div style="font-size:9px;color:var(--text3);margin-top:5px;opacity:.7">↺ ${ts}</div>` : ''}
      </div>`;
  }).join('') + `
    <div class="new-doc-card" onclick="openAddSectionPicker(this)">
      <span style="font-size:22px">+</span>
      <span style="font-size:11px;color:var(--text3)">Add Section</span>
    </div>`;

  renderOvToolbar();
}

function ovDragStart(event, tab) {
  _ovDragTab = tab;
  _ovDragging = true;
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => document.querySelector(`.doc-card[data-tab="${tab}"]`)?.classList.add('ov-dragging'), 0);
}
function ovDragOver(event, tab) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('ov-drag-over'));
  if (tab !== _ovDragTab) document.querySelector(`.doc-card[data-tab="${tab}"]`)?.classList.add('ov-drag-over');
}
function ovDragLeave(event, el) {
  if (!el.contains(event.relatedTarget)) el.classList.remove('ov-drag-over');
}
function ovDrop(event, targetTab) {
  event.preventDefault();
  document.querySelectorAll('.doc-card').forEach(c => { c.classList.remove('ov-drag-over','ov-dragging'); });
  if (!_ovDragTab || _ovDragTab === targetTab) { _ovDragging = false; return; }
  const p = currentProject();
  if (!p) return;
  const from = p.overviewLayout.findIndex(x => x.tab === _ovDragTab);
  const to   = p.overviewLayout.findIndex(x => x.tab === targetTab);
  if (from !== -1 && to !== -1) {
    const [item] = p.overviewLayout.splice(from, 1);
    p.overviewLayout.splice(to, 0, item);
    saveStore();
    renderOverviewDocs(p);
  }
  setTimeout(() => { _ovDragging = false; }, 60);
}
function ovDragEnd() {
  document.querySelectorAll('.doc-card').forEach(c => { c.classList.remove('ov-drag-over','ov-dragging'); });
  setTimeout(() => { _ovDragging = false; }, 60);
}
function ovCardClick(event, tab) {
  if (_ovDragging) return;
  if (overviewSelectedCards.size > 0) { toggleOvCard(tab); return; }
  showSection(tab);
}
function toggleOvCard(tab) {
  if (overviewSelectedCards.has(tab)) overviewSelectedCards.delete(tab);
  else overviewSelectedCards.add(tab);
  const p = currentProject();
  if (p) renderOverviewDocs(p);
}
function clearOverviewSelection() {
  overviewSelectedCards.clear();
  const p = currentProject();
  if (p) renderOverviewDocs(p);
}
function hideOverviewCard(tab) {
  const p = currentProject();
  if (!p) return;
  initOverviewLayout(p);
  const sectionMap = {};
  getAllOverviewSections(p).forEach(s => sectionMap[s.tab] = s);
  const section = sectionMap[tab];
  const name = section ? section.name : tab;
  showConfirmDialog(
    `Hide <strong>${name}</strong> from the overview? Your data is kept — restore it anytime via + Add Section.`,
    'Hide',
    () => {
      const item = p.overviewLayout.find(x => x.tab === tab);
      if (item) item.visible = false;
      overviewSelectedCards.delete(tab);
      saveStore();
      renderOverviewDocs(p);
    }
  );
}
function removeSelectedOverviewCards() {
  const p = currentProject();
  if (!p) return;
  initOverviewLayout(p);
  overviewSelectedCards.forEach(tab => {
    const item = p.overviewLayout.find(x => x.tab === tab);
    if (item) item.visible = false;
  });
  overviewSelectedCards.clear();
  saveStore();
  renderOverviewDocs(p);
}

// ADD SECTION PICKER
function openAddSectionPicker(btn) {
  document.getElementById('_ov-picker')?.remove();
  const p = currentProject();
  if (!p) return;
  initOverviewLayout(p);
  const allSections = getAllOverviewSections(p);
  const sectionMap = {};
  allSections.forEach(s => sectionMap[s.tab] = s);
  const hiddenItems = p.overviewLayout.filter(item => !item.visible && sectionMap[item.tab]);

  const rect = btn.getBoundingClientRect();
  const picker = document.createElement('div');
  picker.id = '_ov-picker';
  picker.style.cssText = `position:fixed;top:${Math.min(rect.bottom+6, window.innerHeight-300)}px;left:${Math.min(rect.left, window.innerWidth-260)}px;width:250px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;z-index:9999;box-shadow:0 16px 40px rgba(0,0,0,0.45)`;

  let html = '';
  if (hiddenItems.length) {
    html += `<div style="font-size:10px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;padding:0 4px">Restore hidden</div>`;
    html += hiddenItems.map(item => {
      const s = sectionMap[item.tab];
      return `<div class="picker-row" onclick="showOverviewCard('${item.tab}')">
        <span>${s.icon}</span><span style="flex:1">${s.name}</span><span style="font-size:10px;color:var(--accent)">+ Add</span>
      </div>`;
    }).join('');
    html += `<hr style="border:none;border-top:1px solid var(--border2);margin:8px 0">`;
  }
  html += `<div class="picker-row" onclick="openCreateCustomSection()">✨ <span>Create custom section</span></div>`;

  picker.innerHTML = html;
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target) && e.target !== btn) { picker.remove(); document.removeEventListener('click', closePicker); }
    });
  }, 0);
}

function showOverviewCard(tab) {
  const p = currentProject();
  if (!p) return;
  const item = p.overviewLayout.find(x => x.tab === tab);
  if (item) item.visible = true;
  saveStore();
  renderOverviewDocs(p);
  document.getElementById('_ov-picker')?.remove();
}

function openCreateCustomSection() {
  document.getElementById('_ov-picker')?.remove();
  const csId = '_create-cs';
  const overlay = document.createElement('div');
  overlay.id = csId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:24px 20px 18px;width:340px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:13px;font-weight:700">Create Custom Section</span>
        <button onclick="document.getElementById('${csId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:4px">Section name *</label>
        <input id="_cs-name" class="form-input" placeholder="e.g. Production Notes" style="width:100%">
      </div>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div style="flex:0 0 70px">
          <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:4px">Icon</label>
          <input id="_cs-icon" class="form-input" placeholder="📌" style="width:100%;text-align:center">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:4px">Purpose (optional)</label>
          <input id="_cs-desc" class="form-input" placeholder="e.g. Notes for production" style="width:100%">
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-sm" onclick="document.getElementById('${csId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="saveCustomSection('${csId}')">Create</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  setTimeout(() => document.getElementById('_cs-name')?.focus(), 50);
}

function saveCustomSection(overlayId) {
  const name = document.getElementById('_cs-name')?.value.trim();
  if (!name) { showToast('Please enter a name', 'error'); return; }
  const icon = document.getElementById('_cs-icon')?.value.trim() || '📌';
  const desc = document.getElementById('_cs-desc')?.value.trim() || '';
  const p = currentProject();
  if (!p) return;
  if (!p.customSections) p.customSections = [];
  const id = makeId();
  p.customSections.push({ id, name, icon, desc, note: '' });
  initOverviewLayout(p);
  p.overviewLayout.push({ tab: 'custom_' + id, visible: true });
  saveStore();
  document.getElementById(overlayId)?.remove();
  renderOverviewDocs(p);
  showToast('Section created', 'success');
}

// CUSTOM SECTIONS
function renderCustomSection(tabName) {
  const el = document.getElementById('custom-section-content');
  if (!el) return;
  const p = currentProject();
  if (!p) return;
  const id = tabName.replace('custom_', '');
  const cs = (p.customSections || []).find(x => x.id === id);
  if (!cs) { el.innerHTML = '<p style="color:var(--text3)">Section not found.</p>'; return; }
  if (!cs.fields) cs.fields = [];
  if (!cs.files)  cs.files  = [];

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:24px">${cs.icon||'📌'}</span>
        <h3 class="section-heading" style="margin:0">${cs.name.replace(/</g,'&lt;')}</h3>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteCustomSection('${cs.id}')">Delete Section</button>
    </div>
    ${cs.desc ? `<p style="font-size:12px;color:var(--text3);margin:2px 0 18px">${cs.desc.replace(/</g,'&lt;')}</p>` : '<div style="margin-bottom:18px"></div>'}

    <div style="margin-bottom:24px">
      <label style="display:block;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Notes</label>
      <textarea class="form-input" rows="6" style="width:100%;resize:vertical;font-size:13px;line-height:1.7"
        placeholder="Add notes, links, references, or any other content..."
        onblur="saveCustomSectionNote('${cs.id}',this.value)">${(cs.note||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>`;

  // Custom fields
  html += cs.fields.map(f => `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <label style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">${f.label.replace(/</g,'&lt;')}</label>
        <button onclick="removeCustomSectionField('${cs.id}','${f.key}')" title="Remove field" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;line-height:1;padding:0 2px">✕</button>
      </div>
      <textarea class="form-input" rows="4" style="width:100%;resize:vertical;font-size:13px;line-height:1.6"
        placeholder="Enter ${f.label.toLowerCase().replace(/</g,'&lt;')}..."
        onblur="saveCustomSectionField('${cs.id}','${f.key}',this.value)">${(f.value||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>`).join('');

  html += `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:28px">
      <input class="form-input form-input-sm" id="cs-field-${cs.id}" placeholder="New field label..." style="flex:1" onkeydown="if(event.key==='Enter')addCustomSectionField('${cs.id}')">
      <button class="btn btn-sm btn-primary" onclick="addCustomSectionField('${cs.id}')">+ Add Field</button>
    </div>

    <div id="cs-files-zone-${cs.id}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h4 style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin:0">Files</h4>
        <label class="btn btn-sm btn-primary" style="cursor:pointer;font-size:11px">
          + Upload File
          <input type="file" multiple style="display:none" onchange="handleCustomSectionUpload('${cs.id}',this.files)">
        </label>
      </div>`;

  if (cs.files.length > 0) {
    html += `<div class="table-container"><table class="data-table"><thead><tr><th>File</th><th>Label</th><th>Size</th><th></th></tr></thead><tbody>`;
    html += cs.files.map(f => `
      <tr data-ctx="custom-file:${cs.id}:${f.id}">
        <td style="cursor:pointer;color:var(--accent)" onclick="openCustomSectionFilePreview('${cs.id}','${f.id}')"><span style="margin-right:6px">${scriptFileIcon(f.type)}</span>${f.name.replace(/</g,'&lt;')}</td>
        <td><input class="form-input form-input-sm" style="width:100%" value="${(f.label||'').replace(/"/g,'&quot;')}" placeholder="Label..." onchange="saveCustomSectionFileLabel('${cs.id}','${f.id}',this.value)"></td>
        <td style="white-space:nowrap">${formatFileSize(f.size)}</td>
        <td style="display:flex;gap:5px">
          <button class="btn btn-sm" style="padding:2px 6px;font-size:10px" onclick="openCustomSectionFileRename('${cs.id}','${f.id}')" title="Rename">✏️</button>
          <button class="btn btn-sm" onclick="shareCustomSectionFile('${cs.id}','${f.id}')" title="Share">↗</button>
          <button class="btn btn-sm" onclick="downloadCustomSectionFile('${cs.id}','${f.id}')" title="Download">⬇</button>
          <button class="btn btn-sm btn-danger" onclick="removeCustomSectionFile('${cs.id}','${f.id}')" title="Remove">🗑</button>
        </td>
      </tr>`).join('');
    html += `</tbody></table></div>`;
  } else {
    html += `<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;border:1px dashed var(--border2);border-radius:var(--radius)">No files yet</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
  // Wire drag-and-drop onto the files zone
  const csDropZone = document.getElementById(`cs-files-zone-${cs.id}`);
  if (csDropZone) {
    csDropZone.classList.add('drop-zone');
    _makeDrop(csDropZone, files => handleCustomSectionUpload(cs.id, files));
  }
}

function saveCustomSectionNote(id, val) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === id);
  if (cs) { cs.note = val; saveStore(); }
}
function addCustomSectionField(csId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs) return;
  if (!cs.fields) cs.fields = [];
  const input = document.getElementById('cs-field-' + csId);
  const label = input?.value.trim();
  if (!label) return;
  cs.fields.push({ key: makeId(), label, value: '' });
  saveStore();
  renderCustomSection('custom_' + csId);
}
function removeCustomSectionField(csId, key) {
  showConfirmDialog('Remove this field?', 'Remove', () => {
    const p = currentProject();
    if (!p || !p.customSections) return;
    const cs = p.customSections.find(x => x.id === csId);
    if (!cs || !cs.fields) return;
    cs.fields = cs.fields.filter(f => f.key !== key);
    saveStore();
    renderCustomSection('custom_' + csId);
  });
}
function saveCustomSectionField(csId, key, val) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.fields) return;
  const f = cs.fields.find(x => x.key === key);
  if (f) { f.value = val; saveStore(); }
}
function handleCustomSectionUpload(csId, files) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs) return;
  if (!cs.files) cs.files = [];
  let loaded = 0;
  const total = files.length;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      cs.files.push({ id: makeId(), name: file.name, label: '', dataUrl: e.target.result, size: file.size, type: file.type, uploadedAt: Date.now() });
      loaded++;
      if (loaded === total) { saveStore(); renderCustomSection('custom_' + csId); }
    };
    reader.readAsDataURL(file);
  });
}
function saveCustomSectionFileLabel(csId, fileId, val) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  if (f) { f.label = val; saveStore(); }
}
function downloadCustomSectionFile(csId, fileId) {
  const p = currentProject();
  if (!p || !p.customSections) return;
  const cs = p.customSections.find(x => x.id === csId);
  if (!cs || !cs.files) return;
  const f = cs.files.find(x => x.id === fileId);
  if (!f) return;
  const a = document.createElement('a'); a.href = f.dataUrl; a.download = f.name; a.click();
}

// ══════════════════════════════════════════
