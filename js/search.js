// GLOBAL SEARCH
// ══════════════════════════════════════════
function performGlobalSearch(query) {
  const dropdown = document.getElementById('search-dropdown');
  if (!query || query.length < 2) { dropdown.style.display = 'none'; return; }
  
  const q = query.toLowerCase();
  const results = [];
  
  // Search Contacts
  const allContacts = [];
  (store.contacts || []).forEach(c => { if (c.name) allContacts.push({ ...c, _projectId: null }); });
  store.projects.forEach(p => {
    (p.contacts || []).forEach(c => { if (c.name) allContacts.push({ ...c, _projectId: p.id }); });
  });
  allContacts.filter(c => 
    (c.name || '').toLowerCase().includes(q) || 
    (c.phone || '').includes(q) || 
    (c.email || '').toLowerCase().includes(q)
  ).forEach(c => {
    results.push({ type: 'Contact', title: c.name, subtitle: c.phone || c.email || '', id: c.name, projectId: c._projectId });
  });
  
  // Search Locations
  const allLocations = [];
  (store.locations || []).forEach(l => { if (l.name) allLocations.push({ ...l, _projectId: null }); });
  store.projects.forEach(p => {
    (p.locations || []).forEach(l => { if (l.name) allLocations.push({ ...l, _projectId: p.id }); });
  });
  allLocations.filter(l => 
    (l.name || '').toLowerCase().includes(q) || 
    (l.suit || '').toLowerCase().includes(q) ||
    (l.decision || '').toLowerCase().includes(q)
  ).forEach(l => {
    results.push({ type: 'Location', title: l.name, subtitle: l.suit ? 'Suitability: ' + l.suit : (l.decision || ''), id: l.name, projectId: l._projectId });
  });
  
  // Search Files (only by filename, not by tagged people)
  (store.files || []).filter(f => 
    (f.name || '').toLowerCase().includes(q)
  ).slice(0, 20).forEach(f => {
    const pids = fileProjectIds(f);
    const proj = pids.length > 0 ? store.projects.find(p => p.id === pids[0]) : null;
    results.push({ type: 'File', title: f.name, subtitle: proj ? proj.title : '', id: f.id, projectId: pids[0] });
  });
  
  // Limit results
  const limited = results.slice(0, 15);
  
  if (limited.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px;text-align:center;">No results found</div>';
  } else {
    dropdown.innerHTML = limited.map(r => `
      <div class="search-result-item" onclick="navigateToSearchResult('${r.type}', '${r.id}', '${r.projectId || ''}')" 
           style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px;">
        <span style="font-size:14px;">${r.type === 'Contact' ? '👤' : r.type === 'Location' ? '📍' : '📄'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.title}</div>
          <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.subtitle}</div>
        </div>
        <span style="font-size:9px;color:var(--text3);background:var(--surface2);padding:2px 6px;border-radius:3px;">${r.type}</span>
      </div>
    `).join('');
    // Add hover effects
    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.onmouseenter = () => el.style.background = 'var(--surface2)';
      el.onmouseleave = () => el.style.background = '';
    });
  }
  
  dropdown.style.display = 'block';
}

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

// Attach search handler
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => performGlobalSearch(e.target.value));
  }
  // WCAG: make nav items keyboard-accessible
  document.querySelectorAll('.nav-item').forEach(el => {
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
});

function populateFilesProjectFilter() {
  const sel = document.getElementById('files-project-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="all">All Projects</option>` +
    store.projects.map(p =>
      `<option value="${p.id}" ${current === p.id ? 'selected' : ''}>${p.title || 'Untitled Project'}</option>`
    ).join('');
}

