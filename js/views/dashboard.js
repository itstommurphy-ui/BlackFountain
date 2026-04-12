// PROJECT CRUD
// ══════════════════════════════════════════
let editingProjectId = null;

// Tag input handling for director/producer fields
function _addProjectTag(fieldType) {
  const input = document.getElementById('proj-input-' + fieldType);
  const tagsContainer = document.getElementById('proj-input-' + fieldType + '-tags');
  const val = (input.value || '').trim();
  if (!val) return;
  const existing = [...tagsContainer.querySelectorAll('[data-name]')].map(t => t.dataset.name.toLowerCase());
  if (existing.includes(val.toLowerCase())) { input.value = ''; return; }
  const chip = document.createElement('span');
  chip.dataset.name = val;
  chip.className = 'tag-input-tag';
  chip.innerHTML = `${val} <span class="tag-input-tag-remove" onclick="this.closest('.tag-input-tag').remove()">✕</span>`;
  tagsContainer.appendChild(chip);
  input.value = '';
  input.focus();
}

function _getProjectTags(fieldType) {
  const tagsContainer = document.getElementById('proj-input-' + fieldType + '-tags');
  return [...(tagsContainer?.querySelectorAll('[data-name]') || [])].map(t => t.dataset.name).filter(Boolean);
}

function _renderProjectTags(fieldType, values) {
  const tagsContainer = document.getElementById('proj-input-' + fieldType + '-tags');
  if (!tagsContainer) return;
  tagsContainer.innerHTML = '';
  (values || []).forEach(val => {
    const chip = document.createElement('span');
    chip.dataset.name = val;
    chip.className = 'tag-input-tag';
    chip.innerHTML = `${val} <span class="tag-input-tag-remove" onclick="this.closest('.tag-input-tag').remove()">✕</span>`;
    tagsContainer.appendChild(chip);
  });
}

function openNewProjectModal() {
  editingProjectId = null;
  document.getElementById('modal-project-title').textContent = 'NEW PROJECT';
  ['title','num','company','genre','notes'].forEach(f => {
    document.getElementById('proj-input-' + f).value = '';
  });
  document.getElementById('proj-input-status').value = 'pre';
  // Clear director/producer tags
  _renderProjectTags('director', []);
  _renderProjectTags('producer', []);
  openModal('modal-project');
}

function openProjectFiles() {
  const p = currentProject();
  showView('files');
  if (p) {
    const sel = document.getElementById('files-project-filter');
    if (sel) { sel.value = p.id; renderFiles(); }
  }
}

function openStoryModal() {
  const p = currentProject();
  if (!p) return;
  document.getElementById('story-logline').value  = p.logline  || '';
  document.getElementById('story-synopsis').value = p.synopsis || '';
  document.getElementById('story-outline').value  = p.outline  || '';
  openModal('modal-story');
}

function saveStory() {
  const p = currentProject();
  if (!p) return;
  p.logline  = document.getElementById('story-logline').value.trim();
  p.synopsis = document.getElementById('story-synopsis').value.trim();
  p.outline  = document.getElementById('story-outline').value.trim();
  saveStore();
  closeModal('modal-story');
  const ll = document.getElementById('proj-logline');
  if (p.logline) {
    ll.textContent = p.logline;
    ll.classList.remove('empty');
  } else {
    ll.textContent = '+ Add logline…';
    ll.classList.add('empty');
  }
}

function openEditProjectModal() {
  const p = currentProject();
  if (!p) return;
  editingProjectId = p.id;
  document.getElementById('modal-project-title').textContent = 'EDIT PROJECT';
  document.getElementById('proj-input-title').value = p.title;
  document.getElementById('proj-input-num').value = p.num;
  document.getElementById('proj-input-status').value = p.status;
  document.getElementById('proj-input-company').value = p.company;
  document.getElementById('proj-input-genre').value = p.genre;
  document.getElementById('proj-input-notes').value = p.notes;
  // Handle director/producer arrays
  const directors = Array.isArray(p.directors) ? p.directors : (p.director ? [p.director] : []);
  const producers = Array.isArray(p.producers) ? p.producers : (p.producer ? [p.producer] : []);
  _renderProjectTags('director', directors);
  _renderProjectTags('producer', producers);
  openModal('modal-project');
}

function saveProject() {
  const title = document.getElementById('proj-input-title').value.trim();
  if (!title) { showToast('Please enter a project title', 'info'); return; }
  const directors = _getProjectTags('director');
  const producers = _getProjectTags('producer');
  const notes = document.getElementById('proj-input-notes').value.trim();
  let p;
  if (editingProjectId) {
    p = getProject(editingProjectId);
    p.title = title;
    p.num = document.getElementById('proj-input-num').value.trim() || '001';
    p.status = document.getElementById('proj-input-status').value;
    p.directors = directors;
    p.producers = producers;
    p.company = document.getElementById('proj-input-company').value.trim();
    p.genre = document.getElementById('proj-input-genre').value.trim();
    p.notes = notes;
    p.logline = notes;
    closeModal('modal-project');
    saveStore();
    showProjectView(editingProjectId);
    showToast('Project updated', 'success');
  } else {
    p = defaultProject({
      title,
      num: document.getElementById('proj-input-num').value.trim() || String((store.projects || []).length + 1).padStart(3,'0'),
      status: document.getElementById('proj-input-status').value,
      directors,
      producers,
      company: document.getElementById('proj-input-company').value.trim(),
      genre: document.getElementById('proj-input-genre').value.trim(),
      notes: notes,
      logline: notes,
    });
    if (!store.projects) store.projects = [];
    store.projects.push(p);
    closeModal('modal-project');
    saveStore();
    showProjectView(p.id);
    showToast('Project created 🎬', 'success');
  }
  // Add directors and producers to crew and contacts
  directors.forEach(name => {
    _addDirectorProducerToContacts(p, name, 'Director');
    _addCrewToProject(p, name, 'Director', 'Direction');
  });
  producers.forEach(name => {
    _addDirectorProducerToContacts(p, name, 'Producer');
    _addCrewToProject(p, name, 'Producer', 'Production');
  });
  saveStore();
  renderSidebarProjects();
}

function deleteCurrentProject() {
  showConfirmDialog('Delete this project? This cannot be undone.', 'Delete Project', () => {
    store.projects = store.projects.filter(p => p.id !== store.currentProjectId);
    store.currentProjectId = null;
    saveStore();
    showView('dashboard');
    showToast('Project deleted', 'info');
  });
}

// Add a person to project's crew (unit)
function _addCrewToProject(p, name, role, dept) {
  if (!p.unit) p.unit = [];
  // Check if already exists
  const exists = p.unit.some(m => m.name && m.name.toLowerCase() === name.toLowerCase());
  if (exists) return;
  p.unit.push({ name, role: role || '', dept: dept || 'Production' });
}

// Add director/producer to global contacts and project crew
function _addDirectorProducerToContacts(p, name, role) {
  if (!name) return;
  
  // Add to global contacts if not exists
  if (!store.contacts) store.contacts = [];
  const existingContact = store.contacts.find(c => c.name && c.name.toLowerCase() === name.toLowerCase());
  if (!existingContact) {
    store.contacts.push({
      name,
      type: 'crew',
      defaultRole: role,
      crewRoles: [role],
      castRoles: []
    });
  } else {
    // Update existing contact's crew roles for this project
    if (!existingContact.crewRoles) existingContact.crewRoles = [];
    if (!existingContact.crewRoles.includes(role)) {
      existingContact.crewRoles.push(role);
    }
    // Also update defaultRole if not set
    if (!existingContact.defaultRole) {
      existingContact.defaultRole = role;
    }
  }
}

function deleteProjectFromDashboard(projectId) {
  showConfirmDialog('Delete this project? This cannot be undone.', 'Delete Project', () => {
    store.projects = store.projects.filter(p => p.id !== projectId);
    saveStore();
    showView('dashboard');
    showToast('Project deleted', 'info');
    renderProjects();
    renderSidebarProjects();
  });
}

function editProjectFromDashboard(projectId) {
  const p = getProject(projectId);
  if (!p) return;
  editingProjectId = p.id;
  document.getElementById('modal-project-title').textContent = 'EDIT PROJECT';
  document.getElementById('proj-input-title').value = p.title;
  document.getElementById('proj-input-num').value = p.num;
  document.getElementById('proj-input-status').value = p.status;
  document.getElementById('proj-input-company').value = p.company;
  document.getElementById('proj-input-genre').value = p.genre;
  document.getElementById('proj-input-notes').value = p.notes;
  const directors = Array.isArray(p.directors) ? p.directors : (p.director ? [p.director] : []);
  const producers = Array.isArray(p.producers) ? p.producers : (p.producer ? [p.producer] : []);
  _renderProjectTags('director', directors);
  _renderProjectTags('producer', producers);
  openModal('modal-project');
}

function showProjectCtxMenu(e, projectId) {
  e.preventDefault();
  e.stopPropagation();
  showContextMenu(e, [
    { label: 'Edit Project', icon: '✎', fn: () => editProjectFromDashboard(projectId) },
    null,
    { label: 'Delete Project', icon: '🗑', danger: true, fn: () => deleteProjectFromDashboard(projectId) }
  ]);
}

function changeProjectStatus(newStatus) {
  const p = currentProject();
  if (!p) return;
  p.status = newStatus;
  saveStore();
  const badgeClass = {pre:'badge-pre',prod:'badge-prod',post:'badge-post',done:'badge-done',released:'badge-released'};
  const sel = document.getElementById('proj-status-select');
  sel.className = 'proj-status-select ' + badgeClass[newStatus];
  renderSidebarProjects();
  showToast('Status updated', 'success');
}

// ══════════════════════════════════════════
// SECTION RENDERING
// ══════════════════════════════════════════
// ── Custom table scrollbars ───────────────────────────────────────────────────
function initTableScrollbars() {
  document.querySelectorAll('.table-container').forEach(el => {
    if (el.dataset.sbInit) return; // already initialised this exact element
    el.dataset.sbInit = '1';

    const track = document.createElement('div');
    track.className = 'tc-scrollbar-track';
    const thumb = document.createElement('div');
    thumb.className = 'tc-scrollbar-thumb';
    track.appendChild(thumb);
    el.appendChild(track);

    const nav = document.createElement('div');
    nav.className = 'tc-nav';
    const btnL = document.createElement('div');
    btnL.className = 'tc-nav-btn';
    btnL.innerHTML = '&#8249;';
    const btnR = document.createElement('div');
    btnR.className = 'tc-nav-btn';
    btnR.innerHTML = '&#8250;';
    nav.appendChild(btnL);
    nav.appendChild(btnR);
    el.insertAdjacentElement('afterend', nav);
    btnL.addEventListener('click', () => el.scrollBy({ left: -300, behavior: 'smooth' }));
    btnR.addEventListener('click', () => el.scrollBy({ left:  300, behavior: 'smooth' }));

    let dragging = false, dragStartX = 0, dragStartScroll = 0;

    const update = () => {
      const scrollable = el.scrollWidth - el.clientWidth;
      if (scrollable <= 0) { track.style.display = 'none'; nav.classList.remove('tc-nav-vis'); return; }
      track.style.display = '';
      nav.classList.add('tc-nav-vis');
      const ratio = el.clientWidth / el.scrollWidth;
      const tw = Math.max(ratio * el.clientWidth, 30);
      const tx = (el.scrollLeft / scrollable) * (el.clientWidth - tw);
      thumb.style.width = tw + 'px';
      thumb.style.left  = tx + 'px';
      btnL.classList.toggle('tc-btn-vis', el.scrollLeft > 1);
      btnR.classList.toggle('tc-btn-vis', el.scrollLeft < scrollable - 1);
    };

    el.addEventListener('scroll', update);
    new ResizeObserver(update).observe(el);
    update();

    thumb.addEventListener('mousedown', e => {
      dragging = true;
      dragStartX = e.clientX;
      dragStartScroll = el.scrollLeft;
      thumb.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const scrollable = el.scrollWidth - el.clientWidth;
      const trackW = el.clientWidth - thumb.offsetWidth;
      el.scrollLeft = dragStartScroll + (e.clientX - dragStartX) * (scrollable / trackW);
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; thumb.classList.remove('dragging'); }
    });
  });
  initTruncationTooltips();
}

function initTruncationTooltips() {
  document.querySelectorAll('.data-table td').forEach(td => {
    if (td.dataset.tip) return; // already has a manually-set tooltip
    if (td.querySelector('button, input, select, textarea, .photos-badge, .tag, a, svg')) return;
    const text = td.textContent.trim();
    if (!text || text === '—') return;
    if (td.scrollWidth > td.clientWidth + 1) td.dataset.tip = text;
  });
}

// ══════════════════════════════════════════
