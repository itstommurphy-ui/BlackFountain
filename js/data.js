// ══════════════════════════════════════════
// DATA ACCESS LAYER - Centralized Data Getters
// ══════════════════════════════════════════

/**
 * Data provides centralized access to application data with
 * caching, computed properties, and reactive updates.
 */

const Data = (function() {
  // Private: Cache for expensive computations
  const _cache = new Map();
  const _CACHE_TTL = 5000; // 5 seconds default TTL
  
  // Private: Helper to generate cache key
  function _cacheKey(...args) {
    return args.join('::');
  }
  
  // Private: Clear cache entry or all
  function _invalidateCache(key) {
    if (key) {
      _cache.delete(key);
    } else {
      _cache.clear();
    }
  }

  /**
   * Get current project from store
   * @returns {Object|null} Current project object
   */
  function currentProject() {
    if (!store.currentProjectId) return null;
    return store.projects?.find(p => p.id === store.currentProjectId) || null;
  }
  
  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Object|null} Project object
   */
  function getProject(projectId) {
    return store.projects?.find(p => p.id === projectId) || null;
  }
  
  /**
   * Get all projects
   * @returns {Array} Array of projects
   */
  function getProjects() {
    return store.projects || [];
  }
  
  /**
   * Get projects sorted by last activity
   * @returns {Array} Sorted array of projects
   */
  function getProjectsByActivity() {
    const projects = getProjects();
    return [...projects].sort((a, b) => {
      const aTime = a.sectionActivity ? Math.max(...Object.values(a.sectionActivity)) : 0;
      const bTime = b.sectionActivity ? Math.max(...Object.values(b.sectionActivity)) : 0;
      return bTime - aTime;
    });
  }
  
  /**
   * Get all contacts (global)
   * @returns {Array} Array of contacts
   */
  function getContacts() {
    return store.contacts || [];
  }
  
  /**
   * Find contact by name
   * @param {string} name - Contact name to search
   * @returns {Object|null} Contact object
   */
  function getContactByName(name) {
    return store.contacts?.find(c => c.name === name) || null;
  }
  
  /**
   * Get contacts by type (cast, crew, or both)
   * @param {string} [type] - Type filter: 'cast', 'crew', or undefined for all
   * @returns {Array} Filtered contacts
   */
  function getContactsByType(type) {
    const contacts = getContacts();
    if (!type) return contacts;
    
    return contacts.filter(c => {
      const cType = c.type || '';
      if (type === 'cast') return cType.includes('cast');
      if (type === 'crew') return cType.includes('crew');
      return true;
    });
  }
  
  /**
   * Get all locations (global)
   * @returns {Array} Array of locations
   */
  function getLocations() {
    return store.locations || [];
  }
  
  /**
   * Get location by name
   * @param {string} name - Location name
   * @returns {Object|null} Location object
   */
  function getLocationByName(name) {
    return store.locations?.find(l => l.name === name) || null;
  }
  
  /**
   * Get all files
   * @returns {Array} Array of files
   */
  function getFiles() {
    return store.files || [];
  }
  
  /**
   * Get files for a specific project
   * @param {string} projectId - Project ID
   * @returns {Array} Array of files for the project
   */
  function getProjectFiles(projectId) {
    return (store.files || []).filter(f => {
      const projectIds = fileProjectIds(f);
      return projectIds.includes(projectId);
    });
  }
  
  /**
   * Get files by category
   * @param {string} category - File category
   * @returns {Array} Filtered files
   */
  function getFilesByCategory(category) {
    return (store.files || []).filter(f => {
      const cats = fileCategories(f);
      return cats.includes(category);
    });
  }
  
  /**
   * Get team members for current project
   * @returns {Array} Array of team members
   */
  function getProjectTeam() {
    const project = currentProject();
    if (!project) return [];
    return project.unit || [];
  }
  
  /**
   * Get cast members for current project
   * @returns {Array} Array of cast members
   */
  function getProjectCast() {
    const project = currentProject();
    if (!project) return [];
    return project.cast || [];
  }
  
  /**
   * Get crew members for current project
   * @returns {Array} Array of crew members
   */
  function getProjectCrew() {
    const project = currentProject();
    if (!project) return [];
    return project.crew || [];
  }
  
  /**
   * Get all locations for current project
   * @returns {Array} Array of project locations
   */
  function getProjectLocations() {
    const project = currentProject();
    if (!project) return [];
    return project.locations || [];
  }
  
  /**
   * Get all shots for current project
   * @returns {Array} Array of shots
   */
  function getProjectShots() {
    const project = currentProject();
    if (!project) return [];
    return project.shots || [];
  }
  
  /**
   * Get shot by number
   * @param {number} shotNum - Shot number
   * @returns {Object|null} Shot object
   */
  function getShotByNumber(shotNum) {
    const shots = getProjectShots();
    return shots.find(s => s.num === shotNum) || null;
  }
  
  /**
   * Get all schedule items for current project
   * @returns {Array} Array of schedule items
   */
  function getProjectSchedule() {
    const project = currentProject();
    if (!project) return [];
    return project.schedule || [];
  }
  
  /**
   * Get budget for current project
   * @returns {Array} Budget items
   */
  function getProjectBudget() {
    const project = currentProject();
    if (!project) return [];
    return project.budget || [];
  }
  
  /**
   * Get all moodboards
   * @returns {Array} Array of moodboards
   */
  function getMoodboards() {
    return store.moodboards || [];
  }
  
  /**
   * Get folders
   * @returns {Array} Array of folders
   */
  function getFolders() {
    return store.folders || [];
  }
  
  /**
   * Get root folders (no parent)
   * @returns {Array} Root folders
   */
  function getRootFolders() {
    return (store.folders || []).filter(f => !f.parentId);
  }
  
  /**
   * Get subfolders of a folder
   * @param {string} parentId - Parent folder ID
   * @returns {Array} Child folders
   */
  function getSubfolders(parentId) {
    return (store.folders || []).filter(f => f.parentId === parentId);
  }
  
  /**
   * Get files in a folder
   * @param {string} folderId - Folder ID
   * @returns {Array} Files in folder
   */
  function getFolderFiles(folderId) {
    return (store.files || []).filter(f => f.folderId === folderId);
  }
  
  /**
   * Get root files (not in any folder)
   * @returns {Array} Root files
   */
  function getRootFiles() {
    return (store.files || []).filter(f => !f.folderId);
  }
  
  // ─────────────────────────────────────────────
  // Computed/Cached Data Getters
  // ─────────────────────────────────────────────
  
  /**
   * Get unique locations used in schedule
   * @returns {Array} Unique location names
   */
  function getScheduleLocations() {
    const key = _cacheKey('scheduleLocations');
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.timestamp < _CACHE_TTL) {
      return cached.value;
    }
    
    const schedule = getProjectSchedule();
    const locations = [...new Set(schedule.map(s => s.location).filter(Boolean))];
    const result = locations.sort();
    
    _cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Get unique cast members from schedule
   * @returns {Array} Unique cast names
   */
  function getScheduleCast() {
    const key = _cacheKey('scheduleCast');
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.timestamp < _CACHE_TTL) {
      return cached.value;
    }
    
    const schedule = getProjectSchedule();
    const cast = [...new Set(schedule.map(s => s.cast).filter(Boolean))];
    const result = cast.sort();
    
    _cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Get total budget amounts (ATL and BTL)
   * @returns {Object} Budget totals
   */
  function getBudgetTotals() {
    const key = _cacheKey('budgetTotals');
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.timestamp < _CACHE_TTL) {
      return cached.value;
    }
    
    const budget = getProjectBudget();
    let atlTotal = 0;
    let btlTotal = 0;
    
    budget.forEach(item => {
      const amount = parseFloat(item.amount) || 0;
      if (item.section === 'atl') {
        atlTotal += amount;
      } else {
        btlTotal += amount;
      }
    });
    
    const result = {
      atl: atlTotal,
      btl: btlTotal,
      total: atlTotal + btlTotal
    };
    
    _cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Get schedule statistics
   * @returns {Object} Schedule stats
   */
  function getScheduleStats() {
    const key = _cacheKey('scheduleStats');
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.timestamp < _CACHE_TTL) {
      return cached.value;
    }
    
    const schedule = getProjectSchedule();
    const totalEst = schedule.reduce((sum, s) => sum + (parseInt(s.est) || 0), 0);
    const shotCount = schedule.filter(s => s.shot).length;
    const dayHeaders = schedule.filter(s => s.isDayHeader).length;
    
    const result = {
      totalItems: schedule.length,
      shotCount,
      dayCount: dayHeaders,
      totalMinutes: totalEst,
      totalHours: (totalEst / 60).toFixed(1)
    };
    
    _cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Get shots by scene
   * @param {string} sceneKey - Scene key
   * @returns {Array} Shots in scene
   */
  function getShotsByScene(sceneKey) {
    const shots = getProjectShots();
    return shots.filter(s => s.sceneKey === sceneKey);
  }
  
  /**
   * Get unique scene keys from shots
   * @returns {Array} Scene keys
   */
  function getSceneKeys() {
    const key = _cacheKey('sceneKeys');
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.timestamp < _CACHE_TTL) {
      return cached.value;
    }
    
    const shots = getProjectShots();
    const keys = [...new Set(shots.map(s => s.sceneKey).filter(Boolean))];
    const result = keys.sort();
    
    _cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Get breakdown items by category
   * @param {string} category - Category (props, wardrobe, sound, etc.)
   * @returns {Array} Breakdown items
   */
  function getBreakdownByCategory(category) {
    const project = currentProject();
    if (!project) return [];
    return project[category] || [];
  }
  
  // ─────────────────────────────────────────────
  // Search & Filter
  // ─────────────────────────────────────────────
  
  /**
   * Search across all data
   * @param {string} query - Search query
   * @returns {Object} Search results
   */
  function search(query) {
    if (!query || query.length < 2) return { projects: [], contacts: [], locations: [], files: [] };
    
    const q = query.toLowerCase();
    
    const projects = getProjects().filter(p => 
      (p.name || '').toLowerCase().includes(q)
    );
    
    const contacts = getContacts().filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
    
    const locations = getLocations().filter(l => 
      (l.name || '').toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q)
    );
    
    const files = getFiles().filter(f => 
      (f.name || '').toLowerCase().includes(q)
    );
    
    return { projects, contacts, locations, files };
  }

  // ─────────────────────────────────────────────
  // Cache Management
  // ─────────────────────────────────────────────
  
  /**
   * Clear all cached data
   */
  function clearCache() {
    _cache.clear();
  }
  
  /**
   * Invalidate specific cache entries when data changes
   * @param {string} type - Type of data that changed
   */
  function invalidateForChange(type) {
    switch (type) {
      case 'schedule':
        _cache.delete(_cacheKey('scheduleLocations'));
        _cache.delete(_cacheKey('scheduleCast'));
        _cache.delete(_cacheKey('scheduleStats'));
        break;
      case 'shots':
        _cache.delete(_cacheKey('sceneKeys'));
        _cache.delete(_cacheKey('scheduleStats'));
        break;
      case 'budget':
        _cache.delete(_cacheKey('budgetTotals'));
        break;
      case 'locations':
        _cache.delete(_cacheKey('scheduleLocations'));
        break;
      default:
        clearCache();
    }
  }

  // Public API
  return {
    // Core getters
    currentProject,
    getProject,
    getProjects,
    getProjectsByActivity,
    getContacts,
    getContactByName,
    getContactsByType,
    getLocations,
    getLocationByName,
    getFiles,
    getProjectFiles,
    getFilesByCategory,
    
    // Project-specific getters
    getProjectTeam,
    getProjectCast,
    getProjectCrew,
    getProjectLocations,
    getProjectShots,
    getShotByNumber,
    getProjectSchedule,
    getProjectBudget,
    getMoodboards,
    
    // Folder getters
    getFolders,
    getRootFolders,
    getSubfolders,
    getFolderFiles,
    getRootFiles,
    
    // Computed/cached getters
    getScheduleLocations,
    getScheduleCast,
    getBudgetTotals,
    getScheduleStats,
    getShotsByScene,
    getSceneKeys,
    getBreakdownByCategory,
    
    // Search & filter
    search,
    
    // Cache management
    clearCache,
    invalidateForChange
  };
})();

// ══════════════════════════════════════════
// COLLABORATION & CROSS-SECTION UTILITIES
// ══════════════════════════════════════════

/**
 * Get formatted last edited time for a project
 */
function getProjectLastEdited(projectId) {
  const project = store.projects?.find(p => p.id === projectId);
  if (!project) return null;
  
  const lastEdit = project.updatedAt || project.sectionActivity ? 
    Math.max(
      project.updatedAt ? new Date(project.updatedAt).getTime() : 0,
      ...Object.values(project.sectionActivity || {})
    ) : 0;
  
  if (!lastEdit) return 'Never';
  
  const diff = Date.now() - lastEdit;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(lastEdit).toLocaleDateString();
}

/**
 * Get section-specific activity timestamp
 */
function getSectionLastEdited(sectionName) {
  const p = currentProject();
  if (!p || !p.sectionActivity) return null;
  const time = p.sectionActivity[sectionName];
  if (!time) return null;
  
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(time).toLocaleDateString();
}

/**
 * Get related data for cross-section navigation
 * Returns links to related items across sections
 */
function getCrossSectionLinks(itemType, itemName, projectId) {
  const links = [];
  const p = store.projects?.find(proj => proj.id === projectId);
  if (!p) return links;
  
  switch (itemType) {
    case 'location':
      // Find shots using this location
      const shotsAtLoc = (p.shots || []).filter(s => s.location === itemName);
      if (shotsAtLoc.length > 0) {
        links.push({ section: 'shotlist', label: `${shotsAtLoc.length} shots`, count: shotsAtLoc.length });
      }
      // Find schedule entries at this location
      const schedAtLoc = (p.schedule || []).filter(s => s.location === itemName);
      if (schedAtLoc.length > 0) {
        links.push({ section: 'schedule', label: `${schedAtLoc.length} schedule entries`, count: schedAtLoc.length });
      }
      break;
      
    case 'cast':
    case 'character':
      // Find shots with this cast
      const shotsWithCast = (p.shots || []).filter(s => s.cast?.includes(itemName));
      if (shotsWithCast.length > 0) {
        links.push({ section: 'shotlist', label: `${shotsWithCast.length} shots`, count: shotsWithCast.length });
      }
      // Find schedule entries with this cast
      const schedWithCast = (p.schedule || []).filter(s => s.cast?.includes(itemName));
      if (schedWithCast.length > 0) {
        links.push({ section: 'schedule', label: `${schedWithCast.length} schedule entries`, count: schedWithCast.length });
      }
      break;
      
    case 'scene':
      // Find shots in this scene
      const shotsInScene = (p.shots || []).filter(s => s.scene === itemName || s.sceneKey === itemName);
      if (shotsInScene.length > 0) {
        links.push({ section: 'shotlist', label: `${shotsInScene.length} shots`, count: shotsInScene.length });
      }
      // Find schedule for this scene
      const schedInScene = (p.schedule || []).filter(s => s.scene === itemName);
      if (schedInScene.length > 0) {
        links.push({ section: 'schedule', label: `${schedInScene.length} entries`, count: schedInScene.length });
      }
      break;
  }
  
  return links;
}

/**
 * Navigate to cross-section with highlighted item
 */
function navigateToCrossSection(section, highlightItem, itemType) {
  showSection(section);
  
  // Use setTimeout to allow section to render
  setTimeout(() => {
    let selector = '';
    switch (itemType) {
      case 'location':
        selector = `[data-ctx*="${highlightItem}"]`;
        break;
      case 'cast':
      case 'character':
        selector = `[data-ctx*="${highlightItem}"]`;
        break;
      default:
        selector = `[data-ctx*="${highlightItem}"]`;
    }
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.boxShadow = '0 0 0 3px var(--accent)';
      setTimeout(() => el.style.boxShadow = '', 3000);
    }
  }, 300);
}

/**
 * Make a data item clickable for cross-section navigation
 * Returns HTML with onclick handler
 */
function makeCrossSectionLink(text, itemType, itemName, projectId) {
  const links = getCrossSectionLinks(itemType, itemName, projectId);
  if (links.length === 0) return text;
  
  const section = links[0].section;
  return `<span class="cross-section-link" 
    onclick="navigateToCrossSection('${section}', '${itemName.replace(/'/g, "\\'")}', '${itemType}')"
    title="View in ${section} (${links[0].count} items)"
    style="cursor:pointer;color:var(--accent);text-decoration:underline">
    ${text}
  </span>`;
}

// Export to global scope
window.Data = Data;
window.getProjectLastEdited = getProjectLastEdited;
window.getSectionLastEdited = getSectionLastEdited;
window.getCrossSectionLinks = getCrossSectionLinks;
window.navigateToCrossSection = navigateToCrossSection;
window.makeCrossSectionLink = makeCrossSectionLink;
