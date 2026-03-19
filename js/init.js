// INIT
// ══════════════════════════════════════════

// MODAL HELPERS - Ensure these are always available
function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) { console.log('overlay NOT FOUND:', id); return; }
  const modal = overlay.querySelector('.modal');
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const heading = modal.querySelector('h2, h3, [class*="modal-title"]');
    if (heading) {
      if (!heading.id) heading.id = id + '-title';
      modal.setAttribute('aria-labelledby', heading.id);
    }
    modal.querySelectorAll('.modal-close').forEach(btn => {
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Close');
    });
  }
  overlay.classList.add('open');
  overlay.style.display = 'flex';
  overlay.dataset.justOpened = Date.now();
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]), textarea, select, button:not(.modal-close)');
    if (first) first.focus();
    else { const close = overlay.querySelector('.modal-close'); if (close) close.focus(); }
  }, 60);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.display = 'none';
  }
}

(function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'global-tip';
  document.body.appendChild(tip);
  let current = null;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (!el || el.classList.contains('tooltip-info')) return;
    current = el;
    tip.textContent = el.dataset.tip;
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', e => {
    if (!current) return;
    const x = e.clientX + 14, y = e.clientY - 44;
    tip.style.left = Math.min(x, window.innerWidth - 316) + 'px';
    tip.style.top = Math.max(y, 8) + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (current && !current.contains(e.relatedTarget)) { current = null; tip.style.display = 'none'; }
  });
})();

// Dropdown toggle functionality
document.addEventListener('click', function(e) {
  const toggle = e.target.closest('.dropdown-toggle');
  if (toggle) {
    e.preventDefault();
    const dropdown = toggle.closest('.dropdown');
    const wasOpen = dropdown.classList.contains('open');
    // Close all dropdowns
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    // Toggle clicked dropdown
    if (!wasOpen) dropdown.classList.add('open');
  } else if (!e.target.closest('.dropdown-menu') && !e.target.closest('input[type="file"]')) {
    // Close dropdowns when clicking outside, but not for file input clicks
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }
});

loadTheme();
async function _startApp() {
  try {
    await loadStore();
    initAutoSave();
    // Wait for views to be loaded before showing the appropriate view
    if (window.viewLoader?.preloadAllViews) {
      await window.viewLoader.preloadAllViews();
    }

    // Try to restore the previously active view from localStorage
    let restoredView = null;
    try {
      const savedView = localStorage.getItem('bf_currentView');
      console.log('[ViewRestore] Checking for saved view, found:', savedView);
      if (savedView) {
        restoredView = JSON.parse(savedView);
        console.log('[ViewRestore] Parsed view:', restoredView);
      }
    } catch (e) {
      console.warn('Could not restore view:', e);
    }

    if (restoredView) {
      if (restoredView.type === 'global') {
        // Restore global view (dashboard, contacts, etc.)
        showView(restoredView.name);
        // Also trigger render for the restored view
        if (restoredView.name === 'dashboard') {
          renderDashboard();
        }
      } else if (restoredView.type === 'project') {
        // Restore project view
        const projectExists = store.projects?.some(p => p.id === restoredView.projectId);
        if (projectExists) {
          showProjectView(restoredView.projectId);
          // Restore the specific section if available
          if (restoredView.section) {
            showSection(restoredView.section);
          } else {
            showSection('overview');
          }
        } else {
          // Project no longer exists, fall back to dashboard
          showView('dashboard');
          renderDashboard();
        }
      }
    } else {
      // No saved view, show dashboard as default
      showView('dashboard');
      renderDashboard();
    }
  } catch(e) {
    console.error('[_startApp] init failed:', e);
  } finally {
    document.body.classList.remove('loading');
  }
  const pendingToast = sessionStorage.getItem('_mf_post_reload_toast');
  if (pendingToast) {
    sessionStorage.removeItem('_mf_post_reload_toast');
    try { const { msg, type } = JSON.parse(pendingToast); showToast(msg, type); } catch(e) {}
  }
}
sbInit(_startApp);

// ── Contact modal role sections ───────────────────────────────────────────────
function ecToggleRoleSections() {
  const isCast = document.getElementById('edit-contact-type-cast').checked;
  const isCrew = document.getElementById('edit-contact-type-crew').checked;
  document.getElementById('ec-cast-roles-section').style.display = isCast ? 'block' : 'none';
  document.getElementById('ec-crew-roles-section').style.display = isCrew ? 'block' : 'none';
  // Update project-role inputs to suggest the right kind of roles
  const listId = (isCast && !isCrew) ? 'cast-roles-datalist'
               : (!isCast && isCrew) ? 'roles-datalist'
               : 'all-roles-datalist';
  document.querySelectorAll('#edit-contact-projects-container .contact-role-input').forEach(inp => {
    inp.setAttribute('list', listId);
  });
}

function ecAddRole(type) {
  const inputId = type === 'cast' ? 'ec-cast-role-input' : 'ec-crew-role-input';
  const tagsId  = type === 'cast' ? 'ec-cast-roles-tags'  : 'ec-crew-roles-tags';
  const input = document.getElementById(inputId);
  const val = (input.value || '').trim();
  if (!val) return;
  const container = document.getElementById(tagsId);
  const existing = [...container.querySelectorAll('[data-role]')].map(t => t.dataset.role.toLowerCase());
  if (existing.includes(val.toLowerCase())) { input.value = ''; return; }
  const chip = document.createElement('span');
  chip.dataset.role = val;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px;background:var(--surface3);border-radius:12px;color:var(--text2);margin-bottom:2px;';
  chip.innerHTML = `${val} <span style="cursor:pointer;color:var(--text3);font-size:10px;" onclick="this.closest('[data-role]').remove()">✕</span>`;
  container.appendChild(chip);
  input.value = '';
  input.focus();
}

function ecClearRoles() {
  const c = document.getElementById('ec-cast-roles-tags');
  const r = document.getElementById('ec-crew-roles-tags');
  if (c) c.innerHTML = '';
  if (r) r.innerHTML = '';
  const ci = document.getElementById('ec-cast-role-input');
  const ri = document.getElementById('ec-crew-role-input');
  if (ci) ci.value = '';
  if (ri) ri.value = '';
}

function closeEditContactModal() {
  _mfNewPersonCallback = null;
  document.getElementById('edit-contact-modal-title').textContent = 'Edit Contact';
  closeModal('modal-edit-contact');
}

function ecGetRoles(type) {
  const tagsId = type === 'cast' ? 'ec-cast-roles-tags' : 'ec-crew-roles-tags';
  return [...(document.getElementById(tagsId)?.querySelectorAll('[data-role]') || [])].map(t => t.dataset.role).filter(Boolean);
}

// ── Role autocomplete ─────────────────────────────────────────────────────────
function refreshRolesDatalist() {
  const roles = new Set();
  store.projects.forEach(p => {
    (p.unit || []).forEach(r => { if (r.role) roles.add(r.role); });
    (p.contacts || []).forEach(c => {
      if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
      (c.crewRoles || []).forEach(r => { if (r) roles.add(r); });
      (c.roles || []).forEach(r => { if (r && r !== 'Cast' && r !== 'Extra') roles.add(r); });
    });
  });
  (store.contacts || []).forEach(c => {
    if ((c.type || '').includes('cast') && !(c.type || '').includes('crew')) return;
    (c.crewRoles || []).forEach(r => { if (r) roles.add(r); });
    if (c.defaultRole && !(c.type || '').includes('cast')) roles.add(c.defaultRole);
  });
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
  const allCrewRoles = new Set([...roles, ...crewDefaults]);
  const dl = document.getElementById('roles-datalist');
  if (dl) dl.innerHTML = Array.from(allCrewRoles).sort().map(r => `<option value="${r}">`).join('');

  // all-roles-datalist = crew roles + cast roles
  const castDefaults = ['Actor','Actress','Lead Actor','Lead Actress','Supporting Actor','Supporting Actress','Voice Actor','Singer','Vocalist','Musician','Dancer','Performer','Entertainer','Comedian','Stunt Double','Stand-In','Extra','Multi-Role'];
  const allRoles = new Set([...allCrewRoles, ...castDefaults]);
  const dlAll = document.getElementById('all-roles-datalist');
  if (dlAll) dlAll.innerHTML = Array.from(allRoles).sort().map(r => `<option value="${r}">`).join('');
}

// ══════════════════════════════════════════
// CONTEXT MENU
// ══════════════════════════════════════════
let _ctxFns = [];

function _ctxRun(i) {
  _ctxFns[i]?.();
  document.getElementById('ctx-menu').style.display = 'none';
}

function showContextMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  _ctxFns = [];
  let fi = 0;
  const menu = document.getElementById('ctx-menu');
  menu.innerHTML = items.map(item => {
    if (!item) return '<div class="ctx-sep"></div>';
    const i = fi++;
    _ctxFns.push(item.fn);
    const danger = item.danger ? ' ctx-danger' : '';
    return `<div class="ctx-item${danger}" onclick="_ctxRun(${i})"><span class="ctx-icon">${item.icon||''}</span><span>${item.label}</span></div>`;
  }).join('');
  const rows = items.length;
  const menuH = rows * 32 + 12;
  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - menuH - 4);
  menu.style.left = Math.max(4, x) + 'px';
  menu.style.top = Math.max(4, y) + 'px';
  menu.style.display = 'block';
}

document.addEventListener('click', () => {
  const m = document.getElementById('ctx-menu');
  if (m) m.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const m = document.getElementById('ctx-menu'); if (m) m.style.display = 'none'; }
});
document.addEventListener('contextmenu', e => {
  const el = e.target.closest('[data-ctx]');
  if (!el) return;
  e.preventDefault();
  const ctx = el.dataset.ctx;
  const sep = ctx.indexOf(':');
  const type = sep >= 0 ? ctx.slice(0, sep) : ctx;
  const rawArgs = sep >= 0 ? ctx.slice(sep + 1) : '';
  const args = rawArgs.split(':');
  let items = [];

  switch (type) {
    case 'personnel':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editPersonnel(args[0], +args[1]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removePersonnel(args[0], +args[1]) }
      ]; break;
    case 'schedule':
      items = [
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeScheduleRow(+args[0]) }
      ]; break;
    case 'budget': {
      const bLine = currentProject()?.budget[+args[0]];
      const isAtl = bLine?.section === 'atl';
      items = [
        { label: 'Edit', icon: '✎', fn: () => editBudgetLine(+args[0]) },
        { label: 'Duplicate Line', icon: '⧉', fn: () => duplicateBudgetLine(+args[0]) },
        { label: isAtl ? 'Move to BTL' : 'Move to ATL', icon: '↕', fn: () => moveBudgetLineSection(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeBudgetLine(+args[0]) }
      ]; break;
    }
    case 'proj-loc': {
      const locIdx = +args[0];
      const locName = decodeURIComponent(args[1] || '');
      items = [
        { label: 'Edit', icon: '✎', fn: () => editLocation(locIdx) },
        null,
        { label: 'Open Scouting Sheet', icon: '🗺', fn: () => openScoutingSheetForLocation(locName) },
        { label: 'Open Tech Scout Checklist', icon: '☑', fn: () => openTechScoutForLocation(locName) },
        null,
        { label: 'Remove from Project', icon: '🗑', danger: true, fn: () => removeLocation(locIdx) }
      ]; break;
    }
    case 'shot':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editShot(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeShot(+args[0]) }
      ]; break;
    case 'prop':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editPropItem(args[0], +args[1]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removePropItem(args[0], +args[1]) }
      ]; break;
    case 'wardrobe':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editWardrobeItem(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeWardrobeItem(+args[0]) }
      ]; break;
    case 'sound':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editSoundEntry(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeSoundEntry(+args[0]) }
      ]; break;
    case 'risk':
      items = [
        { label: 'Edit', icon: '✎', fn: () => editRiskRow(+args[0]) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeRiskRow(+args[0]) }
      ]; break;
    case 'contact': {
      const cname = decodeURIComponent(rawArgs);
      items = [
        { label: 'Edit', icon: '✎', fn: () => editContact(cname) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => removeContact(cname) }
      ]; break;
    }
    case 'loc-global': {
      const pid = args[0], lidx = +args[1];
      const _locObj = pid === '_global'
        ? (store.locations||[])[lidx]
        : (store.projects.find(p=>p.id===pid)?.locations||[])[lidx];
      const _locName = _locObj?.name || '';
      items = [
        { label: 'Edit', icon: '✎', fn: () => editLocationGlobal(pid, lidx) },
        { label: 'Move / Copy', icon: '⇄', fn: () => openMoveLocation(pid, lidx) },
        null,
        { label: 'Create Scouting Sheet', icon: '🗺', fn: () => openCreateScoutModal(_locName, 'scout') },
        { label: 'Create Tech Checklist', icon: '☑', fn: () => openCreateScoutModal(_locName, 'tech') },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => deleteLocationGlobal(pid, lidx) }
      ]; break;
    }
    case 'bud-col': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleBudgetColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openBudgetColumnsModal() }
      ]; break;
    }
    case 'col-contact': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleContactColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openContactColumnsModal() }
      ]; break;
    }
    case 'col-location': {
      const colId = args[0];
      items = [
        { label: 'Hide Column', icon: '👁', fn: () => toggleLocationColVisibility(colId) },
        null,
        { label: 'Manage Columns', icon: '⚙', fn: () => openLocationColumnsModal() }
      ]; break;
    }
    case 'file-card': {
      const fid = args[0];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openManageFile(fid) },
        { label: 'Move to Project', icon: '🔀', fn: () => openMoveFile([fid], null) },
        { label: 'Download', icon: '⬇', fn: () => downloadFile(fid) },
        null,
        { label: 'Delete', icon: '🗑', danger: true, fn: () => openRemoveFiles([fid], null) }
      ]; break;
    }
    case 'script-file': {
      const sid = args[0];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openScriptRename(sid) },
        { label: 'Share', icon: '↗', fn: () => shareScriptFile(sid) },
        { label: 'Download', icon: '⬇', fn: () => downloadScriptFile(sid) },
        null,
        { label: 'Remove', icon: '🗑', danger: true, fn: () => removeScriptFile(sid) }
      ]; break;
    }
    case 'custom-file': {
      const csId = args[0], fId = args[1];
      items = [
        { label: 'Rename', icon: '✏️', fn: () => openCustomSectionFileRename(csId, fId) },
        { label: 'Share', icon: '↗', fn: () => shareCustomSectionFile(csId, fId) },
        { label: 'Download', icon: '⬇', fn: () => downloadCustomSectionFile(csId, fId) },
        null,
        { label: 'Remove', icon: '🗑', danger: true, fn: () => removeCustomSectionFile(csId, fId) }
      ]; break;
    }
  }
  if (items.length) showContextMenu(e, items);
});
