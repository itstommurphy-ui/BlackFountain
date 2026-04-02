// ══════════════════════════════════════════

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return { text: 'Just now', color: 'var(--green)' };
  if (diffMins < 60) return { text: `${diffMins}m ago`, color: 'var(--green)' };
  if (diffHours < 24) return { text: `${diffHours}h ago`, color: 'var(--green)' };
  if (diffWeeks < 1) return { text: `${diffDays}d ago`, color: 'var(--accent)' };
  if (diffMonths < 3) return { text: `${diffWeeks}w ago`, color: 'var(--accent)' };
  return { text: `${diffMonths}mo ago`, color: 'var(--text3)' };
}

function toggleFab() {
  const btn = document.getElementById('fab-btn');
  const items = document.getElementById('fab-items');
  const isOpen = items.classList.contains('open');
  if (isOpen) {
    items.classList.remove('open');
    btn.classList.remove('open');
  } else {
    items.classList.add('open');
    btn.classList.add('open');
  }
}

function closeFab() {
  document.getElementById('fab-items')?.classList.remove('open');
  document.getElementById('fab-btn')?.classList.remove('open');
}

// Close fab when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#fab-menu')) closeFab();
});

function _getSectionLabel(name) {
  const labels = {
    script: 'Script & Docs', breakdown: 'Script Breakdown',
    stripboard: 'Stripboard', storyboard: 'Storyboard',
    moodboards: 'Moodboards', brief: 'Project Outline',
    cast: 'Cast & Extras', crew: 'Crew',
    locations: 'Locations', riskassess: 'Risk Assessment',
    schedule: 'Schedule', callsheet: 'Callsheet',
    shotlist: 'Shot List', props: 'Props',
    wardrobe: 'Wardrobe', soundlog: 'Sound Log',
    equipment: 'Equipment', releases: 'Release Forms',
    budget: 'Budget', plan: 'Production Plan',
    overview: 'Overview',
  };
  if (name.startsWith('custom_')) {
    const p = currentProject();
    const cs = (p?.customSections || []).find(s => 'custom_' + s.id === name);
    return cs?.name || 'Custom Section';
  }
  return labels[name] || name;
}

function _getNavGroup(section) {
  const groups = {
    story:      ['script','breakdown','stripboard','storyboard','moodboards','brief'],
    people:     ['cast','crew'],
    locations:  ['locations','riskassess'],
    production: ['schedule','callsheet','shotlist','props','wardrobe','soundlog','equipment','releases'],
    finance:    ['budget','plan'],
  };
  for (const [group, sections] of Object.entries(groups)) {
    if (sections.includes(section)) return group;
  }
  return null;
}

function _setTopNavActive(group) {
  document.querySelectorAll('.topbar-nav-item').forEach(el => {
    el.classList.remove('active');
  });
  if (group) {
    const el = document.getElementById('nav-' + group);
    if (el) el.classList.add('active');
  }

  // Show project name in nav when in project context
  const projEl = document.getElementById('topbar-project-name');
  if (projEl) {
    const p = currentProject();
    projEl.textContent = p ? p.title : '';
  }
}

function navToSection(sectionName) {
  const p = currentProject();
  if (!p) {
    // No project loaded — if only one project exists open it, otherwise go to dashboard
    if (store.projects && store.projects.length === 1) {
      showProjectView(store.projects[0].id);
      setTimeout(() => showSection(sectionName), 100);
    } else {
      showView('dashboard');
      showToast('Select a project first', 'info');
    }
    return;
  }
  showSection(sectionName);
}

function showView(name) {
  // Check if view element exists - if not, the view hasn't been loaded yet
  const viewEl = document.getElementById('view-' + name);
  if (!viewEl) {
    console.warn(`View '${name}' not found in DOM. Trying to load view...`);
    // Try to load the view dynamically
    if (window.viewLoader?.ensureViewLoaded) {
      window.viewLoader.ensureViewLoaded(name).then(() => {
        // Retry after load
        showView(name);
      });
    }
    return;
  }

  // Save current view to localStorage for persistence across refreshes
  try {
    localStorage.setItem('bf_currentView', JSON.stringify({ type: 'global', name: name }));
    console.log('[ViewRestore] Saved global view:', name);
  } catch (e) {}

  // Clean up canvas mode if leaving moodboards
  if (name !== 'moodboards') {
    document.getElementById('content')?.classList.remove('mb-content-canvas');
    document.getElementById('view-moodboards')?.classList.remove('mb-canvas-mode');
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  viewEl.classList.add('active');
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
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'Dashboard';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain';
    renderDashboard();
  } else if (name === 'team') {
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'Team';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Team';
    renderTeam();
  } else if (name === 'contacts') {
    const subLabel = contactSubView === 'crew' ? 'Crew' : contactSubView === 'talent' ? 'Talent' : contactSubView === 'locations' ? 'Location Contacts' : '';
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = subLabel || 'Contacts';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Contacts' + (subLabel ? ' / ' + subLabel : '');
    renderContacts();
  } else if (name === 'locations') {
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'Locations';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Locations';
    renderLocations();
  } else if (name === 'files') {
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'Files';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Files';
    selectedFileIds.clear();
    renderFiles();
  } else if (name === 'moodboards') {
    const mb = _currentMoodboardId ? (store.moodboards||[]).find(b => b.id === _currentMoodboardId) : null;
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = mb ? mb.title : 'Moodboards';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Moodboards' + (mb ? ' / ' + mb.title : '');
    renderMoodboards();
  } else if (name === 'settings') {
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'Settings';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / Settings';
    renderSettings();
  }
// Update top nav active state
_setTopNavActive(name === 'dashboard' ? 'dashboard' : 
                 name === 'contacts' ? 'assets' :
                 name === 'locations' ? 'assets' :
                 name === 'moodboards' ? 'assets' :
                 name === 'settings' ? 'assets' : null);
// Hide section bar on global views
const sectionBar = document.getElementById('topbar-section-bar');
if (sectionBar) sectionBar.classList.remove('visible');
  setTimeout(initTableScrollbars, 0);
}

function showProjectView(id) {
  store.currentProjectId = id;
  const p = currentProject();
  if (!p) return;

  // Update last opened timestamp
  p.updatedAt = new Date().toISOString();
  try { saveStore(); } catch(e) {}

  // Save current view to localStorage for persistence across refreshes
  try {
    localStorage.setItem('bf_currentView', JSON.stringify({ type: 'project', projectId: id }));
    console.log('[ViewRestore] Saved project view:', id);
  } catch (e) {}

  // Clean up moodboard canvas/fullscreen mode if leaving it
  document.getElementById('content')?.classList.remove('mb-content-canvas');
  document.getElementById('view-moodboards')?.classList.remove('mb-canvas-mode');
  document.body.classList.remove('mb-fullscreen');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-project').classList.add('active');

  const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = p.title.toUpperCase();
  const projNameEl = document.getElementById('topbar-project-name');
  if (projNameEl) projNameEl.textContent = p.title;
  const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = `Black Fountain / ${p.title}`;
  const pt = document.getElementById('proj-title'); if (pt) pt.textContent = p.title.toUpperCase();

  const badgeClass = {pre:'badge-pre',prod:'badge-prod',post:'badge-post',done:'badge-done',released:'badge-released'};
  const sel = document.getElementById('proj-status-select');
  sel.value = p.status;
  sel.className = 'proj-status-select ' + badgeClass[p.status];

  const directors = Array.isArray(p.directors) && p.directors.length ? p.directors.join(', ') : (p.director || '—');
  const producers = Array.isArray(p.producers) && p.producers.length ? p.producers.join(', ') : (p.producer || '—');
  document.getElementById('proj-meta').innerHTML = `
    <span>🎬 ${directors}</span>
    <span>🎥 ${producers}</span>
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

  // Set topbar project name
  const projNameEl2 = document.getElementById('topbar-project-name');
  if (projNameEl2) projNameEl2.textContent = p.title;

  // Show the nav as project-mode
  document.getElementById('topbar-nav')?.classList.add('project-mode');
}

function showSection(name) {
  _activeSection = name;
  // Save current section to localStorage for persistence across refreshes
  try {
    const currentView = JSON.parse(localStorage.getItem('bf_currentView') || '{}');
    if (currentView.type === 'project') {
      localStorage.setItem('bf_currentView', JSON.stringify({ type: 'project', projectId: currentView.projectId, section: name }));
      console.log('[ViewRestore] Saved project section:', name, 'for project:', currentView.projectId);
    }
  } catch (e) {}

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

  // Update section bar and nav active state
  const sectionBar = document.getElementById('topbar-section-bar');
  const sectionNameEl = document.getElementById('topbar-section-name');
  if (sectionBar && sectionNameEl) {
    sectionBar.classList.add('visible');
    sectionNameEl.textContent = _getSectionLabel(name);
  }
  // Highlight correct nav group
  _setTopNavActive(_getNavGroup(name));
}

function _gotoHtml(skip) {
  const sections = [
    ['budget','Budget'],['callsheet','Callsheet'],['cast','Cast & Extras'],['crew','Crew'],
    ['equipment','Equipment'],['locations','Locations'],['moodboards','Moodboards'],['overview','Overview'],
    ['plan','Production Plan'],['brief','Project Brief'],['props','Props'],
    ['releases','Release Forms'],['riskassess','Risk Assessment'],['schedule','Schedule'],
    ['storyboard','Storyboard'],['breakdown','Script Breakdown'],['script','Script & Docs'],['shotlist','Shot List'],
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
  dashboardStatusFilter = (status === null || status === 'null' || dashboardStatusFilter === status)
    ? null
    : status;
  renderDashboard();
}

// ══════════════════════════════════════════
// DASHBOARD QUICK ACTIONS
// ══════════════════════════════════════════

/**
 * Continue where you left off - opens last active project and section
 */
async function quickActionContinue() {
  const lastProject = localStorage.getItem('bf_lastProject');
  const lastSection = localStorage.getItem('bf_lastSection');
  
  if (lastProject && store.projects?.find(p => p.id === lastProject)) {
    showProjectView(lastProject);
    if (lastSection) {
      setTimeout(() => showSection(lastSection), 300);
    }
    showToast('Resumed: ' + (store.projects.find(p => p.id === lastProject)?.title || 'project'), 'success');
  } else if (store.projects?.length > 0) {
    // Open most recent project
    const recent = getMostRecentProject();
    if (recent) {
      showProjectView(recent.id);
      showToast('Opened: ' + recent.title, 'success');
    }
  } else {
    showToast('No projects to continue', 'info');
  }
}

/**
 * Get most recently edited project
 */
function getMostRecentProject() {
  if (!store.projects?.length) return null;
  return [...store.projects].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  })[0];
}

/**
 * Quick action: Create new project
 */
function quickActionNewProject() {
  openNewProjectModal();
}

/**
 * Quick action: Export all project data
 */
async function quickActionExportAll() {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    projects: store.projects,
    contacts: store.contacts,
    locations: store.locations,
    files: store.files
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `black-fountain-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('All data exported successfully', 'success');
}

/**
 * Quick action: Migrate large files to IndexedDB
 */
async function quickActionMigrateFiles() {
  if (window.FileStore) {
    try {
      await FileStore.init();
      await FileStore.migrateFromLocalStorage();
      showToast('Files migrated to IndexedDB', 'success');
    } catch (err) {
      showToast('Migration failed: ' + err.message, 'error');
    }
  } else {
    showToast('FileStore not available', 'error');
  }
}

/**
 * Quick action: View recently edited projects
 */
function quickActionViewRecent() {
  const recent = getMostRecentProject();
  if (recent) {
    showProjectView(recent.id);
    showToast('Most recent: ' + recent.title, 'info');
  } else {
    showToast('No projects found', 'info');
  }
}

/**
 * Save last active project and section
 */
function saveLastActive(projectId, section) {
  if (projectId) {
    localStorage.setItem('bf_lastProject', projectId);
  }
  if (section) {
    localStorage.setItem('bf_lastSection', section);
  }
}

function renderDashboard() {
  const projects = store.projects || [];

  const counts = {
    pre:      projects.filter(p => p.status === 'pre').length,
    prod:     projects.filter(p => p.status === 'prod').length,
    post:     projects.filter(p => p.status === 'post').length,
    done:     projects.filter(p => p.status === 'done').length,
    released: projects.filter(p => p.status === 'released').length,
  };
  const total = projects.length;

  // Stats line
  const statsEl = document.getElementById('dashboard-stats-line');
  if (statsEl) {
    statsEl.innerHTML = total === 0
      ? `<span class="dash-stat-empty">No projects yet</span>`
      : `<span class="dash-stat-total">${total} project${total !== 1 ? 's' : ''}</span>
         <span class="dash-stat-sep">—</span>
         ${counts.pre      ? `<span class="dash-stat-item pre">${counts.pre} pre-prod</span>` : ''}
         ${counts.prod     ? `<span class="dash-stat-item prod">${counts.prod} in production</span>` : ''}
         ${counts.post     ? `<span class="dash-stat-item post">${counts.post} post</span>` : ''}
         ${counts.done     ? `<span class="dash-stat-item done">${counts.done} complete</span>` : ''}
         ${counts.released ? `<span class="dash-stat-item released">${counts.released} released</span>` : ''}`;
  }

  // Render projects into trays by status
  const statusOrder = ['pre', 'prod', 'post', 'done', 'released'];
  const statusLabel = { pre:'Pre-prod', prod:'Production', post:'Post-prod', done:'Complete', released:'Released' };
  const badgeClass  = { pre:'badge-pre', prod:'badge-prod', post:'badge-post', done:'badge-done', released:'badge-released' };

  statusOrder.forEach(status => {
    const statusProjects = projects.filter(p => p.status === status);
    const countEl = document.getElementById(`tray-count-${status}`);
    if (countEl) countEl.textContent = statusProjects.length;

    const contentEl = document.getElementById(`tray-content-${status}`);
    if (!contentEl) return;

    if (statusProjects.length === 0) {
      contentEl.innerHTML = '';
      return;
    }

    contentEl.innerHTML = statusProjects.map(p => {
      const dirName = Array.isArray(p.directors) && p.directors.length
        ? p.directors.join(', ')
        : (p.director || '');
      const castCount = p.cast?.length || 0;
      const crewCount = p.unit?.length || 0;
      const lastEdit = formatRelativeTime(p.updatedAt || p.createdAt);

      return `
      <div class="project-card status-${p.status}" onclick="showProjectView('${p.id}')">
        <div class="project-card-top">
          <span class="project-card-timestamp" style="color:${lastEdit.color}">${lastEdit.text || ''}</span>
          <span class="status-badge ${badgeClass[p.status]}">${statusLabel[p.status]}</span>
        </div>
        <div class="project-card-title">${p.title}</div>
        ${dirName ? `<div class="project-card-dir">${dirName}</div>` : ''}
        ${p.company ? `<div class="project-card-company">${p.company}</div>` : ''}
        <div class="project-card-footer">
          ${castCount ? `<span class="project-card-tag">${castCount} cast</span>` : ''}
          ${crewCount ? `<span class="project-card-tag">${crewCount} crew</span>` : ''}
          ${p.genre   ? `<span class="project-card-tag">${p.genre}</span>` : ''}
          <button class="project-card-edit" onclick="event.stopPropagation();editProjectFromDashboard('${p.id}')" title="Edit project">✎</button>
        </div>
      </div>`;
    }).join('');
  });

  renderSidebarProjects();
}

const collapsedStatusGroups = new Set();

function toggleTray(status) {
  const tray = document.querySelector(`.tray[data-status="${status}"]`);
  if (!tray) return;
  tray.classList.toggle('open');
}

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
