// ══════════════════════════════════════════
// SCHEDULE — SYNC TIMES FROM SHOT LIST
// ══════════════════════════════════════════
// Adds a "↻ Sync from Shot List" button to the
// schedule toolbar. When clicked, matches each
// schedule row to its specific shot using shotRef
// and uses that individual shot's time (setuptime +
// shoottime) instead of summing all shots per scene.
//
// Matching: prefers shotRef (exact match), falls back
// to scene + setup + shot number for legacy rows.
//
// Rows with no matching shots are left untouched.
//
// Drop AFTER schedule.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Core sync ──────────────────────────────────────────────

  window.syncScheduleTimesFromShots = function () {
    const p = currentProject();
    if (!p) return;

    if (!p.shots?.length) {
      showToast('No shots in shot list yet', 'info');
      return;
    }
    if (!p.schedule?.length) {
      showToast('No schedule rows yet', 'info');
      return;
    }

    // Build map: shotRef → individual shot time
    // Also build sceneId+shot number → time for fallback
    const timeByRef     = new Map();
    const timeByShotKey = new Map();

    (p.shots || []).forEach(shot => {
      const setup = parseInt(shot.setuptime) || 0;
      const shoot = parseInt(shot.shoottime) || 0;
      const total = setup + shoot;
      if (!total) return;

      // Primary: shotRef key
      const ref = shot.sceneId
        ? `${shot.sceneId}::${shot.setup}::${shot.num}`
        : `${_norm(shot.sceneKey||'')}::${shot.setup}::${shot.num}`;
      timeByRef.set(ref, total);

      // Fallback: scene + setup + num
      const fallbackKey = `${_norm(shot.sceneKey||'')}::${shot.setup}::${shot.num}`;
      timeByShotKey.set(fallbackKey, total);
    });

    let updated = 0;
    let skipped = 0;

    (p.schedule || []).forEach(row => {
      if (row.isDayHeader) return;

      let total = null;

      // Try shotRef first (exact match)
      if (row.shotRef && timeByRef.has(row.shotRef)) {
        total = timeByRef.get(row.shotRef);
      } else {
        // Build fallback key from row's scene + shot number
        const shotParts = (row.shot || '').split('.');
        const setup = shotParts[0] || '1';
        const num   = shotParts[1] || '1';
        const fallbackKey = `${_norm(row.scene||'')}::${setup}::${num}`;
        if (timeByShotKey.has(fallbackKey)) {
          total = timeByShotKey.get(fallbackKey);
        }
      }

      if (total !== null) {
        row.est = total;
        updated++;
      } else {
        skipped++;
      }
    });

    if (!updated) {
      showToast('No matching shots found', 'info');
      return;
    }

    saveStore();
    renderSchedule(p);

    const parts = [`Updated ${updated} row${updated !== 1 ? 's' : ''}`];
    if (skipped) parts.push(`${skipped} unmatched (left unchanged)`);
    showToast(parts.join(' · '), 'success');
  };

  // ── Inject button into schedule toolbar ───────────────────

  function _injectSyncButton() {
    // Don't double-inject
    if (document.getElementById('_sched-sync-btn')) return;

    // Find the schedule section toolbar — look for the Wrap Days button
    const wrapBtn = document.querySelector('#section-schedule button[onclick="wrapScheduleDays()"]');
    if (!wrapBtn) return;

    const btn = document.createElement('button');
    btn.id = '_sched-sync-btn';
    btn.className = 'btn btn-sm btn-ghost';
    btn.title = 'Update schedule estimates from shot list times';
    btn.textContent = '↻ Sync from Shot List';
    btn.onclick = syncScheduleTimesFromShots;

    // Insert before the Wrap Days button
    wrapBtn.parentElement.insertBefore(btn, wrapBtn);
  }

  // ── Patch showSection to inject button ────────────────────

  const _origShowSection = window.showSection;
  if (_origShowSection) {
    window.showSection = function (name) {
      _origShowSection(name);
      if (name === 'schedule') setTimeout(_injectSyncButton, 100);
    };
  }

  // Also try on renderSchedule
  const _origRenderSchedule = window.renderSchedule;
  if (_origRenderSchedule) {
    window.renderSchedule = function (p) {
      _origRenderSchedule(p);
      setTimeout(_injectSyncButton, 0);
    };
  }

  // ── Helper ─────────────────────────────────────────────────

  function _norm(s) {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,:;]+$/, '').trim();
  }

})();