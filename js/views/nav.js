// VIEWS
// ══════════════════════════════════════════
function showView(name) {
  // Clean up canvas mode if leaving moodboards
  if (name !== 'moodboards') {
    document.getElementById('content')?.classList.remove('mb-content-canvas');
    document.getElementById('view-moodboards')?.classList.remove('mb-canvas-mode');
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-subitem').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[onclick*="${name}"]`) || document.querySelector(`.nav-item[data-view="${name}"]`);
  if (navItem) navItem.classList.add('active');
  
  // Clear project highlighting for global views (not project-specific)
  const globalViews = ['dashboard', 'team', 'contacts', 'locations', 'moodboards', 'files', 'settings'];
  if (globalViews.includes(name)) {
    store.currentProjectId = null;
    renderSidebarProjects();
  }

  if (name === 'dashboard') {
    document.getElementById('topbar-title').textContent = 'Dashboard';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain';
    renderDashboard();
  } else if (name === 'team') {
    document.getElementById('topbar-title').textContent = 'Team';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Team';
    renderTeam();
  } else if (name === 'contacts') {
    const subLabel = contactSubView === 'crew' ? 'Crew' : contactSubView === 'talent' ? 'Talent' : contactSubView === 'locations' ? 'Location Contacts' : '';
    document.getElementById('topbar-title').textContent = subLabel || 'Contacts';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Contacts' + (subLabel ? ' / ' + subLabel : '');
    renderContacts();
  } else if (name === 'locations') {
    document.getElementById('topbar-title').textContent = 'Locations';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Locations';
    renderLocations();
  } else if (name === 'files') {
    document.getElementById('topbar-title').textContent = 'Files';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Files';
    selectedFileIds.clear();
    renderFiles();
  } else if (name === 'moodboards') {
    const mb = _currentMoodboardId ? (store.moodboards||[]).find(b => b.id === _currentMoodboardId) : null;
    document.getElementById('topbar-title').textContent = mb ? mb.title : 'Moodboards';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Moodboards' + (mb ? ' / ' + mb.title : '');
    renderMoodboards();
  } else if (name === 'settings') {
    document.getElementById('topbar-title').textContent = 'Settings';
    document.getElementById('topbar-breadcrumb').textContent = 'Black Fountain / Settings';
    renderSettings();
  }
  setTimeout(initTableScrollbars, 0);
}

function showProjectView(id) {
  store.currentProjectId = id;
  const p = currentProject();
  if (!p) return;

  // Clean up moodboard canvas/fullscreen mode if leaving it
  document.getElementById('content')?.classList.remove('mb-content-canvas');
  document.getElementById('view-moodboards')?.classList.remove('mb-canvas-mode');
  document.body.classList.remove('mb-fullscreen');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-project').classList.add('active');

  document.getElementById('topbar-title').textContent = p.title.toUpperCase();
  document.getElementById('topbar-breadcrumb').textContent = `Black Fountain / ${p.title}`;
  document.getElementById('proj-title').textContent = p.title.toUpperCase();

  const badgeClass = {pre:'badge-pre',prod:'badge-prod',post:'badge-post',done:'badge-done',released:'badge-released'};
  const sel = document.getElementById('proj-status-select');
  sel.value = p.status;
  sel.className = 'proj-status-select ' + badgeClass[p.status];

  document.getElementById('proj-meta').innerHTML = `
    <span>🎬 ${p.director || '—'}</span>
    <span>🎥 ${p.producer || '—'}</span>
    <span>🏢 ${p.company || '—'}</span>
    ${p.genre ? `<span>🎭 ${p.genre}</span>` : ''}
  `;
  const ll = document.getElementById('proj-logline');
  if (p.logline) {
    ll.textContent = p.logline;
    ll.classList.remove('empty');
  } else {
    ll.textContent = '+ Add logline…';
    ll.classList.add('empty');
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-subitem').forEach(n => n.classList.remove('active'));
  renderSidebarProjects();

  showSection('overview');
}

function showSection(name) {
  _activeSection = name;
  // Record section visit immediately (silently, no save-indicator flash)
  if (name !== 'overview') {
    const p = currentProject();
    if (p) {
      if (!p.sectionActivity) p.sectionActivity = {};
      p.sectionActivity[name] = Date.now();
      try { localStorage.setItem('blackfountain_v1', JSON.stringify(store)); } catch(e) {}
    }
  }
  document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
  const sectionId = name.startsWith('custom_') ? 'section-custom' : 'section-' + name;
  const target = document.getElementById(sectionId);
  if (!target) { console.warn('No section div for:', name); return; }
  target.style.display = 'block';
  document.querySelectorAll('.section-tab').forEach(t => {
    const onclick = t.getAttribute('onclick') || '';
    t.classList.toggle('active', onclick.includes(`'${name}'`));
  });
  renderSection(name);
  // Inject Go To dropdown into any hooks in the active section
  const sectionEl = document.getElementById(sectionId);
  if (sectionEl) sectionEl.querySelectorAll('.goto-hook').forEach(h => { h.innerHTML = _gotoHtml(name); });
}

function _gotoHtml(skip) {
  const sections = [
    ['budget','Budget'],['callsheet','Callsheet'],['cast','Cast & Extras'],['crew','Crew'],
    ['equipment','Equipment'],['locations','Locations'],['moodboards','Moodboards'],['overview','Overview'],
    ['plan','Production Plan'],['brief','Project Brief'],['props','Props'],
    ['releases','Release Forms'],['riskassess','Risk Assessment'],['schedule','Schedule'],
    ['breakdown','Script Breakdown'],['script','Script & Docs'],['shotlist','Shot List'],
    ['soundlog','Sound Log'],['stripboard','Stripboard'],['wardrobe','Wardrobe'],
  ];
  return `<select class="btn btn-sm" onchange="if(this.value){showSection(this.value);this.value=''}" style="cursor:pointer" title="Go to section">
    <option value="">→ Go to…</option>
    ${sections.filter(([id])=>id!==skip).map(([id,l])=>`<option value="${id}">${l}</option>`).join('')}
  </select>`;
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
let dashboardStatusFilter = null;

function setDashboardFilter(status) {
  dashboardStatusFilter = dashboardStatusFilter === status ? null : status;
  renderDashboard();
}

function renderDashboard() {
  const projects = store.projects || [];
  const statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.textContent = projects.length;
  const statPre = document.getElementById('stat-pre');
  if (statPre) statPre.textContent = projects.filter(p => p.status === 'pre').length;
  const statProd = document.getElementById('stat-prod');
  if (statProd) statProd.textContent = projects.filter(p => p.status === 'prod').length;
  const statPost = document.getElementById('stat-post');
  if (statPost) statPost.textContent = projects.filter(p => p.status === 'post').length;
  const statDone = document.getElementById('stat-done');
  if (statDone) statDone.textContent = projects.filter(p => p.status === 'done').length;
  const statReleased = document.getElementById('stat-released');
  if (statReleased) statReleased.textContent = projects.filter(p => p.status === 'released').length;

  // Highlight active filter card
  ['pre','prod','post','done','released'].forEach(s => {
    const el = document.getElementById('stat-' + s);
    if (el) el.closest('.stat-card').classList.toggle('active', dashboardStatusFilter === s);
  });
  const totalCard = document.getElementById('stat-total');
  if (totalCard) totalCard.closest('.stat-card').classList.toggle('active', !dashboardStatusFilter);

  const visibleProjects = dashboardStatusFilter
    ? projects.filter(p => p.status === dashboardStatusFilter)
    : projects;

  const grid = document.getElementById('projects-grid');
  const statusMap = {pre:'PRE-PROD',prod:'PRODUCTION',post:'POST-PROD',done:'COMPLETE',released:'RELEASED'};
  const badgeClass = {pre:'badge-pre',prod:'badge-prod',post:'badge-post',done:'badge-done',released:'badge-released'};

  grid.innerHTML = visibleProjects.map(p => `
    <div class="project-card status-${p.status}" onclick="showProjectView('${p.id}')">
      <div class="project-card-header">
        <div>
          <div class="project-card-num">#${p.num}</div>
          <div class="project-card-title">${p.title}</div>
        </div>
        <span class="status-badge ${badgeClass[p.status]}">${statusMap[p.status]}</span>
      </div>
      <div class="project-card-meta">
        ${p.director ? `<div>Dir: ${p.director}</div>` : ''}
        ${p.company ? `<div>${p.company}</div>` : ''}
        ${p.notes ? `<div style="margin-top:6px;color:var(--text3)">${p.notes.substring(0,80)}${p.notes.length>80?'…':''}</div>` : ''}
      </div>
      <div class="project-card-footer">
        <div class="project-card-tags">
          <span class="tag">${p.cast.length} cast</span>
          <span class="tag">${p.unit.length} crew</span>
          ${p.genre ? `<span class="tag">${p.genre}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('') + `
    <div class="new-project-card" onclick="openNewProjectModal()">
      <div class="plus">＋</div>
      <span>New Project</span>
    </div>
  `;

  renderSidebarProjects();
}

const collapsedStatusGroups = new Set();

function toggleStatusGroup(status) {
  if (collapsedStatusGroups.has(status)) collapsedStatusGroups.delete(status);
  else collapsedStatusGroups.add(status);
  renderSidebarProjects();
}

function renderSidebarProjects() {
  const el = document.getElementById('sidebar-projects');
  if (!el) return;
  const groups = [
    { status: 'pre',      label: 'Pre-Production' },
    { status: 'prod',     label: 'Production' },
    { status: 'post',     label: 'Post-Production' },
    { status: 'done',     label: 'Complete' },
    { status: 'released', label: 'Released' }
  ];
  let html = '';
  const storeProjects = store.projects || [];
  groups.forEach(g => {
    const projects = storeProjects.filter(p => p.status === g.status);
    if (!projects.length) return;
    const collapsed = collapsedStatusGroups.has(g.status);
    html += `<div class="sidebar-status-group${collapsed ? ' collapsed' : ''}" onclick="toggleStatusGroup('${g.status}')">
      <span>${g.label} <span style="opacity:0.55;font-weight:400">(${projects.length})</span></span>
      <span class="sg-arrow">▾</span>
    </div>`;
    if (!collapsed) {
      html += projects.map(p => `
        <div class="project-item status-${p.status}${p.id === store.currentProjectId ? ' active' : ''}" data-id="${p.id}" onclick="showProjectView('${p.id}')">
          <div class="project-dot"></div>
          <span>${p.title}</span>
        </div>
      `).join('');
    }
  });
  el.innerHTML = html || '<div style="padding:8px 10px;font-size:11px;color:var(--text3)">No projects yet</div>';
}

// ══════════════════════════════════════════
