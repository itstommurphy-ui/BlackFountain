// ══════════════════════════════════════════
// BLACK FOUNTAIN — BI-DIRECTIONAL SYNC
// bf-sync.js
//
// Patches breakdown tagging to auto-sync
// tagged entities into their respective
// project sections — silently, non-destructively.
//
// Load AFTER breakdown.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Helpers ─────────────────────────────────────────────────

  function _norm(s) {
    return (s || '').toLowerCase().trim();
  }

  function _titleCase(s) {
    return (s || '').replace(/(^|[\s\-])(\w)/g, (_, sep, l) => sep + l.toUpperCase());
  }

  // ── Cast sync ────────────────────────────────────────────────
  // When a 'cast' tag is applied, add the tagged text as a role
  // in p.cast if not already present.

  function _syncCastTag(tagText, bd, silent) {
    const p = currentProject();
    if (!p) return;
    const name = (bd.rawText || '').slice(tagText.start, tagText.end).trim();
    if (!name) return;

    if (!p.cast) p.cast = [];

    // Check by role name (case-insensitive)
    if (p.cast.some(m => _norm(m.role) === _norm(name) || _norm(m.name) === _norm(name))) return;

    p.cast.push({
      name:      '',
      role:      name,
      number:    '',
      email:     '',
      notes:     '',
      social:    '',
      confirmed: 'orange', // pending by default — they're tagged but not yet confirmed
      dept:      '',
    });

    if (!silent) {
      showToast(`"${name}" added to Cast & Extras`, 'success');
    }
  }

  // ── Extras sync ──────────────────────────────────────────────

  function _syncExtrasTag(tagText, bd, silent) {
    const p = currentProject();
    if (!p) return;
    const name = (bd.rawText || '').slice(tagText.start, tagText.end).trim();
    if (!name) return;

    if (!p.extras) p.extras = [];
    if (p.extras.some(m => _norm(m.role) === _norm(name) || _norm(m.name) === _norm(name))) return;

    p.extras.push({
      name:      '',
      role:      name,
      number:    '',
      email:     '',
      notes:     '',
      social:    '',
      confirmed: 'orange',
      dept:      '',
    });

    if (!silent) {
      showToast(`"${name}" added to Extras`, 'success');
    }
  }

  // ── Wardrobe sync ────────────────────────────────────────────
  // When a 'wardrobe' tag is applied, add to p.wardrobe.

  function _syncWardrobeTag(tagText, bd, silent) {
    const p = currentProject();
    if (!p) return;
    const name = (bd.rawText || '').slice(tagText.start, tagText.end).trim();
    if (!name) return;

    if (!p.wardrobe) p.wardrobe = [];
    if (p.wardrobe.some(w => _norm(w.name) === _norm(name))) return;

    p.wardrobe.push({
      name,
      chars:   '',
      scenes:  '',
      size:    '',
      condition: '',
      loc:     '',
      notes:   '',
    });

    if (!silent) {
      showToast(`"${name}" added to Wardrobe`, 'success');
    }
  }

  // ── Location tag sync ────────────────────────────────────────
  // When a 'locations' tag is applied, add to p.locations
  // (in addition to the existing scene-heading auto-import).

  function _syncLocationTag(tagText, bd, silent) {
    const p = currentProject();
    if (!p) return;
    const raw = (bd.rawText || '').slice(tagText.start, tagText.end).trim();
    if (!raw || raw.length < 2) return;
    const name = _titleCase(raw);

    if (!p.locations) p.locations = [];
    if (p.locations.some(l => _norm(l.name) === _norm(name))) return;

    p.locations.push({
      name,
      suit:       'possible',
      contacted:  'no',
      avail:      '',
      rules:      '',
      cost:       '',
      costPeriod: '',
      access:     '',
      recce:      'no',
      light:      '',
      power:      '',
      problems:   '',
      decision:   '',
      notes:      '',
    });

    if (!silent) {
      showToast(`Location "${name}" added to Locations`, 'success');
    }
  }

  // ── Patch applyBreakdownTag ──────────────────────────────────
  // Wraps the existing function to fire sync after each tag.

  const _origApplyBreakdownTag = window.applyBreakdownTag;

  if (!_origApplyBreakdownTag) {
    console.warn('[bf-sync] applyBreakdownTag not found — load bf-sync.js after breakdown.js');
    return;
  }

  if (window._bfSyncPatched) return;
  window._bfSyncPatched = true;

  window.applyBreakdownTag = function (category) {
    // Capture selection and bd BEFORE calling original
    // (original clears _bdPendingSelection)
    const selection = window._bdPendingSelection ? { ...window._bdPendingSelection } : null;
    const p = typeof currentProject === 'function' ? currentProject() : null;
    const bd = p ? _getActiveBd(p) : null;

    // Call original — this pushes the tag, auto-exports props, saves, updates view
    _origApplyBreakdownTag.call(this, category);

    if (!selection || !bd) return;

    // Now fire our additional syncs based on category
    // We build a fake tagText object matching what _bdAutoExportProp expects
    const tagText = { start: selection.start, end: selection.end };

    // Get the tag that was just added (last tag in bd.tags)
    // Props are already handled by _bdAutoExportProp inside the original
    switch (category) {
      case 'cast':
        _syncCastTag(tagText, bd, false);
        saveStore();
        break;
      case 'extras':
        _syncExtrasTag(tagText, bd, false);
        saveStore();
        break;
      case 'wardrobe':
        _syncWardrobeTag(tagText, bd, false);
        saveStore();
        break;
      case 'locations':
        _syncLocationTag(tagText, bd, false);
        saveStore();
        break;
      // 'props' already handled by _bdAutoExportProp — no action needed
    }
  };

  // ── Patch applySelectedBdSuggestions (bulk apply) ───────────
  // The AI suggestion bulk-apply also creates tags but bypasses
  // applyBreakdownTag. Patch it to run syncs silently.

  const _origApplySelected = window.applySelectedBdSuggestions;

  if (_origApplySelected) {
    window.applySelectedBdSuggestions = function () {
      // Run original
      _origApplySelected.apply(this, arguments);

      // After bulk apply, run a full re-sync of all tags
      setTimeout(() => {
        _bfSyncAll(true); // silent = true — no individual toasts
      }, 100);
    };
  }

  // ── Full re-sync ─────────────────────────────────────────────
  // Scans ALL tags in the active breakdown and syncs any that
  // don't already have corresponding entries. Safe to call
  // multiple times — deduplicates before inserting.

  function _bfSyncAll(silent) {
    const p = currentProject();
    if (!p) return;
    const bd = _getActiveBd(p);
    if (!bd || !bd.tags || !bd.tags.length) return;

    let castAdded = 0, extrasAdded = 0, wardrobeAdded = 0, locAdded = 0;

    for (const tag of bd.tags) {
      const tagText = { start: tag.start, end: tag.end };
      const prevCast     = (p.cast     || []).length;
      const prevExtras   = (p.extras   || []).length;
      const prevWardrobe = (p.wardrobe || []).length;
      const prevLoc      = (p.locations|| []).length;

      switch (tag.category) {
        case 'cast':
          _syncCastTag(tagText, bd, true);
          if ((p.cast||[]).length > prevCast) castAdded++;
          break;
        case 'extras':
          _syncExtrasTag(tagText, bd, true);
          if ((p.extras||[]).length > prevExtras) extrasAdded++;
          break;
        case 'wardrobe':
          _syncWardrobeTag(tagText, bd, true);
          if ((p.wardrobe||[]).length > prevWardrobe) wardrobeAdded++;
          break;
        case 'locations':
          _syncLocationTag(tagText, bd, true);
          if ((p.locations||[]).length > prevLoc) locAdded++;
          break;
      }
    }

    const total = castAdded + extrasAdded + wardrobeAdded + locAdded;
    if (total > 0) {
      saveStore();
      if (!silent) {
        const parts = [];
        if (castAdded)     parts.push(`${castAdded} cast`);
        if (extrasAdded)   parts.push(`${extrasAdded} extras`);
        if (wardrobeAdded) parts.push(`${wardrobeAdded} wardrobe`);
        if (locAdded)      parts.push(`${locAdded} location${locAdded !== 1 ? 's' : ''}`);
        showToast(`Synced: ${parts.join(', ')} added from breakdown`, 'success');
      }
    }

    return { castAdded, extrasAdded, wardrobeAdded, locAdded };
  }

  // Expose for manual trigger from console or a UI button
  window.bfSyncAll = _bfSyncAll;

  // ── Auto-sync on section navigation ─────────────────────────
  // When user navigates TO cast, wardrobe, locations — silently
  // catch up anything that was tagged but not yet synced.
  // This covers edge cases where tags were added before this
  // patch was loaded (old data).

  const _origShowSection = window.showSection;
  if (_origShowSection && !window._bfSyncSectionPatched) {
    window._bfSyncSectionPatched = true;
    window.showSection = function (name) {
      _origShowSection.apply(this, arguments);
      if (['cast', 'wardrobe', 'locations', 'props'].includes(name)) {
        // Silently sync — catches any tags that predated this patch
        setTimeout(() => _bfSyncAll(true), 200);
      }
    };
  }

  console.log('[bf-sync] Bi-directional sync active ✓');

})();
