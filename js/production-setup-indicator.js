// ══════════════════════════════════════════
// PRODUCTION SETUP INDICATOR
// ══════════════════════════════════════════
// Slim status strip in the project header.
//
// Three states per section:
//   Grey  — no data
//   Amber — has data (automatic)
//   Green — manually marked complete
//
// Click a pill → mini dropdown:
//   Mark Complete / Mark Incomplete / Go to [section]
// ══════════════════════════════════════════

(function () {

  const SETUP_SECTIONS = [
    {
      key:     'breakdown',
      label:   'Script',
      icon:    '📄',
      check:   p => !!(p.scriptBreakdowns?.length && p.scriptBreakdowns[0].rawText),
      section: 'breakdown',
    },
    {
      key:     'cast',
      label:   'Cast',
      icon:    '🎭',
      check:   p => !!(p.cast?.length || p.extras?.length),
      section: 'cast',
    },
    {
      key:     'crew',
      label:   'Crew',
      icon:    '🎬',
      check:   p => !!(p.unit?.length),
      section: 'crew',
    },
    {
      key:     'locations',
      label:   'Locations',
      icon:    '📍',
      check:   p => !!(p.locations?.length),
      section: 'locations',
    },
    {
      key:     'shots',
      label:   'Shot List',
      icon:    '🎯',
      check:   p => !!(p.shots?.length),
      section: 'shotlist',
    },
    {
      key:     'schedule',
      label:   'Schedule',
      icon:    '📅',
      check:   p => !!(p.schedule?.filter(s => !s.isDayHeader).length),
      section: 'schedule',
    },
    {
      key:     'budget',
      label:   'Budget',
      icon:    '💰',
      check:   p => !!(p.budget?.length),
      section: 'budget',
    },
    {
      key:     'callsheet',
      label:   'Callsheet',
      icon:    '📋',
      check:   p => !!(p.callsheets?.length),
      section: 'callsheet',
    },
    {
      key:     'props',
      label:   'Props',
      icon:    '🎬',
      check:   p => !!(p.props?.length),
      section: 'props',
    },
  ];

  // ── Render ─────────────────────────────────────────────────

  window.renderProductionSetup = function (p) {
    if (!p) return;
    _ensureContainer();
    const el = document.getElementById('prod-setup-indicator');
    if (!el) return;

    if (!p.sectionSignoff) p.sectionSignoff = {};

    const total    = SETUP_SECTIONS.length;
    const complete = SETUP_SECTIONS.filter(s => p.sectionSignoff[s.key]).length;
    const hasData  = SETUP_SECTIONS.filter(s => s.check(p)).length;
    const pct      = Math.round((complete / total) * 100);

    const pills = SETUP_SECTIONS.map(s => {
      const signed  = !!(p.sectionSignoff[s.key]);
      const hasAny  = s.check(p);
      // green = signed off, amber = has data, grey = empty
      const bg      = signed  ? 'rgba(80,200,120,0.12)' : hasAny ? 'rgba(230,188,60,0.12)' : 'var(--surface2)';
      const border  = signed  ? 'var(--green)'          : hasAny ? 'var(--accent)'          : 'var(--border2)';
      const color   = signed  ? 'var(--green)'          : hasAny ? 'var(--accent)'          : 'var(--text3)';
      const prefix  = signed  ? '✓ '                    : hasAny ? '● '                     : '';

      return `<button
        id="pill-${s.key}"
        onclick="_pillClick(event,'${s.key}')"
        style="
          display:inline-flex;align-items:center;gap:3px;
          padding:3px 8px;border-radius:20px;font-size:10px;font-weight:600;
          border:1px solid ${border};background:${bg};color:${color};
          cursor:pointer;white-space:nowrap;transition:opacity 0.15s;
          position:relative;
        "
        title="${signed ? 'Complete' : hasAny ? 'In progress' : 'Not started'} — click for options"
      >${prefix}${_esc(s.label)}</button>`;
    }).join('');

    const allDone = complete === total;

    el.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:8px;
        padding:8px 0 4px;
        border-top:1px solid var(--border2);
        margin-top:8px;
        flex-wrap:wrap;
      ">
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <div style="width:52px;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${allDone ? 'var(--green)' : 'var(--accent)'};border-radius:2px;transition:width 0.3s"></div>
          </div>
          <span style="font-size:10px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap">${complete}/${total}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;flex:1">${pills}</div>
        ${allDone ? `<span style="font-size:10px;color:var(--green);font-weight:600;flex-shrink:0">Production ready ✓</span>` : ''}
      </div>`;
  };

  // ── Pill click → mini dropdown ─────────────────────────────

  window._pillClick = function (e, key) {
    e.stopPropagation();
    _closePillDropdown();

    const p       = currentProject();
    if (!p) return;
    if (!p.sectionSignoff) p.sectionSignoff = {};

    const def     = SETUP_SECTIONS.find(s => s.key === key);
    if (!def) return;
    const signed  = !!(p.sectionSignoff[key]);
    const pill    = document.getElementById('pill-' + key);
    if (!pill) return;

    const rect    = pill.getBoundingClientRect();
    const menu    = document.createElement('div');
    menu.id       = '_pill-dropdown';
    menu.style.cssText = [
      'position:fixed',
      `top:${rect.bottom + 4}px`,
      `left:${rect.left}px`,
      'background:var(--surface)',
      'border:1px solid var(--border)',
      'border-radius:var(--radius)',
      'box-shadow:var(--shadow-lg)',
      'z-index:9000',
      'min-width:160px',
      'overflow:hidden',
      'font-size:12px',
    ].join(';');

    const item = (icon, label, fn, danger = false) => {
      const d = document.createElement('div');
      d.style.cssText = `padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;color:${danger ? 'var(--red)' : 'var(--text)'}`;
      d.innerHTML = `<span>${icon}</span><span>${label}</span>`;
      d.onmouseenter = () => d.style.background = 'var(--surface2)';
      d.onmouseleave = () => d.style.background = '';
      d.onclick = (ev) => { ev.stopPropagation(); _closePillDropdown(); fn(); };
      return d;
    };

    if (!signed) {
      menu.appendChild(item('✓', 'Mark Complete', () => _setPillState(key, true)));
    } else {
      menu.appendChild(item('✕', 'Mark Incomplete', () => _setPillState(key, false)));
    }

    // Divider
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border2);margin:2px 0';
    menu.appendChild(sep);

    menu.appendChild(item('→', `Go to ${def.label}`, () => showSection(def.section)));

    // Clamp to viewport
    document.body.appendChild(menu);
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    if (rect.left + mw > window.innerWidth - 8) {
      menu.style.left = Math.max(8, window.innerWidth - mw - 8) + 'px';
    }
    if (rect.bottom + 4 + mh > window.innerHeight - 8) {
      menu.style.top = (rect.top - mh - 4) + 'px';
    }
  };

  function _setPillState(key, complete) {
    const p = currentProject();
    if (!p) return;
    if (!p.sectionSignoff) p.sectionSignoff = {};
    if (complete) p.sectionSignoff[key] = true;
    else delete p.sectionSignoff[key];
    saveStore();
    renderProductionSetup(p);
  }

  function _closePillDropdown() {
    document.getElementById('_pill-dropdown')?.remove();
  }

  document.addEventListener('click', _closePillDropdown);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _closePillDropdown(); });

  // ── Container injection ────────────────────────────────────

  function _ensureContainer() {
    if (document.getElementById('prod-setup-indicator')) return;
    const logline = document.getElementById('proj-logline');
    if (!logline) return;
    const container = document.createElement('div');
    container.id = 'prod-setup-indicator';
    logline.parentElement.appendChild(container);
  }

  // ── Auto-render hooks ──────────────────────────────────────

  const _origShowSection = window.showSection;
  if (_origShowSection) {
    window.showSection = function (sectionName) {
      _origShowSection(sectionName);
      const p = typeof currentProject === 'function' ? currentProject() : null;
      if (p && document.getElementById('view-project')?.classList.contains('active')) {
        setTimeout(() => renderProductionSetup(p), 50);
      }
    };
  }

  const _origShowProjectView = window.showProjectView;
  if (_origShowProjectView) {
    window.showProjectView = function (id) {
      _origShowProjectView(id);
      setTimeout(() => {
        const p = typeof currentProject === 'function' ? currentProject() : null;
        if (p) renderProductionSetup(p);
      }, 100);
    };
  }

  if (window.EventBus) {
    EventBus.on(EventBus.Events.DATA_SAVED, () => {
      const p = typeof currentProject === 'function' ? currentProject() : null;
      if (p && document.getElementById('prod-setup-indicator')) {
        renderProductionSetup(p);
      }
    });
  }

  // ── Helper ─────────────────────────────────────────────────

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

})();
