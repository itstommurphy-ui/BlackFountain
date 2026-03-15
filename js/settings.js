// ══════════════════════════════════════════
// SETTINGS - EXPORT/IMPORT
// ══════════════════════════════════════════
function renderSettings() {
  const statsEl = document.getElementById('storage-stats');
  if (statsEl) {
    const dataStr = JSON.stringify(store);
    const bytes = new Blob([dataStr]).size;
    const kb = (bytes / 1024).toFixed(2);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    
    // Count all contacts (global + per-project)
    const globalContacts = store.contacts?.length || 0;
    const projectContacts = (store.projects || []).reduce((sum, p) => sum + (p.contacts?.length || 0), 0);
    const totalContacts = globalContacts + projectContacts;
    
    // Count all locations (global + per-project)
    const globalLocations = store.locations?.length || 0;
    const projectLocations = (store.projects || []).reduce((sum, p) => sum + (p.locations?.length || 0), 0);
    const totalLocations = globalLocations + projectLocations;
    
    statsEl.innerHTML = `
      Projects: ${store.projects?.length || 0}<br>
      Files: ${store.files?.length || 0}<br>
      Contacts: ${totalContacts} (${globalContacts} global + ${projectContacts} in projects)<br>
      Locations: ${totalLocations} (${globalLocations} global + ${projectLocations} in projects)<br>
      Team Members: ${store.teamMembers?.length || 0}<br>
      Approximate size: ${kb} KB (${mb} MB)
    `;
  }
  
  // Update theme button styles
  updateThemeButtons();
  updateFontSizeButtons();
}

function updateThemeButtons() {
  const currentTheme = localStorage.getItem('blackfountain_theme') || 'dark';
  const darkBtn = document.getElementById('theme-dark-btn');
  const lightBtn = document.getElementById('theme-light-btn');
  if (darkBtn && lightBtn) {
    const activeStyle = 'border-color:var(--accent) !important;background:var(--accent-dim) !important';
    const inactiveStyle = 'border-color:var(--border) !important';
    darkBtn.style.cssText = 'flex:1;padding:12px 16px' + (currentTheme === 'dark' ? ';' + activeStyle : ';' + inactiveStyle);
    lightBtn.style.cssText = 'flex:1;padding:12px 16px' + (currentTheme === 'light' ? ';' + activeStyle : ';' + inactiveStyle);
  }
}

function setTheme(theme) {
  localStorage.setItem('blackfountain_theme', theme);
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  updateThemeButtons();
  showToast(`Theme changed to ${theme}`, 'success');
}

function setFontSize(size) {
  localStorage.setItem('blackfountain_font_size', size);
  const html = document.documentElement;
  // Remove any previous font-size attribute then set new one
  html.removeAttribute('data-font-size');
  if (size !== 'classic') html.setAttribute('data-font-size', size);
  updateFontSizeButtons();
}

function updateFontSizeButtons() {
  const currentSize = localStorage.getItem('blackfountain_font_size') || 'classic';
  ['classic', 'bigger', 'evenbigger', 'huge', 'double'].forEach(size => {
    const btn = document.getElementById(`font-${size}-btn`);
    if (!btn) return;
    const active = currentSize === size;
    btn.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    btn.style.background  = active ? 'var(--accent-dim)' : 'var(--surface2)';
  });
}

function loadTheme() {
  const theme = localStorage.getItem('blackfountain_theme') || 'dark';
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  const fontSize = localStorage.getItem('blackfountain_font_size') || 'classic';
  if (fontSize !== 'classic') document.documentElement.setAttribute('data-font-size', fontSize);
}

function exportStore() {
  const dataStr = JSON.stringify(store, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `blackfountain-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data exported successfully', 'success');
}

function importStore(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    console.log('[import] onload fired, bytes:', e.target.result?.length);
    try {
      const imported = JSON.parse(e.target.result);
      console.log('[import] parsed OK, keys:', Object.keys(imported));
      if (!imported.projects && !imported.files && !imported.contacts) {
        console.log('[import] failed validation');
        showToast('Invalid backup file format', 'error');
        return;
      }
      window._importedData = imported;
      console.log('[import] _importedData set, opening modal');
      openModal('modal-import-data');
    } catch (err) {
      console.error('[import] parse error:', err);
      showToast('Error parsing backup file: ' + err.message, 'error');
    }
  };
  reader.onerror = function(e) { console.error('[import] FileReader error:', e); };
  reader.readAsText(file);
  input.value = '';
}

async function confirmImportStore() {
  const imported = window._importedData;
  if (!imported) {
    closeModal('modal-import-data');
    return;
  }

  Object.keys(store).forEach(k => delete store[k]);
  Object.assign(store, imported);
  await saveStore();
  closeModal('modal-import-data');
  sessionStorage.setItem('_mf_post_reload_toast', JSON.stringify({ msg: 'Import successful — your data is ready.', type: 'success' }));
  location.reload();
}

function clearAllData() {
  const confirmText = 'DELETE ALL DATA';
  const userInput = prompt('⚠️ WARNING: This will PERMANENTLY DELETE all your projects, contacts, locations, files, and settings. This action cannot be undone.\n\nTo confirm, type: ' + confirmText);
  
  if (userInput !== confirmText) {
    if (userInput) showToast('Confirmation did not match - data NOT deleted', 'error');
    return;
  }
  
  // Clear all Black Fountain related keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('blackfountain') || key.includes('filmforge'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  
  // Also try unregistering service worker for fresh start
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
  
  showToast('All data cleared - please refresh the page manually', 'success');
}

function openClearDataModal() {
  document.getElementById('clear-data-confirm').value = '';
  openModal('modal-clear-data');
}

function confirmClearAllData() {
  const confirmText = 'DELETE ALL DATA';
  const userInput = document.getElementById('clear-data-confirm').value;
  
  if (userInput !== confirmText) {
    showToast('Confirmation did not match - data NOT deleted', 'error');
    return;
  }
  
  closeModal('modal-clear-data');
  
  // Clear all Black Fountain related keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('blackfountain') || key.includes('filmforge'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => {
    localStorage.removeItem(k);
    console.log('Removed:', k);
  });

  // Clear IndexedDB
  openDB().then(db => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').clear();
    _idb = null;
  }).catch(() => indexedDB.deleteDatabase('blackfountain'));

  // Also clear session storage
  sessionStorage.clear();

  // Also try unregistering service worker for fresh start
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }

  // Reset store in memory and go to dashboard
  Object.keys(store).forEach(k => delete store[k]);
  Object.assign(store, { projects: [], teamMembers: [], currentProjectId: null, files: [], contacts: [], locations: [], contactColumns: [], contactCustomData: {}, contactHiddenCols: [], locationHiddenCols: [], locationColumns: [], locationCustomData: {}, moodboards: [] });
  showView('dashboard');
  showToast('All data has been deleted.', 'success');
}

function renderFiles() {
  populateFilesProjectFilter();
  const grid = document.getElementById('file-grid');
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';

  let files = (store.files || []);
  if (projectFilter !== 'all') {
    files = files.filter(f => fileProjectIds(f).includes(projectFilter));
  }
  if (currentFileCategory !== 'all') {
    files = files.filter(f => fileCategories(f).includes(currentFileCategory));
  }

  if (files.length === 0) {
    grid.innerHTML = `
      <div class="file-empty" style="grid-column:1/-1">
        <div class="file-empty-icon">📁</div>
        <div class="file-empty-text">No files yet</div>
        <div class="file-empty-hint">Upload scripts, photos, storyboards, contracts and more</div>
      </div>`;
    updateBulkBars();
    return;
  }

  const _fileCard = (file) => {
    const pids = fileProjectIds(file);
    const cats = fileCategories(file);
    const projectBadge = projectFilter === 'all' && pids.length > 0
      ? `<div style="margin-top:4px;font-size:9px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
           ${pids.map(pid => store.projects.find(p=>p.id===pid)?.title || '').filter(Boolean).join(', ')}
         </div>`
      : '';
    const catBadge = cats.map(c => `${FILE_CATEGORIES[c]?.icon || '📁'}`).join(' ');
    const peopleTags = (file.people || []).length
      ? `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;">${(file.people).map(n => `<span style="font-size:9px;padding:1px 5px;background:var(--surface3);border-radius:3px;color:var(--text2);">👤 ${n}</span>`).join('')}</div>`
      : '';
    return `
    <div class="file-card${selectedFileIds.has(file.id) ? ' selected' : ''}" data-file-id="${file.id}" data-ctx="file-card:${file.id}" onclick="fileCardClick(event,'${file.id}','files')">
      <div class="file-select-check" onclick="event.stopPropagation();toggleFileSelect('${file.id}','files')">${selectedFileIds.has(file.id) ? '✓' : ''}</div>
      <div class="file-card-actions">
        <button class="file-action-btn" onclick="event.stopPropagation();openManageFile('${file.id}')" title="Rename">✏️</button>
        <button class="file-action-btn" onclick="event.stopPropagation();openMoveFile(['${file.id}'],null)" title="Move to project">🔀</button>
        <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.id}')" title="Download">⬇</button>
        <button class="file-action-btn delete" onclick="event.stopPropagation();openRemoveFiles(['${file.id}'],null)" title="Remove / delete">🗑</button>
      </div>
      <div class="file-card-preview">${getFileIcon(file)}</div>
      <div class="file-card-name" title="${file.name}">${file.name}</div>
      <div class="file-card-meta">
        <span class="file-card-type">${catBadge}</span>
        <span>${formatFileSize(file.size)}</span>
      </div>
      ${file.description ? `<div style="margin-top:4px;font-size:10px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${file.description}">${file.description}</div>` : ''}
      ${peopleTags}
      ${projectBadge}
    </div>`;
  };

  if (currentFileCategory === 'location') {
    // Group by location name
    const groups = {};
    files.forEach(f => {
      const loc = (f.location || '').trim();
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(f);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      if (!a) return 1; if (!b) return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    const sectionHeading = label => `
      <div style="grid-column:1/-1;padding:6px 0 10px;margin-top:8px;border-bottom:1px solid var(--border2)">
        <span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);font-family:var(--font-mono)">📍 ${label}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:8px">${groups[label === '— No location —' ? '' : label].length} file${groups[label === '— No location —' ? '' : label].length !== 1 ? 's' : ''}</span>
      </div>`;
    grid.innerHTML = keys.map(loc =>
      sectionHeading(loc || '— No location —') + groups[loc].map(_fileCard).join('')
    ).join('');

  } else if (currentFileCategory === 'people') {
    // Build role → { personName → [files] } mapping
    const _getPersonRole = name => {
      const lc = name.toLowerCase();
      // Check global contacts
      const gc = (store.contacts || []).find(c => c.name && c.name.toLowerCase() === lc);
      if (gc) {
        if (gc.castRoles && gc.castRoles.length) return gc.castRoles[0];
        if (gc.crewRoles && gc.crewRoles.length) return gc.crewRoles[0];
        if (gc.defaultRole) return gc.defaultRole;
      }
      // Check project contacts
      for (const p of store.projects) {
        const pc = (p.contacts || []).find(c => c.name && c.name.toLowerCase() === lc);
        if (pc) {
          if (pc.castRoles && pc.castRoles.length) return pc.castRoles[0];
          if (pc.crewRoles && pc.crewRoles.length) return pc.crewRoles[0];
          if (pc.defaultRole) return pc.defaultRole;
          if (pc.roles && pc.roles.length && pc.roles[0] !== 'Cast' && pc.roles[0] !== 'Extra' && pc.roles[0] !== 'Contact') return pc.roles[0];
        }
        // Check unit roster for crew roles
        const ur = (p.unit || []).find(r => r.name && r.name.toLowerCase() === lc);
        if (ur && ur.role) return ur.role;
      }
      return '';
    };

    const rolePeople = {}; // role → { personName → [files] }
    files.forEach(f => {
      (f.people || []).forEach(personName => {
        const role = (_getPersonRole(personName) || '').trim() || '— No role —';
        if (!rolePeople[role]) rolePeople[role] = {};
        if (!rolePeople[role][personName]) rolePeople[role][personName] = [];
        rolePeople[role][personName].push(f);
      });
    });

    if (!Object.keys(rolePeople).length) {
      grid.innerHTML = `<div class="file-empty" style="grid-column:1/-1"><div class="file-empty-icon">👥</div><div class="file-empty-text">No people tagged in these files</div></div>`;
      updateBulkBars();
      return;
    }

    const roles = Object.keys(rolePeople).sort((a, b) => {
      if (a === '— No role —') return 1; if (b === '— No role —') return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    const _sn = n => { const p = (n || '').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).toLowerCase(); };

    let html = '';
    roles.forEach(role => {
      html += `<div style="grid-column:1/-1;padding:6px 0 10px;margin-top:8px;border-bottom:1px solid var(--border2)">
        <span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);font-family:var(--font-mono)">👤 ${role}</span>
      </div>`;
      const peopleInRole = rolePeople[role];
      const personNames = Object.keys(peopleInRole).sort((a, b) => _sn(a).localeCompare(_sn(b), undefined, { sensitivity: 'base' }));
      personNames.forEach(personName => {
        const personFiles = peopleInRole[personName];
        html += `<div style="grid-column:1/-1;padding:4px 0 6px;margin-top:4px;">
          <span style="font-size:11px;font-weight:600;color:var(--text2);">${personName}</span>
          <span style="font-size:10px;color:var(--text3);margin-left:8px">${personFiles.length} file${personFiles.length !== 1 ? 's' : ''}</span>
        </div>`;
        html += personFiles.map(_fileCard).join('');
      });
    });
    grid.innerHTML = html;

  } else {
    grid.innerHTML = files.map(_fileCard).join('');
  }
  updateBulkBars();
}

function renderOverviewFiles() {
  const grid = document.getElementById('overview-files-grid');
  if (!grid) return;
  const p = currentProject();
  if (!p) return;
  const projectId = p.id;
  const files = (store.files || []).filter(f => fileProjectIds(f).includes(projectId));

  if (files.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text3);font-size:12px;border:1px dashed var(--border2);border-radius:var(--radius);">No files yet — upload scripts, photos, contracts and more</div>`;
    updateBulkBars();
    return;
  }

  grid.innerHTML = files.map(file => {
    const cats = fileCategories(file);
    const catBadge = cats.map(c => `${FILE_CATEGORIES[c]?.icon || '📁'}`).join(' ');
    const peopleTags = (file.people || []).length
      ? `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;">${(file.people).map(n => `<span style="font-size:9px;padding:1px 5px;background:var(--surface3);border-radius:3px;color:var(--text2);">👤 ${n}</span>`).join('')}</div>`
      : '';
    return `
    <div class="file-card${selectedFileIds.has(file.id) ? ' selected' : ''}" data-file-id="${file.id}" data-ctx="file-card:${file.id}" onclick="fileCardClick(event,'${file.id}','overview')" style="font-size:11px;">
      <div class="file-select-check" onclick="event.stopPropagation();toggleFileSelect('${file.id}','overview')">${selectedFileIds.has(file.id) ? '✓' : ''}</div>
      <div class="file-card-actions">
        <button class="file-action-btn" onclick="event.stopPropagation();openManageFile('${file.id}')" title="Rename">✏️</button>
        <button class="file-action-btn" onclick="event.stopPropagation();openMoveFile(['${file.id}'],'${projectId}')" title="Move to project">🔀</button>
        <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.id}')" title="Download">⬇</button>
        <button class="file-action-btn delete" onclick="event.stopPropagation();openRemoveFiles(['${file.id}'],'${projectId}')" title="Remove from project">🗑</button>
      </div>
      <div class="file-card-preview">${getFileIcon(file)}</div>
      <div class="file-card-name" title="${file.name}">${file.name}</div>
      <div class="file-card-meta">
        <span class="file-card-type">${catBadge}</span>
        <span>${formatFileSize(file.size)}</span>
      </div>
      ${file.description ? `<div style="margin-top:4px;font-size:10px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${file.description}">${file.description}</div>` : ''}
      ${peopleTags}
    </div>`;
  }).join('');
  updateBulkBars();
}

// ── Multi-select ─────────────────────────────────────────────────────────────
function toggleFileSelect(id, context) {
  if (selectedFileIds.has(id)) selectedFileIds.delete(id);
  else selectedFileIds.add(id);
  if (context === 'files') renderFiles();
  else renderOverviewFiles();
}

function fileCardClick(event, id, context) {
  // If any are selected, clicking a card toggles selection instead of opening
  if (selectedFileIds.size > 0) {
    event.stopPropagation();
    toggleFileSelect(id, context);
  } else {
    viewFile(id);
  }
}

function getActivePid() {
  const p = currentProject();
  return p ? p.id : null;
}

// Returns array of selected IDs that are relevant in the given context
function getSelectedInContext(context) {
  if (context === 'overview') {
    const pid = getActivePid();
    return [...selectedFileIds].filter(id => {
      const f = (store.files || []).find(f => f.id === id);
      return f && (pid === null || fileProjectIds(f).includes(pid));
    });
  }
  return [...selectedFileIds];
}

function clearFileSelection() {
  selectedFileIds.clear();
  renderFiles();
  renderOverviewFiles();
}

function updateBulkBars() {
  const count = selectedFileIds.size;
  // Main files bar
  const bar = document.getElementById('files-bulk-bar');
  const cnt = document.getElementById('files-bulk-count');
  if (bar) { bar.classList.toggle('visible', count > 0); if (cnt) cnt.textContent = count; }
  // Overview bar
  const obar = document.getElementById('overview-files-bulk-bar');
  const ocnt = document.getElementById('overview-bulk-count');
  if (obar) {
    const pid = getActivePid();
    const overviewCount = pid !== null
      ? [...selectedFileIds].filter(id => { const f=(store.files||[]).find(f=>f.id===id); return f && fileProjectIds(f).includes(pid); }).length
      : count;
    obar.classList.toggle('visible', overviewCount > 0);
    if (ocnt) ocnt.textContent = overviewCount;
  }
}

// ── Rename ───────────────────────────────────────────────────────────────────
function openManageFile(id) {
  refreshRolesDatalist();
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;

  document.getElementById('manage-file-id').value = id;
  document.getElementById('manage-file-name').value = file.name;
  document.getElementById('manage-file-desc').value = file.description || '';

  const cats = fileCategories(file);

  // Build category checkboxes
  const catsEl = document.getElementById('manage-file-cats');
  catsEl.innerHTML = Object.entries(FILE_CATEGORIES).map(([k, v]) =>
    `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);cursor:pointer;white-space:nowrap;">
      <input type="checkbox" data-mfcat="${k}" ${cats.includes(k) ? 'checked' : ''} style="width:13px;height:13px;" onchange="mfCatChange()">
      ${v.icon} ${v.label}
    </label>`
  ).join('');

  // People tags
  const tagsEl = document.getElementById('mf-people-tags');
  tagsEl.innerHTML = '';
  document.getElementById('mf-people-input').value = '';
  document.getElementById('mf-people-dropdown').style.display = 'none';
  (file.people || []).forEach(name => {
    // Find their role from the project contacts if available
    let role = '';
    fileProjectIds(file).forEach(pid => {
      const proj = store.projects.find(p => p.id === pid);
      const contact = (proj?.contacts || []).find(c => c.name?.toLowerCase() === name.toLowerCase());
      if (contact && contact.roles && contact.roles.length) role = contact.roles.join(', ');
    });
    mfAddPersonTag(name, role);
  });

  // Project dropdown
  const currentPids = fileProjectIds(file);
  const activePid = currentPids[0] || '';
  document.getElementById('mf-project-select').innerHTML =
    `<option value="">— No project —</option>` +
    store.projects.map(proj =>
      `<option value="${proj.id}" ${proj.id === activePid ? 'selected' : ''}>${proj.title || 'Untitled Project'}</option>`
    ).join('');

  // Location dropdown — pull from all projects this file belongs to, plus current
  const allLocs = new Set();
  const pids = fileProjectIds(file);
  const currentPid = currentProject()?.id;
  [...new Set([...pids, currentPid].filter(Boolean))].forEach(pid => {
    const proj = store.projects.find(p => p.id === pid);
    (proj?.locations || []).forEach(l => { if (l.name) allLocs.add(l.name); });
  });
  const currentLoc = file.location || '';
  if (currentLoc) allLocs.add(currentLoc);

  const locSel = document.getElementById('mf-location-select');
  locSel.innerHTML = `<option value="">— None —</option>` +
    [...allLocs].sort().map(n => `<option value="${n}" ${n === currentLoc ? 'selected' : ''}>${n}</option>`).join('') +
    `<option value="__new__">+ Create new location…</option>`;
  document.getElementById('mf-location-new').value = '';
  document.getElementById('mf-location-new-row').style.display = 'none';

  // Show/hide conditional sections
  mfCatChange();

  openModal('modal-manage-file');
}

function mfCatChange() {
  const checked = [...document.querySelectorAll('#manage-file-cats [data-mfcat]:checked')].map(cb => cb.dataset.mfcat);
  document.getElementById('mf-people-section').style.display = checked.includes('people') ? 'block' : 'none';
  document.getElementById('mf-location-section').style.display = checked.includes('location') ? 'block' : 'none';
}

function mfLocationSelectChange() {
  document.getElementById('mf-location-new-row').style.display =
    document.getElementById('mf-location-select').value === '__new__' ? 'block' : 'none';
}

function mfProjectChange() {
  const pid = document.getElementById('mf-project-select').value;
  const locSel = document.getElementById('mf-location-select');
  const currentLoc = locSel.value === '__new__' ? '' : locSel.value;
  const allLocs = new Set();
  if (pid) {
    const proj = store.projects.find(p => p.id === pid);
    (proj?.locations || []).forEach(l => { if (l.name) allLocs.add(l.name); });
  }
  if (currentLoc) allLocs.add(currentLoc);
  locSel.innerHTML = `<option value="">— None —</option>` +
    [...allLocs].sort().map(n => `<option value="${n}" ${n === currentLoc ? 'selected' : ''}>${n}</option>`).join('') +
    `<option value="__new__">+ Create new location…</option>`;
  document.getElementById('mf-location-new-row').style.display = 'none';
  document.getElementById('mf-location-new').value = '';
}

function mfAddPersonTag(name, existingRole) {
  name = name.trim();
  if (!name) return;
  const tagsEl = document.getElementById('mf-people-tags');
  if ([...tagsEl.querySelectorAll('[data-mfperson]')].some(t => t.dataset.mfperson.toLowerCase() === name.toLowerCase())) return;

  const isNew = !getAllContactNames().some(n => n.toLowerCase() === name.toLowerCase());

  // For brand-new people, open the full contact creation modal
  if (isNew && !existingRole) {
    addNewContactFromMf(name);
    return;
  }

  const tag = document.createElement('span');
  tag.dataset.mfperson = name;
  tag.dataset.role = existingRole || '';
  tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = '👤 ' + name;
  tag.appendChild(nameSpan);

  const removeBtn = document.createElement('span');
  removeBtn.style.cssText = 'cursor:pointer;color:var(--text3);';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => tag.remove());
  tag.appendChild(removeBtn);

  tagsEl.appendChild(tag);
}

// Directly add a person chip (used after creating via full modal — no "is new" re-check)
function mfAddPersonTagDirect(name, role) {
  name = (name || '').trim();
  if (!name) return;
  const tagsEl = document.getElementById('mf-people-tags');
  if (!tagsEl) return;
  if ([...tagsEl.querySelectorAll('[data-mfperson]')].some(t => t.dataset.mfperson.toLowerCase() === name.toLowerCase())) return;

  const tag = document.createElement('span');
  tag.dataset.mfperson = name;
  tag.dataset.role = role || '';
  tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = '👤 ' + name;
  tag.appendChild(nameSpan);
  const removeBtn = document.createElement('span');
  removeBtn.style.cssText = 'cursor:pointer;color:var(--text3);';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => tag.remove());
  tag.appendChild(removeBtn);
  tagsEl.appendChild(tag);
}

function addNewContactFromMf(name) {
  _mfNewPersonCallback = name; // signal saveEditedContact to return to file modal
  addNewContact();
  document.getElementById('edit-contact-name-display').value = name;
  document.getElementById('edit-contact-name').value = '';
  // Show the modal title as "Add Contact" context
  const h3 = document.getElementById('edit-contact-modal-title');
  if (h3) h3.textContent = 'Add Contact';
}

function mfPeopleSearch(input) {
  const q = input.value.trim().toLowerCase();
  const dropdown = document.getElementById('mf-people-dropdown');
  if (!q) { dropdown.style.display = 'none'; return; }
  const tagged = new Set([...document.querySelectorAll('#mf-people-tags [data-mfperson]')].map(t => t.dataset.mfperson.toLowerCase()));
  const matches = getAllContactNames().filter(n => n.toLowerCase().includes(q) && !tagged.has(n.toLowerCase()));
  const showCreate = !getAllContactNames().some(n => n.toLowerCase() === q) && !tagged.has(q);
  const addAndClose = name => `mfAddPersonTag('${name.replace(/'/g,"\\'")}');document.getElementById('mf-people-input').value='';document.getElementById('mf-people-dropdown').style.display='none';`;
  let html = matches.map(n => `<div style="padding:7px 10px;cursor:pointer;font-size:12px;" onmousedown="event.preventDefault();${addAndClose(n)}">${n}</div>`).join('');
  if (showCreate) html += `<div style="padding:7px 10px;cursor:pointer;font-size:12px;color:var(--accent);${matches.length ? 'border-top:1px solid var(--border)' : ''}" onmousedown="event.preventDefault();mfAddPersonTag(document.getElementById('mf-people-input').value.trim());document.getElementById('mf-people-input').value='';document.getElementById('mf-people-dropdown').style.display='none';">+ Add "${input.value.trim()}"</div>`;
  dropdown.innerHTML = html;
  dropdown.style.display = html ? 'block' : 'none';
}

function mfPeopleKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const val = document.getElementById('mf-people-input').value.trim();
    if (val) { mfAddPersonTag(val); document.getElementById('mf-people-input').value = ''; document.getElementById('mf-people-dropdown').style.display = 'none'; }
  }
}

function confirmManageFile() {
  const id = document.getElementById('manage-file-id').value;
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;

  // Name & description
  const newName = document.getElementById('manage-file-name').value.trim();
  if (newName) file.name = newName;
  file.description = document.getElementById('manage-file-desc').value.trim();

  // Project
  const selectedPid = document.getElementById('mf-project-select').value;
  file.projectIds = selectedPid ? [selectedPid] : [];
  delete file.projectId;

  // Categories — migrate legacy single field
  const cats = [...document.querySelectorAll('#manage-file-cats [data-mfcat]:checked')].map(cb => cb.dataset.mfcat);
  file.categories = cats.length ? cats : ['other'];
  delete file.category;

  // People — update tags and add new ones to contacts (with roles)
  const peopleTags = [...document.querySelectorAll('#mf-people-tags [data-mfperson]')];
  const people = peopleTags.map(t => t.dataset.mfperson);
  file.people = people;
  if (people.length) {
    fileProjectIds(file).forEach(pid => {
      const proj = store.projects.find(p => p.id === pid);
      if (!proj) return;
      proj.contacts = proj.contacts || [];
      peopleTags.forEach(tag => {
        const name = tag.dataset.mfperson;
        const roleVal = (tag.dataset.role || '').trim();
        const roles = roleVal ? roleVal.split(',').map(r => r.trim()).filter(Boolean) : ['Contact'];
        const existingIdx = proj.contacts.findIndex(c => c.name?.toLowerCase() === name.toLowerCase());
        if (existingIdx >= 0) {
          if (roleVal) proj.contacts[existingIdx].roles = roles;
        } else {
          proj.contacts.push({ name, roles, phone: '', email: '', manual: true });
        }
      });
    });
  }

  // Location
  if (file.categories.includes('location')) {
    const sel = document.getElementById('mf-location-select');
    if (sel.value === '__new__') {
      const newLoc = document.getElementById('mf-location-new').value.trim();
      file.location = newLoc;
      if (newLoc) {
        const p = currentProject();
        if (p) {
          p.locations = p.locations || [];
          if (!p.locations.some(l => l.name.toLowerCase() === newLoc.toLowerCase()))
            p.locations.push({ name: newLoc, suit: 'possible', contacted: 'no', recce: 'no', decision: '' });
        }
      }
    } else {
      file.location = sel.value;
    }
  } else {
    file.location = '';
  }

  saveStore();
  closeModal('modal-manage-file');
  renderFiles(); renderOverviewFiles();
  showToast('File updated', 'success');
}

// ── Move (single or bulk) ────────────────────────────────────────────────────
function openMoveFile(ids, sourcePid) {
  if (!ids || ids.length === 0) return;
  if (!store.projects || store.projects.length === 0) { showToast('No projects exist', 'error'); return; }
  // For move options: union of projects files are NOT in
  const allPids = new Set();
  ids.forEach(id => {
    const f = (store.files||[]).find(f=>f.id===id);
    if (f) fileProjectIds(f).forEach(p => allPids.add(p));
  });
  const options = store.projects
    .map((p, i) => !allPids.has(p.id) || ids.length > 1
      ? `<option value="${i}">${p.title || 'Untitled Project'}</option>` : '')
    .filter(Boolean).join('');

  // For multi-file, show all projects as targets
  const fullOptions = store.projects
    .map((p, i) => `<option value="${i}">${p.title || 'Untitled Project'}</option>`).join('');

  const targetOptions = ids.length === 1
    ? (() => {
        const pids = fileProjectIds((store.files||[]).find(f=>f.id===ids[0])||{});
        return store.projects.map((p,i) => pids.includes(p.id) ? '' : `<option value="${i}">${p.title||'Untitled'}</option>`).filter(Boolean).join('');
      })()
    : fullOptions;

  if (!targetOptions) { showToast('No other projects to move to', 'info'); return; }

  const sourceLabel = sourcePid !== null && sourcePid !== undefined
    ? (store.projects.find(p => p.id === sourcePid)?.title || 'this project')
    : (ids.length === 1
        ? (() => { const pids = fileProjectIds((store.files||[]).find(f=>f.id===ids[0])||{}); return pids.length===1 ? (store.projects.find(p => p.id === pids[0])?.title||'this project') : 'current projects'; })()
        : 'current projects');

  document.getElementById('move-file-ids-store').dataset.ids = JSON.stringify(ids);
  document.getElementById('move-file-source-pid').value = sourcePid ?? '';
  document.getElementById('move-file-target').innerHTML = targetOptions;
  document.getElementById('move-file-keep-copy').checked = false;
  document.getElementById('move-file-source-label').textContent = sourceLabel;
  document.getElementById('move-file-title').textContent = ids.length > 1 ? `MOVE ${ids.length} FILES` : 'MOVE FILE';
  openModal('modal-move-file');
}

function confirmMoveFile() {
  const ids = JSON.parse(document.getElementById('move-file-ids-store').dataset.ids || '[]');
  const sourcePid = document.getElementById('move-file-source-pid').value || null;
  const targetIdx = parseInt(document.getElementById('move-file-target').value);
  const keepCopy = document.getElementById('move-file-keep-copy').checked;
  if (isNaN(targetIdx)) return;
  const targetPid = store.projects[targetIdx]?.id;
  if (!targetPid) return;

  ids.forEach(id => {
    const file = (store.files||[]).find(f=>f.id===id);
    if (!file) return;
    if (!Array.isArray(file.projectIds)) { file.projectIds = fileProjectIds(file); delete file.projectId; }
    if (!file.projectIds.includes(targetPid)) file.projectIds.push(targetPid);
    if (!keepCopy && sourcePid !== null) {
      file.projectIds = file.projectIds.filter(p => p !== sourcePid);
    }
  });

  saveStore();
  closeModal('modal-move-file');
  clearFileSelection();
  showToast(`${ids.length > 1 ? ids.length + ' files' : 'File'} moved to ${store.projects[targetIdx]?.title || 'project'}`, 'success');
}

// ── Remove / Delete (single or bulk) ────────────────────────────────────────
function openRemoveFiles(ids, sourcePid) {
  if (!ids || ids.length === 0) return;
  // sourcePid can be either a project ID string or array index - handle both
  const projectName = sourcePid !== null && sourcePid !== undefined
    ? (typeof sourcePid === 'string' 
        ? (store.projects.find(p => p.id === sourcePid)?.title || 'this project')
        : (store.projects[sourcePid]?.title || 'this project')) : null;
  const count = ids.length;
  const fileWord = count > 1 ? `${count} files` : `"${(store.files||[]).find(f=>f.id===ids[0])?.name || 'file'}"`;

  document.getElementById('remove-file-ids-store').dataset.ids = JSON.stringify(ids);
  document.getElementById('remove-file-source-pid').value = sourcePid ?? '';
  document.getElementById('remove-file-title').textContent = count > 1 ? `REMOVE ${count} FILES` : 'REMOVE FILE';

  if (projectName) {
    document.getElementById('remove-file-body').innerHTML =
      `Remove ${fileWord} from <strong style="color:var(--text)">${projectName}</strong>? The file${count>1?'s':''} will remain accessible from other projects and the Files tab.`;
    document.getElementById('remove-file-delete-label').textContent =
      `Also permanently delete from the site entirely (removes from all projects)`;
  } else {
    document.getElementById('remove-file-body').innerHTML =
      `Remove ${fileWord} from this project? The file${count>1?'s':''} will remain accessible from other projects and the Files tab.`;
    document.getElementById('remove-file-delete-label').textContent =
      `Also permanently delete from the site entirely`;
  }

  document.getElementById('remove-file-also-delete').checked = false;
  // Show the delete-entirely row only when there's a source project (i.e. project dashboard context)
  // On global files tab with no project, only option is delete entirely
  if (sourcePid === null || sourcePid === undefined) {
    document.getElementById('remove-file-body').innerHTML =
      `Permanently delete ${fileWord}? This removes ${count>1?'them':'it'} from all projects and cannot be undone.`;
    document.getElementById('remove-file-delete-row').style.display = 'none';
    document.getElementById('remove-file-also-delete').checked = true;
  } else {
    document.getElementById('remove-file-delete-row').style.display = 'flex';
  }

  openModal('modal-remove-file');
}

function confirmRemoveFiles() {
  const ids = JSON.parse(document.getElementById('remove-file-ids-store').dataset.ids || '[]');
  const sourcePid = document.getElementById('remove-file-source-pid').value || null;
  const alsoDelete = document.getElementById('remove-file-also-delete').checked;

  if (alsoDelete) {
    store.files = (store.files||[]).filter(f => !ids.includes(f.id));
  } else if (sourcePid !== null) {
    ids.forEach(id => {
      const file = (store.files||[]).find(f=>f.id===id);
      if (!file) return;
      if (!Array.isArray(file.projectIds)) { file.projectIds = fileProjectIds(file); delete file.projectId; }
      file.projectIds = file.projectIds.filter(p => p !== sourcePid);
    });
  }

  saveStore();
  closeModal('modal-remove-file');
  clearFileSelection();
  showToast(alsoDelete ? `${ids.length > 1 ? ids.length + ' files' : 'File'} deleted` : `Removed from project`, alsoDelete ? 'info' : 'info');
}

// ── Legacy stubs ─────────────────────────────────────────────────────────────
function removeFileFromProject(id, pid) { openRemoveFiles([id], pid); }
function openDeleteFileConfirm(id) { openRemoveFiles([id], null); }
function confirmDeleteFileEntirely() {}
function manageFileDelete() {}
function deleteFile(id) { openRemoveFiles([id], null); }
function deleteFileFromOverview(id) { const p = currentProject(); openRemoveFiles([id], p ? p.id : null); }
function confirmDeleteFile() {}
function renameFile(id) { openManageFile(id); }
function confirmRenameFile() {}

function handleFileUploadFromOverview(fileList) {
  const p = currentProject();
  const presetProjectId = p ? p.id : null;
  handleFileUpload(fileList, presetProjectId);
}

function handleFileUpload(fileList, presetProjectId) {
  if (!fileList || fileList.length === 0) return;
  refreshRolesDatalist();
  _pendingFiles = [];

  // Populate project selector
  const projSelect = document.getElementById('upload-project-select');
  const currentProjId = presetProjectId ?? currentProject()?.id;
  projSelect.innerHTML = store.projects.map(proj =>
    `<option value="${proj.id}" ${proj.id === currentProjId ? 'selected' : ''}>${proj.title || 'Untitled Project'}</option>`
  ).join('');

  const container = document.getElementById('upload-file-list');
  container.innerHTML = '';

  Array.from(fileList).forEach((file, idx) => {
    const suggestedCat = getFileCategory(file.name);
    const nameNoExt = file.name.replace(/\.[^.]+$/, '');
    _pendingFiles.push({ file, dataUrl: null });

    const isImage = file.type.startsWith('image/');
    const row = document.createElement('div');
    row.style.cssText = 'border:1px solid var(--border2);border-radius:var(--radius);padding:12px;background:var(--surface2);';

    // Build category checkboxes
    const catChecks = Object.entries(FILE_CATEGORIES).map(([k,v]) =>
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);cursor:pointer;white-space:nowrap;">
        <input type="checkbox" data-idx="${idx}" data-field="cat-${k}" ${k===suggestedCat?'checked':''} style="width:13px;height:13px;" onchange="uploadRowCatChange(this,${idx})">
        ${v.icon} ${v.label}
      </label>`
    ).join('');

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div data-thumb style="width:52px;height:52px;border-radius:6px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;">
          ${getFileIcon({name:file.name, data:'', category:suggestedCat})}
        </div>
        <span style="font-size:11px;color:var(--text3);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name} · ${formatFileSize(file.size)}</span>
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Display Name</label>
        <input class="form-input" data-idx="${idx}" data-field="name" value="${nameNoExt}" style="font-size:12px;">
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Categories</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 10px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);">
          ${catChecks}
        </div>
      </div>
      <div data-people-section-${idx} style="display:${suggestedCat==='people'?'block':'none'};margin-bottom:10px;">
        <label class="form-label">Who's in this?</label>
        <div data-people-tags-${idx} style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;min-height:10px;"></div>
        <div style="display:flex;gap:6px;">
          <div style="position:relative;flex:1;">
            <input class="form-input" data-idx="${idx}" data-field="people-input" placeholder="Search or add person…" style="font-size:12px;" autocomplete="off"
              oninput="uploadPeopleSearch(this,${idx})" onkeydown="uploadPeopleKey(event,${idx})">
            <div data-people-dropdown-${idx} style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);z-index:50;max-height:140px;overflow-y:auto;box-shadow:var(--shadow);"></div>
          </div>
        </div>
        <div style="margin-top:6px;font-size:10px;color:var(--text3);">People not already in contacts will be added when you upload.</div>
      </div>
      <div data-location-section-${idx} style="display:${suggestedCat==='location'?'block':'none'};margin-bottom:10px;">
        <label class="form-label">Link to Location</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <select class="form-select" data-idx="${idx}" data-field="location-select" style="font-size:12px;flex:1;" onchange="uploadLocationSelectChange(this,${idx})">
            <option value="">— Select existing location —</option>
            ${(currentProject()?.locations || []).map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
            <option value="__new__">+ Create new location…</option>
          </select>
        </div>
        <div data-new-location-${idx} style="display:none;margin-top:6px;">
          <input class="form-input" data-idx="${idx}" data-field="location-new" placeholder="New location name…" style="font-size:12px;">
          <div style="margin-top:4px;font-size:10px;color:var(--text3);">This location will be added to the project when you upload.</div>
        </div>
      </div>
      <div>
        <label class="form-label">Description / Notes <span style="color:var(--text3);font-weight:400">(optional)</span></label>
        <input class="form-input" data-idx="${idx}" data-field="description" placeholder="e.g. Final draft, Location scout photos…" style="font-size:12px;">
      </div>
      <div data-alt-section-${idx} style="display:${isImage?'block':'none'};margin-top:10px;">
        <label class="form-label">Alt Text <span style="color:var(--text3);font-weight:400">(for accessibility)</span></label>
        <input class="form-input" data-idx="${idx}" data-field="altText" placeholder="Describe the image for screen readers" style="font-size:12px;">
      </div>`;
    container.appendChild(row);

    const reader = new FileReader();
    reader.onload = e => {
      _pendingFiles[idx].dataUrl = e.target.result;
      if (isImage) {
        const thumb = row.querySelector('[data-thumb]');
        if (thumb) thumb.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    };
    reader.readAsDataURL(file);
  });

  openModal('modal-upload-file');
  document.getElementById('file-input').value = '';
}

function cancelFileUpload() {
  _pendingFiles = [];
  closeModal('modal-upload-file');
}

// Show/hide people/location sections when categories are toggled
function uploadRowCatChange(checkbox, idx) {
  const field = checkbox.dataset.field; // e.g. 'cat-people' or 'cat-location'
  if (field === 'cat-people') {
    const section = document.querySelector(`[data-people-section-${idx}]`);
    if (section) section.style.display = checkbox.checked ? 'block' : 'none';
  }
  if (field === 'cat-location') {
    const section = document.querySelector(`[data-location-section-${idx}]`);
    if (section) section.style.display = checkbox.checked ? 'block' : 'none';
  }
}

function uploadLocationSelectChange(select, idx) {
  const newRow = document.querySelector(`[data-new-location-${idx}]`);
  if (newRow) newRow.style.display = select.value === '__new__' ? 'block' : 'none';
}

// Build list of all contacts across all projects for autocomplete
function getAllContactNames() {
  const seen = new Set();
  (store.projects || []).forEach(p => {
    (p.contacts || []).forEach(c => { if (c.name) seen.add(c.name); });
  });
  return [...seen].sort();
}

function uploadPeopleSearch(input, idx) {
  const q = input.value.trim().toLowerCase();
  const dropdown = document.querySelector(`[data-people-dropdown-${idx}]`);
  if (!dropdown) return;
  if (!q) { dropdown.style.display = 'none'; return; }

  const existing = getAllContactNames();
  const tagged = new Set([...document.querySelectorAll(`[data-people-tag-idx="${idx}"]`)].map(t => t.dataset.name.toLowerCase()));
  const matches = existing.filter(n => n.toLowerCase().includes(q) && !tagged.has(n.toLowerCase()));

  const showCreate = !existing.some(n => n.toLowerCase() === q) && !tagged.has(q);
  let html = matches.map(n =>
    `<div style="padding:7px 10px;cursor:pointer;font-size:12px;" onmousedown="event.preventDefault();uploadAddPerson('${n.replace(/'/g,"\\'")}',${idx})">${n}</div>`
  ).join('');
  if (showCreate) html += `<div style="padding:7px 10px;cursor:pointer;font-size:12px;color:var(--accent);border-top:${matches.length?'1px solid var(--border)':'none'}" onmousedown="event.preventDefault();uploadAddPerson(document.querySelector('[data-idx=\\'${idx}\\'][data-field=\\'people-input\\']').value.trim(),${idx})">+ Add "${input.value.trim()}"</div>`;

  dropdown.innerHTML = html;
  dropdown.style.display = html ? 'block' : 'none';
}

function uploadPeopleKey(event, idx) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = document.querySelector(`[data-idx="${idx}"][data-field="people-input"]`);
    const val = input?.value.trim();
    if (val) uploadAddPerson(val, idx);
  }
}

function uploadAddPerson(name, idx) {
  name = name.trim();
  if (!name) return;
  const tagsEl = document.querySelector(`[data-people-tags-${idx}]`);
  const dropdown = document.querySelector(`[data-people-dropdown-${idx}]`);
  const input = document.querySelector(`[data-idx="${idx}"][data-field="people-input"]`);
  if (!tagsEl) return;

  // Prevent duplicates
  if ([...tagsEl.querySelectorAll('[data-people-tag-idx]')].some(t => t.dataset.name.toLowerCase() === name.toLowerCase())) return;

  const isNew = !getAllContactNames().some(n => n.toLowerCase() === name.toLowerCase());

  const tag = document.createElement('span');
  tag.dataset.peopleTagIdx = idx;
  tag.dataset.name = name;
  tag.dataset.role = '';
  tag.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = '👤 ' + name;
  tag.appendChild(nameSpan);

  // For new contacts, show a small role input inside the tag
  if (isNew) {
    const roleInput = document.createElement('input');
    roleInput.placeholder = 'role…';
    roleInput.setAttribute('list', 'roles-datalist');
    roleInput.style.cssText = 'width:70px;font-size:10px;padding:1px 4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);outline:none;';
    roleInput.addEventListener('input', () => { tag.dataset.role = roleInput.value.trim(); });
    roleInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    tag.appendChild(roleInput);
  }

  const removeBtn = document.createElement('span');
  removeBtn.style.cssText = 'cursor:pointer;color:var(--text3);margin-left:2px;';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => tag.remove());
  tag.appendChild(removeBtn);

  tagsEl.appendChild(tag);

  if (input) input.value = '';
  if (dropdown) dropdown.style.display = 'none';
}


function confirmFileUpload() {
  const container = document.getElementById('upload-file-list');
  const projectId = document.getElementById('upload-project-select').value;
  let saved = 0;

  _pendingFiles.forEach((pending, idx) => {
    if (!pending.dataUrl) return;
    const nameEl = container.querySelector(`[data-idx="${idx}"][data-field="name"]`);
    const descEl = container.querySelector(`[data-idx="${idx}"][data-field="description"]`);
    const altTextEl = container.querySelector(`[data-idx="${idx}"][data-field="altText"]`);
    const ext = pending.file.name.split('.').pop().toLowerCase();
    const displayName = (nameEl?.value.trim() || pending.file.name) + (nameEl?.value.includes('.') ? '' : '.' + ext);

    // Collect checked categories
    const cats = Object.keys(FILE_CATEGORIES).filter(k => {
      const cb = container.querySelector(`[data-idx="${idx}"][data-field="cat-${k}"]`);
      return cb && cb.checked;
    });
    if (cats.length === 0) cats.push('other');

    // Collect tagged people
    const peopleTags = container.querySelectorAll(`[data-people-tag-idx="${idx}"]`);
    const people = [...peopleTags].map(t => t.dataset.name).filter(Boolean);

    // Add new people to project contacts if not already there
    const projForUpload = store.projects.find(p => p.id === projectId);
    if (people.length > 0 && projForUpload) {
      const proj = projForUpload;
      proj.contacts = proj.contacts || [];
      peopleTags.forEach(tagEl => {
        const name = tagEl.dataset.name;
        if (!name) return;
        const exists = proj.contacts.some(c => c.name && c.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          const roleVal = (tagEl.dataset.role || '').trim();
          const roles = roleVal ? roleVal.split(',').map(r => r.trim()).filter(Boolean) : ['Contact'];
          proj.contacts.push({ name, roles, phone: '', email: '', manual: true });
        }
      });
    }

    // Collect linked location
    let location = '';
    if (cats.includes('location')) {
      const locSel = container.querySelector(`[data-idx="${idx}"][data-field="location-select"]`);
      if (locSel?.value === '__new__') {
        const locNew = container.querySelector(`[data-idx="${idx}"][data-field="location-new"]`);
        location = locNew?.value.trim() || '';
        // Add new location to project if not already there
        if (location && projForUpload) {
          const proj = projForUpload;
          proj.locations = proj.locations || [];
          if (!proj.locations.some(l => l.name.toLowerCase() === location.toLowerCase())) {
            proj.locations.push({ name: location, suit: 'possible', contacted: 'no', recce: 'no', decision: '' });
          }
        }
      } else {
        location = locSel?.value || '';
      }
    }

    store.files = store.files || [];
    store.files.push({
      id: makeId(),
      name: displayName,
      categories: cats,
      people,
      location,
      description: descEl?.value.trim() || '',
      altText: altTextEl?.value.trim() || '',
      type: pending.file.type,
      size: pending.file.size,
      data: pending.dataUrl,
      projectIds: [projectId],
      uploadedAt: new Date().toISOString(),
    });
    saved++;
  });

  saveStore();
  _pendingFiles = [];
  closeModal('modal-upload-file');
  renderFiles();
  renderOverviewFiles();
  showToast(`${saved} file${saved !== 1 ? 's' : ''} uploaded`, 'success');
}

function downloadFile(id) {
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;
  const link = document.createElement('a');
  link.href = file.data;
  link.download = file.name;
  link.click();
}

function viewFile(id) {
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;
  const win = window.open();
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.data.startsWith('data:image')) {
    win.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${file.data}" alt="${file.altText || file.name}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
  } else if (ext === 'pdf') {
    win.document.write(`<!DOCTYPE html><html><head><title>${file.name}</title><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{height:100%;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${file.data}"></iframe></body></html>`);
  } else {
    win.document.write(`<html><head><title>${file.name}</title></head><body style="margin:0;padding:20px;font-family:sans-serif;background:#f5f5f5"><div style="background:white;padding:40px;border-radius:8px;max-width:600px;margin:40px auto"><h2 style="margin-bottom:12px">${file.name}</h2><p style="color:#666;margin-bottom:20px">${formatFileSize(file.size)}</p><a href="${file.data}" download="${file.name}" style="background:#e6bc3c;color:#000;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:600">Download</a></div></body></html>`);
  }
  win.document.close();
}

// Reusable drag-and-drop helper — attach to any element
function _makeDrop(el, fn) {
  if (!el || el._dropAttached) return;
  el._dropAttached = true;
  el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('dragover'); });
  el.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    el.classList.remove('dragover');
    if (e.dataTransfer.files.length) fn(e.dataTransfer.files);
  });
}

// File tab switching
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('file-tabs').addEventListener('click', function(e) {
    if (e.target.classList.contains('file-tab')) {
      document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFileCategory = e.target.dataset.category;
      renderFiles();
    }
  });

  // Main file upload zone (Files tab)
  _makeDrop(document.getElementById('file-upload-zone'), handleFileUpload);

  // Overview project files area
  const ovFilesGrid = document.getElementById('overview-files-grid');
  if (ovFilesGrid) {
    ovFilesGrid.classList.add('drop-zone');
    _makeDrop(ovFilesGrid, handleFileUploadFromOverview);
  }

  // Script & Docs section
  const sectionScript = document.getElementById('section-script');
  if (sectionScript) {
    sectionScript.classList.add('drop-zone');
    _makeDrop(sectionScript, handleScriptUpload);
  }
});

const EQUIP_CATEGORIES = [
  'Camera','Glass (Lenses)','Batteries','Grip Equipment','Accessories',
  'Lighting','Camera Support','Audio','Adapters',
  'Computer & Tech','Light Modifiers','Miscellaneous'
];

const UNIT_DEPTS = [
  'Production','Direction','Script','Camera','Sound',
  'Lights','Makeup','Behind-the-Scenes','Post-Production','Other'
];

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function getProject(id) { return store.projects.find(p => p.id === id); }
function currentProject() { return getProject(store.currentProjectId); }

function defaultProject(data) {
  return {
    id: makeId(),
    title: data.title || 'Untitled',
    num: data.num || '001',
    status: data.status || 'pre',
    director: data.director || '',
    producer: data.producer || '',
    company: data.company || '',
    genre: data.genre || '',
    notes: data.notes || '',
    logline: data.logline || '',
    synopsis: data.synopsis || '',
    outline: data.outline || '',
    cast: [],
    extras: [],
    unit: [],
    budget: [],
    equipment: {},
    locations: [],
    scoutingSheets: [],
    breakdown: [],
    scriptBreakdown: { rawText: '', tags: [] },
    callsheets: [],
    schedule: [],
    scripts: [],
    brief: { template: null, fields: {}, removedKeys: [], customFields: [] },
    customSections: [],
    createdAt: Date.now()
  };
}

let _activeSection = null;

function relativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return mins + 'm ago';
  const hours = Math.floor(diff / 3600000);
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hours < 24) return 'Today ' + hhmm;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'Yesterday ' + hhmm;
  if (days < 7)   return days + ' days ago';
  if (days < 30)  return Math.floor(days / 7) + 'w ago';
  return d.toLocaleDateString();
}

// ── IndexedDB storage (no size limit vs localStorage's ~5MB) ─────────────────
let _idb = null;
function openDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('blackfountain', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}

async function saveStore() {
  // Record section activity for the active section
  const p = currentProject();
  if (p && _activeSection && _activeSection !== 'overview') {
    if (!p.sectionActivity) p.sectionActivity = {};
    p.sectionActivity[_activeSection] = Date.now();
  }
  // flash save indicator
  const ind = document.getElementById('save-indicator');
  if (ind) {
    ind.style.opacity = '1';
    clearTimeout(window._saveFlashT);
    window._saveFlashT = setTimeout(() => ind.style.opacity = '0', 2000);
  }
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(store, 'v1');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) {
    console.error('[saveStore] IndexedDB write failed:', e);
    showToast('Data could not be saved.', 'error');
  }
}

function manualSave() {
  saveStore();
  showToast('Project saved ✓', 'success');
}

// ══════════════════════════════════════════
// AUTOSAVE SYSTEM
// ══════════════════════════════════════════
let _autoSaveTimer = null;
let _lastAutoSave = 0;

function initAutoSave() {
  // Auto-save every 30 seconds
  _autoSaveTimer = setInterval(() => {
    const now = Date.now();
    if (now - _lastAutoSave > 30000) { // 30 seconds
      saveStore();
      _lastAutoSave = now;
    }
  }, 10000); // Check every 10 seconds
  
  // Save on page unload
  window.addEventListener('beforeunload', () => {
    saveStore();
  });
  
  // Save when tab becomes hidden (user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveStore();
    }
  });
}

function triggerAutoSave() {
  _lastAutoSave = Date.now();
  saveStore();
}

async function loadStore() {
  let loaded = null;
  let migrateFromLS = false;

  try {
    const db = await openDB();
    loaded = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('v1');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch(e) {
    console.error('[loadStore] IDB error, trying localStorage:', e);
  }

  if (!loaded) {
    // First run or IDB unavailable — try localStorage
    try {
      const raw = localStorage.getItem('blackfountain_v1');
      if (raw) { loaded = JSON.parse(raw); migrateFromLS = true; }
    } catch(e) {}
  }

  if (loaded) {
    Object.assign(store, loaded);
    if (!store.files) store.files = [];
    if (!store.contacts) store.contacts = [];
    if (!store.locations) store.locations = [];
    if (!store.contactColumns) store.contactColumns = [];
    if (!store.contactCustomData) store.contactCustomData = {};
    if (!store.contactHiddenCols) store.contactHiddenCols = [];
    if (!store.locationHiddenCols) store.locationHiddenCols = [];
    if (!store.locationColumns) store.locationColumns = [];
    if (!store.locationCustomData) store.locationCustomData = {};
    if (!store.moodboards) store.moodboards = [];
    // Migrate: convert legacy integer projectIds (array indices) to project UUID strings
    store.files.forEach(f => {
      if (f.projectIds) {
        f.projectIds = f.projectIds.map(pid => {
          if (typeof pid === 'number') return store.projects[pid]?.id ?? null;
          return pid;
        }).filter(Boolean);
      }
      if (typeof f.projectId === 'number') {
        f.projectId = store.projects[f.projectId]?.id ?? null;
      }
    });
    // Validate currentProjectId - clear if project no longer exists
    if (store.currentProjectId) {
      const projExists = store.projects?.some(p => p.id === store.currentProjectId);
      if (!projExists) store.currentProjectId = null;
    }
    // One-time migration: write localStorage data into IDB then clean up
    if (migrateFromLS) {
      await saveStore();
      localStorage.removeItem('blackfountain_v1');
      console.log('[loadStore] migrated data from localStorage to IndexedDB');
    }
  }
}

// ══════════════════════════════════════════
