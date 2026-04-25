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

// ═══ PROJECT SWITCHER ═══

let _psSortMode = 'recent';
let _psSortAsc = false;

function toggleProjectSwitcher(e) {
  e.stopPropagation();
  const d = document.getElementById('ps-dropdown');
  const isOpen = d.classList.contains('open');
  document.getElementById('ps-sort-menu')?.classList.remove('open');
  if (isOpen) { d.classList.remove('open'); return; }
  renderProjectSwitcher();
  d.classList.add('open');
}

function closeProjectSwitcher() {
  document.getElementById('ps-dropdown')?.classList.remove('open');
  document.getElementById('ps-sort-menu')?.classList.remove('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('#ps-btn') && !e.target.closest('#ps-dropdown')) {
    closeProjectSwitcher();
  }
});

function togglePsSort(e) {
  e.stopPropagation();
  document.getElementById('ps-sort-menu')?.classList.toggle('open');
}

function togglePsDir(e) {
  e.stopPropagation();
  _psSortAsc = !_psSortAsc;
  const dirBtn = document.getElementById('ps-dir-btn');
  if (dirBtn) dirBtn.textContent = _psSortAsc ? '↑' : '↓';
  renderProjectSwitcher();
}

function setPsSort(mode, el) {
  _psSortMode = mode;
  document.querySelectorAll('.ps-sort-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ps-sort-menu')?.classList.remove('open');
  renderProjectSwitcher();
}

function renderProjectSwitcher() {
  const list = document.getElementById('ps-list');
  if (!list) return;
  const projects = [...(store.projects || [])];
  const statusOrder = { pre:0, prod:1, post:2, done:3, released:4 };
  const statusLabel  = { pre:'Pre-prod', prod:'Production', post:'Post-prod', done:'Complete', released:'Released' };
  const dotColor     = { pre:'#7dd0f5', prod:'#e6bc3c', post:'#e08095', done:'#2ea864', released:'#b88af0' };

  if (_psSortMode === 'recent') {
    projects.sort((a,b) => _psSortAsc 
      ? new Date(a.updatedAt||0) - new Date(b.updatedAt||0)
      : new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
  } else if (_psSortMode === 'status') {
    projects.sort((a,b) => _psSortAsc
      ? (statusOrder[a.status]||0) - (statusOrder[b.status]||0)
      : (statusOrder[b.status]||0) - (statusOrder[a.status]||0));
  } else {
    projects.sort((a,b) => _psSortAsc 
      ? a.title.localeCompare(b.title)
      : b.title.localeCompare(a.title));
  }

  list.innerHTML = projects.map(p => `
    <div class="psd-item${p.id === store.currentProjectId ? ' active' : ''}"
         onclick="switchProject('${p.id}')">
      <div class="psd-dot" style="background:${dotColor[p.status]||'#9090a8'};"></div>
      <div>
        <div class="psd-title">${p.title}</div>
        <div class="psd-status">${statusLabel[p.status]||p.status}</div>
      </div>
    </div>`).join('');
}

function switchProject(id) {
  closeProjectSwitcher();
  showProjectView(id);
  qtDrawerSync();
}

// ═══ FAB ─────────────────────

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
  document.querySelectorAll('.dock-item').forEach(el => el.classList.remove('active'));
  const map = {
    dashboard:  'dock-overview',
    story:      'dock-story',
    people:     'dock-people',
    locations:  'dock-locations',
    production: 'dock-production',
    finance:    'dock-finance',
  };
  if (map[group]) document.getElementById(map[group])?.classList.add('active');

  const projEl = document.getElementById('ps-current-name');
  if (projEl) {
    const p = currentProject();
    projEl.textContent = p ? p.title : '—';
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

  if (name === 'dashboard') {
    setTimeout(() => qtDrawerRender(null), 50);
  } else {
    setTimeout(qtDrawerSync, 50);
  }

  // Save current view to localStorage for persistence across refreshes
  try {
    localStorage.setItem('bf_currentView', JSON.stringify({ type: 'global', name: name }));
    console.log('[ViewRestore] Saved global view:', name);
  } catch (e) {}

  // Clean up moodboard state if leaving moodboards view
  if (name !== 'moodboards') {
    if (typeof _currentMoodboardId !== 'undefined') {
      _currentMoodboardId = null;
    }
    document.getElementById('content')?.classList.remove('mb-content-canvas');
    document.getElementById('view-moodboards')?.classList.remove('mb-canvas-mode');
  }
  document.body.classList.remove('project-mode');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  viewEl.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-subitem').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[onclick*="${name}"]`) || document.querySelector(`.nav-item[data-view="${name}"]`);
  if (navItem) navItem.classList.add('active');
  
  // Clear project highlighting for global views (not project-specific)
  const globalViews = ['dashboard', 'team', 'contacts', 'locations', 'moodboards', 'files', 'settings', 'myfountain'];
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
    if (typeof renderSaveHistoryUI === 'function') renderSaveHistoryUI();
  } else if (name === 'myfountain') {
    const tt = document.getElementById('topbar-title'); if (tt) tt.textContent = 'My Fountain';
    const tb = document.getElementById('topbar-breadcrumb'); if (tb) tb.textContent = 'Black Fountain / My Fountain';
    renderMyFountain();
  }
// Update top nav active state
_setTopNavActive(name === 'dashboard' ? 'dashboard' : 
                 name === 'contacts' ? 'assets' :
                 name === 'locations' ? 'assets' :
                 name === 'moodboards' ? 'assets' :
                 name === 'settings' ? 'assets' :
                 name === 'myfountain' ? 'assets' : null);
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

   // Save current view to localStorage for persistence across refreshes
  try {
    localStorage.setItem('bf_currentView', JSON.stringify({ type: 'project', projectId: id }));
    console.log('[ViewRestore] Saved project view:', id);
  } catch (e) {}

  // Clean up moodboard canvas/fullscreen mode if leaving it
  document.getElementById('content')?.classList.remove('mb-content-canvas');
  if (typeof _currentMoodboardId !== 'undefined') {
    _currentMoodboardId = null;
  }
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
  document.body.classList.add('project-mode');
  const psName = document.getElementById('ps-current-name');
  if (psName) psName.textContent = p.title;

  setTimeout(qtDrawerSync, 50);
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
  const groups = {
    'Story': [
      ['script','Script & Docs'],['breakdown','Script Breakdown'],['stripboard','Stripboard'],
      ['storyboard','Storyboard'],['moodboards','Moodboards'],['brief','Project Brief'],
    ],
    'People': [
      ['cast','Cast & Extras'],['crew','Crew'],
    ],
    'Locations': [
      ['locations','Locations'],['riskassess','Risk Assessment'],
    ],
    'Production': [
      ['schedule','Schedule'],['callsheet','Callsheet'],['shotlist','Shot List'],
      ['props','Props'],['wardrobe','Wardrobe'],['soundlog','Sound Log'],
      ['equipment','Equipment'],['releases','Release Forms'],
    ],
    'Finance': [
      ['budget','Budget'],['plan','Production Plan'],
    ],
  };
  const current = currentProject();
  if (current) {
    const custom = (current.customSections || []).map(s => ['custom_'+s.id, s.name]);
    if (custom.length) groups['Custom'] = custom;
  }
  const skipSet = new Set([skip, 'overview']);
  let opts = `<option value="overview">Overview</option><option disabled>── Story ──</option>`;
  const storySections = groups['Story'].filter(([id])=>!skipSet.has(id));
  opts += storySections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  opts += `<option disabled>── People ──</option>`;
  const peopleSections = groups['People'].filter(([id])=>!skipSet.has(id));
  opts += peopleSections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  opts += `<option disabled>── Locations ──</option>`;
  const locSections = groups['Locations'].filter(([id])=>!skipSet.has(id));
  opts += locSections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  opts += `<option disabled>── Production ──</option>`;
  const prodSections = groups['Production'].filter(([id])=>!skipSet.has(id));
  opts += prodSections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  opts += `<option disabled>── Finance ──</option>`;
  const finSections = groups['Finance'].filter(([id])=>!skipSet.has(id));
  opts += finSections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  if (groups['Custom']) {
    opts += `<option disabled>── Custom ──</option>`;
    const customSections = groups['Custom'].filter(([id])=>!skipSet.has(id));
    opts += customSections.map(([id,l])=>`<option value="${id}">${l}</option>`).join('');
  }
  return `<select class="btn btn-sm" onchange="if(this.value){showSection(this.value);this.value=''}" style="cursor:pointer" title="Go to section">
    <option value="">→ Go to…</option>
    ${opts}
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

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) {
    const name = store.preferences?.name || store.userProfile?.name || '';
    greetEl.textContent = name ? `${greeting}, ${name}.` : `${greeting}.`;
  }

  // Sub line
  const subEl = document.getElementById('dash-sub');
  if (subEl) {
    const recent = getMostRecentProject();
    const totalStr = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
    subEl.innerHTML = recent
      ? `${totalStr} &nbsp;<span style="color:#3a3a52">·</span>&nbsp; Last active: ${recent.title}`
      : totalStr;
  }

  // Pipeline bar
  const counts = {
    pre:      projects.filter(p => p.status === 'pre').length,
    prod:     projects.filter(p => p.status === 'prod').length,
    post:     projects.filter(p => p.status === 'post').length,
    done:     projects.filter(p => p.status === 'done').length,
    released: projects.filter(p => p.status === 'released').length,
  };
  const pipelineEl = document.getElementById('dash-pipeline');
  if (pipelineEl) {
    const stages = [
      { key:'pre',      label:'Pre-production',  color:'#7dd0f5' },
      { key:'prod',     label:'In production',   color:'#e6bc3c' },
      { key:'post',     label:'Post-production', color:'#e08095' },
      { key:'done',     label:'Complete',        color:'#2ea864' },
      { key:'released', label:'Released',        color:'#b88af0' },
    ];
    pipelineEl.innerHTML = stages.map(s => `
      <div class="dash-pipe-stage${dashboardStatusFilter === s.key ? ' active' : ''}"
           style="--sc:${s.color}"
           onclick="setDashboardFilter('${s.key}')">
        <div class="dash-pipe-label">${s.label}</div>
        <div class="dash-pipe-count">${counts[s.key]}</div>
        <div class="dash-pipe-bar"></div>
      </div>`).join('');
  }

  // Sections
  const sectionsEl = document.getElementById('dash-sections');
  if (!sectionsEl) return;

  const statusOrder = ['prod','post','pre','done','released'];
  const statusConfig = {
    prod:     { label:'In production',   color:'#e6bc3c',  featured: true },
    post:     { label:'Post-production', color:'#e08095',  featured: true },
    pre:      { label:'Pre-production',  color:'#7dd0f5',  featured: false },
    done:     { label:'Complete',        color:'#2ea864',  featured: false },
    released: { label:'Released',        color:'#b88af0',  featured: false },
  };

  const visibleProjects = dashboardStatusFilter
    ? projects.filter(p => p.status === dashboardStatusFilter)
    : projects;

  if (projects.length === 0) {
    sectionsEl.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-title">No projects yet</div>
        <div class="dash-empty-sub">Use the + button to create your first project</div>
      </div>`;
    renderSidebarProjects();
    return;
  }

  let html = '';

  statusOrder.forEach(status => {
    const cfg = statusConfig[status];
    const group = visibleProjects.filter(p => p.status === status);
    if (!group.length) return;

    html += `<div class="dash-section-label" style="--sc:${cfg.color}">${cfg.label}</div>`;

    if (cfg.featured) {
      // Featured card for prod/post
      group.forEach(p => {
        const dir = Array.isArray(p.directors) && p.directors.length
          ? p.directors.join(', ') : (p.director || '');
        const castCount = p.cast?.length || 0;
        const crewCount = p.unit?.length || 0;
        const lastEdit = formatRelativeTime(p.updatedAt || p.createdAt);
        const tags = [
          castCount ? `${castCount} cast` : null,
          crewCount ? `${crewCount} crew` : null,
          p.genre || null,
        ].filter(Boolean);

        html += `
        <div class="dash-featured-card" style="--sc:${cfg.color}" onclick="showProjectView('${p.id}')" oncontextmenu="showProjectCtxMenu(event,'${p.id}')">
          <div class="dash-featured-main">
            <div class="dash-featured-eyebrow">#${String(p.num).padStart(3,'0')}${p.company ? ' · ' + p.company : ''}</div>
            <div class="dash-featured-title">${p.title}</div>
            ${dir ? `<div class="dash-featured-meta">${dir}${p.genre ? ' · ' + p.genre : ''}</div>` : ''}
            ${tags.length ? `<div class="dash-featured-tags">${tags.map(t => `<span class="dash-tag">${t}</span>`).join('')}</div>` : ''}
          </div>
          <div class="dash-featured-side">
            <div class="dash-featured-badge" style="--sc:${cfg.color}">${cfg.label}</div>
            ${lastEdit ? `<div class="dash-featured-time" style="color:${lastEdit.color}">${lastEdit.text}</div>` : ''}
            <button class="dash-edit-btn" onclick="event.stopPropagation();editProjectFromDashboard('${p.id}')" title="Edit">✎</button>
          </div>
        </div>`;
      });
    } else {
      // Card grid for pre/done/released
      html += `<div class="dash-card-grid">`;
      group.forEach(p => {
        const dir = Array.isArray(p.directors) && p.directors.length
          ? p.directors.join(', ') : (p.director || '');
        const lastEdit = formatRelativeTime(p.updatedAt || p.createdAt);
        html += `
        <div class="dash-proj-card" style="--sc:${cfg.color}" onclick="showProjectView('${p.id}')" oncontextmenu="showProjectCtxMenu(event,'${p.id}')">
          <div class="dash-proj-num">#${String(p.num).padStart(3,'0')}</div>
          <div class="dash-proj-title">${p.title}</div>
          ${dir ? `<div class="dash-proj-dir">${dir}</div>` : ''}
          <div class="dash-proj-footer">
            ${lastEdit ? `<span class="dash-proj-time" style="color:${lastEdit.color}">${lastEdit.text}</span>` : ''}
            <button class="dash-edit-btn" onclick="event.stopPropagation();editProjectFromDashboard('${p.id}')" title="Edit">✎</button>
          </div>
        </div>`;
      });

      if (!dashboardStatusFilter) {
        html += `<div class="dash-new-card" onclick="openNewProjectModal()">+ New project</div>`;
      }
      html += `</div>`;
    }
  });

  sectionsEl.innerHTML = html;
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

// ── QUICK TASKS DRAWER ──────────────────────────────────────

let _qtDrawerOpen = false;
let _qtDeleteConfirmOpen = false;

function toggleQtDrawer() {
  _qtDrawerOpen = !_qtDrawerOpen;
  document.getElementById('qt-drawer').classList.toggle('open', _qtDrawerOpen);
}

document.addEventListener('click', e => {
  const panel = document.getElementById('right-panel');
  const body  = document.getElementById('rp-body');
  const strip = document.querySelector('.rp-strip');
  
  // If delete confirm was recently shown, don't close drawer
  if (_qtDeleteConfirmOpen) return;
  
  // Use right-panel if it exists (new), otherwise fall back to qt-drawer (legacy)
  if (panel && panel.classList.contains('open') && body && strip) {
    if (!body.contains(e.target) && !strip.contains(e.target)) {
      // Clicked outside - close the panel
      // Save scratchpad before closing
      if (typeof _rpSaveCurrent === 'function') _rpSaveCurrent();
      panel.classList.remove('open');
      document.body.classList.remove('rp-panel-open');
      document.querySelectorAll('.rp-strip-tab').forEach(t => t.classList.remove('active'));
      // Reset active tab state so dimensions recalculate properly
      _rpActiveTab = null;
    }
    return;
  }
  
  // Legacy qt-drawer handling
  const drawer = document.getElementById('qt-drawer');
  const tab = document.querySelector('.qt-drawer-tab');
  
  if (_qtDrawerOpen && drawer && 
      !drawer.contains(e.target) && 
      (!tab || !tab.contains(e.target))) {
    _qtDrawerOpen = false;
    drawer.classList.remove('open');
  }
});

function qtDrawerSortChanged() {
  const sort = document.getElementById('qt-drawer-sort').value;
  const oldSort = document.getElementById('qt-sort');
  if (oldSort) oldSort.value = sort;
  const p = currentProject();
  if (p) qtDrawerRender(p);
}

function qtDrawerAddTask() {
  const input = document.getElementById('qt-drawer-input');
  const priority = document.getElementById('qt-drawer-priority');
  const deadline = document.getElementById('qt-drawer-deadline');
  const deadlineLabel = document.getElementById('qt-drawer-deadline-label');
  const val = input.value.trim();
  if (!val) return;

  const p = currentProject();
  if (!p) {
    showToast('Open a project to add tasks', 'info');
    return;
  }

  if (!p.quickTasks) p.quickTasks = [];
  p.quickTasks.push({
    id: Date.now().toString(),
    text: val,
    done: false,
    priority: priority.value || '',
    deadline: deadline.value || '',
    order: p.quickTasks.length,
  });

  input.value = '';
  priority.value = '';
  deadline.value = '';
  deadlineLabel.textContent = 'Deadline';

  saveStore();
  qtDrawerRender(p);
}

function showQtDatePicker() {
  const deadline = document.getElementById('qt-drawer-deadline');
  const deadlineLabel = document.getElementById('qt-drawer-deadline-label');
  showDatePicker('Set Deadline', deadline.value || '', (newDate) => {
    deadline.value = newDate || '';
    if (newDate) {
      const d = new Date(newDate + 'T00:00:00');
      deadlineLabel.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      deadlineLabel.textContent = 'Deadline';
    }
  });
}

function qtOpenDeadlinePicker(btn) {
  const deadline = document.getElementById('qt-drawer-deadline');
  const deadlineLabel = document.getElementById('qt-drawer-deadline-label');
  const list = document.getElementById('qt-drawer-list');
  const rect = btn.getBoundingClientRect();
  
  let pickerInput = document.getElementById('qt-deadline-picker');
  if (!pickerInput) {
    pickerInput = document.createElement('input');
    pickerInput.id = 'qt-deadline-picker';
    pickerInput.type = 'date';
    pickerInput.style.cssText = 'position:fixed;left:-9999px;opacity:0;z-index:9999';
    document.body.appendChild(pickerInput);
  }
  
  pickerInput.value = deadline.value || '';
  
  const handleChange = () => {
    const val = pickerInput.value;
    deadline.value = val;
    if (val) {
      const d = new Date(val + 'T00:00:00');
      deadlineLabel.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      deadlineLabel.textContent = 'Deadline';
    }
  };
  
  pickerInput.onchange = handleChange;
  pickerInput.onblur = handleChange;
  
  const listRect = list ? list.getBoundingClientRect() : rect;
  pickerInput.style.position = 'fixed';
  pickerInput.style.left = (listRect.left + 10) + 'px';
  pickerInput.style.top = (listRect.bottom - 40) + 'px';
  pickerInput.style.width = '200px';
  pickerInput.style.height = '36px';
  pickerInput.style.opacity = '0';
  pickerInput.style.cursor = 'pointer';
  
  setTimeout(() => {
    try {
      pickerInput.showPicker();
    } catch (e) {
      pickerInput.focus();
    }
  }, 10);
}

function getEmptySections(p) {
  const empty = [];
  if (!p.budget?.length) empty.push({ tab: 'budget', name: 'Budget', task: 'Set up budget' });
  if (!p.callsheets?.length) empty.push({ tab: 'callsheet', name: 'Callsheet', task: 'Create callsheet' });
  if (!(p.cast?.length || p.extras?.length)) empty.push({ tab: 'cast', name: 'Cast & Extras', task: 'Add cast & extras' });
  if (!(p.gearList?.length || Object.values(p.equipment || {}).flat().length)) empty.push({ tab: 'equipment', name: 'Equipment', task: 'Add equipment' });
  if (!p.locations?.length) empty.push({ tab: 'locations', name: 'Locations', task: 'Add locations' });
  if (!(store.moodboards || []).filter(b => b.projectId === p.id).length) empty.push({ tab: 'moodboards', name: 'Moodboards', task: 'Create moodboard' });
  if (!p.brief?.projectType) empty.push({ tab: 'brief', name: 'Project Brief', task: 'Write project brief' });
  if (!p.props?.length) empty.push({ tab: 'props', name: 'Props', task: 'List props' });
  if (!p.releases?.length) empty.push({ tab: 'releases', name: 'Release Forms', task: 'Prepare release forms' });
  if (!p.risks?.length) empty.push({ tab: 'riskassess', name: 'Risk Assessment', task: 'Complete risk assessment' });
  if (!p.schedule?.length) empty.push({ tab: 'schedule', name: 'Schedule', task: 'Create schedule' });
  if (!p.scripts?.length) empty.push({ tab: 'script', name: 'Script & Docs', task: 'Upload script' });
  if (!p.scriptBreakdowns?.length) empty.push({ tab: 'breakdown', name: 'Script Breakdown', task: 'Load script breakdown' });
  if (!p.stripboard?.days?.length) empty.push({ tab: 'stripboard', name: 'Stripboard', task: 'Set up stripboard' });
  if (!p.shots?.length) empty.push({ tab: 'shotlist', name: 'Shot List', task: 'Create shot list' });
  if (!p.storyboard?.frames?.length) empty.push({ tab: 'storyboard', name: 'Storyboard', task: 'Add storyboard frames' });
  if (!p.soundlog?.length) empty.push({ tab: 'soundlog', name: 'Sound Log', task: 'Set up sound log' });
  if (!p.unit?.length) empty.push({ tab: 'crew', name: 'Crew', task: 'Add crew members' });
  if (!p.productionPlan?.sections?.length) empty.push({ tab: 'plan', name: 'Production Plan', task: 'Create production plan' });
  if (!p.wardrobe?.length) empty.push({ tab: 'wardrobe', name: 'Wardrobe', task: 'List wardrobe items' });
  return empty;
}

function renderDrawerSuggestions(p) {
  const container = document.getElementById('qt-drawer-suggestions');
  if (!container) return;
  if (!p) {
    container.style.display = 'none';
    return;
  }
  const empty = getEmptySections(p);
  if (!empty.length) {
    container.style.display = 'none';
    return;
  }
  const show = empty.slice(0, 4);
  container.style.display = 'block';
  container.innerHTML = `<div style="font-size:9px;color:var(--text3);margin-bottom:4px">Suggested:</div>` +
    show.map(s => `<span onclick="qtDrawerAddSuggested(this,'${escapeHtml(s.task).replace(/'/g, "\\'")}',event)" style="display:inline-block;margin:2px 3px 2px 0;padding:3px 6px;font-size:10px;background:var(--surface2);color:var(--text2);border:1px solid var(--border2);border-radius:10px;cursor:pointer">${s.task}</span>`).join('');
}

function qtDrawerAddSuggested(btn, taskText, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  
  const p = currentProject();
  if (!p) return;
  if (!p.quickTasks) p.quickTasks = [];
  p.quickTasks.push({ id: Date.now().toString(), text: taskText, done: false, priority: 'medium' });
  saveStore();
  qtDrawerRender(p);
}

function qtDrawerRender(p) {
  const list = document.getElementById('qt-drawer-list');
  const progress = document.getElementById('qt-drawer-progress');
  const tabCount = document.getElementById('qt-tab-count');
  const context = document.getElementById('qt-drawer-context');
  if (!list) return;

  // Update badge on strip if right-panel exists
  const badge = document.getElementById('rp-badge-tasks');
  
  if (!p) {
    const context = document.getElementById('qt-drawer-context');
    if (context) context.textContent = 'All projects';

    const allTasks = [];
    (store.projects || []).forEach(proj => {
      (proj.quickTasks || []).forEach(t => {
        allTasks.push({ ...t, _projTitle: proj.title, _projId: proj.id });
      });
    });

    const total = allTasks.length;
    const done = allTasks.filter(t => t.done).length;
    const outstanding = total - done;

    if (progress) progress.textContent = total ? `${done}/${total}` : '—';
    if (tabCount) {
      tabCount.textContent = outstanding || (total ? '✓' : '0');
      tabCount.className = 'qt-tab-count' + (outstanding === 0 && total > 0 ? ' zero' : '');
    }
    if (badge) badge.textContent = outstanding > 0 ? String(outstanding) : '';

    const priorityColor = { low:'#2ea864', medium:'#d4883a', high:'#c44444', urgent:'#b88af0', '':'#3a3a52' };

    if (!allTasks.length) {
      list.innerHTML = '<div style="padding:20px 12px;font-size:12px;color:var(--text3);">No tasks across any project.</div>';
      return;
    }

    const byProject = {};
    allTasks.forEach(t => {
      if (!byProject[t._projId]) byProject[t._projId] = { title: t._projTitle, tasks: [] };
      byProject[t._projId].tasks.push(t);
    });

    list.innerHTML = Object.values(byProject).map(group => `
      <div style="font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;font-family:var(--font-mono);padding:8px 4px 4px;">${group.title}</div>
      ${group.tasks.map(t => {
        const pc = priorityColor[t.priority || ''];
        const dl = t.deadline ? _qtFormatDeadline(t.deadline) : '';
        return `
        <div class="quick-task-item" data-id="${t.id}" style="--pc:${pc};opacity:${t.done?'0.5':'1'}">
          <div class="qt-priority-bar" style="background:${pc}"></div>
          <input type="checkbox" class="qt-checkbox" ${t.done ? 'checked' : ''}
                 onchange="qtDashboardToggle('${t._projId}','${t.id}')">
          <span class="qt-text${t.done ? ' done' : ''}">${t.text}</span>
          ${dl ? `<span style="font-size:9px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap;flex-shrink:0">${dl}</span>` : ''}
          <button onclick="qtDashboardDeleteConfirm(this,'${t._projId}','${t.id}')"
                  style="background:none;border:none;color:var(--border);font-size:11px;cursor:pointer;padding:0 4px;flex-shrink:0;transition:color 0.1s"
                  onmouseover="this.style.color='var(--red)'"
                  onmouseout="this.style.color='var(--border)'">✕</button>
        </div>`;
      }).join('')}
    `).join('');
    return;
  }

  if (context) context.textContent = p.title;

  const tasks = p.quickTasks || [];
  const sortVal = document.getElementById('qt-drawer-sort')?.value || 'custom';
  const sorted = [...tasks];

  if (sortVal === 'priority') {
    const order = { urgent:0, high:1, medium:2, low:3, '':4 };
    sorted.sort((a,b) => (order[a.priority]??4) - (order[b.priority]??4));
  } else if (sortVal === 'deadline') {
    sorted.sort((a,b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }

  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const outstanding = total - done;

  if (progress) progress.textContent = `${done}/${total}`;
  if (tabCount) {
    tabCount.textContent = outstanding || '✓';
    tabCount.className = 'qt-tab-count' + (outstanding === 0 && total > 0 ? ' zero' : '');
  }
  if (badge) badge.textContent = outstanding > 0 ? String(outstanding) : '';

  const priorityColor = { low:'#2ea864', medium:'#d4883a', high:'#c44444', urgent:'#b88af0', '':'#3a3a52' };
  const priorityLabel = { low:'🟢', medium:'🟠', high:'🔴', urgent:'🟣' };

  if (!sorted.length) {
    list.innerHTML = '<div style="padding:20px 12px;font-size:12px;color:var(--text3);">No tasks yet.</div>';
    renderDrawerSuggestions(p);
    return;
  }

  list.innerHTML = sorted.map(t => {
    const pc = priorityColor[t.priority || ''];
    const dl = t.deadline ? _qtFormatDeadline(t.deadline) : '';
    const taskId = t.id ? `'${t.id}'` : 'null';
    return `
    <div class="quick-task-item" data-id="${t.id || ''}" style="--pc:${pc}">
      <div class="qt-priority-bar" style="background:${pc}"></div>
      <input type="checkbox" class="qt-checkbox" ${t.done ? 'checked' : ''}
             onchange="qtDrawerToggleDone(${taskId})">
      <span class="qt-text${t.done ? ' done' : ''}"
            ondblclick="qtDrawerRename(this,${taskId})"
            title="Double-click to rename">${t.text}</span>
      ${dl ? `<span class="qt-deadline" style="font-size:9px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap;flex-shrink:0;cursor:pointer" onclick="qtEditTaskDeadline('${t.id}')" title="Click to change date">${dl}</span>` : `<span class="qt-deadline" style="font-size:9px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap;flex-shrink:0;cursor:pointer;opacity:0.5" onclick="qtEditTaskDeadline('${t.id}')" title="Click to set date">—</span>`}
      <button onclick="qtDrawerDeleteConfirm(this,${taskId})"
              style="background:none;border:none;color:var(--border);font-size:11px;cursor:pointer;padding:0 4px;flex-shrink:0;transition:color 0.1s"
              onmouseover="this.style.color='var(--red)'"
              onmouseout="this.style.color='var(--border)'">✕</button>
    </div>`;
  }).join('');

  renderDrawerSuggestions(p);
}

function qtDrawerToggleDone(id) {
  if (!id) return;
  const p = currentProject(); if (!p) return;
  const t = (p.quickTasks||[]).find(t => t.id === id);
  if (t) { t.done = !t.done; saveStore(); qtDrawerRender(p); }
}

function qtEditTaskDeadline(id) {
  const p = currentProject(); if (!p) return;
  const t = (p.quickTasks||[]).find(t => t.id === id);
  if (!t) return;

  const list = document.getElementById('qt-drawer-list');
  
  let pickerInput = document.getElementById('qt-task-deadline-picker');
  if (!pickerInput) {
    pickerInput = document.createElement('input');
    pickerInput.id = 'qt-task-deadline-picker';
    pickerInput.type = 'date';
    pickerInput.style.cssText = 'position:fixed;left:-9999px;opacity:0;z-index:9999';
    document.body.appendChild(pickerInput);
  }

  pickerInput.value = t.deadline || '';

  const handleChange = () => {
    const val = pickerInput.value;
    t.deadline = val || null;
    saveStore();
    qtDrawerRender(p);
  };

  pickerInput.onchange = handleChange;
  pickerInput.onblur = handleChange;

  const listRect = list ? list.getBoundingClientRect() : { left: 0, bottom: 0 };
  pickerInput.style.position = 'fixed';
  pickerInput.style.left = (listRect.left + 10) + 'px';
  pickerInput.style.top = (listRect.bottom - 40) + 'px';
  pickerInput.style.width = '200px';
  pickerInput.style.height = '28px';
  pickerInput.style.opacity = '0';
  pickerInput.style.cursor = 'pointer';

  setTimeout(() => {
    try {
      pickerInput.showPicker();
    } catch (e) {
      pickerInput.focus();
    }
  }, 10);
}

function qtDashboardToggle(projId, taskId) {
  const p = store.projects?.find(p => p.id === projId);
  if (!p) return;
  const t = (p.quickTasks||[]).find(t => t.id === taskId);
  if (t) { t.done = !t.done; saveStore(); qtDrawerRender(null); }
}

function qtDashboardDeleteConfirm(btn, projId, taskId) {
  const rect = btn.getBoundingClientRect();
  const existing = document.getElementById('qt-delete-confirm');
  if (existing) existing.remove();

  const p = store.projects?.find(p => p.id === projId);
  if (!p) return;

  _qtDeleteConfirmOpen = true;

  const taskItem = btn.closest('.quick-task-item');
  const taskText = taskItem?.querySelector('.qt-text')?.textContent || 'this task';
  const truncate = taskText.length > 20 ? taskText.substring(0,20) + '...' : taskText;

  const confirmDiv = document.createElement('div');
  confirmDiv.id = 'qt-delete-confirm';
  const popupWidth = 180;
  const popupHeight = 60;
  let left = rect.left;
  let top = rect.bottom + 5;
  if (left + popupWidth > window.innerWidth) {
    left = window.innerWidth - popupWidth - 10;
  }
  if (top + popupHeight > window.innerHeight) {
    top = rect.top - popupHeight - 5;
  }
  confirmDiv.style.cssText = `
    position:fixed;top:${top}px;left:${left}px;
    background:var(--surface);border:1px solid var(--border);
    border-radius:var(--radius);padding:8px 10px;z-index:10000;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:11px;display:flex;flex-direction:column;gap:6px;
  `;
  confirmDiv.addEventListener('click', e => e.stopPropagation());
  confirmDiv.addEventListener('mousedown', e => e.stopPropagation());
  confirmDiv.innerHTML = `
    <div style="color:var(--text3);white-space:nowrap;">Delete "${truncate}"?</div>
    <div style="display:flex;gap:6px;">
      <button id="qt-confirm-btn" onclick="event.stopPropagation();qtDashboardDelete('${projId}','${taskId}');document.getElementById('qt-delete-confirm')?.remove()"
              style="background:var(--red);border:none;color:white;font-size:10px;padding:3px 8px;border-radius:3px;cursor:pointer;">Confirm</button>
      <button id="qt-cancel-btn" onclick="event.stopPropagation();_qtDeleteConfirmOpen=false;document.getElementById('qt-delete-confirm')?.remove()"
              style="background:transparent;border:1px solid var(--border2);color:var(--text3);font-size:10px;padding:3px 8px;border-radius:3px;cursor:pointer;">Cancel</button>
    </div>
  `;
  document.body.appendChild(confirmDiv);
}

function qtDashboardDelete(projId, taskId) {
  const p = store.projects?.find(p => p.id === projId);
  if (!p) return;
  p.quickTasks = (p.quickTasks || []).filter(t => t.id !== taskId);
  saveStore();
  qtDrawerRender(null);
}

function qtDrawerDeleteConfirm(btn, id) {
  const rect = btn.getBoundingClientRect();
  const existing = document.getElementById('qt-delete-confirm');
  if (existing) existing.remove();
  
  const p = currentProject(); if (!p) { _qtDeleteConfirmOpen = false; return; }
  
  _qtDeleteConfirmOpen = true;
  
  const taskItem = btn.closest('.quick-task-item');
  const taskText = taskItem?.querySelector('.qt-text')?.textContent || 'this task';
  const truncate = taskText.length > 20 ? taskText.substring(0,20) + '...' : taskText;
  
  const confirmDiv = document.createElement('div');
  confirmDiv.id = 'qt-delete-confirm';
  const popupWidth = 180;
  const popupHeight = 60;
  let left = rect.left;
  let top = rect.bottom + 5;
  if (left + popupWidth > window.innerWidth) {
    left = window.innerWidth - popupWidth - 10;
  }
  if (top + popupHeight > window.innerHeight) {
    top = rect.top - popupHeight - 5;
  }
  confirmDiv.style.cssText = `
    position:fixed;top:${top}px;left:${left}px;
    background:var(--surface);border:1px solid var(--border);
    border-radius:var(--radius);padding:8px 10px;z-index:10000;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:11px;display:flex;flex-direction:column;gap:6px;
  `;
  confirmDiv.addEventListener('click', e => e.stopPropagation());
  confirmDiv.addEventListener('mousedown', e => e.stopPropagation());
  confirmDiv.innerHTML = `
    <div style="color:var(--text3);white-space:nowrap;">Delete "${truncate}"?</div>
    <div style="display:flex;gap:6px;">
      <button id="qt-confirm-btn" onclick="event.stopPropagation();qtDrawerDelete(${id ? "'"+id+"'" : "null"});document.getElementById('qt-delete-confirm')?.remove()"
              style="background:var(--red);border:none;color:white;font-size:10px;padding:3px 8px;border-radius:3px;cursor:pointer;">Confirm</button>
      <button id="qt-cancel-btn" onclick="event.stopPropagation();_qtDeleteConfirmOpen=false;document.getElementById('qt-delete-confirm')?.remove()"
              style="background:transparent;border:1px solid var(--border2);color:var(--text3);font-size:10px;padding:3px 8px;border-radius:3px;cursor:pointer;">Cancel</button>
    </div>
  `;
  document.body.appendChild(confirmDiv);
  setTimeout(() => {
    confirmDiv.remove();
    _qtDeleteConfirmOpen = false;
  }, 4000);
}

function qtDrawerDelete(id) {
  const p = currentProject(); if (!p) return;
  const tasks = p.quickTasks || [];
  if (id) {
    p.quickTasks = tasks.filter(t => t.id !== id);
  } else {
    p.quickTasks = tasks.slice(0, -1);
  }
  _qtDeleteConfirmOpen = false;
  saveStore(); qtDrawerRender(p);
}

function qtDrawerRename(el, id) {
  if (!id) return;
  const p = currentProject(); if (!p) return;
  const t = (p.quickTasks||[]).find(t => t.id === id);
  if (!t) return;
  const old = el.textContent;
  el.contentEditable = 'true';
  el.style.outline = 'none';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  const finish = () => {
    el.contentEditable = 'false';
    const val = el.textContent.trim();
    if (val) { t.text = val; saveStore(); }
    else { el.textContent = old; }
    qtDrawerRender(p);
  };
  el.addEventListener('blur', finish, { once:true });
  el.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();el.blur();} }, { once:true });
}

function _qtFormatDeadline(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `${diff}d`;
}

function qtDrawerSync() {
  const p = currentProject();
  qtDrawerRender(p || null);
}
