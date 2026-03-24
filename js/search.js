// GLOBAL SEARCH - Legacy navigation helpers kept for compatibility
// ══════════════════════════════════════════
function navigateToSearchResult(type, id, projectId) {
  document.getElementById('search-dropdown').style.display = 'none';
  document.getElementById('global-search').value = '';
  
  if (type === 'Contact') {
    _highlightContact = id;
    if (projectId) {
      showProjectView(projectId);
      setTimeout(() => { showView('contacts'); _scrollToHighlightedContact(); }, 200);
    } else {
      showView('contacts');
      setTimeout(_scrollToHighlightedContact, 100);
    }
  } else if (type === 'Location') {
    _highlightLocation = id;
    if (projectId) {
      showProjectView(projectId);
      setTimeout(() => { showView('locations'); _scrollToHighlightedLocation(); }, 200);
    } else {
      showView('locations');
      setTimeout(_scrollToHighlightedLocation, 100);
    }
  } else if (type === 'File') {
    if (projectId) {
      showProjectView(projectId);
      setTimeout(() => { showView('files'); viewFile(id); }, 200);
    } else {
      showView('files');
      setTimeout(() => viewFile(id), 100);
    }
  }
}

function _scrollToHighlightedContact() {
  if (!_highlightContact) return;
  const row = document.querySelector(`[data-ctx="contact:${encodeURIComponent(_highlightContact)}"]`);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(() => { row.style.boxShadow = ''; _highlightContact = null; }, 2000);
  }
}

function _scrollToHighlightedLocation() {
  if (!_highlightLocation) return;
  // Find location row by text content
  const rows = document.querySelectorAll('#locations-list tbody tr');
  let foundRow = null;
  for (const row of rows) {
    if (row.textContent.toLowerCase().includes(_highlightLocation.toLowerCase())) {
      foundRow = row;
      break;
    }
  }
  if (foundRow) {
    foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    foundRow.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(() => { foundRow.style.boxShadow = ''; _highlightLocation = null; }, 2000);
  }
}

// Legacy file filter population
function populateFilesProjectFilter() {
  const sel = document.getElementById('files-project-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="all">All Projects</option>` +
    store.projects.map(p =>
      `<option value="${p.id}" ${current === p.id ? 'selected' : ''}>${p.title || 'Untitled Project'}</option>`
    ).join('');
}

