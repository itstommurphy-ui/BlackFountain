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
  'team': '/html/views/team'
};

const loadedViews = new Set();

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
    // Show error to user
    const contentDiv = document.getElementById('content');
    if (contentDiv && !document.getElementById('view-loading-error')) {
      contentDiv.innerHTML += `<div id="view-loading-error" style="padding:20px;color:#f55;background:#311;">
        <strong>Error loading views</strong><br>
        Could not load ${viewName} view. Please try:<br>
        • Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)<br>
        • Clear browser cache<br>
        • Check console for details
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
