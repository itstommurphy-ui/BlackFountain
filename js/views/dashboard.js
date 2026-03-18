// ══════════════════════════════════════════
// DASHBOARD RENDERING
// ══════════════════════════════════════════

let dashboardStatusFilter = null;

function renderDashboard() {
  // Update stats
  const stats = { total: 0, pre: 0, prod: 0, post: 0, done: 0, released: 0 };
  store.projects.forEach(p => {
    stats.total++;
    stats[p.status] = (stats[p.status] || 0) + 1;
  });
  
  ['total','pre','prod','post','done','released'].forEach(s => {
    document.getElementById(`stat-${s}`).textContent = stats[s];
  });
  
  // Active states
  document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
  if (dashboardStatusFilter) {
    document.querySelector(`[onclick="setDashboardFilter('${dashboardStatusFilter}')"]`)?.closest('.stat-card').classList.add('active');
  }
  
  // Render projects grid
  const grid = document.getElementById('projects-grid');
  const filteredProjects = dashboardStatusFilter 
    ? store.projects.filter(p => p.status === dashboardStatusFilter)
    : store.projects;
  
  grid.innerHTML = `
    <div class="new-project-card" onclick="openNewProjectModal()">
      <div class="plus">＋</div>
      <span>New Project</span>
    </div>
    ${filteredProjects.map(p => projectCardHTML(p)).join('')}
  `;
}

function setDashboardFilter(status) {
  dashboardStatusFilter = (dashboardStatusFilter === status) ? null : status;
  renderDashboard();
}

function projectCardHTML(p) {
  const badgeClass = {
    pre: 'badge-pre', prod: 'badge-prod', post: 'badge-post', 
    done: 'badge-done', released: 'badge-released'
  }[p.status];
  
  const daysAgo = Math.floor((Date.now() - new Date(p.createdAt || 0)) / (24*60*60*1000));
  const meta = [
    p.num || '#',
    p.genre ? `#${p.genre}` : '',
    daysAgo > 0 ? `${daysAgo}d ago` : ''
  ].filter(Boolean).join(' · ');
  
  return `
    <div class="project-card status-${p.status}" onclick="showProjectView('${p.id}')" data-ctx="project:${p.id}">
      <div class="project-card-header">
        <div>
          <div class="project-card-title">${escapeHtml(p.title)}</div>
          <div class="project-card-num">${p.num || ''}</div>
        </div>
        <span class="status-badge ${badgeClass}">${p.status?.toUpperCase()}</span>
      </div>
      <div class="project-card-meta">${meta}</div>
      <div class="project-card-footer">
        <div class="project-card-tags">
          ${p.genre ? `<span class="tag">${escapeHtml(p.genre)}</span>` : ''}
        </div>
        <span style="font-size:11px;color:var(--text3)">📁 ${p.files?.length || 0}</span>
      </div>
    </div>
  `;
}

function showProjectView(projectId) {
  store.currentProjectId = projectId;
  saveStore();
  
  // Activate project view
  showView('project');
  
  // Basic header population
  const p = getProject(projectId);
  if (p) {
    document.getElementById('proj-title').textContent = p.title;
    document.getElementById('proj-status-select').value = p.status;
    renderProjectHeader(p);
  }
  
  document.title = p?.title + ' — Black Fountain' || 'Black Fountain';
  
  // Stub for full render - sections next
  showSection('overview');
}

function renderProjectHeader(p) {
  let meta = [];
  if (p.num) meta.push(p.num);
  if (p.director) meta.push(`Director: ${p.director}`);
  if (p.producer) meta.push(`Producer: ${p.producer}`);
  if (p.genre) meta.push(p.genre);
  document.getElementById('proj-meta').innerHTML = meta.map(m => `<span>${m}</span>`).join('');
  
  const llEl = document.getElementById('proj-logline');
  if (p.notes) {
    llEl.textContent = p.notes;
    llEl.classList.remove('empty');
  } else {
    llEl.textContent = '+ Add logline…';
    llEl.classList.add('empty');
  }
}

function getProject(id) {
  return store.projects.find(p => p.id === id);
}

function currentProject() {
  return getProject(store.currentProjectId);
}

function showSection(section) {
  // Hide all sections
  document.querySelectorAll('[id^="section-"]').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
  
  // Show selected
  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
  const tab = Array.from(document.querySelectorAll('.section-tab')).find(t => t.textContent.trim().toLowerCase() === section);
  if (tab) tab.classList.add('active');
  
  // Section-specific renders (stub)
  if (section === 'overview') renderProjectOverview();
}

function renderProjectOverview() {
  const p = currentProject();
  if (!p) return;
  
  // Quick tasks - sample data
  const sampleTasks = [
    { id: 1, text: 'Finalise locations', priority: 'high', deadline: null, done: false },
    { id: 2, text: 'Book crew', priority: 'medium', deadline: '2024-01-15', done: true },
    { id: 3, text: 'Confirm cast availability', priority: 'urgent', deadline: '2024-01-10', done: false }
  ];
  p.quickTasks = p.quickTasks || sampleTasks;
  
  const tasksHtml = p.quickTasks.map(task => {
    const priColor = { low: '🟢', medium: '🟠', high: '🔴', urgent: '🟣' }[task.priority] || '';
    const doneClass = task.done ? 'line-through opacity-60' : '';
    const priStyle = task.priority ? `style="border-left:3px solid ${task.priority === 'low' ? '#46d090' : task.priority === 'medium' ? '#f0b970' : task.priority === 'high' ? '#e85e60' : '#b88af0'}"` : '';
    return `
      <div class="qt-item ${doneClass}" data-task="${task.id}" ${priStyle}>
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleQuickTask(${task.id}, this.checked)" style="cursor:pointer">
        <span>${escapeHtml(task.text)}</span>
        ${task.deadline ? `<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${task.deadline}</span>` : ''}
        <span class="qt-pri">${priColor}</span>
      </div>
    `;
  }).join('');
  document.getElementById('quick-tasks-list').innerHTML = tasksHtml || '<div style="padding:20px;text-align:center;color:var(--text3)">No quick tasks</div>';
  
  // Update progress
  const doneCount = p.quickTasks.filter(t => t.done).length;
  const total = p.quickTasks.length;
  document.getElementById('qt-progress').textContent = `${doneCount}/${total}`;
  
  // Files - project files
  const projFiles = store.files?.filter(f => fileProjectIds(f).includes(p.id)) || [];
  if (projFiles.length === 0) {
    document.getElementById('overview-files-grid').innerHTML = '<div style="grid-column:1/-1;padding:60px;text-align:center;color:var(--text3);border:2px dashed var(--border2);border-radius:var(--radius-lg);"><div style="font-size:48px;margin-bottom:16px;opacity:0.3">📁</div><div style="font-size:14px;margin-bottom:8px">No files yet</div><div style="font-size:12px">Upload files or drag & drop here</div></div>';
  } else {
    const filesHtml = projFiles.slice(0, 12).map(f => `
      <div class="file-card" data-ctx="file-card:${f.id}">
        <div class="file-card-preview">${getFileIcon(f)}</div>
        <div class="file-card-name">${escapeHtml(f.name)}</div>
        <div class="file-card-meta">
          <span>${formatFileSize(f.size || 0)}</span>
          <span class="file-card-type">${FILE_CATEGORIES[fileCategories(f)[0] || 'other']?.label || 'File'}</span>
        </div>
      </div>
    `).join('');
    document.getElementById('overview-files-grid').innerHTML = filesHtml;
  }
  
  // Overview docs - sample cards
  document.getElementById('overview-docs').innerHTML = `
    <div class="doc-card" onclick="showSection('script')">
      <div class="doc-card-icon">📜</div>
      <div class="doc-card-title">Script Breakdown</div>
      <div class="doc-card-sub">Scene list & stripboard</div>
      <div class="doc-card-status empty">No scenes broken down</div>
    </div>
    <div class="doc-card" onclick="showSection('locations')">
      <div class="doc-card-icon">📍</div>
      <div class="doc-card-title">Locations</div>
      <div class="doc-card-sub">${p.locations?.length || 0} locations</div>
      <div class="doc-card-status ${p.locations?.length ? 'filled' : 'empty'}">${p.locations?.length || 0} locations</div>
    </div>
    <div class="doc-card" onclick="showSection('budget')">
      <div class="doc-card-icon">💰</div>
      <div class="doc-card-title">Budget</div>
      <div class="doc-card-sub">ATL / BTL tracking</div>
      <div class="doc-card-status empty">No budget lines</div>
    </div>
    <div class="new-doc-card" onclick="console.log('Add custom section')">
      <div style="font-size:20px">＋</div>
      <span>Add Section</span>
    </div>
  `;
}

function toggleQuickTask(id, done) {
  const p = currentProject();
  const task = p.quickTasks.find(t => t.id === id);
  if (task) {
    task.done = done;
    saveStore();
    renderProjectOverview();
  }
}

function addQuickTask() {
  const p = currentProject();
  const text = document.getElementById('quick-task-input').value.trim();
  const pri = document.getElementById('quick-task-priority').value;
  const dl = document.getElementById('quick-task-deadline').value;
  
  if (!text) return;
  
  p.quickTasks = p.quickTasks || [];
  p.quickTasks.push({
    id: Date.now(),
    text,
    priority: pri,
    deadline: dl || null,
    done: false
  });
  
  document.getElementById('quick-task-input').value = '';
  document.getElementById('quick-task-priority').value = '';
  document.getElementById('quick-task-deadline').value = '';
  saveStore();
  renderProjectOverview();
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Init on load
if (typeof renderDashboard === 'undefined') {
  document.addEventListener('DOMContentLoaded', renderDashboard);
}

