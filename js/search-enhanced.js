// ══════════════════════════════════════════
// GLOBAL SEARCH — ENHANCED (Phase 3)
// ══════════════════════════════════════════
// Replaces performGlobalSearch and navigateToSearchResult
// with a version that indexes:
//   Projects, Cast, Crew, Scenes (breakdown),
//   Locations, Contacts, Files, Budget lines
//
// Results are grouped by type, navigate directly to the
// right project section, and support keyboard navigation.
// ══════════════════════════════════════════

(function () {

  // ── Result builders ────────────────────────────────────────

  function _buildResults(q) {
    const results = [];
    const seen    = new Set(); // deduplicate by key

    function add(item) {
      const key = item.type + '::' + item.key;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(item);
    }

    // ── Projects ─────────────────────────────────────────────
    (store.projects || []).forEach(p => {
      const directors = Array.isArray(p.directors) ? p.directors.join(' ') : (p.director || '');
      const producers = Array.isArray(p.producers) ? p.producers.join(' ') : (p.producer || '');
      const haystack = [p.title, directors, producers, p.genre, p.notes, p.logline].join(' ').toLowerCase();
      if (!haystack.includes(q)) return;
      const statusLabels = { pre: 'Pre-Production', prod: 'Production', post: 'Post-Production', done: 'Complete', released: 'Released' };
      add({
        type:      'Project',
        icon:      '⬛',
        title:     p.title || 'Untitled',
        subtitle:  statusLabels[p.status] || '',
        key:       p.id,
        projectId: p.id,
        section:   'overview',
        score:     (p.title || '').toLowerCase().startsWith(q) ? 10 : 5,
      });
    });

    // ── Cast & Extras ─────────────────────────────────────────
    (store.projects || []).forEach(p => {
      [...(p.cast || []), ...(p.extras || [])].forEach((m, i) => {
        const haystack = [m.name, m.role, m.email, m.number].join(' ').toLowerCase();
        if (!haystack.includes(q)) return;
        const type = p.extras?.includes(m) ? 'Extra' : 'Cast';
        add({
          type:      type,
          icon:      '🎭',
          title:     m.name || '—',
          subtitle:  [m.role, p.title].filter(Boolean).join(' · '),
          key:       (m.name || '') + '::' + p.id,
          projectId: p.id,
          section:   'cast',
          score:     (m.name || '').toLowerCase().startsWith(q) ? 9 : 4,
        });
      });
    });

    // ── Crew ──────────────────────────────────────────────────
    (store.projects || []).forEach(p => {
      (p.unit || []).forEach(m => {
        const haystack = [m.name, m.role, m.dept, m.email].join(' ').toLowerCase();
        if (!haystack.includes(q)) return;
        add({
          type:      'Crew',
          icon:      '🎬',
          title:     m.name || '—',
          subtitle:  [m.role, p.title].filter(Boolean).join(' · '),
          key:       (m.name || '') + '::crew::' + p.id,
          projectId: p.id,
          section:   'crew',
          score:     (m.name || '').toLowerCase().startsWith(q) ? 9 : 4,
        });
      });
    });

    // ── Scenes (breakdown) ────────────────────────────────────
    (store.projects || []).forEach(p => {
      (p.scenes || []).forEach(s => {
        const haystack = [s.heading, s.location, s.intExt, s.tod].join(' ').toLowerCase();
        if (!haystack.includes(q)) return;
        add({
          type:      'Scene',
          icon:      '🎞️',
          title:     SceneEntity.getLabel(s),
          subtitle:  p.title,
          key:       s.id,
          projectId: p.id,
          section:   'breakdown',
          sceneId:   s.id,
          score:     (s.location || '').toLowerCase().startsWith(q) ? 8 : 3,
        });
      });
    });

    // ── Contacts (global + per-project) ───────────────────────
    const contactsSeen = new Set();
    const addContact = (c, projectId, projectTitle) => {
      const haystack = [c.name, c.phone, c.email].join(' ').toLowerCase();
      if (!haystack.includes(q)) return;
      const dedupeKey = (c.name || '').toLowerCase();
      if (contactsSeen.has(dedupeKey)) return;
      contactsSeen.add(dedupeKey);
      const roles = (c.roles || []).slice(0, 2).join(', ');
      add({
        type:      'Contact',
        icon:      '📱',
        title:     c.name || '—',
        subtitle:  [roles, c.phone, projectTitle].filter(Boolean).join(' · '),
        key:       'contact::' + (c.name || ''),
        projectId: projectId || null,
        section:   'contacts',
        score:     (c.name || '').toLowerCase().startsWith(q) ? 8 : 3,
      });
    };
    (store.contacts || []).forEach(c => addContact(c, null, null));
    (store.projects || []).forEach(p => {
      (p.contacts || []).forEach(c => addContact(c, p.id, p.title));
    });

    // ── Locations ─────────────────────────────────────────────
    const locsSeen = new Set();
    const addLoc = (l, projectId, projectTitle) => {
      const haystack = [l.name, l.location, l.notes].join(' ').toLowerCase();
      if (!haystack.includes(q)) return;
      const dedupeKey = (l.name || '').toLowerCase() + '::' + (projectId || '');
      if (locsSeen.has(dedupeKey)) return;
      locsSeen.add(dedupeKey);
      add({
        type:      'Location',
        icon:      '📍',
        title:     l.name || '—',
        subtitle:  [l.location, projectTitle].filter(Boolean).join(' · '),
        key:       'loc::' + (l.name || '') + '::' + (projectId || ''),
        projectId: projectId || null,
        section:   'locations',
        score:     (l.name || '').toLowerCase().startsWith(q) ? 7 : 3,
      });
    };
    (store.locations || []).forEach(l => addLoc(l, null, null));
    (store.projects || []).forEach(p => {
      (p.locations || []).forEach(l => addLoc(l, p.id, p.title));
    });

    // ── Files ─────────────────────────────────────────────────
    (store.files || []).filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q)
    ).slice(0, 8).forEach(f => {
      const pids = fileProjectIds(f);
      const proj = pids.length ? store.projects.find(p => p.id === pids[0]) : null;
      add({
        type:      'File',
        icon:      '📄',
        title:     f.name || '—',
        subtitle:  proj ? proj.title : '',
        key:       'file::' + f.id,
        projectId: pids[0] || null,
        section:   'files',
        fileId:    f.id,
        score:     (f.name || '').toLowerCase().startsWith(q) ? 7 : 2,
      });
    });

    // ── Budget lines ──────────────────────────────────────────
    (store.projects || []).forEach(p => {
      (p.budget || []).filter(b =>
        (b.desc || '').toLowerCase().includes(q) ||
        (b.dept || '').toLowerCase().includes(q) ||
        (b.vendor || '').toLowerCase().includes(q)
      ).slice(0, 4).forEach(b => {
        add({
          type:      'Budget',
          icon:      '💰',
          title:     b.desc || b.dept || '—',
          subtitle:  [b.dept, b.vendor, p.title].filter(Boolean).join(' · '),
          key:       'bud::' + (b.desc || '') + '::' + p.id,
          projectId: p.id,
          section:   'budget',
          score:     2,
        });
      });
    });

    // Sort by score desc, then alpha
    results.sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title));
    return results;
  }

  // ── Render ─────────────────────────────────────────────────

  const TYPE_ORDER = ['Project', 'Cast', 'Extra', 'Crew', 'Scene', 'Contact', 'Location', 'File', 'Budget'];
  let _activeIdx = -1;
  let _currentResults = [];

  function _renderResults(results) {
    const dropdown = document.getElementById('search-dropdown');
    _currentResults = results;
    _activeIdx = -1;

    if (!results.length) {
      dropdown.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px;text-align:center;">No results found</div>';
      dropdown.style.display = 'block';
      return;
    }

    // Group by type
    const groups = {};
    TYPE_ORDER.forEach(t => groups[t] = []);
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });

    let html = '';
    let idx  = 0;

    TYPE_ORDER.forEach(type => {
      const items = groups[type];
      if (!items.length) return;
      html += `<div style="padding:4px 12px 2px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);background:var(--surface2)">${type}${items.length > 1 ? 's' : ''}</div>`;
      items.forEach(r => {
        html += `<div class="sr-item" data-idx="${idx}" onclick="_navigateSearch(${idx})"
          style="padding:8px 12px;border-bottom:1px solid var(--border2);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <span style="font-size:13px;flex-shrink:0">${r.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(r.title)}</div>
            ${r.subtitle ? `<div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(r.subtitle)}</div>` : ''}
          </div>
          <span style="font-size:9px;color:var(--text3);background:var(--surface2);padding:2px 6px;border-radius:3px;flex-shrink:0">${_esc(r.type)}</span>
        </div>`;
        idx++;
      });
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';

    // Hover effects
    dropdown.querySelectorAll('.sr-item').forEach(el => {
      el.onmouseenter = () => { _activeIdx = parseInt(el.dataset.idx); _highlightActive(); };
    });
  }

  function _highlightActive() {
    document.querySelectorAll('.sr-item').forEach((el, i) => {
      el.style.background = i === _activeIdx ? 'var(--surface2)' : '';
    });
    // Scroll active into view
    const active = document.querySelector(`.sr-item[data-idx="${_activeIdx}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }

  // ── Navigation ─────────────────────────────────────────────

  window._navigateSearch = function (idx) {
    const r = _currentResults[idx];
    if (!r) return;

    const dropdown = document.getElementById('search-dropdown');
    dropdown.style.display = 'none';
    document.getElementById('global-search').value = '';
    _currentResults = [];
    _activeIdx = -1;

    if (r.type === 'Project') {
      showProjectView(r.projectId);
      return;
    }

    if (r.type === 'File') {
      if (r.projectId) showProjectView(r.projectId);
      else showView('files');
      setTimeout(() => viewFile(r.fileId), 200);
      return;
    }

    if (r.section === 'contacts') {
      showView('contacts');
      setTimeout(() => {
        _highlightContact = r.title;
        _scrollToHighlightedContact?.();
      }, 150);
      return;
    }

    if (r.section === 'locations' && !r.projectId) {
      showView('locations');
      setTimeout(() => {
        _highlightLocation = r.title;
        _scrollToHighlightedLocation?.();
      }, 150);
      return;
    }

    if (!r.projectId) return;

    // Navigate to project section
    showProjectView(r.projectId);
    setTimeout(() => {
      showSection(r.section);
      // Scene: scroll to the scene in the breakdown editor
      if (r.type === 'Scene' && r.sceneId) {
        setTimeout(() => {
          const p = store.projects.find(proj => proj.id === r.projectId);
          const scene = p ? SceneEntity.getById(p, r.sceneId) : null;
          if (scene) scrollBreakdownToScene(scene.start);
        }, 300);
        return;
      }
      // Cast/Crew/Budget/Location: highlight matching row
      setTimeout(() => {
        const selector = `[data-ctx*="${CSS.escape(r.title)}"], tr`;
        const rows = document.querySelectorAll(`#section-${r.section} tr`);
        for (const row of rows) {
          if (row.textContent.toLowerCase().includes(r.title.toLowerCase())) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.boxShadow = '0 0 0 2px var(--accent)';
            setTimeout(() => row.style.boxShadow = '', 2500);
            break;
          }
        }
      }, 350);
    }, 200);
  };

  // ── Main entry point ───────────────────────────────────────

  window.performGlobalSearch = function (query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!query || query.length < 2) {
      dropdown.style.display = 'none';
      _currentResults = [];
      _activeIdx = -1;
      return;
    }
    const results = _buildResults(query.toLowerCase().trim());
    _renderResults(results.slice(0, 20));
  };

  // ── Keyboard navigation ────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('global-search');
    if (!input) return;

    input.addEventListener('input', e => performGlobalSearch(e.target.value));

    input.addEventListener('keydown', e => {
      const dropdown = document.getElementById('search-dropdown');
      if (dropdown.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _activeIdx = Math.min(_activeIdx + 1, _currentResults.length - 1);
        _highlightActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _activeIdx = Math.max(_activeIdx - 1, 0);
        _highlightActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_activeIdx >= 0) _navigateSearch(_activeIdx);
        else if (_currentResults.length) _navigateSearch(0);
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        _currentResults = [];
        _activeIdx = -1;
        input.blur();
      }
    });

    // WCAG: make nav items keyboard-accessible
    document.querySelectorAll('.nav-item').forEach(el => {
      if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
  });

  // ── Helpers ────────────────────────────────────────────────

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

})();
