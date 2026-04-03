// ══════════════════════════════════════════
// VIEW LOADER - Dynamically loads view HTML fragments
// ══════════════════════════════════════════

const viewFiles = {
  'dashboard': '/html/views/dashboard',
  'project': '/html/views/project',
  'contacts': '/html/views/contacts',
  'locations': '/html/views/locations',
  'moodboards': '/html/views/moodboards',
  'files': '/html/views/files',
  'settings': '/html/views/settings',
  'team': '/html/views/team',
  'myfountain': '/html/views/my-fountain'
};

const loadedViews = new Set();

// ══════════════════════════════════════════
// ERROR BOUNDARY FOR VIEW RENDERING
// ══════════════════════════════════════════

/**
 * Wrap a function with error boundary handling
 */
function withErrorBoundary(fn, fallbackMessage = 'An error occurred') {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      console.error(`[ErrorBoundary] ${fn.name || 'anonymous'} failed:`, error);
      showErrorToast(fallbackMessage + ': ' + error.message);
      return null;
    }
  };
}

/**
 * Show error toast notification
 */
function showErrorToast(message) {
  if (typeof showToast === 'function') {
    showToast(message, 'error');
  } else {
    console.error('[ErrorToast]', message);
    alert('Error: ' + message);
  }
}

/**
 * Render a view section with error boundary
 */
function renderSectionWithError(sectionName, renderFn) {
  const sectionEl = document.getElementById(`section-${sectionName}`);
  if (!sectionEl) {
    console.warn(`Section element not found: section-${sectionName}`);
    return;
  }
  
  try {
    sectionEl.innerHTML = '';
    renderFn();
  } catch (error) {
    console.error(`[ErrorBoundary] Failed to render section ${sectionName}:`, error);
    sectionEl.innerHTML = `
      <div style="padding:20px;color:var(--red);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:10px;">
        <strong>⚠️ Error rendering ${sectionName}</strong>
        <p style="font-size:12px;color:var(--text3);margin-top:8px">${error.message}</p>
        <button class="btn btn-sm" onclick="location.reload()" style="margin-top:10px">Reload Page</button>
      </div>
    `;
  }
}

// Export error boundary functions
window.withErrorBoundary = withErrorBoundary;
window.showErrorToast = showErrorToast;
window.renderSectionWithError = renderSectionWithError;

// ══════════════════════════════════════════
// VIEW LOADING
// ══════════════════════════════════════════

// Load a view HTML fragment and insert it into the DOM
async function loadView(viewName) {
  // Skip if already loaded or if view already exists in DOM
  if (loadedViews.has(viewName)) return;
  if (document.getElementById(`view-${viewName}`)) {
    loadedViews.add(viewName);
    return;
  }
  
  const viewFile = viewFiles[viewName];
  if (!viewFile) {
    console.error(`View ${viewName} not found in viewFiles mapping`);
    return;
  }
  
  try {
    const response = await fetch(viewFile);
    if (!response.ok) {
      throw new Error(`Failed to load ${viewFile}: ${response.status}`);
    }
    const html = await response.text();
    
    // Find the content div and insert the view
    const contentDiv = document.getElementById('content');
    if (contentDiv) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Find the view div within the HTML
      const viewDiv = tempDiv.querySelector(`#view-${viewName}`);
      if (viewDiv) {
        contentDiv.appendChild(viewDiv);
        loadedViews.add(viewName);
        console.log(`Loaded view: ${viewName}`);
      }
    }
  } catch (error) {
    console.error(`Error loading view ${viewName}:`, error);
    // Show error to user with retry option
    const contentDiv = document.getElementById('content');
    if (contentDiv && !document.getElementById('view-loading-error')) {
      contentDiv.innerHTML += `<div id="view-loading-error" style="padding:20px;color:#f55;background:#311;border-radius:var(--radius);margin:10px;">
        <strong>⚠️ Error loading views</strong><br>
        Could not load ${viewName} view. Please try:<br>
        • Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)<br>
        • Clear browser cache<br>
        • Check console for details<br>
        <button class="btn btn-sm" onclick="location.reload()" style="margin-top:10px">Reload Page</button>
      </div>`;
    }
  }
}

// Preload all views (call this after DOM is ready)
async function preloadAllViews() {
  const loadPromises = Object.keys(viewFiles).map(viewName => loadView(viewName));
  await Promise.all(loadPromises);
  
  // Remove the loading indicator
  const loadingDiv = document.getElementById('view-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
  
  console.log('All views preloaded');
}

// Lazy load a view when needed (call this before showing a view)
async function ensureViewLoaded(viewName) {
  await loadView(viewName);
}

// Override showView to lazy-load views
const originalShowView = window.showView;
window.showView = async function(name) {
  await ensureViewLoaded(name);
  // Call original showView after ensuring the view is loaded
  if (originalShowView) {
    originalShowView(name);
  }
};

// Export functions
window.viewLoader = {
  loadView,
  preloadAllViews,
  ensureViewLoaded,
  loadedViews
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => preloadAllViews());
} else {
  preloadAllViews();
}
