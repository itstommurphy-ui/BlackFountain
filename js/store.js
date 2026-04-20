document.body.classList.add('loading');
// ══════════════════════════════════════════
// IMPORTANT: All new features should be WCAG 2.2 AA compliant
// - Ensure color contrast ratios are at least 4.5:1 for normal text
// - Ensure all interactive elements have accessible names
// - Ensure keyboard navigation works for all features
// - Ensure form inputs have labels
// - Ensure error messages are announced to screen readers
// ══════════════════════════════════════════

// DATA STORE
// ══════════════════════════════════════════
let store = {
  projects: [],
  teamMembers: [],
  currentProjectId: null,
  files: [],
  folders: [],
  contacts: [],
  locations: [],
  contactColumns: [],
  contactCustomData: {},
  contactHiddenCols: [],
  locationHiddenCols: [],
  locationColumns: [],
  locationCustomData: {},
  moodboards: []
};

const FILE_CATEGORIES = {
  script:     { label: 'Scripts',          icon: '📄', extensions: ['pdf','doc','docx','txt','fdx'] },
  location:   { label: 'Location Photos',  icon: '📍', extensions: ['jpg','jpeg','png','gif','webp'] },
  bts:        { label: 'BTS',             icon: '🎬', extensions: ['jpg','jpeg','png','gif','webp'] },
  stills:     { label: 'Stills',          icon: '📸', extensions: ['jpg','jpeg','png','gif','webp'] },
  people:     { label: 'People',           icon: '👥', extensions: ['jpg','jpeg','png','gif','webp'] },
  moodboard:  { label: 'Moodboards',       icon: '🎨', extensions: ['jpg','jpeg','png','gif','webp'] },
  storyboard: { label: 'Storyboards',      icon: '🖼️', extensions: ['jpg','jpeg','png','gif','webp','pdf'] },
  contract:   { label: 'Contracts',        icon: '📋', extensions: ['pdf','doc','docx'] },
  edits:      { label: 'Edits',            icon: '🎞️', extensions: ['mp4','mov','avi','mkv','webm','m4v'] },
  other:      { label: 'Other',            icon: '📁', extensions: [] },
};

// Normalise file → always read categories as array (migrates old single category string)
function fileCategories(file) {
  if (Array.isArray(file.categories)) return file.categories;
  if (file.category && file.category !== '') return [file.category];
  return ['other'];
}

function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [cat, info] of Object.entries(FILE_CATEGORIES)) {
    if (info.extensions.includes(ext)) return cat;
  }
  return 'other';
}

function getFileIcon(file) {
  if (file.data) {
    // Check for image
    if (file.data.startsWith('data:image')) {
      return `<img src="${file.data}" alt="${file.altText || file.name}">`;
    }
    // Check for video
    if (file.data.startsWith('data:video') || file.type?.startsWith('video/')) {
      return `<video src="${file.data}" controls preload="metadata" style="width:100%;height:100%;object-fit:contain;max-height:120px;"></video>`;
    }
    // Check for audio
    if (file.data.startsWith('data:audio') || file.type?.startsWith('audio/')) {
      return `<audio src="${file.data}" controls preload="none" style="width:100%;"></audio>`;
    }
  }
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (ext === 'txt') return '📃';
  if (['fdx'].includes(ext)) return '🎞️';
  // Check for audio/video extensions even if data is missing
  if (['mp3','wav','ogg','m4a','aac','flac'].includes(ext)) return '🎵';
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return '🎬';
  return FILE_CATEGORIES[file.category]?.icon || '📁';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

let currentFileCategory = 'all';
let currentFolderId = null;
let _mfNewPersonCallback = null; // set when opening contact modal from file-tagging flow
const selectedFileIds = new Set();

// Normalise file → always read projectIds as array (migrates old single projectId)
function fileProjectIds(file) {
  if (Array.isArray(file.projectIds)) return file.projectIds;
  if (file.projectId !== undefined && file.projectId !== null) return [file.projectId];
  return [];
}

// Folder helper functions
function getFolderById(id) {
  return store.folders?.find(f => f.id === id);
}

function getFolderFiles(folderId) {
  return (store.files || []).filter(f => f.folderId === folderId);
}

function getRootFiles() {
  return (store.files || []).filter(f => !f.folderId);
}

function createFolder(name, parentId = null, projectId = null) {
  const folder = {
    id: 'folder_' + Date.now(),
    name: name,
    parentId: parentId,
    projectId: projectId,
    createdAt: new Date().toISOString()
  };
  if (!store.folders) store.folders = [];
  store.folders.push(folder);
  saveStore();
  return folder;
}

function deleteFolder(folderId) {
  // Move files in this folder to root
  store.files.forEach(f => {
    if (f.folderId === folderId) f.folderId = null;
  });
  // Delete subfolder references
  store.folders.forEach(f => {
    if (f.parentId === folderId) f.parentId = null;
  });
  // Remove the folder
  store.folders = store.folders.filter(f => f.id !== folderId);
  saveStore();
}

function renameFolder(folderId, newName) {
  const folder = getFolderById(folderId);
  if (folder) {
    folder.name = newName;
    saveStore();
  }
}

function moveFileToFolder(fileId, folderId) {
  const file = store.files.find(f => f.id === fileId);
  if (file) {
    file.folderId = folderId;
    saveStore();
  }
}

function moveFolderToProject(folderId, projectId) {
  const folder = getFolderById(folderId);
  if (folder) {
    // If parent folder exists but is in a different project, move to root of new project
    if (folder.parentId) {
      const parentFolder = getFolderById(folder.parentId);
      if (parentFolder && parentFolder.projectId !== projectId) {
        folder.parentId = null;
      }
    }
    
    // Move folder to new project
    folder.projectId = projectId;
    
    // Also attach all files in this folder to the new project
    const folderFiles = getFolderFiles(folderId);
    folderFiles.forEach(file => {
      // If file is in a folder that isn't in this project, move file to root
      if (file.folderId) {
        const fileFolder = getFolderById(file.folderId);
        if (fileFolder && fileFolder.projectId !== projectId) {
          file.folderId = null;
        }
      }
      
      if (!Array.isArray(file.projectIds)) {
        file.projectIds = file.projectId ? [file.projectId] : [];
      }
      // Add new project if not already present
      if (!file.projectIds.includes(projectId)) {
        file.projectIds.push(projectId);
      }
    });
    
    saveStore();
  }
}

function moveFolderToParent(folderId, parentFolderId) {
  const folder = getFolderById(folderId);
  if (folder) {
    // Prevent moving folder into itself or its own children
    if (parentFolderId === folderId) return;
    if (parentFolderId) {
      let check = getFolderById(parentFolderId);
      while (check && check.parentId) {
        if (check.parentId === folderId) return; // Would create circular reference
        check = getFolderById(check.parentId);
      }
    }
    folder.parentId = parentFolderId;
    saveStore();
  }
}

// ══════════════════════════════════════════
// DEBOUNCED SAVE
// ══════════════════════════════════════════

let _debouncedSaveTimer = null;
const _DEBOUNCE_DELAY = 300; // ms

/**
 * Debounced version of saveStore - batches rapid calls into a single save
 * Use this for high-frequency updates (e.g., typing in input fields)
 */
function debouncedSave() {
  if (_debouncedSaveTimer) {
    clearTimeout(_debouncedSaveTimer);
  }
  _debouncedSaveTimer = setTimeout(() => {
    saveStore();
    _debouncedSaveTimer = null;
  }, _DEBOUNCE_DELAY);
}

/**
 * Cancel any pending debounced save
 * Use this if you need to prevent a save (e.g., before a major operation)
 */
function cancelDebouncedSave() {
  if (_debouncedSaveTimer) {
    clearTimeout(_debouncedSaveTimer);
    _debouncedSaveTimer = null;
  }
}

/**
 * Force immediate save, canceling any pending debounced save
 */
function immediateSave() {
  cancelDebouncedSave();
  saveStore();
}

// ══════════════════════════════════════════
// BATCH OPERATIONS
// ══════════════════════════════════════════

let _batchMode = false;
let _batchChanges = [];
let _batchTimer = null;

/**
 * Begin a batch update mode - multiple changes will be consolidated
 * @param {number} [delay=500] - ms to wait after last change before saving
 */
function beginBatch(delay = 500) {
  _batchMode = true;
  _batchChanges = [];
}

/**
 * Record a change in batch mode
 * @param {string} description - Description of the change
 * @param {Function} changeFn - Function to execute the change
 */
function batchChange(description, changeFn) {
  if (!_batchMode) {
    // Not in batch mode, execute immediately
    changeFn();
    saveStore();
    return;
  }
  
  _batchChanges.push({ description, changeFn });
  
  // Reset the batch timer
  if (_batchTimer) {
    clearTimeout(_batchTimer);
  }
  
  _batchTimer = setTimeout(() => {
    flushBatch();
  }, 500);
}

/**
 * Execute all batched changes and save
 */
function flushBatch() {
  if (!_batchMode || _batchChanges.length === 0) {
    _batchMode = false;
    return;
  }
  
  // Execute all changes
  _batchChanges.forEach(({ changeFn }) => {
    try {
      changeFn();
    } catch (err) {
      console.error('[Batch] Change error:', err);
    }
  });
  
  // Save once
  saveStore();
  
  // Clear batch state
  _batchChanges = [];
  _batchMode = false;
  
  if (_batchTimer) {
    clearTimeout(_batchTimer);
    _batchTimer = null;
  }
}

/**
 * Cancel the current batch without saving
 */
function cancelBatch() {
  _batchChanges = [];
  _batchMode = false;
  if (_batchTimer) {
    clearTimeout(_batchTimer);
    _batchTimer = null;
  }
}

/**
 * Check if currently in batch mode
 * @returns {boolean} True if in batch mode
 */
function isBatchMode() {
  return _batchMode;
}

/**
 * Get number of pending batch changes
 * @returns {number} Number of changes waiting to be applied
 */
function getBatchSize() {
  return _batchChanges.length;
}

// ══════════════════════════════════════════
// MEMOIZATION UTILITY
// ══════════════════════════════════════════

const Memo = (function() {
  // Private: Cache store
  const _cache = new Map();
  
  /**
   * Create a memoized version of a function
   * @param {Function} fn - Function to memoize
   * @param {Function} [keyFn] - Optional function to generate cache key from arguments
   * @param {number} [ttl] - Optional time-to-live in ms
   * @returns {Function} Memoized function
   */
  function memoize(fn, keyFn, ttl) {
    return function(...args) {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      
      // Check cache
      const cached = _cache.get(key);
      if (cached) {
        // Check TTL if specified
        if (ttl && Date.now() - cached.timestamp > ttl) {
          _cache.delete(key);
        } else {
          return cached.value;
        }
      }
      
      // Compute and cache
      const value = fn.apply(this, args);
      _cache.set(key, { value, timestamp: Date.now() });
      return value;
    };
  }
  
  /**
   * Clear memoization cache
   * @param {string} [key] - Optional specific key to clear
   */
  function clear(key) {
    if (key) {
      _cache.delete(key);
    } else {
      _cache.clear();
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  function stats() {
    return {
      size: _cache.size,
      keys: Array.from(_cache.keys())
    };
  }
  
  /**
   * Create a render function wrapper with memoization
   * Automatically clears cache when store data changes
   * @param {Function} renderFn - The render function to wrap
   * @param {string} cacheKey - Key to identify this render
   * @returns {Function} Memoized render function
   */
  function memoizedRender(renderFn, cacheKey) {
    let lastHash = '';
    
    return function(...args) {
      // Generate a simple hash of relevant store state
      const project = typeof currentProject === 'function' ? currentProject() : null;
      const hash = project ? JSON.stringify({
        id: project.id,
        shots: project.shots?.length,
        schedule: project.schedule?.length,
        budget: project.budget?.length
      }) : '';
      
      // Clear cache if data changed
      if (hash !== lastHash) {
        clear(cacheKey);
        lastHash = hash;
      }
      
      const keyFn = () => cacheKey + '_' + hash;
      const memoized = memoize(renderFn, keyFn, 0); // No TTL for renders
      return memoized.apply(this, args);
    };
  }
  
  return {
    memoize,
    clear,
    stats,
    memoizedRender
  };
})();

// ══════════════════════════════════════════
// EVENTBUS DATA MUTATION WRAPPERS
// ══════════════════════════════════════════

/**
 * Wrap a data mutation to automatically emit events
 * Use this for all data changes to enable reactive cross-view updates
 */
function mutateData(operation, options = {}) {
  const { 
    eventName, 
    dataKey, 
    itemId, 
    itemData, 
    projectId = store.currentProjectId,
    autoSave = true 
  } = options;
  
  try {
    // Execute the mutation operation
    const result = operation();
    
    // Auto-save if enabled
    if (autoSave) {
      if (isBatchMode()) {
        batchChange(eventName || 'unknown', () => {});
      } else {
        debouncedSave();
      }
    }
    
    // Emit event if EventBus is available and event name provided
    if (eventName && window.EventBus) {
      EventBus.emit(eventName, {
        key: dataKey,
        id: itemId,
        data: itemData,
        projectId,
        timestamp: Date.now()
      });
      
      // Also emit generic DATA_CHANGED
      EventBus.emit(EventBus.Events.DATA_CHANGED, {
        key: dataKey,
        id: itemId,
        projectId
      });
    }
    
    // Clear relevant caches
    if (window.Memo) {
      Memo.clear();
    }
    if (window.Data) {
      Data.clearCache();
    }
    
    return result;
  } catch (error) {
    console.error('[MutateData] Error:', error);
    throw error;
  }
}

/**
 * Add an item to an array in store with automatic event emission
 */
function addStoreItem(arrayPath, item, options = {}) {
  const parts = arrayPath.split('.');
  return mutateData(() => {
    let obj = store;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    if (!obj[parts[parts.length - 1]]) {
      obj[parts[parts.length - 1]] = [];
    }
    obj[parts[parts.length - 1]].push(item);
    return item;
  }, {
    eventName: options.eventName || EventBus?.Events?.DATA_CHANGED,
    dataKey: arrayPath,
    itemId: item.id,
    itemData: item,
    projectId: options.projectId,
    autoSave: options.autoSave !== false
  });
}

/**
 * Update an item in store with automatic event emission
 */
function updateStoreItem(arrayPath, itemId, updates, options = {}) {
  const parts = arrayPath.split('.');
  return mutateData(() => {
    let obj = store;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    const arr = obj[parts[parts.length - 1]];
    const index = arr.findIndex(item => item.id === itemId);
    if (index !== -1) {
      arr[index] = { ...arr[index], ...updates };
      return arr[index];
    }
    return null;
  }, {
    eventName: options.eventName || EventBus?.Events?.DATA_CHANGED,
    dataKey: arrayPath,
    itemId: itemId,
    itemData: updates,
    projectId: options.projectId,
    autoSave: options.autoSave !== false
  });
}

/**
 * Remove an item from store with automatic event emission
 */
function removeStoreItem(arrayPath, itemId, options = {}) {
  const parts = arrayPath.split('.');
  return mutateData(() => {
    let obj = store;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    const arr = obj[parts[parts.length - 1]];
    const index = arr.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const removed = arr.splice(index, 1)[0];
      return removed;
    }
    return null;
  }, {
    eventName: options.eventName || EventBus?.Events?.DATA_CHANGED,
    dataKey: arrayPath,
    itemId: itemId,
    projectId: options.projectId,
    autoSave: options.autoSave !== false
  });
}

/**
 * Subscribe to specific data changes with automatic cleanup
 */
function subscribeToData(eventName, callback) {
  if (!window.EventBus) {
    console.warn('[SubscribeToData] EventBus not available');
    return () => {};
  }
  
  // Wrap callback to handle errors gracefully
  const safeCallback = (data) => {
    try {
      callback(data);
    } catch (error) {
      console.error('[SubscribeToData] Callback error:', error);
    }
  };
  
  return EventBus.on(eventName, safeCallback);
}

// ══════════════════════════════════════════
// SAVE FEEDBACK SYSTEM
// ══════════════════════════════════════════

const SaveFeedback = (function() {
  let pendingChanges = 0;
  let lastSaveTime = null;
  let el = null;
  let fadeTimer = null;

  function init() {
    el = document.getElementById('topbar-save-status');
  }

  function show(text, state) {
    if (!el) init();
    if (!el) return;
    clearTimeout(fadeTimer);
    el.textContent = text;
    if (state === 'saving') {
      el.style.color = 'var(--accent)';
    } else if (state === 'saved') {
      el.style.color = 'var(--green)';
    } else {
      el.style.color = 'var(--red)';
    }
    el.style.opacity = '1';
  }

  function hide() {
    if (!el) return;
    el.style.opacity = '0';
  }

  function showSaving() {
    show('Saving...', 'saving');
  }

  function showSaved() {
    show('Saved ✓', 'saved');
    lastSaveTime = Date.now();
    fadeTimer = setTimeout(hide, 2500);
  }

  function showPending() {
    pendingChanges++;
    show('Pending...', 'saving');
  }

  function showError(msg) {
    show('Save failed', 'error');
    fadeTimer = setTimeout(hide, 4000);
    if (typeof showToast === 'function') showToast('Save error: ' + msg, 'error');
  }

  function decrementPending() {
    pendingChanges = Math.max(0, pendingChanges - 1);
    if (pendingChanges === 0) {
      showSaved();
    }
  }

  function getPendingCount() {
    return pendingChanges;
  }

  function getLastSaveTime() {
    return lastSaveTime;
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    showSaving,
    showSaved,
    showPending,
    showError,
    decrementPending,
    getPendingCount,
    getLastSaveTime
  };
})();

// Export utilities to global scope
window.debouncedSave = debouncedSave;
window.cancelDebouncedSave = cancelDebouncedSave;
window.immediateSave = immediateSave;
window.beginBatch = beginBatch;
window.batchChange = batchChange;
window.flushBatch = flushBatch;
window.cancelBatch = cancelBatch;
window.isBatchMode = isBatchMode;
window.getBatchSize = getBatchSize;
window.Memo = Memo;
window.mutateData = mutateData;
window.addStoreItem = addStoreItem;
window.updateStoreItem = updateStoreItem;
window.removeStoreItem = removeStoreItem;
window.subscribeToData = subscribeToData;
window.SaveFeedback = SaveFeedback;

// ══════════════════════════════════════════
