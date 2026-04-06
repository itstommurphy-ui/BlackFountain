// ══════════════════════════════════════════
// RIGHT PANEL — Tasks · Contacts · Moodboards · Scratchpad
// Add to nav.js or as js/views/right-panel.js (load after nav.js)
// ══════════════════════════════════════════

// ── State ───────────────────────────────────────────────────

let _rpActiveTab  = null; // currently open tab id, null = closed
let _rpScratchPage = 0;   // current scratchpad page index
let _rpDrawMode   = false;
let _rpDrawing    = false;
let _rpLastX      = 0;
let _rpLastY      = 0;

// Stop propagation on right-panel clicks so document click handler doesn't close it
// But allow ctx-menu and rp-confirm clicks to propagate so they can close menus
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('right-panel');
  if (panel) {
    panel.addEventListener('click', e => {
      const ctxMenu = document.getElementById('ctx-menu');
      const rpConfirm = document.getElementById('rp-confirm');
      if (ctxMenu?.contains(e.target) || rpConfirm?.contains(e.target)) return;
      e.stopPropagation();
    });
  }
});

// ── Tab switching ────────────────────────────────────────────

function rpShowTab(tabId) {
  const panel = document.getElementById('right-panel');
  const body  = document.getElementById('rp-body');
  if (!panel || !body) return;

  // Save scratchpad before switching away from it
  if (_rpActiveTab === 'scratchpad' && tabId !== 'scratchpad') {
    _rpSaveCurrent();
  }

  if (_rpActiveTab === tabId) {
    // Save before closing if scratchpad was active
    if (_rpActiveTab === 'scratchpad') _rpSaveCurrent();
    // Toggle closed
    _rpActiveTab = null;
    panel.classList.remove('open');
    document.body.classList.remove('rp-panel-open');
    document.querySelectorAll('.rp-strip-tab').forEach(t => t.classList.remove('active'));
    return;
  }

  _rpActiveTab = tabId;
  panel.classList.add('open');
  document.body.classList.add('rp-panel-open');

  // Update tab strip active state
  document.querySelectorAll('.rp-strip-tab').forEach(t => {
    t.classList.toggle('active', t.id === `rp-tab-${tabId}`);
  });

  // Show correct pane
  document.querySelectorAll('.rp-pane').forEach(p => p.style.display = 'none');
  const pane = document.getElementById(`rp-pane-${tabId}`);
  if (pane) pane.style.display = 'flex';

  // Render content
  switch (tabId) {
    case 'tasks':      qtDrawerSync();         break;
    case 'contacts':   rpContactsRender();     break;
    case 'moodboards': rpMoodboardsRender();   break;
    case 'scratchpad': rpScratchRender();      break;
  }
}

// Expose so external calls still work
function toggleQtDrawer() { rpShowTab('tasks'); }

// ── Badge updates ────────────────────────────────────────────

function rpUpdateBadges() {
  // Tasks badge — outstanding tasks in current project
  const p = typeof currentProject === 'function' ? currentProject() : null;
  const tasks = p?.quickTasks || [];
  const outstanding = tasks.filter(t => !t.done).length;
  const tb = document.getElementById('rp-badge-tasks');
  if (tb) tb.textContent = outstanding > 0 ? String(outstanding) : '';

  // Contacts badge — total contacts across all sources
  const allContacts = _rpGetAllContacts();
  const cb = document.getElementById('rp-badge-contacts');
  if (cb) cb.textContent = allContacts.length > 0 ? String(allContacts.length) : '';
}

// Call rpUpdateBadges whenever data changes
// Hook into saveStore if possible, or call manually after mutations
const _rpOrigSaveStore = typeof saveStore === 'function' ? saveStore : null;

// ── Contacts ─────────────────────────────────────────────────

function _rpGetAllContacts() {
  const seen = new Map(); // key = name.toLowerCase() → contact object

  const _add = (name, role, phone, email, projectTitle, source, socials) => {
    if (!name?.trim()) return;
    const key = name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, { name: name.trim(), roles: new Set(), phone: phone||'', email: email||'', socials: socials||'', projects: new Set(), source });
    }
    const c = seen.get(key);
    if (role) c.roles.add(role);
    if (phone) c.phone = c.phone || phone;
    if (email) c.email = c.email || email;
    if (socials) c.socials = c.socials || socials;
    if (projectTitle) c.projects.add(projectTitle);
  };

  // Global contacts store
  (store.contacts || []).forEach(c => {
    const roles = Array.isArray(c.roles) ? c.roles : (c.type ? [c.type] : []);
    _add(c.name, roles.join(', '), c.phone, c.email, null, 'global', c.socials);
  });

  // Per-project cast, crew, extras
  (store.projects || []).forEach(p => {
    const title = p.title || 'Untitled';
    (p.cast   || []).forEach(c => _add(c.name, c.role || 'Cast',  c.number, c.email, title, 'cast', c.social));
    (p.extras || []).forEach(c => _add(c.name, c.role || 'Extra', c.number, c.email, title, 'extra', ''));
    (p.unit   || []).forEach(c => _add(c.name, c.role || 'Crew',  c.number, c.email, title, 'crew', ''));
    // Per-project contacts array
    (p.contacts || []).forEach(c => {
      const roles = Array.isArray(c.roles) ? c.roles : [];
      _add(c.name, roles.join(', '), c.phone, c.email, title, 'contact', c.socials);
    });
  });

  return [...seen.values()].map(c => ({
    ...c,
    roles:    [...c.roles].filter(Boolean),
    projects: [...c.projects],
  }));
}

function rpContactsRender() {
  const list = document.getElementById('rp-contacts-list');
  const countEl = document.getElementById('rp-contacts-count');
  if (!list) return;

  const query   = (document.getElementById('rp-contacts-search')?.value || '').toLowerCase().trim();
  const sortMode= document.getElementById('rp-contacts-sort')?.value || 'name';
  const projectFilter = document.getElementById('rp-contacts-project-filter')?.checked;

  let contacts = _rpGetAllContacts();

  // Filter by current project if checkbox is checked
  if (projectFilter) {
    const p = typeof currentProject === 'function' ? currentProject() : null;
    if (p) {
      contacts = contacts.filter(c => c.projects.includes(p.title));
    }
  }

  // Filter
  if (query) {
    contacts = contacts.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.roles.some(r => r.toLowerCase().includes(query)) ||
      c.projects.some(p => p.toLowerCase().includes(query))
    );
  }

  if (countEl) countEl.textContent = contacts.length;

  if (!contacts.length) {
    list.innerHTML = `<div style="padding:20px 8px;font-size:12px;color:var(--text3);text-align:center">${query ? 'No matches' : 'No contacts yet'}</div>`;
    return;
  }

  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

  if (sortMode === 'name') {
    contacts.sort((a,b) => a.name.localeCompare(b.name));
    // Alphabetical groups
    const groups = {};
    contacts.forEach(c => {
      const letter = c.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    list.innerHTML = Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([letter, items]) =>
      `<div class="rp-contacts-group-label">${letter}</div>` +
      items.map(c => _rpContactRow(c, esc)).join('')
    ).join('');

  } else if (sortMode === 'role') {
    contacts.sort((a,b) => {
      const ra = a.roles[0]||''; const rb = b.roles[0]||'';
      return ra.localeCompare(rb) || a.name.localeCompare(b.name);
    });
    const groups = {};
    contacts.forEach(c => {
      const role = c.roles[0] || 'Other';
      if (!groups[role]) groups[role] = [];
      groups[role].push(c);
    });
    list.innerHTML = Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([role, items]) =>
      `<div class="rp-contacts-group-label">${esc(role)}</div>` +
      items.map(c => _rpContactRow(c, esc)).join('')
    ).join('');

  } else if (sortMode === 'project') {
    contacts.sort((a,b) => {
      const pa = a.projects[0]||'Global'; const pb = b.projects[0]||'Global';
      return pa.localeCompare(pb) || a.name.localeCompare(b.name);
    });
    const groups = {};
    contacts.forEach(c => {
      const proj = c.projects[0] || 'Global';
      if (!groups[proj]) groups[proj] = [];
      groups[proj].push(c);
    });
    list.innerHTML = Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([proj, items]) =>
      `<div class="rp-contacts-group-label">${esc(proj)}</div>` +
      items.map(c => _rpContactRow(c, esc)).join('')
    ).join('');
  }
}

function _rpContactRow(c, esc) {
  const initials = c.name.split(' ').map(w=>w[0]).join('').toUpperCase().substring(0,2);
  const roleStr  = c.roles.slice(0,2).join(', ');
  const projTag  = c.projects.length ? c.projects[0] : '';
  const phone    = c.phone;
  const email    = c.email;
  const nameKey  = esc(c.name).replace(/'/g, "\\'");

  let socialsHtml = '';
  if (c.socials) {
    if (typeof renderSocialLinks === 'function') {
      socialsHtml = `<div class="rp-contact-socials">${renderSocialLinks(c.socials, { empty: '' })}</div>`;
    } else {
      socialsHtml = `<div class="rp-contact-socials">${esc(c.socials)}</div>`;
    }
  }

  let projectsHtml = '';
  if (c.projects.length) {
    projectsHtml = `<div class="rp-contact-detail"><span class="rp-contact-detail-label">Projects:</span> ${c.projects.map(p => esc(p)).join(', ')}</div>`;
  }

  return `<div class="rp-contact-item" id="rp-contact-${nameKey.replace(/[^a-zA-Z0-9]/g, '-')}" onclick="rpToggleContactExpand('${nameKey}')" oncontextmenu="rpContactCtxMenu(event, this)" data-rp-contact-name="${nameKey}" data-rp-contact-phone="${esc(phone)}" data-rp-contact-email="${esc(email)}">
    <div class="rp-contact-main">
      <div class="rp-contact-avatar">${esc(initials)}</div>
      <div class="rp-contact-info">
        <div class="rp-contact-name">${esc(c.name)}</div>
        <div class="rp-contact-role">${esc(roleStr)}${phone?` · ${esc(phone)}`:''}${email && !phone?` · ${esc(email)}`:''}${c.projects.length > 1 ? ` +${c.projects.length-1}` : ''}</div>
      </div>
      ${projTag ? `<div class="rp-contact-project" title="${esc(c.projects.join(', '))}">${esc(projTag.substring(0,12))}${projTag.length>12?'…':''}</div>` : ''}
    </div>
    <div class="rp-contact-expand">
      ${c.phone ? `<div class="rp-contact-detail"><span class="rp-contact-detail-label">Phone:</span> <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></div>` : ''}
      ${c.email ? `<div class="rp-contact-detail"><span class="rp-contact-detail-label">Email:</span> <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
      ${socialsHtml}
      ${projectsHtml}
    </div>
  </div>`;
}

let _rpExpandedContact = null;

function rpToggleContactExpand(name) {
  const id = 'rp-contact-' + name.replace(/[^a-zA-Z0-9]/g, '-');
  const item = document.getElementById(id);
  if (!item) return;

  if (_rpExpandedContact && _rpExpandedContact !== item) {
    _rpExpandedContact.classList.remove('expanded');
  }

  if (_rpExpandedContact === item && item.classList.contains('expanded')) {
    item.classList.remove('expanded');
    _rpExpandedContact = null;
  } else {
    item.classList.add('expanded');
    _rpExpandedContact = item;
  }
}

function rpContactCtxMenu(e, itemEl) {
  e.preventDefault();
  e.stopPropagation();
  const item = itemEl.closest('.rp-contact-item');
  const name = item?.dataset.rpContactName || '';
  const phone = item?.dataset.rpContactPhone || '';
  const email = item?.dataset.rpContactEmail || '';

  const items = [
    phone ? { label: 'Copy Phone', icon: '📋', fn: () => navigator.clipboard.writeText(phone) } : null,
    email ? { label: 'Copy Email', icon: '📋', fn: () => navigator.clipboard.writeText(email) } : null,
    (phone || email) ? { label: 'Copy Contact', icon: '📋', fn: () => navigator.clipboard.writeText(`${name}${phone ? '\n' + phone : ''}${email ? '\n' + email : ''}`) } : null,
    null,
    { label: 'Delete Contact', icon: '🗑', danger: true, fn: () => rpDeleteContact(name) }
  ].filter(Boolean);

  showContextMenu(e, items);
}

function rpDeleteContact(name) {
  const contacts = _rpGetAllContacts();
  const c = contacts.find(ct => ct.name.toLowerCase() === name.toLowerCase());
  if (!c) return;

  rpShowConfirm(`Delete contact "${c.name}"?`, 'Delete', () => {
    store.contacts = (store.contacts || []).filter(con => con.name.toLowerCase() !== c.name.toLowerCase());

    for (const p of store.projects || []) {
      if (p.cast) p.cast = p.cast.filter(cast => cast.name.toLowerCase() !== c.name.toLowerCase());
      if (p.extras) p.extras = p.extras.filter(ext => ext.name.toLowerCase() !== c.name.toLowerCase());
      if (p.unit) p.unit = p.unit.filter(u => u.name.toLowerCase() !== c.name.toLowerCase());
      if (p.contacts) p.contacts = p.contacts.filter(con => con.name.toLowerCase() !== c.name.toLowerCase());
    }

    saveStore();
    rpContactsRender();
  });
}

function rpShowConfirm(message, confirmLabel, onConfirm) {
  const existing = document.getElementById('rp-confirm');
  if (existing) existing.remove();

  const left = window.innerWidth / 2 - 100;
  const top = window.innerHeight / 2;
  const confirm = document.createElement('div');
  confirm.id = 'rp-confirm';
  confirm.style.cssText = `position:fixed;left:${left}px;top:${top}px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.25);z-index:200;font-size:13px;color:var(--text)`;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-sm';
  cancelBtn.style.background = 'var(--surface2)';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = (e) => { e.stopPropagation(); confirm.remove(); };
  
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-sm btn-danger';
  confirmBtn.textContent = confirmLabel;
  confirmBtn.onclick = (e) => { e.stopPropagation(); confirm.remove(); onConfirm(); };
  
  const msg = document.createElement('div');
  msg.style.marginBottom = '12px';
  msg.textContent = message;
  
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  
  confirm.appendChild(msg);
  confirm.appendChild(btnRow);
  document.body.appendChild(confirm);
}

document.addEventListener('contextmenu', e => {
  const confirm = document.getElementById('rp-confirm');
  if (confirm) confirm.remove();
});

// ── Moodboards ───────────────────────────────────────────────

function rpMoodboardsRender() {
  const list = document.getElementById('rp-moodboards-list');
  if (!list) return;

  const boards = store.moodboards || [];

  if (!boards.length) {
    list.innerHTML = `<div style="padding:20px 8px;font-size:12px;color:var(--text3);text-align:center">No moodboards yet.<br><br><button onclick="openNewMoodboardModal()" style="background:none;border:1px solid var(--border);color:var(--accent);border-radius:var(--radius);padding:6px 14px;font-size:11px;cursor:pointer">+ Create first board</button></div>`;
    return;
  }

  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

  // Group by project
  const byProject = {};
  boards.forEach(b => {
    const p = (store.projects||[]).find(p => p.id === b.projectId);
    const title = p?.title || 'Global';
    if (!byProject[title]) byProject[title] = [];
    byProject[title].push({ board: b, project: p });
  });

  list.innerHTML = Object.entries(byProject).sort(([a],[b]) => a.localeCompare(b)).map(([title, items]) =>
    `<div class="rp-contacts-group-label">${esc(title)}</div>` +
    items.map(({ board, project }) => {
      // Find first image in this moodboard from store.files
      const firstImage = (store.files||[]).find(f =>
        f.moodboardId === board.id &&
        f.data?.startsWith('data:image')
      );
      const thumbHtml = firstImage
        ? `<img src="${firstImage.data}" alt="">`
        : `<div style="font-size:16px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--text3)">${board.icon||'🎨'}</div>`;

      return `<div class="rp-mb-item" onclick="rpOpenMoodboard('${board.id}','${project?.id||''}')">
        <div class="rp-mb-thumb">${thumbHtml}</div>
        <div class="rp-mb-info">
          <div class="rp-mb-name">${esc(board.name||'Untitled board')}</div>
          <div class="rp-mb-project">${esc(title)}</div>
        </div>
      </div>`;
    }).join('')
  ).join('');
}

function rpOpenMoodboard(boardId, projectId) {
  // Switch to the project if needed, then navigate to moodboards section
  if (projectId && store.currentProjectId !== projectId) {
    store.currentProjectId = projectId;
    if (typeof showProjectView === 'function') showProjectView(projectId);
  }
  // Navigate to moodboards section
  if (typeof showSection === 'function') showSection('moodboards');
  // Close panel
  rpShowTab('moodboards'); // toggles it closed
}

// ── Scratchpad ───────────────────────────────────────────────

function _rpGetScratchData() {
  if (!store.scratchpad) store.scratchpad = { pages: [{ text: '', drawing: null }] };
  if (!store.scratchpad.pages?.length) store.scratchpad.pages = [{ text: '', drawing: null }];
  return store.scratchpad;
}

function rpScratchRender() {
  const book   = document.getElementById('rp-sp-book');
  const pageBar= document.getElementById('rp-sp-page-bar');
  if (!book) return;

  const data = _rpGetScratchData();
  const pages = data.pages;

  // Clamp active page
  if (_rpScratchPage >= pages.length) _rpScratchPage = pages.length - 1;
  if (_rpScratchPage < 0) _rpScratchPage = 0;

  // Page dots
  if (pageBar) {
    pageBar.innerHTML = pages.map((_, i) =>
      `<div class="rp-sp-page-dot${i === _rpScratchPage ? ' active' : ''}" onclick="rpScratchGoPage(${i})" title="Page ${i+1}"></div>`
    ).join('') + `<div class="rp-sp-page-dot" onclick="rpScratchNewPage()" title="New page" style="background:none;border:1px solid var(--border);font-size:8px;display:flex;align-items:center;justify-content:center;color:var(--text3)">+</div>`;
  }

  // Render only current page (virtual scroll — no need to render all)
  const page = pages[_rpScratchPage];
  book.innerHTML = '';

  const pageEl = document.createElement('div');
  pageEl.className = `rp-sp-page${_rpDrawMode ? ' draw-mode' : ''}`;
  pageEl.id = 'rp-sp-current-page';

  const ta = document.createElement('textarea');
  ta.className = 'rp-sp-textarea';
  ta.placeholder = _rpScratchPage === 0 && !_rpDrawMode ? 'Start writing…' : '';
  ta.value = page.text || '';
  ta.addEventListener('input', () => {
    _rpGetScratchData().pages[_rpScratchPage].text = ta.value;
    // Don't auto-save on every keystroke - save when panel closes or page changes
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'rp-sp-canvas';
  canvas.id = 'rp-sp-canvas';

  pageEl.appendChild(ta);
  pageEl.appendChild(canvas);
  book.appendChild(pageEl);

  // Set canvas size to match page
  requestAnimationFrame(() => {
    const rect = pageEl.getBoundingClientRect();
    canvas.width  = rect.width  || 280;
    canvas.height = rect.height || 400;
    _rpRestoreDrawing(canvas, page.drawing);
    _rpWireCanvas(canvas);
  });
}

function rpScratchGoPage(i) {
  _rpSaveCurrent();
  _rpScratchPage = i;
  rpScratchRender();
}

function rpScratchNewPage() {
  _rpSaveCurrent();
  const data = _rpGetScratchData();
  data.pages.push({ text: '', drawing: null });
  _rpScratchPage = data.pages.length - 1;
  saveStore();
  rpScratchRender();
}

function rpScratchMode(mode) {
  _rpDrawMode = (mode === 'draw');
  document.getElementById('rp-sp-mode-text')?.classList.toggle('active', !_rpDrawMode);
  document.getElementById('rp-sp-mode-draw')?.classList.toggle('active',  _rpDrawMode);
  const page = document.getElementById('rp-sp-current-page');
  if (page) page.classList.toggle('draw-mode', _rpDrawMode);
}

function _rpSaveCurrent() {
  const ta = document.querySelector('#rp-sp-current-page .rp-sp-textarea');
  if (ta) {
    _rpGetScratchData().pages[_rpScratchPage].text = ta.value;
  }
  const canvas = document.getElementById('rp-sp-canvas');
  if (canvas) {
    _rpGetScratchData().pages[_rpScratchPage].drawing = canvas.toDataURL();
  }
  saveStore();
}

function _rpRestoreDrawing(canvas, dataUrl) {
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

function _rpWireCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'var(--text)' in document.documentElement.style
    ? getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0e0e8'
    : '#e0e0e8';
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  const getPos = e => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = e => {
    if (!_rpDrawMode) return;
    e.preventDefault();
    _rpDrawing = true;
    const { x, y } = getPos(e);
    _rpLastX = x; _rpLastY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = e => {
    if (!_rpDrawing || !_rpDrawMode) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    _rpLastX = x; _rpLastY = y;
  };

  const end = e => {
    if (!_rpDrawing) return;
    _rpDrawing = false;
    // Auto-save drawing data to memory (will save when panel closes)
    _rpGetScratchData().pages[_rpScratchPage].drawing = canvas.toDataURL();
  };

  canvas.addEventListener('mousedown',  start);
  canvas.addEventListener('mousemove',  move);
  canvas.addEventListener('mouseup',    end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove',  move,  { passive: false });
  canvas.addEventListener('touchend',   end);
}

// ── Sync qtDrawerRender to use the new panel ─────────────────
// The existing qtDrawerRender/qtDrawerSync functions write to
// #qt-drawer-list which now lives inside #rp-pane-tasks.
// No changes needed to those functions — the IDs are reused.

// ── Auto-update badges on data changes ───────────────────────
// Call rpUpdateBadges after any saveStore
(function _rpHookSaveStore() {
  if (typeof window === 'undefined') return;
  const _orig = window.saveStore;
  if (!_orig || typeof _orig !== 'function') {
    // Retry after load
    window.addEventListener('load', _rpHookSaveStore, { once: true });
    return;
  }
  window.saveStore = async function(...args) {
    const result = await _orig.apply(this, args);
    rpUpdateBadges();
    return result;
  };
})();

// Initial badge render
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(rpUpdateBadges, 500);
});
