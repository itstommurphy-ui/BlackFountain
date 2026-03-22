// ══════════════════════════════════════════
// EVENT BUS - Pub/Sub System for Cross-View Communication
// ══════════════════════════════════════════

/**
 * EventBus provides a centralized pub/sub system for decoupled communication
 * between different views and components in Black Fountain.
 */

const EventBus = (function() {
  // Private: Event storage
  const _listeners = new Map();
  
  // Private: Event history for debugging (limited to last 50 events)
  const _history = [];
  const _MAX_HISTORY = 50;

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  function on(eventName, callback) {
    if (typeof callback !== 'function') {
      console.warn('[EventBus] Callback must be a function');
      return () => {};
    }
    
    if (!_listeners.has(eventName)) {
      _listeners.set(eventName, new Set());
    }
    
    _listeners.get(eventName).add(callback);
    
    // Return unsubscribe function
    return function unsubscribe() {
      off(eventName, callback);
    };
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first emit)
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  function once(eventName, callback) {
    const wrapper = (...args) => {
      off(eventName, wrapper);
      callback(...args);
    };
    return on(eventName, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - The callback function to remove
   */
  function off(eventName, callback) {
    if (!_listeners.has(eventName)) return;
    
    const callbacks = _listeners.get(eventName);
    callbacks.delete(callback);
    
    // Clean up empty event sets
    if (callbacks.size === 0) {
      _listeners.delete(eventName);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventName - Name of the event to emit
   * @param {*} data - Data to pass to all subscribers
   * @returns {number} Number of subscribers that received the event
   */
  function emit(eventName, data) {
    if (!_listeners.has(eventName)) {
      return 0;
    }
    
    const callbacks = _listeners.get(eventName);
    let count = 0;
    
    // Store in history
    _history.push({
      event: eventName,
      data: data,
      timestamp: Date.now()
    });
    if (_history.length > _MAX_HISTORY) {
      _history.shift();
    }
    
    // Call all listeners (use forEach to handle mutations during iteration)
    callbacks.forEach(callback => {
      try {
        callback(data);
        count++;
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${eventName}":`, err);
      }
    });
    
    return count;
  }

  /**
   * Emit an event asynchronously to all subscribers
   * @param {string} eventName - Name of the event to emit
   * @param {*} data - Data to pass to all subscribers
   */
  function emitAsync(eventName, data) {
    return new Promise(resolve => {
      setTimeout(() => {
        const count = emit(eventName, data);
        resolve(count);
      }, 0);
    });
  }

  /**
   * Check if an event has listeners
   * @param {string} eventName - Name of the event
   * @returns {boolean} True if event has listeners
   */
  function hasListeners(eventName) {
    return _listeners.has(eventName) && _listeners.get(eventName).size > 0;
  }

  /**
   * Get the number of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number} Number of listeners
   */
  function listenerCount(eventName) {
    if (!_listeners.has(eventName)) return 0;
    return _listeners.get(eventName).size;
  }

  /**
   * Get all registered event names
   * @returns {string[]} Array of event names
   */
  function getEventNames() {
    return Array.from(_listeners.keys());
  }

  /**
   * Clear all listeners for an event, or all events if no name provided
   * @param {string} [eventName] - Optional event name to clear
   */
  function clear(eventName) {
    if (eventName) {
      _listeners.delete(eventName);
    } else {
      _listeners.clear();
    }
  }

  /**
   * Get event history for debugging
   * @returns {Array} Array of historical events
   */
  function getHistory() {
    return [..._history];
  }

  // ─────────────────────────────────────────────
  // Predefined Application Events
  // ─────────────────────────────────────────────
  
  /**
   * Event names used throughout the application
   * Using constants ensures consistency and prevents typos
   */
  const Events = {
    // Project Events
    PROJECT_CREATED: 'project:created',
    PROJECT_UPDATED: 'project:updated',
    PROJECT_DELETED: 'project:deleted',
    PROJECT_SWITCHED: 'project:switched',
    
    // Data Events
    DATA_LOADED: 'data:loaded',
    DATA_SAVED: 'data:saved',
    DATA_CHANGED: 'data:changed',
    
    // View Events
    VIEW_CHANGED: 'view:changed',
    VIEW_RENDERED: 'view:rendered',
    SECTION_CHANGED: 'section:changed',
    
    // Contact Events
    CONTACT_CREATED: 'contact:created',
    CONTACT_UPDATED: 'contact:updated',
    CONTACT_DELETED: 'contact:deleted',
    
    // Location Events
    LOCATION_CREATED: 'location:created',
    LOCATION_UPDATED: 'location:updated',
    LOCATION_DELETED: 'location:deleted',
    
    // Schedule Events
    SCHEDULE_UPDATED: 'schedule:updated',
    SCHEDULE_GENERATED: 'schedule:generated',
    
    // Shot List Events
    SHOT_CREATED: 'shot:created',
    SHOT_UPDATED: 'shot:updated',
    SHOT_DELETED: 'shot:deleted',
    
    // File Events
    FILE_UPLOADED: 'file:uploaded',
    FILE_DELETED: 'file:deleted',
    FILE_MOVED: 'file:moved',
    
    // UI Events
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
    TOAST_SHOWN: 'toast:shown',
    THEME_CHANGED: 'theme:changed',
    
    // Navigation Events
    NAV_BACK: 'nav:back',
    NAV_FORWARD: 'nav:forward',
    
    // Sync Events
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_FAILED: 'sync:failed'
  };

  // Public API
  return {
    on,
    once,
    off,
    emit,
    emitAsync,
    hasListeners,
    listenerCount,
    getEventNames,
    clear,
    getHistory,
    Events
  };
})();

// Export to global scope
window.EventBus = EventBus;
