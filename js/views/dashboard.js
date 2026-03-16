// PROJECT CRUD
// ══════════════════════════════════════════
let editingProjectId = null;

function openNewProjectModal() {
  editingProjectId = null;
  document.getElementById('modal-project-title').textContent = 'NEW PROJECT';
  ['title','num','director','producer','company','genre','notes'].forEach(f => {
    document.getElementById('proj-input-' + f).value = '';
  });
  document.getElementById('proj-input-status').value = 'pre';
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
  document.getElementById('proj-input-director').value = p.director;
  document.getElementById('proj-input-producer').value = p.producer;
  document.getElementById('proj-input-company').value = p.company;
  document.getElementById('proj-input-genre').value = p.genre;
  document.getElementById('proj-input-notes').value = p.notes;
  openModal('modal-project');
}

function saveProject() {
  const title = document.getElementById('proj-input-title').value.trim();
  if (!title) { showToast('Please enter a project title', 'info'); return; }
  if (editingProjectId) {
    const p = getProject(editingProjectId);
    p.title = title;
    p.num = document.getElementById('proj-input-num').value.trim() || '001';
    p.status = document.getElementById('proj-input-status').value;
    p.director = document.getElementById('proj-input-director').value.trim();
    p.producer = document.getElementById('proj-input-producer').value.trim();
    p.company = document.getElementById('proj-input-company').value.trim();
    p.genre = document.getElementById('proj-input-genre').value.trim();
    p.notes = document.getElementById('proj-input-notes').value.trim();
    closeModal('modal-project');
    saveStore();
    showProjectView(editingProjectId);
    showToast('Project updated', 'success');
  } else {
    const p = defaultProject({
      title,
      num: document.getElementById('proj-input-num').value.trim() || String(store.projects.length + 1).padStart(3,'0'),
      status: document.getElementById('proj-input-status').value,
      director: document.getElementById('proj-input-director').value.trim(),
      producer: document.getElementById('proj-input-producer').value.trim(),
      company: document.getElementById('proj-input-company').value.trim(),
      genre: document.getElementById('proj-input-genre').value.trim(),
      notes: document.getElementById('proj-input-notes').value.trim(),
    });
    store.projects.push(p);
    closeModal('modal-project');
    saveStore();
    showProjectView(p.id);
    showToast('Project created 🎬', 'success');
  }
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
