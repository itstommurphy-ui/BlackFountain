// ══════════════════════════════════════════
// SETTINGS - EXPORT/IMPORT
// ══════════════════════════════════════════
let _lastCloudPush = 0;
const CLOUD_PUSH_INTERVAL = 0;

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
  renderContactLinkStats();
  renderSaveSlots();
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
  store.preferences = store.preferences || {};
  store.preferences.theme = theme;
  saveStore();
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  updateThemeButtons();
}

function setFontSize(size) {
  localStorage.setItem('blackfountain_font_size', size);
  store.preferences = store.preferences || {};
  store.preferences.fontSize = size;
  saveStore();
  const html = document.documentElement;
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
  const theme = store.preferences?.theme || localStorage.getItem('blackfountain_theme') || 'dark';
  const fontSize = store.preferences?.fontSize || localStorage.getItem('blackfountain_font_size') || 'classic';
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  if (fontSize !== 'classic') document.documentElement.setAttribute('data-font-size', fontSize);
  localStorage.setItem('blackfountain_theme', theme);
  localStorage.setItem('blackfountain_font_size', fontSize);
}

function exportStore() {
  try {
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
    if (typeof showToast === 'function') {
      showToast('Data exported successfully', 'success');
    }
  } catch (err) {
    console.error('Export failed:', err);
    alert('Failed to export data: ' + err.message);
  }
}

// Emergency backup: triggers when localStorage fails, creates downloadable file
function createEmergencyBackup(reason) {
  console.warn('[EmergencyBackup] Triggered:', reason);
  try {
    const dataStr = JSON.stringify(store);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0,19).replace(/:/g,'-');
    a.href = url;
    a.download = `EMERGENCY-BACKUP-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('⚠️ Emergency backup downloaded! Save this file safely.', 'error', 10000);
    // Store in sessionStorage as last resort
    sessionStorage.setItem('_emergency_backup_reason', reason);
    sessionStorage.setItem('_emergency_backup_time', Date.now().toString());
    console.log('[EmergencyBackup] Download initiated');
  } catch(e) {
    console.error('[EmergencyBackup] Failed to create download:', e);
    showToast('⚠️ CRITICAL: Could not create backup file! Data may be lost!', 'error', 15000);
  }
}

// Check for previous emergency backup on load
function checkEmergencyBackup() {
  const reason = sessionStorage.getItem('_emergency_backup_reason');
  const time = sessionStorage.getItem('_emergency_backup_time');
  if (reason) {
    sessionStorage.removeItem('_emergency_backup_reason');
    sessionStorage.removeItem('_emergency_backup_time');
    const minutesAgo = time ? Math.round((Date.now() - parseInt(time)) / 60000) : 'unknown';
    showToast(`⚠️ Previous session had data issues (${reason}). Consider importing a backup if data is missing.`, 'error', 15000);
  }
}

function importStore(input) {
  const file = input.files[0];
  if (!file) return;
  
  // Warn if file is very large (>50MB)
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 50) {
    showToast(`Warning: Large file (${fileSizeMB.toFixed(1)}MB). Import may take a while.`, 'info', 5000);
  }
  
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

  try {
    // Clear existing store and merge imported data
    Object.keys(store).forEach(k => delete store[k]);
    Object.assign(store, imported);
    
    // Ensure all required keys exist
    if (!store.projects) store.projects = [];
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
    
    console.log('[confirmImportStore] Starting save...');
    await saveStore();
    console.log('[confirmImportStore] Save complete, reloading...');
  } catch (err) {
    console.error('[confirmImportStore] Save failed:', err);
    showToast('Failed to save data: ' + err.message, 'error');
    closeModal('modal-import-data');
    return;
  }
  
  closeModal('modal-import-data');
  sessionStorage.setItem('_mf_post_reload_toast', JSON.stringify({ msg: 'Import successful — your data is ready.', type: 'success' }));
  // Reload after save completes
  location.reload();
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
  renderFolderNav();
  updateStorageDisplay();
  
  const grid = document.getElementById('file-grid');
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';
  
  // Get search query
  const searchInput = document.getElementById('files-search-input');
  currentFilesSearch = searchInput ? searchInput.value.toLowerCase() : '';

  // Ensure tab listeners are attached
  const tabs = document.getElementById('file-tabs');
  if (tabs) {
    if (!tabs._listenerAttached) {
      tabs.addEventListener('click', function(e) {
        const tab = e.target.closest('.file-tab');
        if (tab) {
          currentFileCategory = tab.dataset.category;
          renderFiles();
        }
      });
      tabs._listenerAttached = true;
    }
    // Sync active state
    tabs.querySelectorAll('.file-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.category === currentFileCategory);
    });
  }

  // Ensure file upload drop zone is attached
  const uploadZone = document.getElementById('file-upload-zone');
  if (uploadZone) {
    uploadZone.classList.add('drop-zone');
    _makeDrop(uploadZone, handleFileUpload);
  }

  // Get folders for current context
  let folders = [];
  if (filesViewMode === 'all') {
    folders = (store.folders || []).filter(f => {
      if (projectFilter !== 'all' && f.projectId !== projectFilter) return false;
      return f.parentId === currentFolderId;
    });
  }

  // Get files based on view mode
  let files = [];
  
  if (filesViewMode === 'recent') {
    // Recent files view - show all recent files regardless of folder
    files = getRecentFiles(50);
  } else if (filesViewMode === 'starred') {
    // Starred files view
    files = getStarredFiles();
  } else {
    // Normal folder view - files without folderId (undefined) should show when at root (null)
    files = (store.files || []).filter(f => {
      const fileFolderId = f.folderId || null;
      return fileFolderId === currentFolderId;
    });
  }
  
  // Apply project filter
  if (projectFilter !== 'all' && filesViewMode !== 'recent') {
    files = files.filter(f => fileProjectIds(f).includes(projectFilter));
  }
  
  // Apply category filter
  if (currentFileCategory !== 'all') {
    files = files.filter(f => fileCategories(f).includes(currentFileCategory));
  }
  
  // Apply search filter
  if (currentFilesSearch) {
    files = files.filter(f => 
      (f.name || '').toLowerCase().includes(currentFilesSearch) ||
      (f.description || '').toLowerCase().includes(currentFilesSearch)
    );
  }

  // Sort files
  const sortSelect = document.getElementById('files-sort-select');
  const sort = sortSelect ? sortSelect.value : 'name';
  
  files.sort((a, b) => {
    let cmp = 0;
    switch(sort) {
      case 'name':
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        break;
      case 'date':
        cmp = new Date(b.modifiedAt || b.createdAt || 0) - new Date(a.modifiedAt || a.createdAt || 0);
        break;
      case 'size':
        cmp = (b.size || 0) - (a.size || 0);
        break;
      case 'type':
        const extA = (a.name || '').split('.').pop() || '';
        const extB = (b.name || '').split('.').pop() || '';
        cmp = extA.localeCompare(extB);
        break;
    }
    return currentFilesSortDir === 'desc' ? -cmp : cmp;
  });

  // Sort folders by name
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // Show empty state only if no folders and no files
  if (folders.length === 0 && files.length === 0) {
    let emptyMessage, emptyIcon, emptyTitle;
    if (filesViewMode === 'recent') {
      emptyTitle = 'No recent files';
      emptyMessage = 'Files you open or edit will appear here for quick access.';
      emptyIcon = '🕐';
    } else if (filesViewMode === 'starred') {
      emptyTitle = 'No starred files';
      emptyMessage = 'Star files to add them to your favorites for quick access.';
      emptyIcon = '⭐';
    } else if (currentFolderId) {
      emptyTitle = 'Folder is empty';
      emptyMessage = 'This folder is empty. Drop files here or upload new ones.';
      emptyIcon = '📂';
    } else {
      emptyTitle = 'No files yet';
      emptyMessage = 'No files yet. Upload scripts, photos, storyboards, contracts and more.';
      emptyIcon = '📁';
    }
    grid.innerHTML = `
      <div class="file-empty" style="grid-column:1/-1">
        <div class="file-empty-icon">${emptyIcon}</div>
        <div class="file-empty-text">${emptyTitle}</div>
        <div class="file-empty-hint">${emptyMessage}</div>
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
    const pFilter = (document.getElementById('files-project-filter')?.value === 'all') ? null : document.getElementById('files-project-filter')?.value;
    const starIcon = file.starred ? '⭐' : '☆';
    const starClass = file.starred ? 'starred' : '';
    const lastInteraction = file.modifiedAt || file.uploadedAt || file.createdAt;
    const dateStr = formatRelativeTime(lastInteraction);
    const ext = file.name.split('.').pop().toLowerCase();
    const isImg = file.data?.startsWith('data:image');
    const isVid = file.data?.startsWith('data:video') || ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);

    const TYPE_META = {
      script:     { colour: '#4a9eff', bg: '#1a2535', iconCol: '#4a9eff' },
      edits:      { colour: '#e74c3c', bg: '#251515', iconCol: '#e74c3c' },
      location:   { colour: '#4caf7d', bg: '#152520', iconCol: '#4caf7d' },
      stills:     { colour: '#f5a623', bg: '#252015', iconCol: '#f5a623' },
      bts:        { colour: '#f5a623', bg: '#252015', iconCol: '#f5a623' },
      moodboard:  { colour: '#9b59b6', bg: '#201525', iconCol: '#9b59b6' },
      storyboard: { colour: '#9b59b6', bg: '#201525', iconCol: '#9b59b6' },
      contract:   { colour: '#607d8b', bg: '#181e22', iconCol: '#90a4ae' },
      other:      { colour: '#555',    bg: 'var(--surface2)', iconCol: 'var(--text3)' },
    };
    const cat = cats[0] || 'other';
    const meta = TYPE_META[cat] || TYPE_META.other;

    const FILE_SVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="${meta.iconCol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;


    const PLAY_SVG = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#666" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="#666" stroke="none"/></svg>`;

    const thumbInner = isImg
      ? `<img src="${file.data}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;">`
      : isVid
      ? `<div style="position:absolute;inset:0;background:#111;display:flex;align-items:center;justify-content:center;">${PLAY_SVG}</div>`
      : `<div style="position:absolute;inset:0;background:${meta.bg};display:flex;align-items:center;justify-content:center;">
           <div style="width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;">${FILE_SVG}</div>
         </div>`;

    const catLabel = cats.map(c => FILE_CATEGORIES[c]?.label || c).join(', ');

    // Grid view template
    const gridTemplate = `
    <div class="file-card${selectedFileIds.has(file.id) ? ' selected' : ''}${starClass}" data-file-id="${file.id}" 
         onclick="fileCardClick(event,'${file.id}','files')"
         draggable="true"
         ondragstart="handleFileDragStart(event,'${file.id}')"
         ondragend="handleFileDragEnd(event)"
         oncontextmenu="showContextMenu(event,'${file.id}','file')">
      <div class="file-select-check" onclick="event.stopPropagation();toggleFileSelect('${file.id}','files')">${selectedFileIds.has(file.id) ? '✓' : ''}</div>
      <div class="file-card-star" onclick="event.stopPropagation();toggleStarFile('${file.id}')" title="${file.starred ? 'Remove from starred' : 'Add to starred'}">${starIcon}</div>

      <div class="file-card-actions">
        <button class="file-action-btn" onclick="event.stopPropagation();openManageFile('${file.id}')" title="Rename">✏️</button>
        <button class="file-action-btn" onclick="event.stopPropagation();openMoveFile(['${file.id}'], ${pFilter ? `'${pFilter}'` : 'null'})" title="Move to project">🔀</button>
        <button class="file-action-btn" onclick="event.stopPropagation();openMoveFileToFolder(['${file.id}'])" title="Move to folder">📁</button>
        <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.id}')" title="Download">⬇</button>
        <button class="file-action-btn delete" onclick="event.stopPropagation();openRemoveFiles(['${file.id}'], ${pFilter ? `'${pFilter}'` : 'null'})" title="Remove / delete">🗑</button>
      </div>
      <div style="position:relative;width:100%;height:110px;overflow:hidden;flex-shrink:0;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${meta.colour};z-index:1;"></div>
      ${thumbInner}
      </div>
      <div style="font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${file.name}">${file.name}</div>
      <div style="display:flex;gap:6px;" style="display:flex;gap:6px;">
        <span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;background:${meta.bg}; color:${meta.iconCol};">${catLabel}</span>
        <span>·</span>
        <span>${formatFileSize(file.size)}</span>
      </div>
      ${file.description ? `<div style="margin-top:4px;font-size:10px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${file.description}">${file.description}</div>` : ''}
      ${peopleTags}
      ${projectBadge}
    </div>`;

    // List view template
    const listTemplate = `
    <div class="file-list-item${selectedFileIds.has(file.id) ? ' selected' : ''}${starClass}" data-file-id="${file.id}" 
         onclick="fileCardClick(event,'${file.id}','files')"
         draggable="true"
         ondragstart="handleFileDragStart(event,'${file.id}')"
         ondragend="handleFileDragEnd(event)"
         oncontextmenu="showContextMenu(event,'${file.id}','file')">
      <div class="file-select-check" onclick="event.stopPropagation();toggleFileSelect('${file.id}','files')">${selectedFileIds.has(file.id) ? '✓' : ''}</div>
      <div class="file-list-star" onclick="event.stopPropagation();toggleStarFile('${file.id}')" title="${file.starred ? 'Remove from starred' : 'Add to starred'}">${starIcon}</div>
      <div class="file-list-icon" style="flex-shrink:0;margin-right:8px;">${isImg ? `<img src="${file.data}" style="width:auto;height:40px;object-fit:contain;border-radius:4px;">` : isVid ? `<div style="width:40px;height:40px;background:#111;display:flex;align-items:center;justify-content:center;border-radius:4px;">${PLAY_SVG}</div>` : getFileIcon(file)}</div>
      <div class="file-list-name" style="flex:1;overflow:hidden;" title="${file.name}">${file.name}</div>
      <div class="file-list-meta">
        <span class="file-list-type">${catBadge}</span>
      </div>
      <div class="file-list-size">${formatFileSize(file.size)}</div>
      <div class="file-list-date">${dateStr}</div>
      <div class="file-list-actions">
        <button class="file-action-btn" onclick="event.stopPropagation();openManageFile('${file.id}')" title="Rename">✏️</button>
        <button class="file-action-btn" onclick="event.stopPropagation();toggleStarFile('${file.id}')" title="${file.starred ? 'Remove from starred' : 'Add to starred'}">${starIcon}</button>
        <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.id}')" title="Download">⬇</button>
        <button class="file-action-btn delete" onclick="event.stopPropagation();openRemoveFiles(['${file.id}'], ${pFilter ? `'${pFilter}'` : 'null'})" title="Remove / delete">🗑</button>
      </div>
    </div>`;
    
    return currentFileView === 'list' ? listTemplate : gridTemplate;
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
    // Show folders and files in the grid or list view
    const folderHtml = folders.map(currentFileView === 'list' ? _folderListItem : _folderCard).join('');
    const fileHtml = files.map(_fileCard).join('');

    if (currentFileView === 'list') {
      // List view header
      const listHeader = `<div class="file-list-header">
        <div></div>
        <div class="file-list-header-star"></div>
        <div class="file-list-header-name">Name</div>
        <div class="file-list-header-type">Type</div>
        <div class="file-list-header-size">Size</div>
        <div class="file-list-header-date">Modified</div>
      </div>`;
      // Use file-list container for list view
      grid.className = 'file-list';
      grid.innerHTML = listHeader + folderHtml + fileHtml;
    } else {
      // Grid view
      grid.className = 'file-grid';
      grid.innerHTML = folderHtml + fileHtml;
    }

    // Add drop zone listeners to folders after they're rendered
    setTimeout(() => {
      document.querySelectorAll('.folder-card, .folder-list-item').forEach(folderEl => {
        folderEl.addEventListener('dragover', handleFolderDragOver);
        folderEl.addEventListener('dragleave', handleFolderDragLeave);
        folderEl.addEventListener('drop', (e) => handleFolderDrop(e, folderEl.dataset.folderId));
      });
    }, 0);
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
    const ext = file.name.split('.').pop().toLowerCase();
    const isVideo = (file.data && file.data.startsWith('data:video')) || ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);
    const playBtn = isVideo ? `<button class="file-action-btn" onclick="event.stopPropagation();openVideoPlayer('${file.id}')" title="Play video">▶</button>` : '';
    return `
    <div class="file-card${selectedFileIds.has(file.id) ? ' selected' : ''}" data-file-id="${file.id}" onclick="fileCardClick(event,'${file.id}','overview')" oncontextmenu="showContextMenu(event,'${file.id}','file')" style="font-size:11px;">
      <div class="file-select-check" onclick="event.stopPropagation();toggleFileSelect('${file.id}','overview')">${selectedFileIds.has(file.id) ? '✓' : ''}</div>
      <div class="file-card-actions">
        ${playBtn}
        <button class="file-action-btn" onclick="event.stopPropagation();openManageFile('${file.id}')" title="Rename">✏️</button>
        <button class="file-action-btn" onclick="event.stopPropagation();openMoveFile(['${file.id}'],'${projectId}')" title="Move to project">🔀</button>
        <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.id}')" title="Download">⬇</button>
        <button class="file-action-btn delete" onclick="event.stopPropagation();openRemoveFiles(['${file.id}'],'${projectId}')" title="Remove from project">🗑</button>
      </div>
      <div class="file-card-preview">${getFileIcon(file)}</div>
      <div class="file-card-name" title="${file.name}">${file.name}</div>
      <div class="file-card-meta">
        <span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:500;background:${meta.bg}; color:${meta.iconCol};">${catLabel}</span>
        <span>${formatFileSize(file.size)}</span>
      </div>
      <div class="file-card-time" style="font-size:10px;color:var(--text2);margin-top:4px;">${formatRelativeTime(lastInteraction)}</div>
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
  else ovFilesRender();
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
  ovFilesRender();
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

// ── Folders ──────────────────────────────────────────────────────────────────
function _openCreateFolder() {
  console.log('[Files] New Folder button clicked');
  try {
    const nameInput = document.getElementById('new-folder-name');
    if (nameInput) nameInput.value = '';
    
    const contextEl = document.getElementById('create-folder-context');
    if (contextEl) {
      const filterSel = document.getElementById('files-project-filter');
      const projectFilter = filterSel ? filterSel.value : 'all';
      const project = projectFilter !== 'all' ? store.projects?.find(p => p.id === projectFilter) : null;
      
      let contextText = 'Creating folder at root level';
      if (currentFolderId) {
        const folder = getFolderById(currentFolderId);
        if (folder) contextText = `Creating folder inside: ${folder.name}`;
      }
      if (project) {
        contextText += ` • Project: ${project.title}`;
      }
      contextEl.textContent = contextText;
    }
    
    openModal('modal-create-folder');
    setTimeout(() => {
      const nameInput = document.getElementById('new-folder-name');
      if (nameInput) {
        nameInput.focus();
        // Add Enter key listener via JS to ensure it works
        nameInput.onkeydown = function(event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            confirmCreateFolder();
          }
        };
      }
    }, 100);
  } catch (err) {
    console.error('[Files] Error opening create folder:', err);
    showToast('Error opening create folder dialog', 'error');
  }
}

// Alias for backwards compatibility
function openCreateFolder() {
  return _openCreateFolder();
}

function confirmCreateFolder() {
  console.log('[Files] confirmCreateFolder called');
  try {
    const nameInput = document.getElementById('new-folder-name');
    let name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      showToast('Please enter a folder name', 'error');
      return;
    }

    const filterSel = document.getElementById('files-project-filter');
    const projectFilter = filterSel ? filterSel.value : 'all';
    const projectId = projectFilter !== 'all' ? projectFilter : null;

    // Find a unique name by appending (1), (2), etc. if duplicate
    const existingNames = (store.folders || [])
      .filter(f => f.parentId === currentFolderId && f.projectId === projectId)
      .map(f => f.name.toLowerCase());
    let uniqueName = name;
    let counter = 1;
    while (existingNames.includes(uniqueName.toLowerCase())) {
      uniqueName = `${name} (${counter})`;
      counter++;
    }

    console.log('[Files] Creating folder:', uniqueName);
    createFolder(uniqueName, currentFolderId, projectId);
    console.log('[Files] Closing modal');
    closeModal('modal-create-folder');
    console.log('[Files] Rendering files');
    renderFiles();
    showToast(`Folder "${uniqueName}" created`, 'success');
  } catch (err) {
    console.error('[Files] Error creating folder:', err);
    showToast('Error creating folder: ' + err.message, 'error');
  }
}

function openFolder(folderId) {
  currentFolderId = folderId;
  renderFiles();
}

function navigateToRoot() {
  currentFolderId = null;
  renderFiles();
}

function navigateUp() {
  if (currentFolderId) {
    const folder = getFolderById(currentFolderId);
    if (folder && folder.parentId) {
      currentFolderId = folder.parentId;
    } else {
      currentFolderId = null;
    }
    renderFiles();
  }
}

// ── View Mode ─────────────────────────────────────────────────────────────────
let currentFileView = 'grid';
let currentFilesSort = 'name';
let currentFilesSortDir = 'asc';
let currentFilesSearch = '';
let filesViewMode = 'all'; // 'all', 'recent', 'starred'

function setFileView(view) {
  currentFileView = view;
  document.getElementById('view-grid-btn')?.classList.toggle('active', view === 'grid');
  document.getElementById('view-list-btn')?.classList.toggle('active', view === 'list');
  const grid = document.getElementById('file-grid');
  if (grid) {
    grid.className = view === 'list' ? 'file-list' : 'file-grid';
  }
  renderFiles();
}

function setFileSort(sort) {
  if (currentFilesSort === sort) {
    currentFilesSortDir = currentFilesSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentFilesSort = sort;
    currentFilesSortDir = 'asc';
  }
  const select = document.getElementById('files-sort-select');
  if (select) select.value = sort;
  renderFiles();
}

function showRecentFiles() {
  filesViewMode = 'recent';
  document.getElementById('files-search-input').value = '';
  currentFilesSearch = '';
  renderFiles();
}

function showStarredFiles() {
  filesViewMode = 'starred';
  document.getElementById('files-search-input').value = '';
  currentFilesSearch = '';
  renderFiles();
}

function showAllFiles() {
  filesViewMode = 'all';
  currentFolderId = null;
  document.getElementById('files-search-input').value = '';
  currentFilesSearch = '';
  renderFiles();
}

// ── Storage Calculation ──────────────────────────────────────────────────────
function calculateStorage() {
  const files = store.files || [];
  let totalSize = 0;
  files.forEach(f => {
    if (f.data) {
      // Estimate base64 size
      totalSize += f.data.length * 0.75; // Approximate decoded size
    }
    if (f.size) totalSize += parseInt(f.size);
  });
  return totalSize;
}

function formatStorageSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function updateStorageDisplay() {
  const used = calculateStorage();
  const maxStorage = 100 * 1024 * 1024; // 100 MB limit for demo
  const percent = Math.min((used / maxStorage) * 100, 100);
  
  const bar = document.getElementById('storage-bar-used');
  const text = document.getElementById('storage-text');
  
  if (bar) bar.style.width = percent + '%';
  if (text) text.textContent = `${formatStorageSize(used)} of ${formatStorageSize(maxStorage)} used`;
}

// ── Starred Files ─────────────────────────────────────────────────────────────
function toggleStarFile(fileId) {
  const file = (store.files || []).find(f => f.id === fileId);
  if (!file) return;
  
  // Toggle starred state
  file.starred = !file.starred && file.starred !== true;
  if (file.starred) {
    file.starredAt = new Date().toISOString();
    showToast('Added to starred', 'success');
  } else {
    file.starredAt = null;
    showToast('Removed from starred', 'success');
  }
  
  saveStore();
  
  // Update just the star element directly instead of full re-render
  const starEl = document.querySelector(`[data-file-id="${fileId}"] .file-card-star`);
  if (starEl) {
    starEl.textContent = file.starred ? '⭐' : '☆';
    const cardEl = starEl.closest('.file-card');
    if (cardEl) {
      cardEl.classList.toggle('starred', file.starred);
    }
  }
  
  // Also update list view if present
  const listStarEl = document.querySelector(`[data-file-id="${fileId}"] .file-list-star`);
  if (listStarEl) {
    listStarEl.textContent = file.starred ? '⭐' : '☆';
  }
}

function getStarredFiles() {
  return (store.files || []).filter(f => f.starred);
}

function getRecentFiles(limit = 20) {
  return (store.files || [])
    .sort((a, b) => {
      const aDate = new Date(a.modifiedAt || a.uploadedAt);
      const bDate = new Date(b.modifiedAt || b.uploadedAt);
      return bDate - aDate;
    })
    .slice(0, limit);
}

// ── Context Menu ─────────────────────────────────────────────────────────────
let contextTargetId = null;
let contextTargetType = null; // 'file' or 'folder'

function showFileContextMenu(e, targetId, targetType) {
  e.preventDefault();
  e.stopPropagation(); // Prevent global init.js handler from also firing
  contextTargetId = targetId;
  contextTargetType = targetType;
  
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  
  if (targetType === 'file') {
    const file = (store.files || []).find(f => f.id === targetId);
    const starLabel = file?.starred ? 'Remove from Starred' : 'Add to Starred';
    const starIcon = file?.starred ? '⭐' : '☆';
    const filterSel = document.getElementById('files-project-filter');
    const projectFilter = filterSel ? filterSel.value : 'all';
    
    menu.innerHTML = `
      <div class="context-menu-item" onclick="contextOpenFile()">
        <span class="context-menu-icon">📂</span> Open / Preview
      </div>
      <div class="context-menu-item" onclick="contextRename()">
        <span class="context-menu-icon">✏️</span> Rename
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="contextStar();hideContextMenu()">
        <span class="context-menu-icon">${starIcon}</span> <span id="context-star-label">${starLabel}</span>
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="openMoveFile(['${targetId}'], ${projectFilter !== 'all' ? `'${projectFilter}'` : 'null'});hideContextMenu()">
        <span class="context-menu-icon">🔀</span> Move to Project
      </div>
      <div class="context-menu-item" onclick="contextMoveToFolder()">
        <span class="context-menu-icon">📁</span> Move to Folder
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="contextDownload()">
        <span class="context-menu-icon">⬇️</span> Download
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item danger" onclick="contextDelete()">
        <span class="context-menu-icon">🗑️</span> Delete
      </div>
    `;
  } else if (targetType === 'folder') {
    const folder = getFolderById(targetId);
    const filterSel = document.getElementById('files-project-filter');
    const projectFilter = filterSel ? filterSel.value : 'all';
    
    menu.innerHTML = `
      <div class="context-menu-item" onclick="contextOpenFile()">
        <span class="context-menu-icon">📂</span> Open Folder
      </div>
      <div class="context-menu-item" onclick="contextRename()">
        <span class="context-menu-icon">✏️</span> Rename
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item" onclick="openMoveFolderToProject('${targetId}', ${projectFilter !== 'all' ? `'${projectFilter}'` : 'null'});hideContextMenu()">
        <span class="context-menu-icon">🔀</span> Move to Project
      </div>
      <div class="context-menu-item" onclick="openMoveFolderToParent('${targetId}');hideContextMenu()">
        <span class="context-menu-icon">📁</span> Move to Subfolder
      </div>
      <div class="context-menu-sep"></div>
      <div class="context-menu-item danger" onclick="contextDelete()">
        <span class="context-menu-icon">🗑️</span> Delete
      </div>
    `;
  }
  
  menu.style.display = 'block';
  const menuH = menu.offsetHeight || 200;
  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - menuH - 4);
  menu.style.left = Math.max(4, x) + 'px';
  menu.style.top = Math.max(4, y) + 'px';
  
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 10);
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.style.display = 'none';
}

function contextOpenFile() {
  if (contextTargetType === 'file') {
    viewFile(contextTargetId);
  } else if (contextTargetType === 'folder') {
    openFolder(contextTargetId);
  }
  hideContextMenu();
}

function contextRename() {
  if (contextTargetType === 'file') {
    openManageFile(contextTargetId);
  } else if (contextTargetType === 'folder') {
    openRenameFolder(contextTargetId);
  }
  hideContextMenu();
}

function contextStar() {
  if (contextTargetType === 'file') {
    toggleStarFile(contextTargetId);
  }
  hideContextMenu();
}

function contextDownload() {
  if (contextTargetType === 'file') {
    downloadFile(contextTargetId);
  }
  hideContextMenu();
}

function contextMoveToFolder() {
  if (contextTargetType === 'file') {
    openMoveFileToFolder([contextTargetId]);
  }
  hideContextMenu();
}

function contextDelete() {
  if (contextTargetType === 'file') {
    const filterSel = document.getElementById('files-project-filter');
    const projectFilter = filterSel ? filterSel.value : 'all';
    openRemoveFiles([contextTargetId], projectFilter === 'all' ? null : projectFilter);
  } else if (contextTargetType === 'folder') {
    if (confirm('Delete this folder? Files inside will be moved to the root folder.')) {
      deleteFolder(contextTargetId);
      renderFiles(); // Refresh the view
    }
  }
  hideContextMenu();
}

// Add right-click handlers to file cards
function _addContextMenuToFileCard(fileId) {
  const card = document.querySelector(`[data-file-id="${fileId}"]`);
  if (card) {
    card.addEventListener('contextmenu', (e) => showFileContextMenu(e, fileId, 'file'));
  }
}

function _addContextMenuToFolderCard(folderId) {
  const card = document.querySelector(`[data-folder-id="${folderId}"]`);
  if (card) {
    card.addEventListener('contextmenu', (e) => showFileContextMenu(e, folderId, 'folder'));
  }
}

function getFolderBreadcrumb() {
  const crumbs = [];
  let currentId = currentFolderId;
  
  while (currentId) {
    const folder = getFolderById(currentId);
    if (folder) {
      crumbs.unshift(folder);
      currentId = folder.parentId;
    } else {
      break;
    }
  }
  
  return crumbs;
}

function renderFolderNav() {
  const nav = document.getElementById('folder-nav');
  if (!nav) return;
  
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';
  
  // Show "Back to All Files" button when in recent/starred mode
  if (filesViewMode === 'recent' || filesViewMode === 'starred') {
    const modeLabel = filesViewMode === 'recent' ? 'Recent' : 'Starred';
    nav.innerHTML = `
      <span class="folder-nav-item" onclick="showAllFiles()" style="cursor:pointer;">🏠 Home</span>
      <span class="folder-nav-sep">›</span>
      <span class="folder-nav-item current">${modeLabel}</span>
      <span class="folder-nav-item" onclick="showAllFiles()" style="margin-left:auto;color:var(--accent);cursor:pointer;">← Back to All Files</span>
    `;
    return;
  }
  
  // Get folders for current context
  let folders = (store.folders || []).filter(f => {
    if (projectFilter !== 'all' && f.projectId !== projectFilter) return false;
    return f.parentId === currentFolderId;
  });
  
  if (currentFolderId === null && folders.length === 0) {
    nav.innerHTML = '';
    return;
  }
  
  const crumbs = getFolderBreadcrumb();
  let html = `<span class="folder-nav-item" onclick="navigateToRoot()">🏠 Home</span>`;
  
  if (crumbs.length > 0) {
    html += `<span class="folder-nav-sep">›</span>`;
    crumbs.forEach((folder, idx) => {
      if (idx < crumbs.length - 1) {
        html += `<span class="folder-nav-item" onclick="openFolder('${folder.id}')">${folder.name}</span>`;
        html += `<span class="folder-nav-sep">›</span>`;
      } else {
        html += `<span class="folder-nav-item current">${folder.name}</span>`;
      }
    });
  }
  
  if (currentFolderId) {
    html += `<span class="folder-nav-item" onclick="navigateUp()" style="margin-left:auto;">↑ Up</span>`;
  }
  
  nav.innerHTML = html;
}

function _folderCard(folder) {
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';
  const fileCount = getFolderFiles(folder.id).length;
  const subfolderCount = (store.folders || []).filter(f => f.parentId === folder.id).length;

  return `
  <div class="folder-card" data-folder-id="${folder.id}" onclick="openFolder('${folder.id}')"
       oncontextmenu="showContextMenu(event,'${folder.id}','folder')">
    <div class="folder-card-actions">
      <button class="file-action-btn" onclick="event.stopPropagation();openRenameFolder('${folder.id}')" title="Rename">✏️</button>
      <button class="file-action-btn" onclick="event.stopPropagation();openMoveFolderToProject('${folder.id}', ${projectFilter !== 'all' ? `'${projectFilter}'` : 'null'})" title="Move to project">🔀</button>
      <button class="file-action-btn" onclick="event.stopPropagation();openMoveFolderToParent('${folder.id}')" title="Move to subfolder">📁</button>
      <button class="file-action-btn delete" onclick="event.stopPropagation();openDeleteFolder('${folder.id}')" title="Delete">🗑</button>
    </div>
    <div class="folder-icon">📁</div>
    <div class="folder-card-name" title="${folder.name}">${folder.name}</div>
    <div class="folder-card-meta">
      ${fileCount} file${fileCount !== 1 ? 's' : ''}${subfolderCount > 0 ? `, ${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}` : ''}
    </div>
  </div>`;
}

function _folderListItem(folder) {
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';
  const fileCount = getFolderFiles(folder.id).length;
  const subfolderCount = (store.folders || []).filter(f => f.parentId === folder.id).length;
  const dateStr = folder.createdAt ? new Date(folder.createdAt).toLocaleDateString() : '—';

  return `
  <div class="folder-list-item" data-folder-id="${folder.id}" onclick="openFolder('${folder.id}')"
       oncontextmenu="showContextMenu(event,'${folder.id}','folder')">
    <div></div>
    <div class="folder-list-star"></div>
    <div class="folder-list-icon">📁</div>
    <div class="folder-list-name" title="${folder.name}">${folder.name}</div>
    <div class="folder-list-type">Folder</div>
    <div class="folder-list-size">${fileCount} file${fileCount !== 1 ? 's' : ''}${subfolderCount > 0 ? `, ${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}` : ''}</div>
    <div class="folder-list-date">${dateStr}</div>
    <div class="folder-list-actions">
      <button class="file-action-btn" onclick="event.stopPropagation();openRenameFolder('${folder.id}')" title="Rename">✏️</button>
      <button class="file-action-btn" onclick="event.stopPropagation();openMoveFolderToProject('${folder.id}', ${projectFilter !== 'all' ? `'${projectFilter}'` : 'null'})" title="Move to project">🔀</button>
      <button class="file-action-btn" onclick="event.stopPropagation();openMoveFolderToParent('${folder.id}')" title="Move to subfolder">📁</button>
      <button class="file-action-btn delete" onclick="event.stopPropagation();openDeleteFolder('${folder.id}')" title="Delete">🗑</button>
    </div>
  </div>`;
}

function openRenameFolder(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return;
  
  // Create inline modal for renaming
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal" role="dialog" style="max-width:400px">
      <div class="modal-header">
        <h3>Rename Folder</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="form-group" style="margin:16px 0;">
        <label class="form-label">Folder name</label>
        <input type="text" class="form-input" id="_rename-folder-input" value="${folder.name}">
      </div>
      <div class="form-actions">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="_rename-folder-confirm">Rename</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  
  const input = document.getElementById('_rename-folder-input');
  setTimeout(() => input.focus(), 50);
  
  document.getElementById('_rename-folder-confirm').onclick = () => {
    const newName = input.value.trim();
    if (newName && newName !== folder.name) {
      renameFolder(folderId, newName);
      renderFiles();
      showToast('Folder renamed', 'success');
    }
    overlay.remove();
  };
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('_rename-folder-confirm').click();
    }
  };
}

function openDeleteFolder(folderId) {
  const folder = getFolderById(folderId);
  if (!folder) return;
  
  const fileCount = getFolderFiles(folderId).length;
  const subfolderCount = (store.folders || []).filter(f => f.parentId === folderId).length;
  
  let message = `Delete folder "${folder.name}"?`;
  if (fileCount > 0 || subfolderCount > 0) {
    message += `<br><br>This folder contains ${fileCount} file${fileCount !== 1 ? 's' : ''} and ${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}. Files will be moved to the current location.`;
  }
  
  showConfirmDialog(message, 'Delete Folder', () => {
    deleteFolder(folderId);
    if (currentFolderId === folderId) {
      currentFolderId = null;
    }
    renderFiles();
    showToast('Folder deleted', 'success');
  });
}

// Move folder to a different project
function openMoveFolderToProject(folderId, currentProjectId) {
  if (!folderId) return;
  if (!store.projects || store.projects.length === 0) { showToast('No projects exist', 'error'); return; }
  
  document.getElementById('move-folder-to-project-id-store').dataset.folderId = folderId;
  
  // Build project options (exclude current project)
  const targetOptions = store.projects
    .map((p, i) => {
      const isCurrent = currentProjectId && p.id === currentProjectId;
      return isCurrent ? '' : `<option value="${i}">${p.title || 'Untitled Project'}</option>`;
    })
    .filter(Boolean).join('');
  
  if (!targetOptions) { showToast('No other projects to move to', 'info'); return; }
  
  document.getElementById('move-folder-to-project-target').innerHTML = targetOptions;
  openModal('modal-move-folder-to-project');
}

function confirmMoveFolderToProject() {
  const folderId = document.getElementById('move-folder-to-project-id-store').dataset.folderId;
  const targetIdx = parseInt(document.getElementById('move-folder-to-project-target').value);
  if (isNaN(targetIdx) || !store.projects[targetIdx]) return;
  
  const targetPid = store.projects[targetIdx].id;
  moveFolderToProject(folderId, targetPid);
  
  closeModal('modal-move-folder-to-project');
  renderFiles();
  showToast(`Folder moved to ${store.projects[targetIdx].title || 'project'}`, 'success');
}

// Move folder to a subfolder (parent folder)
function openMoveFolderToParent(folderId) {
  if (!folderId) return;
  
  document.getElementById('move-folder-to-parent-id-store').dataset.folderId = folderId;
  
  // Build folder tree options, excluding the folder itself and its descendants
  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';
  
  let folders = (store.folders || []).filter(f => {
    if (projectFilter !== 'all' && f.projectId !== projectFilter) return false;
    return true;
  });
  
  // Build tree, excluding self and children
  const buildTree = (parentId, indent = '', depth = 0) => {
    let options = '';
    folders
      .filter(f => f.parentId === parentId && f.id !== folderId)
      .forEach(folder => {
        // Check if this folder is a descendant of the folder being moved
        let isDescendant = false;
        let check = folder;
        while (check && check.parentId) {
          if (check.parentId === folderId) { isDescendant = true; break; }
          check = folders.find(f => f.id === check.parentId);
        }
        if (isDescendant) return;
        
        options += `<option value="${folder.id}">${indent}📁 ${folder.name}</option>`;
        options += buildTree(folder.id, indent + '  ', depth + 1);
      });
    return options;
  };
  
  const folderOptions = buildTree(null) + '<option value="">📁 Root / No parent</option>';
  document.getElementById('move-folder-to-parent-target').innerHTML = folderOptions;
  openModal('modal-move-folder-to-parent');
}

function confirmMoveFolderToParent() {
  const folderId = document.getElementById('move-folder-to-parent-id-store').dataset.folderId;
  const targetParentId = document.getElementById('move-folder-to-parent-target').value || null;
  
  moveFolderToParent(folderId, targetParentId);
  
  closeModal('modal-move-folder-to-parent');
  renderFiles();
  showToast('Folder moved', 'success');
}

// Drag and drop for moving files to folders
let draggedFileId = null;

function handleFileDragStart(e, fileId) {
  // Don't start drag if clicking on buttons or interactive elements
  if (e.target.closest('button') || e.target.closest('.file-card-star') || e.target.closest('.file-card-actions') || e.target.closest('.file-select-check')) {
    e.preventDefault();
    return;
  }
  draggedFileId = fileId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', fileId);
}

function handleFileDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedFileId = null;
  // Remove all drop target highlights
  document.querySelectorAll('.folder-card.drop-target').forEach(el => {
    el.classList.remove('drop-target');
  });
}

function handleFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drop-target');
}

function handleFolderDragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}

function handleFolderDrop(e, folderId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  
  if (draggedFileId) {
    moveFileToFolder(draggedFileId, folderId);
    showToast('File moved to folder', 'success');
    renderFiles();
  }
  draggedFileId = null;
}

// Also support moving via selection (bulk move)
function moveSelectedToFolder(folderId) {
  const selectedIds = [...selectedFileIds];
  if (selectedIds.length === 0) return;
  
  selectedIds.forEach(fileId => {
    moveFileToFolder(fileId, folderId);
  });
  
  clearFileSelection();
  renderFiles();
  showToast(`${selectedIds.length} file${selectedIds.length !== 1 ? 's' : ''} moved to folder`, 'success');
}

// Open modal to select folder for moving files
function openMoveFileToFolder(fileIds) {
  if (!fileIds || fileIds.length === 0) return;

  const filterSel = document.getElementById('files-project-filter');
  const projectFilter = filterSel ? filterSel.value : 'all';

  // Get all folders that are relevant to the project filter
  let folders = (store.folders || []).filter(f => {
    if (projectFilter !== 'all' && f.projectId !== projectFilter) return false;
    return true;
  });

  if (folders.length === 0) {
    showToast('No folders available', 'info');
    return;
  }

  // Build folder options
  const buildTree = (parentId, indent = '') => {
    let options = '';
    folders.filter(f => f.parentId === parentId).forEach(folder => {
      options += `<option value="${folder.id}">${indent}📁 ${folder.name}</option>`;
      options += buildTree(folder.id, indent + '  ');
    });
    return options;
  };

  const folderOptions = buildTree(null) + '<option value="">📁 Root / No folder</option>';

  document.getElementById('move-file-to-folder-ids-store').dataset.ids = JSON.stringify(fileIds);
  document.getElementById('move-file-to-folder-target').innerHTML = folderOptions;
  document.getElementById('move-file-to-folder-title').textContent = fileIds.length > 1 ? `MOVE ${fileIds.length} FILES TO FOLDER` : 'MOVE TO FOLDER';
  openModal('modal-move-file-to-folder');
}

function confirmMoveFileToFolder() {
  const ids = JSON.parse(document.getElementById('move-file-to-folder-ids-store').dataset.ids || '[]');
  const targetFolderId = document.getElementById('move-file-to-folder-target').value;
  const finalFolderId = targetFolderId === '' ? null : targetFolderId;

  ids.forEach(fileId => {
    moveFileToFolder(fileId, finalFolderId);
  });
  renderFiles();
  showToast(`${ids.length} file(s) moved`, 'success');
  closeModal('modal-move-file-to-folder');
}

// Open folder selection for selected files (from bulk bar)
function openMoveSelectedToFolder() {
  const selectedIds = getSelectedInContext('files');
  openMoveFileToFolder(selectedIds);
}

// ── Rename ───────────────────────────────────────────────────────────────────
function openManageFile(id) {
  refreshRolesDatalist();
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;

  document.getElementById('manage-file-id').value = id;

  const cats = fileCategories(file);
  const isImage = file.data && file.data.startsWith('data:image');
  const nameNoExt = file.name.replace(/\.[^.]+$/, '');
  const suggestedCat = cats[0] || 'other';

  // Build category checkboxes
  const catChecks = Object.entries(FILE_CATEGORIES).map(([k, v]) =>
    `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);cursor:pointer;white-space:nowrap;">
      <input type="checkbox" data-mfcat="${k}" ${cats.includes(k) ? 'checked' : ''} style="width:13px;height:13px;" onchange="mfCatChange()">
      ${v.icon} ${v.label}
    </label>`
  ).join('');

  // Project dropdown
  const currentPids = fileProjectIds(file);
  const activePid = currentPids[0] || '';
  const projectOptions = `<option value="">— No project —</option>` +
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

  const locationOptions = `<option value="">— None —</option>` +
    [...allLocs].sort().map(n => `<option value="${n}" ${n === currentLoc ? 'selected' : ''}>${n}</option>`).join('') +
    `<option value="__new__">+ Create new location…</option>`;

  // People tags
  let peopleTagsHtml = '';
  (file.people || []).forEach(name => {
    let role = '';
    fileProjectIds(file).forEach(pid => {
      const proj = store.projects.find(p => p.id === pid);
      const contact = (proj?.contacts || []).find(c => c.name?.toLowerCase() === name.toLowerCase());
      if (contact && contact.roles && contact.roles.length) role = contact.roles.join(', ');
    });
    const roleText = role ? ` <span style="color:var(--text3);font-size:9px;">(${role})</span>` : '';
    peopleTagsHtml += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:var(--accent);color:#fff;border-radius:3px;font-size:10px;">${name}${roleText}<span style="cursor:pointer;margin-left:2px;" onclick="this.parentElement.remove()">×</span></span>`;
  });

  // Build the content HTML similar to upload modal
  const contentEl = document.getElementById('manage-file-content');
  contentEl.innerHTML = `
    <div style="border:1px solid var(--border2);border-radius:var(--radius);padding:12px;background:var(--surface2);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div data-thumb style="width:52px;height:52px;border-radius:6px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;">
          ${file.data ? getFileIcon(file) : getFileIcon({name:file.name, data:'', category:suggestedCat})}
        </div>
        <span style="font-size:11px;color:var(--text3);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name} · ${formatFileSize(file.size)}</span>
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Display Name</label>
        <input class="form-input" id="manage-file-name" type="text" value="${nameNoExt}" style="font-size:12px;">
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Link to Project</label>
        <select class="form-select" id="mf-project-select" style="font-size:12px;" onchange="mfProjectChange()">
          ${projectOptions}
        </select>
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Categories</label>
        <div id="manage-file-cats" style="display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 10px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);">
          ${catChecks}
        </div>
      </div>
      <div id="mf-people-section" style="display:${cats.includes('people')?'block':'none'};margin-bottom:10px;">
        <label class="form-label">Who's in this?</label>
        <div id="mf-people-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;min-height:10px;">
          ${peopleTagsHtml}
        </div>
        <div style="position:relative;">
          <input class="form-input" id="mf-people-input" placeholder="Search or add person…" style="font-size:12px;" autocomplete="off"
            oninput="mfPeopleSearch(this)" onkeydown="mfPeopleKey(event)">
          <div id="mf-people-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);z-index:100;max-height:150px;overflow-y:auto;box-shadow:var(--shadow);"></div>
        </div>
        <div style="margin-top:5px;font-size:10px;color:var(--text3);">New people will be added to project contacts on save.</div>
      </div>
      <div id="mf-location-section" style="display:${cats.includes('location')?'block':'none'};margin-bottom:10px;">
        <label class="form-label">Linked Location</label>
        <select class="form-select" id="mf-location-select" style="font-size:12px;" onchange="mfLocationSelectChange()">
          ${locationOptions}
        </select>
        <div id="mf-location-new-row" style="display:none;margin-top:6px;">
          <input class="form-input" id="mf-location-new" placeholder="New location name…" style="font-size:12px;">
          <div style="margin-top:4px;font-size:10px;color:var(--text3);">Will be added to this project's locations.</div>
        </div>
      </div>
      <div style="margin-bottom:10px;">
        <label class="form-label">Description / Notes <span style="color:var(--text3);font-weight:400">(optional)</span></label>
        <input class="form-input" id="manage-file-desc" type="text" value="${file.description || ''}" placeholder="e.g. Final draft, Location scout photos…" style="font-size:12px;">
      </div>
      <div id="mf-alt-section" style="display:${isImage?'block':'none'};">
        <label class="form-label">Alt Text <span style="color:var(--text3);font-weight:400">(for accessibility)</span></label>
        <input class="form-input" id="mf-alt-input" value="${file.altText || ''}" placeholder="Describe the image for screen readers" style="font-size:12px;">
      </div>
    </div>`;

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

  const tag = document.createElement('span');
  tag.dataset.mfperson = name;
  tag.dataset.role = existingRole || '';
  tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = '👤 ' + name;
  tag.appendChild(nameSpan);

  // For new contacts, show a small role input inside the tag (matches upload modal)
  if (isNew && !existingRole) {
    const roleInput = document.createElement('input');
    roleInput.placeholder = 'role…';
    roleInput.setAttribute('list', 'roles-datalist');
    roleInput.style.cssText = 'width:70px;font-size:10px;padding:1px 4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);outline:none;';
    roleInput.addEventListener('input', () => { tag.dataset.role = roleInput.value.trim(); });
    roleInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    tag.appendChild(roleInput);
  }

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

  // Alt text
  file.altText = document.getElementById('mf-alt-input').value.trim();

  saveStore();
  closeModal('modal-manage-file');
  renderFiles(); ovFilesRender();
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

  let inferredPid = sourcePid;
  if (!inferredPid && ids.length === 1) {
    const f = (store.files || []).find(f => f.id === ids[0]);
    if (f) {
      const pids = fileProjectIds(f);
      if (pids.length === 1) inferredPid = pids[0];
    }
  }

  const sourceLabel = inferredPid
    ? (store.projects.find(p => p.id === inferredPid)?.title || 'this project')
    : 'current projects';

  document.getElementById('move-file-ids-store').dataset.ids = JSON.stringify(ids);
  document.getElementById('move-file-source-pid').value = inferredPid ?? '';
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
    const file = (store.files || []).find(f => f.id === id);
    if (!file) return;
    if (!Array.isArray(file.projectIds)) { file.projectIds = fileProjectIds(file); delete file.projectId; }

    // If target is same as source, just keep it (unless user specifically wanted to move but change their mind to the same project?)
    // But targetPid should not be sourcePid based on UI, but if it is, we should not delete it.
    const isActuallyNew = !file.projectIds.map(String).includes(String(targetPid));
    if (isActuallyNew) file.projectIds.push(targetPid);

    if (!keepCopy && sourcePid !== null) {
      // Use string comparison to be robust
      file.projectIds = file.projectIds.filter(p => String(p) !== String(sourcePid));
      // Ensure we don't accidentally leave it empty if target was same as source
      if (file.projectIds.length === 0 && isActuallyNew) file.projectIds.push(targetPid);
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
  renderFiles();
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

  // ── SIZE CHECK ─────────────────────────────────────────────────────────────
  const validFiles = Array.from(fileList).filter(file => {
    return _bfCheckFileSize(file, _bfGetFileType(file));
  });
  if (validFiles.length === 0) return;
  if (validFiles.length < fileList.length) {
    showToast(`${fileList.length - validFiles.length} file${fileList.length - validFiles.length > 1 ? 's' : ''} skipped (too large)`, 'info', 4000);
  }
  // ── END SIZE CHECK ─────────────────────────────────────────────────────────

  // Populate project selector
  const projSelect = document.getElementById('upload-project-select');
  const currentProjId = presetProjectId ?? currentProject()?.id;
  projSelect.innerHTML = store.projects.map(proj =>
    `<option value="${proj.id}" ${proj.id === currentProjId ? 'selected' : ''}>${proj.title || 'Untitled Project'}</option>`
  ).join('');

  const container = document.getElementById('upload-file-list');
  container.innerHTML = '';

  validFiles.forEach((file, idx) => {
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
      folderId: currentFolderId,
      projectIds: [projectId],
      uploadedAt: new Date().toISOString(),
    });
    saved++;
  });

  saveStore();
  _pendingFiles = [];
  closeModal('modal-upload-file');
  renderFiles();
  ovFilesRender();
  showToast(`${saved} file${saved !== 1 ? 's' : ''} uploaded`, 'success');
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return diffSec <= 1 ? 'Just now' : `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function downloadFile(id) {
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;
  file.modifiedAt = new Date().toISOString();
  saveStore();
  const link = document.createElement('a');
  link.href = file.data;
  link.download = file.name;
  link.click();
}

function viewFile(id) {
  const file = (store.files || []).find(f => f.id === id);
  if (!file) return;
  file.modifiedAt = new Date().toISOString();
  saveStore();
  const win = window.open();
  const ext = file.name.split('.').pop().toLowerCase();
  const isVideo = file.data.startsWith('data:video') || ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);
  if (file.data.startsWith('data:image')) {
    win.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${file.data}" alt="${file.altText || file.name}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
  } else if (ext === 'pdf') {
    win.document.write(`<!DOCTYPE html><html><head><title>${file.name}</title><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{height:100%;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${file.data}"></iframe></body></html>`);
  } else if (isVideo) {
    win.document.write(`<!DOCTYPE html><html><head><title>${file.name}</title><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{height:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;}video{max-width:100%;max-height:90vh;}h1{color:#fff;font-family:sans-serif;font-size:16px;font-weight:normal;margin:10px 0;}</style></head><body><video controls autoplay><source src="${file.data}" type="${file.type || 'video/mp4'}">Your browser does not support video playback.</video><h1>${file.name}</h1></body></html>`);
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

// ── EDITS / CUTS ──────────────────────────────────────────────────────────────────
let _pendingEditFile = null; // { file, dataUrl }
let _editUploadQueue = [];

function handleEditUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  const p = currentProject();
  if (!p) { showToast('Please select a project first', 'warning'); return; }

  // ── SIZE CHECK ─────────────────────────────────────────────────────────────
  const validFiles = Array.from(fileList).filter(file => _bfCheckFileSize(file, 'video'));
  if (validFiles.length === 0) return;
  if (validFiles.length < fileList.length) {
    showToast(`${fileList.length - validFiles.length} file${fileList.length - validFiles.length > 1 ? 's' : ''} skipped (too large)`, 'info', 4000);
  }
  // ── END SIZE CHECK ─────────────────────────────────────────────────────────

  // Process one file at a time via the modal
  _editUploadQueue = validFiles;
  _processNextEditUpload();
}

function _processNextEditUpload() {
  const p = currentProject();
  if (!p || !_editUploadQueue.length) return;
  
  const file = _editUploadQueue.shift();
  const reader = new FileReader();
  reader.onload = e => {
    _pendingEditFile = { file, dataUrl: e.target.result };
    openEditUploadModal(p, file);
  };
  reader.readAsDataURL(file);
}

function openEditUploadModal(p, file) {
  const nameNoExt = file.name.replace(/\.[^.]+$/, '');
  const euName = document.getElementById('eu-name');
  const euVersion = document.getElementById('eu-version');
  const euIsVersion = document.getElementById('eu-is-version');
  const euVersionRow = document.getElementById('eu-version-row');
  const euParentEdit = document.getElementById('eu-parent-edit');
  
  if (!euName || !euVersion || !euIsVersion || !euVersionRow || !euParentEdit) {
    console.error('[openEditUploadModal] Modal elements not found in DOM');
    // Modal HTML might not be loaded yet - try opening anyway
    openModal('modal-edit-upload');
    return;
  }
  
  euName.value = nameNoExt;
  euVersion.value = '';
  euIsVersion.checked = false;
  euVersionRow.style.display = 'none';
  
  // Populate existing edits dropdown - only show LATEST version of each edit
  const allEdits = store.files || [];
  const editsByBaseName = {};
  allEdits.forEach(f => {
    if (f.categories?.includes('edits') && f.projectIds?.includes(p.id)) {
      const key = f.baseName || f.id;
      if (!editsByBaseName[key] || (f.version || 1) > (editsByBaseName[key].version || 1)) {
        editsByBaseName[key] = f;
      }
    }
  });
  const existingEdits = Object.values(editsByBaseName).sort((a, b) => (b.version || 1) - (a.version || 1));
  
  const editOpts = existingEdits.length
    ? existingEdits.map(e => `<option value="${e.id}">${e.name}</option>`).join('')
    : '<option value="">— None —</option>';
  
  euParentEdit.innerHTML = editOpts;
  
  // If there are existing edits, pre-check the version checkbox
  if (existingEdits.length > 0) {
    euIsVersion.checked = true;
    euVersionRow.style.display = 'block';
  }
  
  openModal('modal-edit-upload');
}

function confirmEditUpload() {
  const p = currentProject();
  if (!p || !_pendingEditFile) {
    console.log('[confirmEditUpload] early exit - p:', !!p, '_pendingEditFile:', !!_pendingEditFile);
    return;
  }
  
  const name = document.getElementById('eu-name').value.trim() || _pendingEditFile.file.name;
  const versionLabel = document.getElementById('eu-version').value.trim();
  const isVersion = document.getElementById('eu-is-version').checked;
  const parentId = document.getElementById('eu-parent-edit').value;
  
  const ext = _pendingEditFile.file.name.split('.').pop().toLowerCase();
  
  // Determine version number and baseName
  let version = 1;
  let baseName = 'edit_' + makeId(); // Unique baseName for standalone edits
  
  if (isVersion && parentId) {
    const parent = (store.files || []).find(f => f.id === parentId);
    if (parent) {
      version = (parent.version || 1) + 1;
      baseName = parent.baseName || 'edit_' + parent.id;
    }
  }
  
  // Store version label separately, not in the filename
  const displayName = name + '.' + ext;
  
  store.files = store.files || [];
  const newFile = {
    id: makeId(),
    name: displayName,
    categories: ['edits'],
    people: [],
    location: '',
    description: '',
    altText: '',
    type: _pendingEditFile.file.type,
    size: _pendingEditFile.file.size,
    data: _pendingEditFile.dataUrl,
    folderId: null,
    projectIds: [p.id],
    uploadedAt: new Date().toISOString(),
    version: version,
    versionLabel: versionLabel || null,
    baseName: baseName
  };
  store.files.push(newFile);
  console.log('[confirmEditUpload] File added, total files:', store.files.length, '| file data length:', newFile.data?.length);
  
  saveStore();
  closeModal('modal-edit-upload');
  renderOverviewEdits();
  renderFiles();
  showToast('Edit uploaded', 'success');
  
  _pendingEditFile = null;
  
  // Process next file in queue if any
  if (_editUploadQueue.length) _processNextEditUpload();
}

function renderOverviewEdits() {
  const p = currentProject();
  console.log('[renderOverviewEdits] p:', !!p, 'currentProjectId:', store.currentProjectId);
  if (!p) return;
  
  const grid = document.getElementById('overview-edits-grid');
  const empty = document.getElementById('overview-edits-empty');
  if (!grid || !empty) {
    console.log('[renderOverviewEdits] grid or empty not found, grid:', !!grid, 'empty:', !!empty);
    return;
  }
  
  const allFiles = store.files || [];
  console.log('[renderOverviewEdits] Total files:', allFiles.length, '| projectId:', p.id);
  
  const edits = allFiles.filter(f => {
    const hasCategory = f.categories?.includes('edits');
    const hasProject = f.projectIds?.includes(p.id);
    return hasCategory && hasProject;
  }).sort((a, b) => {
    // First sort by baseName to group versions together
    const aKey = a.baseName || a.id;
    const bKey = b.baseName || b.id;
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    // Then sort by version number (highest first)
    return (b.version || 1) - (a.version || 1);
  });
  
  console.log('[renderOverviewEdits] Filtered edits:', edits.length, '| edits:', edits.map(e => e.name));
  
  if (edits.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  
  // Group by base name for version display
  const grouped = {};
  edits.forEach(edit => {
    const key = edit.baseName || edit.name.replace(/\.[^.]+$/, '').toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(edit);
  });
  
  let html = '';
  Object.entries(grouped).forEach(([baseName, versionList]) => {
    const latest = versionList[0];
    const versions = versionList.length;
    const displayTitle = latest.name.replace(/\.[^.]+$/, '');
    // Use stored versionLabel field, fallback to auto version number
    const customLabel = latest.versionLabel;
    const versionDisplay = customLabel ? customLabel : (versions > 1 ? `v${latest.version || 1}` : '');
    
    html += `
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:12px;position:relative;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:48px;height:48px;background:var(--surface3);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🎞</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${displayTitle}">${displayTitle}</div>
            <div style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;">
              ${versionDisplay ? `<span style="background:var(--accent);color:var(--bg);padding:1px 6px;border-radius:3px;font-weight:600;">${versionDisplay}</span>` : '<span>Single edit</span>'}
              ${versions > 1 ? `<span>(${versions} versions)</span>` : ''}
              <span>•</span>
              <span>${formatFileSize(latest.size)}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="btn btn-sm" style="flex:1;font-size:11px;" onclick="openVideoPlayer('${latest.id}')">▶ Play</button>
          <button class="btn btn-sm" style="flex:1;font-size:11px;" onclick="downloadFile('${latest.id}')">⬇ Download</button>
        </div>
        ${versions > 1 ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border2);">
            <div style="font-size:10px;color:var(--text3);margin-bottom:6px;">PREVIOUS VERSIONS</div>
            <div style="display:flex;flex-direction:column;gap:4px;max-height:80px;overflow-y:auto;">
              ${versionList.slice(1).map(v => {
                const prevLabel = v.versionLabel || `v${v.version || 1}`;
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;padding:4px 6px;background:var(--surface3);border-radius:3px;">
                  <span>${prevLabel}</span>
                  <div style="display:flex;gap:4px;">
                    <button onclick="openVideoPlayer('${v.id}')" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0 4px;">▶</button>
                    <button onclick="downloadFile('${v.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0 4px;">⬇</button>
                  </div>
                </div>
              `;}).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  grid.innerHTML = html;
}

// ── VIDEO PLAYER MODAL ─────────────────────────────────────────────────────────────

function openVideoPlayer(fileId) {
  const file = (store.files || []).find(f => f.id === fileId);
  if (!file) return;
  
  const ext = file.name.split('.').pop().toLowerCase();
  const isVideo = file.data.startsWith('data:video') || ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);
  if (!isVideo) {
    viewFile(fileId);
    return;
  }
  
  document.getElementById('vp-title').textContent = file.name;
  document.getElementById('vp-info').textContent = formatFileSize(file.size);
  
  const video = document.getElementById('vp-video');
  video.src = file.data;
  video.load();
  
  const dlBtn = document.getElementById('vp-download');
  dlBtn.href = file.data;
  dlBtn.download = file.name;
  
  openModal('modal-video-player');
}

function toggleVideoFullscreen() {
  const container = document.getElementById('vp-container');
  const video = document.getElementById('vp-video');
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (video.requestFullscreen) {
    video.requestFullscreen();
  }
}

// Main file upload zone (Files tab) - now attached in renderFiles() after view is loaded

// Overview project files area (drop zone now on #ov-files-list)
const ovFilesList = document.getElementById('ov-files-list');
if (ovFilesList) {
  ovFilesList.classList.add('drop-zone');
  _makeDrop(ovFilesList, files => ovFilesUpload(files));
}

// Script & Docs section
const sectionScript = document.getElementById('section-script');
if (sectionScript) {
  sectionScript.classList.add('drop-zone');
  _makeDrop(sectionScript, handleScriptUpload);
}

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
    directors: data.directors || (data.director ? [data.director] : []),
    producers: data.producers || (data.producer ? [data.producer] : []),
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
    gearList: [],
    gearPool: [],
    locations: [],
    scoutingSheets: [],
    breakdown: [],
    scriptBreakdown: { rawText: '', tags: [] },
    callsheets: [],
    schedule: [],
    scripts: [],
    brief: { template: null, fields: {}, removedKeys: [], customFields: [] },
    customSections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
  // 1. Record activity for the current section
  const p = currentProject();
  if (p && _activeSection && _activeSection !== 'overview') {
    if (!p.sectionActivity) p.sectionActivity = {};
    p.sectionActivity[_activeSection] = Date.now();
  }
  
  // 2. Visual Feedback
  if (window.SaveFeedback) {
    SaveFeedback.showSaving();
  }

  // 3. PRIMARY SAVE: IndexedDB (This is your "Source of Truth")
  let idbSuccess = false;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(store, 'v1');
      tx.oncomplete = () => { idbSuccess = true; resolve(); };
      tx.onerror = () => reject(tx.error);
    });
    console.log('[saveStore] IndexedDB success');
  } catch(e) {
    console.error('[saveStore] IndexedDB failed:', e);
    showToast('Primary save failed! Please export your data manually.', 'error');
    return; // Stop here if primary save fails
  }

  // 4. SECONDARY SAVE: Supabase Cloud (The "Backup")
  // We only run this if we are logged in.
  if (typeof sbPushStore === 'function') {
    const now = Date.now();
    if (now - _lastCloudPush > CLOUD_PUSH_INTERVAL) {
      _lastCloudPush = now;
      try {
        await sbPushStore();
      } catch(e) {
        console.warn('[saveStore] Cloud sync failed:', e);
      }
    }
  }

  // 5. EMERGENCY FALLBACK: LocalStorage
  // Save essential data to localStorage as backup for when IndexedDB fails
  // Only store metadata and small data - NOT large moodboards or files
  try {
    localStorage.setItem('bf_last_save', Date.now().toString());
    localStorage.setItem('bf_currentProjectId_backup', store.currentProjectId || '');
    // Save only essential data - skip large arrays like moodboards and files
    if (store.projects) {
      try { localStorage.setItem('bf_projects_backup', JSON.stringify(store.projects)); } catch(e) {}
    }
    if (store.contacts) {
      try { localStorage.setItem('bf_contacts_backup', JSON.stringify(store.contacts)); } catch(e) {}
    }
    if (store.locations) {
      try { localStorage.setItem('bf_locations_backup', JSON.stringify(store.locations)); } catch(e) {}
    }
    if (store.folders) {
      try { localStorage.setItem('bf_folders_backup', JSON.stringify(store.folders)); } catch(e) {}
    }
    if (store.teamMembers) {
      try { localStorage.setItem('bf_team_backup', JSON.stringify(store.teamMembers)); } catch(e) {}
    }
    localStorage.setItem('bf_backup_timestamp', Date.now().toString());
    console.log('[saveStore] LocalStorage backup saved');
  } catch(e) { 
    console.warn('[saveStore] LocalStorage backup failed:', e.message);
  }

  // 6. Visual feedback - show saved
  if (window.SaveFeedback) {
    SaveFeedback.showSaved();
  }

  // 7. Notify the rest of the app
  if (typeof EventBus !== 'undefined') {
    EventBus.emit(EventBus.Events.DATA_SAVED, { timestamp: Date.now() });
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
  
  // Note: Auto-backup removed to avoid performance issues. Users can manually export from Settings.
}

function triggerAutoSave() {
  _lastAutoSave = Date.now();
  saveStore();
}

async function loadStore() {
  let loaded = null;
  let migrateFromLS = false;
  let localFileBlobMap = {};

  // Always load IDB first — it holds file blobs that never go to Supabase
  try {
    const db = await openDB();
    const idbData = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('v1');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (idbData) {
      loaded = idbData;
      const fileCount = (idbData.files || []).length;
      const blobCount = (idbData.files || []).filter(f => f.data).length;
      console.log('[loadStore] IDB loaded, files:', fileCount, 'with blobs:', blobCount);
      (idbData.files || []).forEach(f => { if (f.data) localFileBlobMap[f.id] = f.data; });
    }
  } catch(e) {
    console.error('[loadStore] IDB error, trying localStorage:', e);
  }

  // If logged in, pull from Supabase — it's the authoritative source for project data
  // BUT we need to preserve local file blobs since they're not stored in the cloud
  console.log('[loadStore] Checking cloud sync: sbPullStore exists:', typeof sbPullStore === 'function', '| _sbUser:', _sbUser);
  const _skipCloudPull = localStorage.getItem('bf_skip_cloud_pull') === '1';
  if (!_skipCloudPull && typeof sbPullStore === 'function' && _sbUser) {
    localStorage.removeItem('bf_skip_cloud_pull'); // consume only when we'd actually pull
    try {
      const cloudData = await Promise.race([
        sbPullStore(),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);
      if (cloudData && cloudData.projects !== undefined) {
        // Get local backup timestamp to compare
        const localTimestamp = (() => {
          try {
            const idbData = localStorage.getItem('bf_backup_timestamp');
            return idbData ? parseInt(idbData, 10) : 0;
          } catch(e) { return 0; }
        })();
        const cloudTimestamp = cloudData._lastSave || cloudData.lastSave || 0;
        
        // If local is newer than cloud, preserve local data instead of letting cloud overwrite
        if (loaded && loaded.projects && loaded.projects.length > 0 && localTimestamp > cloudTimestamp) {
          console.log('[loadStore] Local data is newer than cloud (' + localTimestamp + ' > ' + cloudTimestamp + '), keeping local');
          // Push local to cloud for sync
          setTimeout(() => typeof sbPushStore === 'function' && sbPushStore(), 1000);
        } else {
          // Capture local file blobs BEFORE overwriting with cloud data
          if (loaded && loaded.files) {
            loaded.files.forEach(f => { if (f.data) localFileBlobMap[f.id] = f.data; });
            console.log('[loadStore] Saved local blobs before cloud sync:', Object.keys(localFileBlobMap).length);
          }
          loaded = cloudData;
          console.log('[loadStore] Cloud data loaded, files in cloud:', (cloudData.files || []).length);
        }
      } else if (loaded) {
        console.log('[loadStore] Cloud unavailable, using local data');
        sbPushStore(); // push local up when connection recovers
      }
    } catch(e) {
      console.warn('[loadStore] Supabase pull failed, using local data:', e);
    }
  }

  if (!loaded) {
    // First run or IDB unavailable — try localStorage
    try {
      const raw = localStorage.getItem('blackfountain_v1');
      if (raw) { loaded = JSON.parse(raw); migrateFromLS = true; }
    } catch(e) {}
  }

  // Try to restore from our new localStorage backups if IDB failed
  if (!loaded || !loaded.projects || loaded.projects.length === 0) {
    try {
      const projectsJson = localStorage.getItem('bf_projects_backup');
      const contactsJson = localStorage.getItem('bf_contacts_backup');
      const locationsJson = localStorage.getItem('bf_locations_backup');
      const foldersJson = localStorage.getItem('bf_folders_backup');
      const moodboardsJson = localStorage.getItem('bf_moodboards_backup');
      const teamJson = localStorage.getItem('bf_team_backup');
      const currentPid = localStorage.getItem('bf_currentProjectId_backup');
      const timestamp = localStorage.getItem('bf_backup_timestamp');
      
      if (projectsJson) {
        loaded = loaded || {};
        loaded.projects = JSON.parse(projectsJson);
        if (contactsJson) loaded.contacts = JSON.parse(contactsJson);
        if (locationsJson) loaded.locations = JSON.parse(locationsJson);
        if (foldersJson) loaded.folders = JSON.parse(foldersJson);
        if (moodboardsJson) loaded.moodboards = JSON.parse(moodboardsJson);
        if (teamJson) loaded.teamMembers = JSON.parse(teamJson);
        if (currentPid) loaded.currentProjectId = currentPid || null;
        console.log('[loadStore] Restored from localStorage backup, timestamp:', timestamp);
        migrateFromLS = true;
      }
    } catch(e) { console.warn('[loadStore] localStorage backup restore failed:', e); }
  }

  if (loaded) {
    Object.assign(store, loaded);
    if (!store.projects) store.projects = [];
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

    // Migrate: Ensure all projects have IDs and required fields
    store.projects.forEach(p => {
      if (!p.id) p.id = makeId();
      if (!p.gearList) p.gearList = [];
      if (!p.gearPool) p.gearPool = [];
      if (!p.equipment) p.equipment = {};
      if (!p.callsheets) p.callsheets = [];
      if (!p.cast) p.cast = [];
      if (!p.extras) p.extras = [];
      if (!p.unit) p.unit = [];
      if (!p.schedule) p.schedule = [];
      if (!p.scripts) p.scripts = [];
      if (!p.locations) p.locations = [];
      if (!p.scoutingSheets) p.scoutingSheets = [];
      if (!p.breakdown) p.breakdown = [];
    });

    // Migrate: convert legacy currentProjectId (array index) to project UUID string
    if (typeof store.currentProjectId === 'number') {
      store.currentProjectId = store.projects[store.currentProjectId]?.id ?? null;
    }

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

    // Migrate: convert legacy integer projectIds in moodboards
    store.moodboards.forEach(b => {
      if (typeof b.projectId === 'number') {
        b.projectId = store.projects[b.projectId]?.id ?? null;
      }
    });
    // Restore file blobs from local IDB (they're never sent to Supabase)
    const filesWithDataBefore = store.files?.filter(f => f.data)?.length || 0;
    if (Object.keys(localFileBlobMap).length) {
      store.files.forEach(f => { if (!f.data && localFileBlobMap[f.id]) f.data = localFileBlobMap[f.id]; });
    }
    const filesWithDataAfter = store.files?.filter(f => f.data)?.length || 0;
    console.log('[loadStore] File blobs restored:', filesWithDataBefore, '->', filesWithDataAfter, '| localFileBlobMap size:', Object.keys(localFileBlobMap).length);
    
    // If still no file data, try localStorage backup
    if (filesWithDataAfter === 0) {
      try {
        const backup = localStorage.getItem('blackfountain_backup');
        if (backup) {
          const backupData = JSON.parse(backup);
          if (backupData.files) {
            const filesWithBackupData = backupData.files.filter(f => f.data).length;
            console.log('[loadStore] Trying localStorage backup, files with data:', filesWithBackupData);
            if (filesWithBackupData > 0) {
              store.files = backupData.files;
            }
          }
        }
      } catch(e) { console.warn('[loadStore] localStorage backup restore failed:', e); }
    }
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

function ovFilesUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  const p = currentProject();
  if (!p) return;
  store.files = store.files || [];
  let count = 0;
  const readers = Array.from(fileList).map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      store.files.push({
        id: makeId(),
        name: file.name,
        categories: ['other'],
        people: [],
        description: '',
        type: file.type,
        size: file.size,
        data: e.target.result,
        folderId: null,
        projectIds: [p.id],
        uploadedAt: new Date().toISOString(),
      });
      count++;
      resolve();
    };
    reader.readAsDataURL(file);
  }));
  Promise.all(readers).then(() => {
    saveStore();
    ovFilesRender();
    showToast(`${count} file${count !== 1 ? 's' : ''} uploaded`, 'success');
  });
}

function ovFilesRender() {
  const p = currentProject();
  const el = document.getElementById('ov-files-list');
  const storageEl = document.getElementById('ov-files-storage');
  if (!el || !p) return;

  const files = (store.files || []).filter(f =>
    (f.projectIds || []).includes(p.id)
  );

  // Storage bar
  if (storageEl) {
    const used = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const maxBytes = 100 * 1024 * 1024; // 100MB
    const pct = Math.min((used / maxBytes) * 100, 100).toFixed(1);
    const usedStr = formatFileSize(used);
    storageEl.innerHTML = `
      <span style="color:var(--text3);">${usedStr} of 100 MB</span>
      <span style="display:inline-block;width:80px;height:4px;background:var(--surface3);border-radius:2px;vertical-align:middle;margin-left:6px;overflow:hidden;">
        <span style="display:block;height:100%;width:${pct}%;background:${pct > 85 ? 'var(--red)' : 'var(--accent)'};border-radius:2px;"></span>
      </span>`;
  }

  if (files.length === 0) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px;border:1px dashed var(--border2);border-radius:var(--radius);">No files yet — upload scripts, photos, contracts and more</div>`;
    return;
  }

  const EXT_ICON = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📃', fdx: '🎬', fountain: '🎬',
    mp4: '🎞', mov: '🎞', avi: '🎞', mkv: '🎞', webm: '🎞',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼',
    mp3: '🎵', wav: '🎵', zip: '📦', rar: '📦',
  };

  el.innerHTML = files.map(f => {
    const ext = (f.name || '').split('.').pop().toLowerCase();
    const icon = EXT_ICON[ext] || '📁';
    const date = f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-bottom:1px solid var(--border2);font-size:12px;" id="ovf-${f.id}">
      <span style="font-size:18px;flex-shrink:0;">${icon}</span>
      <span id="ovf-name-${f.id}" style="flex:1;color:var(--text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" onclick="ovFilesView('${f.id}')" title="${f.name}">${f.name}</span>
      <span style="color:var(--text3);flex-shrink:0;">${formatFileSize(f.size)}</span>
      <span style="color:var(--text3);flex-shrink:0;font-size:11px;">${date}</span>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-sm" onclick="ovFilesRename('${f.id}')" title="Rename">✏️</button>
        <button class="btn btn-sm" onclick="ovFilesDownload('${f.id}')" title="Download">⬇</button>
        <button class="btn btn-sm btn-danger" onclick="ovFilesDelete('${f.id}')" title="Delete">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function ovFilesView(id) {
  const f = (store.files || []).find(f => f.id === id);
  if (!f || !f.data) return;
  const win = window.open();
  const ext = (f.name || '').split('.').pop().toLowerCase();
  if (f.data.startsWith('data:image')) {
    win.document.write(`<html><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${f.data}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
  } else if (ext === 'pdf') {
    win.document.write(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}html,body{height:100%;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${f.data}"></iframe></body></html>`);
  } else {
    win.document.write(`<html><body style="margin:20px;font-family:sans-serif;"><h2>${f.name}</h2><p style="color:#666;">${formatFileSize(f.size)}</p><a href="${f.data}" download="${f.name}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#e6bc3c;color:#000;text-decoration:none;border-radius:4px;font-weight:600;">Download</a></body></html>`);
  }
  win.document.close();
}

function ovFilesRename(id) {
  const f = (store.files || []).find(f => f.id === id);
  if (!f) return;
  const nameEl = document.getElementById(`ovf-name-${id}`);
  const current = f.name;
  // Inline edit
  if (nameEl) {
    nameEl.contentEditable = 'true';
    nameEl.focus();
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const finish = () => {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim();
      if (newName && newName !== current) {
        f.name = newName;
        saveStore();
        showToast('Renamed', 'success');
      } else {
        nameEl.textContent = current;
      }
      nameEl.removeEventListener('blur', finish);
      nameEl.removeEventListener('keydown', keyHandler);
    };
    const keyHandler = e => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = current; nameEl.blur(); }
    };
    nameEl.addEventListener('blur', finish);
    nameEl.addEventListener('keydown', keyHandler);
  }
}

function ovFilesDownload(id) {
  const f = (store.files || []).find(f => f.id === id);
  if (!f) return;
  const a = document.createElement('a');
  a.href = f.data;
  a.download = f.name;
  a.click();
}

function ovFilesDelete(id) {
  const f = (store.files || []).find(f => f.id === id);
  if (!f) return;
  showConfirmDialog(`Delete "${f.name}"? This cannot be undone.`, 'Delete File', () => {
    store.files = (store.files || []).filter(f => f.id !== id);
    saveStore();
    ovFilesRender();
    showToast('File deleted', 'success');
  });
}

