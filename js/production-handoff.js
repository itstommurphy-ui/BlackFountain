// ══════════════════════════════════════════
// PRODUCTION HANDOFF
// ══════════════════════════════════════════
// After breakdown tags are applied, detects newly
// tagged cast, props, and wardrobe items and offers
// to populate the relevant project sections.
//
// Non-blocking: appears as a slide-in banner.
// Review mode shows a checklist before committing.
//
// Drop AFTER breakdown.js in index.html.
//
// DISABLED — keeping code for reference in case re-enabled later
// ══════════════════════════════════════════

(function () {

  return; // Disabled

  // ── Patch applySelectedBdSuggestions ──────────────────────

  const _orig = window.applySelectedBdSuggestions;

  window.applySelectedBdSuggestions = function () {
    const p   = currentProject();
    const bd  = _getActiveBd(p);
    if (!bd) { _orig?.(); return; }

    // Snapshot what's already in sections before applying
    const before = {
      cast:     new Set((p.cast     || []).map(m => (m.role  || m.name  || '').toLowerCase())),
      extras:   new Set((p.extras   || []).map(m => (m.role  || m.name  || '').toLowerCase())),
      props:    new Set((p.props    || []).map(m => (m.name  || '').toLowerCase())),
      wardrobe: new Set((p.wardrobe || []).map(m => (m.name  || '').toLowerCase())),
    };

    // Apply the tags
    _orig?.();

    // Now detect what's new
    const bd2 = _getActiveBd(currentProject()); // re-read after apply
    if (!bd2?.rawText || !bd2?.tags) return;

    const text = bd2.rawText;
    const tags = bd2.tags;

    const newCast     = _uniqueTagTexts(tags, text, 'cast'    ).filter(t => !before.cast.has(t.toLowerCase()));
    const newExtras   = _uniqueTagTexts(tags, text, 'extras'  ).filter(t => !before.extras.has(t.toLowerCase()));
    const newProps    = _uniqueTagTexts(tags, text, 'props'   ).filter(t => !before.props.has(t.toLowerCase()));
    const newWardrobe = _uniqueTagTexts(tags, text, 'wardrobe').filter(t => !before.wardrobe.has(t.toLowerCase()));

    if (!newCast.length && !newExtras.length && !newProps.length && !newWardrobe.length) return;

    _showHandoffBanner(newCast, newExtras, newProps, newWardrobe);
  };

  // ── Banner ─────────────────────────────────────────────────

  function _showHandoffBanner(cast, extras, props, wardrobe) {
    _removeBanner();

    const parts = [
      cast.length     && `${cast.length} cast`,
      extras.length   && `${extras.length} extra${extras.length > 1 ? 's' : ''}`,
      props.length    && `${props.length} prop${props.length > 1 ? 's' : ''}`,
      wardrobe.length && `${wardrobe.length} wardrobe item${wardrobe.length > 1 ? 's' : ''}`,
    ].filter(Boolean);

    const banner = document.createElement('div');
    banner.id = '_handoff-banner';
    banner.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%) translateY(80px)',
      'background:var(--surface)',
      'border:1px solid var(--accent)',
      'border-radius:var(--radius-lg)',
      'box-shadow:var(--shadow-lg)',
      'padding:14px 18px',
      'display:flex',
      'align-items:center',
      'gap:14px',
      'z-index:8000',
      'transition:transform 0.3s ease',
      'max-width:560px',
      'width:calc(100vw - 48px)',
    ].join(';');

    banner.innerHTML = `
      <span style="font-size:18px;flex-shrink:0">✦</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">
          New elements detected: ${parts.join(', ')}
        </div>
        <div style="font-size:11px;color:var(--text3)">Add to project sections?</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="_handoffAcceptAll()" style="flex-shrink:0">
        Add All
      </button>
      <button class="btn btn-sm" onclick="_handoffReview()" style="flex-shrink:0">
        Review
      </button>
      <button onclick="_removeBanner()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px;flex-shrink:0" aria-label="Dismiss">✕</button>`;

    document.body.appendChild(banner);

    // Store payload for accept/review
    banner._payload = { cast, extras, props, wardrobe };

    // Slide in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.style.transform = 'translateX(-50%) translateY(0)';
      });
    });


  }

  function _removeBanner() {
    const b = document.getElementById('_handoff-banner');
    if (!b) return;
    b.style.transform = 'translateX(-50%) translateY(80px)';
    setTimeout(() => b.remove(), 300);
    _removeReviewPanel();
  }
  window._removeBanner = _removeBanner;

  // ── Accept all ─────────────────────────────────────────────

  window._handoffAcceptAll = function () {
    const b = document.getElementById('_handoff-banner');
    if (!b?._payload) return;
    const { cast, extras, props, wardrobe } = b._payload;
    const p = currentProject();
    let added = 0;

    const blank = { name: '', number: '', email: '', notes: '', social: '', confirmed: 'green', dept: '' };

    cast.forEach(role => {
      if (!(p.cast || []).some(m => (m.role || '').toLowerCase() === role.toLowerCase())) {
        if (!p.cast) p.cast = [];
        p.cast.push({ ...blank, role });
        added++;
      }
    });
    extras.forEach(role => {
      if (!(p.extras || []).some(m => (m.role || '').toLowerCase() === role.toLowerCase())) {
        if (!p.extras) p.extras = [];
        p.extras.push({ ...blank, role });
        added++;
      }
    });
    props.forEach(name => {
      if (!(p.props || []).some(pr => (pr.name || '').toLowerCase() === name.toLowerCase())) {
        if (!p.props) p.props = [];
        p.props.push({ name, qty: 1, chars: '', scenes: '', locs: '', pgs: '', notes: '' });
        added++;
      }
    });
    wardrobe.forEach(name => {
      if (!(p.wardrobe || []).some(w => (w.name || '').toLowerCase() === name.toLowerCase())) {
        if (!p.wardrobe) p.wardrobe = [];
        p.wardrobe.push({ name, chars: '', scenes: '', size: '', condition: '', loc: '', notes: '' });
        added++;
      }
    });

    if (added) {
      saveStore();
      showToast(`Added ${added} item${added !== 1 ? 's' : ''} to project sections`, 'success');
    } else {
      showToast('All items already exist in project sections', 'info');
    }
    _removeBanner();
  };

  // ── Review panel ───────────────────────────────────────────

  window._handoffReview = function () {
    const b = document.getElementById('_handoff-banner');
    if (!b?._payload) return;
    const { cast, extras, props, wardrobe } = b._payload;

    _removeReviewPanel();

    const panel = document.createElement('div');
    panel.id = '_handoff-review';
    panel.style.cssText = [
      'position:fixed',
      'bottom:90px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:var(--surface)',
      'border:1px solid var(--border)',
      'border-radius:var(--radius-lg)',
      'box-shadow:var(--shadow-lg)',
      'padding:16px 18px',
      'z-index:7999',
      'max-width:560px',
      'width:calc(100vw - 48px)',
      'max-height:60vh',
      'overflow-y:auto',
    ].join(';');

    const sections = [
      { label: 'Cast',     icon: '🎭', items: cast,     key: 'cast'     },
      { label: 'Extras',   icon: '👥', items: extras,   key: 'extras'   },
      { label: 'Props',    icon: '🎬', items: props,     key: 'props'    },
      { label: 'Wardrobe', icon: '👗', items: wardrobe,  key: 'wardrobe' },
    ].filter(s => s.items.length);

    let checkboxHtml = '';
    sections.forEach(s => {
      checkboxHtml += `
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">
            ${s.icon} ${s.label}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${s.items.map(item => `
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:4px 0">
                <input type="checkbox" class="_handoff-cb" data-key="${_esc(s.key)}" data-value="${_esc(item)}" checked
                  style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0">
                <span style="color:var(--text)">${_esc(item)}</span>
              </label>`).join('')}
          </div>
        </div>`;
    });

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;font-weight:700;color:var(--text)">Review items to add</span>
        <button onclick="_removeReviewPanel()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0" aria-label="Close">✕</button>
      </div>
      ${checkboxHtml}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="_removeReviewPanel()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_handoffApplyReview()">Add Selected</button>
      </div>`;

    document.body.appendChild(panel);
  };

  window._handoffApplyReview = function () {
    const p = currentProject();
    const checkboxes = document.querySelectorAll('._handoff-cb:checked');
    const blank = { name: '', number: '', email: '', notes: '', social: '', confirmed: 'green', dept: '' };
    let added = 0;

    checkboxes.forEach(cb => {
      const key  = cb.dataset.key;
      const val  = cb.dataset.value;

      if (key === 'cast' || key === 'extras') {
        if (!p[key]) p[key] = [];
        if (!p[key].some(m => (m.role || '').toLowerCase() === val.toLowerCase())) {
          p[key].push({ ...blank, role: val });
          added++;
        }
      } else if (key === 'props') {
        if (!p.props) p.props = [];
        if (!p.props.some(pr => (pr.name || '').toLowerCase() === val.toLowerCase())) {
          p.props.push({ name: val, qty: 1, chars: '', scenes: '', locs: '', pgs: '', notes: '' });
          added++;
        }
      } else if (key === 'wardrobe') {
        if (!p.wardrobe) p.wardrobe = [];
        if (!p.wardrobe.some(w => (w.name || '').toLowerCase() === val.toLowerCase())) {
          p.wardrobe.push({ name: val, chars: '', scenes: '', size: '', condition: '', loc: '', notes: '' });
          added++;
        }
      }
    });

    if (added) {
      saveStore();
      showToast(`Added ${added} item${added !== 1 ? 's' : ''} to project sections`, 'success');
    } else {
      showToast('All selected items already exist in project sections', 'info');
    }
    _removeReviewPanel();
    _removeBanner();
  };

  function _removeReviewPanel() {
    document.getElementById('_handoff-review')?.remove();
  }
  window._removeReviewPanel = _removeReviewPanel;

  // ── Helpers ────────────────────────────────────────────────

  function _uniqueTagTexts(tags, text, category) {
    return [...new Set(
      tags
        .filter(t => t.category === category)
        .map(t => text.slice(t.start, t.end).trim())
        .filter(Boolean)
    )];
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }

  // ── Expose for manual trigger ──────────────────────────────
  // Can also be called after manual tagging:
  // window._triggerHandoffCheck()

  window._triggerHandoffCheck = function () {
    const p  = currentProject();
    const bd = _getActiveBd(p);
    if (!bd?.rawText || !bd?.tags) { showToast('No breakdown tags found', 'info'); return; }
    const text = bd.rawText;
    const tags = bd.tags;
    
    // Get items already in project sections
    const existingCast = new Set((p.cast || []).map(m => (m.role || m.name || '').toLowerCase()));
    const existingExtras = new Set((p.extras || []).map(m => (m.role || m.name || '').toLowerCase()));
    const existingProps = new Set((p.props || []).map(m => (m.name || '').toLowerCase()));
    const existingWardrobe = new Set((p.wardrobe || []).map(m => (m.name || '').toLowerCase()));
    
    // Get tagged items and filter out those already in project
    const allCast = _uniqueTagTexts(tags, text, 'cast');
    const allExtras = _uniqueTagTexts(tags, text, 'extras');
    const allProps = _uniqueTagTexts(tags, text, 'props');
    const allWardrobe = _uniqueTagTexts(tags, text, 'wardrobe');
    
    const newCast = allCast.filter(t => !existingCast.has(t.toLowerCase()));
    const newExtras = allExtras.filter(t => !existingExtras.has(t.toLowerCase()));
    const newProps = allProps.filter(t => !existingProps.has(t.toLowerCase()));
    const newWardrobe = allWardrobe.filter(t => !existingWardrobe.has(t.toLowerCase()));
    
    if (!newCast.length && !newExtras.length && !newProps.length && !newWardrobe.length) {
      showToast('All tagged items are already in the project', 'info');
      return;
    }
    _showHandoffBanner(newCast, newExtras, newProps, newWardrobe);
  };

})();
