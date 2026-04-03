// ══════════════════════════════════════════
// AUTO COMPLETE HUB - Consolidated Suggestions
// ══════════════════════════════════════════

/**
 * AutoComplete provides a centralized system for managing
 * all autocomplete/datalist suggestions across the application.
 */

const AutoComplete = (function() {
  // Private: Cache for suggestions
  const _suggestions = new Map();
  const _listeners = new Map();
  
  // Default debounce time
  const _DEBOUNCE_MS = 150;
  
  // ─────────────────────────────────────────────
  // Core Suggestion Functions
  // ─────────────────────────────────────────────
  
  /**
   * Get all roles (crew + cast combined)
   * @returns {Array} Sorted array of role names
   */
  function getAllRoles() {
    const key = 'allRoles';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const roles = new Set();
    
    // Get roles from projects
    store.projects?.forEach(p => {
      (p.unit || []).forEach(r => { if (r.role) roles.add(r.role); });
      (p.contacts || []).forEach(c => {
        if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
        (c.crewRoles || []).forEach(r => { if (r) roles.add(r); });
        (c.roles || []).forEach(r => { if (r && r !== 'Cast' && r !== 'Extra') roles.add(r); });
      });
    });
    
    // Get roles from global contacts
    store.contacts?.forEach(c => {
      if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
      (c.crewRoles || []).forEach(r => { if (r) roles.add(r); });
      if (c.defaultRole && !(c.type || '').includes('cast')) roles.add(c.defaultRole);
    });
    
    // Add default roles
    const crewDefaults = [
      'Director','Assistant Director','1st AD','2nd AD','3rd AD',
      'Director of Photography','Cinematographer','Camera Operator','Focus Puller','1st AC','2nd AC','Clapper Loader','DIT',
      'Gaffer','Best Boy Electric','Electrician','Key Grip','Best Boy Grip','Grip','Dolly Grip',
      'Production Designer','Art Director','Set Decorator','Set Dresser','Props Master','Props Buyer',
      'Costume Designer','Wardrobe Supervisor','Wardrobe Assistant','Make-Up Artist','Hair Stylist','SFX Make-Up',
      'Sound Mixer','Boom Operator','Sound Assistant',
      'Script Supervisor','Continuity',
      'Executive Producer','Producer','Line Producer','Co-Producer','Associate Producer',
      'Production Manager','Production Coordinator','Production Assistant','Runner',
      'Location Manager','Location Scout','Facilities Manager',
      'Casting Director','Casting Associate',
      'Editor','Assistant Editor','Colorist','Colourist','VFX Supervisor','VFX Artist','Motion Graphics',
      'Stunt Coordinator','Stunt Performer','Stunt Double',
      'Composer','Music Supervisor',
      'Unit Publicist','Still Photographer','Behind The Scenes',
      'Catering','Driver','Security'
    ];
    
    const castDefaults = [
      'Actor','Actress','Lead Actor','Lead Actress','Supporting Actor','Supporting Actress',
      'Voice Actor','Singer','Vocalist','Musician','Dancer','Performer','Entertainer','Comedian',
      'Stunt Double','Stand-In','Extra','Multi-Role'
    ];
    
    roles.forEach(r => {
      if (!crewDefaults.includes(r) && !castDefaults.includes(r)) {
        crewDefaults.push(r);
      }
    });
    
    const result = [...new Set([...crewDefaults, ...castDefaults])].sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get crew roles only
   * @returns {Array} Sorted array of crew roles
   */
  function getCrewRoles() {
    const key = 'crewRoles';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const roles = new Set();
    
    store.projects?.forEach(p => {
      (p.unit || []).forEach(r => { if (r.role) roles.add(r.role); });
      (p.contacts || []).forEach(c => {
        if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
        const crewRoles = Array.isArray(c.crewRoles) ? c.crewRoles : [];
        crewRoles.forEach(r => { if (r) roles.add(r); });
      });
    });
    
    store.contacts?.forEach(c => {
      if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
      const crewRoles = Array.isArray(c.crewRoles) ? c.crewRoles : [];
      crewRoles.forEach(r => { if (r) roles.add(r); });
      if (c.defaultRole && !(c.type || '').includes('cast')) roles.add(c.defaultRole);
    });
    
    const defaults = [
      'Director','Assistant Director','1st AD','2nd AD','3rd AD',
      'Director of Photography','Cinematographer','Camera Operator','Focus Puller','1st AC','2nd AC','Clapper Loader','DIT',
      'Gaffer','Best Boy Electric','Electrician','Key Grip','Best Boy Grip','Grip','Dolly Grip',
      'Production Designer','Art Director','Set Decorator','Set Dresser','Props Master','Props Buyer',
      'Costume Designer','Wardrobe Supervisor','Wardrobe Assistant','Make-Up Artist','Hair Stylist','SFX Make-Up',
      'Sound Mixer','Boom Operator','Sound Assistant',
      'Script Supervisor','Continuity',
      'Executive Producer','Producer','Line Producer','Co-Producer','Associate Producer',
      'Production Manager','Production Coordinator','Production Assistant','Runner',
      'Location Manager','Location Scout','Facilities Manager',
      'Casting Director','Casting Associate',
      'Editor','Assistant Editor','Colorist','Colourist','VFX Supervisor','VFX Artist','Motion Graphics',
      'Stunt Coordinator','Stunt Performer','Stunt Double',
      'Composer','Music Supervisor',
      'Unit Publicist','Still Photographer','Behind The Scenes',
      'Catering','Driver','Security'
    ];
    
    const result = [...new Set([...roles, ...defaults])].sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get cast roles only
   * @returns {Array} Sorted array of cast roles
   */
  function getCastRoles() {
    const key = 'castRoles';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const roles = new Set();
    
    store.projects?.forEach(p => {
      (p.cast || []).forEach(c => {
        if (c.role) roles.add(c.role);
      });
    });
    
    const defaults = [
      'Actor','Actress','Lead Actor','Lead Actress','Supporting Actor','Supporting Actress',
      'Voice Actor','Singer','Vocalist','Musician','Dancer','Performer','Entertainer','Comedian',
      'Stunt Double','Stand-In','Extra','Multi-Role'
    ];
    
    const result = [...new Set([...roles, ...defaults])].sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get all locations (global + project)
   * @returns {Array} Sorted array of location names
   */
  function getLocations() {
    const key = 'locations';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const locations = new Set();
    
    // Global locations
    store.locations?.forEach(l => {
      if (l.name) locations.add(l.name);
    });
    
    // Project locations
    store.projects?.forEach(p => {
      (p.locations || []).forEach(l => {
        if (l.name) locations.add(l.name);
      });
    });
    
    // Schedule locations
    store.projects?.forEach(p => {
      (p.schedule || []).forEach(s => {
        if (s.location) locations.add(s.location);
      });
    });
    
    const result = Array.from(locations).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get all contacts
   * @returns {Array} Sorted array of contact names
   */
  function getContacts() {
    const key = 'contacts';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const contacts = new Set();
    
    store.contacts?.forEach(c => {
      if (c.name) contacts.add(c.name);
    });
    
    store.projects?.forEach(p => {
      (p.unit || []).forEach(u => {
        if (u.name) contacts.add(u.name);
      });
      (p.cast || []).forEach(c => {
        if (c.name) contacts.add(c.name);
      });
    });
    
    const result = Array.from(contacts).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get scene keys from shot list
   * @returns {Array} Sorted array of scene keys
   */
  function getSceneKeys() {
    const key = 'sceneKeys';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const scenes = new Set();
    
    store.projects?.forEach(p => {
      (p.shots || []).forEach(s => {
        if (s.sceneKey) scenes.add(s.sceneKey);
      });
    });
    
    const result = Array.from(scenes).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get shot types
   * @returns {Array} Array of shot types
   */
  function getShotTypes() {
    const key = 'shotTypes';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const types = new Set();
    
    store.projects?.forEach(p => {
      (p.shots || []).forEach(s => {
        if (s.type) types.add(s.type);
      });
    });
    
    const defaults = [
      'Wide Shot','Medium Shot','Close-Up','Extreme Close-Up','Over the Shoulder',
      'POV','Two Shot','Insert Shot','Establishing Shot','Cutaway',
      'Tracking Shot','Dolly Shot','Crane Shot',' Aerial Shot',
      'Static Shot','Pan','Tilt','Zoom','Rack Focus'
    ];
    
    const result = [...new Set([...types, ...defaults])];
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get movement types
   * @returns {Array} Array of movement types
   */
  function getMovements() {
    const key = 'movements';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const movements = new Set();
    
    store.projects?.forEach(p => {
      (p.schedule || []).forEach(s => {
        if (s.movement) movements.add(s.movement);
      });
      (p.shots || []).forEach(s => {
        if (s.movement) movements.add(s.movement);
      });
    });
    
    const defaults = [
      'Stationary','Pan','Tilt','Dolly In','Dolly Out',
      'Tracking','Crane Up','Crane Down','Handheld','Steadicam',
      'Zoom In','Zoom Out','Whip Pan','Rack Focus','Push In','Pull Out'
    ];
    
    const result = [...new Set([...movements, ...defaults])];
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get time of day options
   * @returns {Array} Array of time options
   */
  function getTimeOfDay() {
    return ['DAY','NIGHT','DAWN','DUSK','MORNING','EVENING','CONTINUOUS'];
  }
  
  /**
   * Get int/ext options
   * @returns {Array} Array of interior/exterior options
   */
  function getIntExt() {
    return ['INT','EXT','INT/EXT','EXT/INT'];
  }
  
  /**
   * Get weather options
   * @returns {Array} Array of weather options
   */
  function getWeather() {
    const key = 'weather';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const weather = new Set();
    
    store.projects?.forEach(p => {
      (p.schedule || []).forEach(s => {
        if (s.weather) weather.add(s.weather);
      });
    });
    
    const defaults = ['Sunny','Cloudy','Overcast','Rain','Snow','Fog','Stormy','Windy'];
    const result = [...new Set([...weather, ...defaults])];
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get props from breakdown
   * @returns {Array} Sorted array of prop names
   */
  function getProps() {
    const key = 'props';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const props = new Set();
    
    store.projects?.forEach(p => {
      (p.props || []).forEach(item => {
        if (item.name) props.add(item.name);
      });
    });
    
    const result = Array.from(props).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get wardrobe items
   * @returns {Array} Sorted array of wardrobe items
   */
  function getWardrobe() {
    const key = 'wardrobe';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const items = new Set();
    
    store.projects?.forEach(p => {
      (p.wardrobe || []).forEach(item => {
        if (item.description) items.add(item.description);
      });
    });
    
    const result = Array.from(items).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get sound items
   * @returns {Array} Sorted array of sound items
   */
  function getSoundItems() {
    const key = 'soundItems';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const items = new Set();
    
    store.projects?.forEach(p => {
      (p.sound || []).forEach(item => {
        if (item.description) items.add(item.description);
      });
    });
    
    const result = Array.from(items).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  /**
   * Get vehicles
   * @returns {Array} Sorted array of vehicle names
   */
  function getVehicles() {
    const key = 'vehicles';
    if (_suggestions.has(key)) {
      return _suggestions.get(key);
    }
    
    const vehicles = new Set();
    
    store.projects?.forEach(p => {
      (p.vehicles || []).forEach(v => {
        if (v.name) vehicles.add(v.name);
      });
    });
    
    const result = Array.from(vehicles).sort();
    _suggestions.set(key, result);
    return result;
  }
  
  // ─────────────────────────────────────────────
  // Datalist Management
  // ─────────────────────────────────────────────
  
  /**
   * Update a datalist with suggestions
   * @param {string} datalistId - ID of the datalist element
   * @param {Array} suggestions - Array of suggestion strings
   */
  function updateDatalist(datalistId, suggestions) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    
    datalist.innerHTML = suggestions
      .map(s => `<option value="${s}">`)
      .join('');
  }
  
  /**
   * Refresh all datalists in the application
   */
  function refreshAll() {
    // Clear cache to force rebuild
    _suggestions.clear();
    
    // Update role datalists
    updateDatalist('roles-datalist', getCrewRoles());
    updateDatalist('cast-roles-datalist', getCastRoles());
    updateDatalist('all-roles-datalist', getAllRoles());
    
    // NOTE: Do NOT emit DATA_CHANGED here - it would cause infinite loop
    // since init.js listens to DATA_CHANGED and calls refreshAll()
  }
  
  /**
   * Subscribe to autocomplete updates
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  function subscribe(callback) {
    if (typeof callback === 'function') {
      if (!_listeners.has('update')) {
        _listeners.set('update', new Set());
      }
      _listeners.get('update').add(callback);
      
      return function unsubscribe() {
        _listeners.get('update')?.delete(callback);
      };
    }
    return () => {};
  }
  
  /**
   * Notify all subscribers of an update
   */
  function _notify() {
    _listeners.get('update')?.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('[AutoComplete] Callback error:', err);
      }
    });
  }

  // Public API
  return {
    // Get various suggestion types
    getAllRoles,
    getCrewRoles,
    getCastRoles,
    getLocations,
    getContacts,
    getSceneKeys,
    getShotTypes,
    getMovements,
    getTimeOfDay,
    getIntExt,
    getWeather,
    getProps,
    getWardrobe,
    getSoundItems,
    getVehicles,
    
    // Datalist management
    updateDatalist,
    refreshAll,
    
    // Subscription
    subscribe,
    _notify
  };
})();

// Export to global scope
window.AutoComplete = AutoComplete;
