// ══════════════════════════════════════════
// SCHEDULE STRUCTURE
// ══════════════════════════════════════════
// "Suggest Day Structure" button that proposes
// arrival, breaks, lunch, and company moves for review
// before inserting.
//
// Note: Auto-insert of company moves was removed to prevent
// duplicate insertions on re-renders/drags.
// ══════════════════════════════════════════

(function () {

  // ── Constants ──────────────────────────────────────────────

  const COMPANY_MOVE_MINS = 15;
  const ARRIVAL_MINS      = 30;  // unit base / arrival before first shot
  const COMFORT_BREAK_MINS = 15;
  const COMFORT_INTERVAL   = 120; // suggest comfort break every ~2 hours

  // Lunch duration based on total day shoot time
  function _lunchMins(totalDayMins) {
    if (totalDayMins < 240) return 0;   // under 4h — no lunch
    if (totalDayMins < 360) return 30;  // 4–6h — 30 mins
    return 45;                          // 6h+ — 45 mins
  }

  // ── Non-shot row builders ──────────────────────────────────

  function _makeMove(fromLoc, toLoc) {
    return {
      _type:    'company-move',
      time:     '',
      scene:    '',
      shot:     '',
      type:     '',
      desc:     `Company move: ${fromLoc} → ${toLoc}`,
      cast:     '',
      pages:    '',
      est:      COMPANY_MOVE_MINS,
      location: toLoc,
      extint:   '',
      movement: '',
      _nonShot: true,
    };
  }

  function _makeArrival() {
    return {
      _type:    'arrival',
      time:     '',
      scene:    '',
      shot:     '',
      type:     '',
      desc:     'Unit base / arrival',
      cast:     '',
      pages:    '',
      est:      ARRIVAL_MINS,
      location: '',
      extint:   '',
      movement: '',
      _nonShot: true,
    };
  }

  function _makeBreak(label, mins) {
    return {
      _type:    'break',
      time:     '',
      scene:    '',
      shot:     '',
      type:     '',
      desc:     label,
      cast:     '',
      pages:    '',
      est:      mins,
      location: '',
      extint:   '',
      movement: '',
      _nonShot: true,
    };
  }

  function _makePhotoPromo() {
    return {
      _type:    'photo-promo',
      time:     '',
      scene:    '',
      shot:     '',
      type:     '',
      desc:     'Photo / promo shoot',
      cast:     '',
      pages:    '',
      est:      30,
      location: '',
      extint:   '',
      movement: '',
      _nonShot: true,
    };
  }

  // ── Patch wrapScheduleDays to insert company moves ─────────

  // Don't patch - auto-insert is disabled, user must use "Suggest Structure"
  // The original wrapScheduleDays will handle everything

  // (no _insertCompanyMoves function needed)

  // ── "Suggest Day Structure" ────────────────────────────────

  // Flag to prevent multiple runs (only set after successful apply)
  let _structureAppliedThisSession = false;

  window.suggestDayStructure = function () {
    if (_structureAppliedThisSession) {
      showToast('Suggest Structure already applied. Refresh the page to run again.', 'info');
      return;
    }

    const p = currentProject();
    if (!p?.schedule?.length) {
      showToast('Generate a schedule first', 'info');
      return;
    }

    const suggestions = _buildSuggestions(p);
    if (!suggestions.length) {
      showToast('Nothing to suggest — schedule looks good', 'info');
      return;
    }

    _showSuggestionPanel(suggestions, p);
  };

  function _buildSuggestions(p) {
    const suggestions = [];
    const schedule    = p.schedule;

    // Walk day by day
    let i = 0;
    while (i < schedule.length) {
      const row = schedule[i];
      if (!row.isDayHeader) { i++; continue; }

      // Collect this day's shot rows
      const dayStart = i;
      const dayShots = [];
      let j = i + 1;
      while (j < schedule.length && !schedule[j].isDayHeader) {
        if (!schedule[j]._nonShot) dayShots.push({ row: schedule[j], idx: j });
        j++;
      }

      if (!dayShots.length) { i = j; continue; }

      const totalMins = dayShots.reduce((sum, s) => sum + (parseInt(s.row.est) || 0), 0);
      const firstShotIdx = dayShots[0].idx;

      // 1. Arrival — suggest before first shot if not already there
      const rowBefore = schedule[firstShotIdx - 1];
      const hasArrival = schedule.slice(Math.max(0, firstShotIdx - 3), firstShotIdx)
        .some(r => r._type === 'arrival');
      if (!rowBefore?.isDayHeader && !rowBefore?._type?.includes('arrival') && !hasArrival) {
        suggestions.push({
          type:    'arrival',
          label:   `Day ${row.desc?.replace('DAY ','')||''} — Arrival / unit base (${ARRIVAL_MINS} mins)`,
          insert:  firstShotIdx, // insert before this index
          row:     _makeArrival(),
          checked: true,
        });
      }

      // 2. Company Move — suggest between consecutive shots at different locations
      // Check if there's already a company move in this area
      for (let k = 1; k < dayShots.length; k++) {
        const prevLoc = (dayShots[k-1].row.location || '').trim();
        const currLoc = (dayShots[k].row.location || '').trim();
        if (prevLoc && currLoc && prevLoc.toLowerCase() !== currLoc.toLowerCase()) {
          const existingMove = schedule.slice(Math.max(0, dayShots[k].idx - 2), dayShots[k].idx + 1)
            .some(r => r._type === 'company-move');
          if (!existingMove) {
            suggestions.push({
              type:    'company-move',
              label:   `Day ${row.desc?.replace('DAY ','')||''} — Company move: ${prevLoc} → ${currLoc} (${COMPANY_MOVE_MINS} mins)`,
              insert:  dayShots[k].idx,
              row:     _makeMove(prevLoc, currLoc),
              checked: true,
            });
          }
        }
      }

      // 3. Lunch — suggest near midpoint if day is long enough
      const lunchMins = _lunchMins(totalMins);
      if (lunchMins > 0) {
        // Check if lunch already exists in this day
        const dayRows = schedule.slice(i, j);
        const hasLunch = dayRows.some(r => r._type === 'break' && r.desc?.toLowerCase().includes('lunch'));
        if (!hasLunch) {
          // Find the shot closest to the midpoint
          let accumulated = 0;
          const midpoint  = totalMins / 2;
          let lunchAfter  = dayShots[dayShots.length - 1].idx; // default: after last shot
          for (const s of dayShots) {
            accumulated += parseInt(s.row.est) || 0;
            if (accumulated >= midpoint) {
              lunchAfter = s.idx;
              break;
            }
          }
          // Don't suggest if there's already a break near there
          const already = schedule.slice(Math.max(0, lunchAfter - 1), lunchAfter + 2)
            .some(r => r._type === 'break' && r.desc?.toLowerCase().includes('lunch'));
          if (!already) {
            suggestions.push({
              type:    'lunch',
              label:   `Day ${row.desc?.replace('DAY ','')||''} — Lunch break (${lunchMins} mins)`,
              insert:  lunchAfter + 1, // insert after this index
              row:     _makeBreak('Lunch break', lunchMins),
              checked: true,
            });
          }
        }
      }

      // 4. Comfort breaks — every ~COMFORT_INTERVAL mins
      // Only suggest if there's no break type in the day at all
      const dayRows = schedule.slice(i, j);
      const hasAnyBreak = dayRows.some(r => r._type === 'break' || r._type === 'arrival' || r._type === 'photo-promo');
      if (!hasAnyBreak) {
        let runningMins = 0;
        let lastBreakAt = 0;
        for (const s of dayShots) {
          runningMins += parseInt(s.row.est) || 0;
          if (runningMins - lastBreakAt >= COMFORT_INTERVAL) {
            // Don't suggest if there's already a non-shot row nearby
            const nearby = schedule.slice(Math.max(0, s.idx - 1), s.idx + 2)
              .some(r => r._nonShot);
            if (!nearby) {
              suggestions.push({
                type:    'comfort',
                label:   `Day ${row.desc?.replace('DAY ','')||''} — Comfort break after ${_fmtMins(runningMins)} (${COMFORT_BREAK_MINS} mins)`,
                insert:  s.idx + 1,
                row:     _makeBreak('Comfort break', COMFORT_BREAK_MINS),
                checked: true,
              });
              lastBreakAt = runningMins;
            }
          }
        }
      }

      i = j;
    }

    return suggestions;
  }

  // ── Suggestion panel ───────────────────────────────────────

  function _showSuggestionPanel(suggestions, p) {
    document.getElementById('_struct-panel')?.remove();

    const panel = document.createElement('div');
    panel.id    = '_struct-panel';
    panel.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:var(--surface)',
      'border:1px solid var(--accent)',
      'border-radius:var(--radius-lg)',
      'box-shadow:var(--shadow-lg)',
      'padding:16px 18px',
      'z-index:8000',
      'max-width:520px',
      'width:calc(100vw - 48px)',
      'max-height:70vh',
      'display:flex',
      'flex-direction:column',
      'gap:12px',
    ].join(';');

    const checks = suggestions.map((s, i) => ({...s, _i: i, checked: true }));

    const itemsHtml = checks.map(s => `
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:4px 0">
        <input type="checkbox" class="_struct-cb" data-idx="${s._i}" checked
          style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0">
        <span style="color:var(--text)">${_esc(s.label)}</span>
      </label>`).join('');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;font-weight:700;color:var(--text)">📅 Suggested day structure</span>
        <button onclick="document.getElementById('_struct-panel').remove()" 
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0" aria-label="Close">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">${itemsHtml}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="document.getElementById('_struct-panel').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_applyStructureSuggestions()">Add Selected</button>
      </div>`;

    document.body.appendChild(panel);
    window._structSuggestions = checks;
    window._structProject     = p;
  }

  window._applyStructureSuggestions = function () {
    const checks      = window._structSuggestions;
    const p           = window._structProject;
    const panel       = document.getElementById('_struct-panel');
    if (!checks || !p) { panel?.remove(); return; }

    const selected = [...document.querySelectorAll('._struct-cb:checked')]
      .map(cb => checks[parseInt(cb.dataset.idx)])
      .filter(Boolean);

    if (!selected.length) { panel?.remove(); return; }

    // Insert in reverse index order so earlier inserts don't shift later indices
    const sorted = [...selected].sort((a, b) => b.insert - a.insert);
    sorted.forEach(s => {
      p.schedule.splice(s.insert, 0, { ...s.row });
    });

    saveStore();
    panel?.remove();

    // Mark as applied so user can't run again this session
    _structureAppliedThisSession = true;

    // Render schedule directly to avoid re-triggering wrapScheduleDays via rippleScheduleTimes
    renderSchedule(p);

    showToast(`Added ${selected.length} structure item${selected.length !== 1 ? 's' : ''}`, 'success');
  };

  // ── Inject button into schedule toolbar ───────────────────

  function _injectStructureButton() {
    if (document.getElementById('_struct-btn')) return;
    const toolbar = document.querySelector('#section-schedule .toolbar, #section-schedule .btn-group, #section-schedule button[onclick*="wrap"]');
    if (!toolbar) return;
    
    // If we found a specific button, insert after it; otherwise append to toolbar
    const wrapBtn = document.querySelector('#section-schedule button[onclick="wrapScheduleDays()"]');
    if (wrapBtn && wrapBtn.parentElement) {
      const btn   = document.createElement('button');
      btn.id      = '_struct-btn';
      btn.className = 'btn btn-sm btn-ghost';
      btn.title   = 'Suggest arrival times, breaks and company moves';
      btn.textContent = '📅 Suggest Day Structure';
      btn.onclick = suggestDayStructure;
      btn.style.marginLeft = '8px';
      btn.style.fontWeight = '600';
      wrapBtn.parentElement.insertBefore(btn, wrapBtn.nextSibling);
      console.log('schedule-structure: injected Suggest Day Structure button');
    }
  }

  const _origShowSection = window.showSection;
  if (_origShowSection && !window._scheduleStructureSectionPatched) {
    window._scheduleStructureSectionPatched = true;
    window.showSection = function (name) {
      _origShowSection(name);
      if (name === 'schedule') setTimeout(_injectStructureButton, 100);
    };
  }

  const _origRenderSchedule = window.renderSchedule;
  if (_origRenderSchedule && !window._scheduleStructureRenderPatched) {
    window._scheduleStructureRenderPatched = true;
    window.renderSchedule = function (p) {
      _origRenderSchedule(p);
      setTimeout(_injectStructureButton, 0);
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  function _fmtMins(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

})();