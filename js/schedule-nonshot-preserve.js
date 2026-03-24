// ══════════════════════════════════════════
// SCHEDULE — NON-SHOT ROW PRESERVATION
// ══════════════════════════════════════════
// wrapScheduleDays() strips all _nonShot rows
// (company moves, breaks, arrivals) because it
// rebuilds the schedule from shots only.
//
// This patch wraps wrapScheduleDays to:
//   1. Before: record each _nonShot row's anchor
//      (the shotRef of the shot immediately before it,
//       or 'DAY_START:{dayDesc}' if it sits before
//       the first shot of a day)
//   2. After: re-insert each _nonShot row after its
//      anchor shot in the new schedule, preserving
//      relative order when multiple non-shot rows
//      share the same anchor.
//
// Drop AFTER schedule.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Build a stable key for a shot row ──────────────────────
  // Prefers shotRef, falls back to scene+shot string.
  function _shotKey(row) {
    if (row.shotRef) return row.shotRef;
    return `${row.sceneId || row.sceneKey || row.scene || ''}::${row.shot || ''}`;
  }

  // ── Snapshot non-shot rows with their anchors ───────────────
  function _snapshotNonShots(schedule) {
    // Returns array of { row, anchor, order }
    // anchor is either:
    //   'DAY_START:{dayDesc}'  — insert before first shot of that day
    //   'AFTER:{shotKey}'      — insert after the shot with that key
    const result = [];
    let lastShotKey = null;
    let lastDayDesc = null;

    schedule.forEach((row) => {
      if (row.isDayHeader) {
        lastDayDesc = row.desc;
        lastShotKey = null;
        return;
      }
      if (row._nonShot) {
        result.push({
          row:    { ...row },
          anchor: lastShotKey ? `AFTER:${lastShotKey}` : `DAY_START:${lastDayDesc || 'DAY 1'}`,
          order:  result.length, // preserve relative order of multiple non-shots at same anchor
        });
      } else {
        lastShotKey = _shotKey(row);
      }
    });

    return result;
  }

  // ── Re-insert non-shot rows into rebuilt schedule ───────────
  function _restoreNonShots(schedule, snapshots) {
    if (!snapshots.length) return schedule;

    // Build a map: shotKey → last index of that shot in schedule
    // (after wrapScheduleDays the schedule only has headers + shots)
    const shotIndexMap = new Map();
    schedule.forEach((row, i) => {
      if (!row.isDayHeader && !row._nonShot) {
        shotIndexMap.set(_shotKey(row), i);
      }
    });

    // Build a map: dayDesc → index of that day header
    const dayHeaderMap = new Map();
    schedule.forEach((row, i) => {
      if (row.isDayHeader) dayHeaderMap.set(row.desc, i);
    });

    // Group snapshots by anchor, preserving order within each group
    const byAnchor = new Map();
    snapshots
      .sort((a, b) => a.order - b.order)
      .forEach(snap => {
        if (!byAnchor.has(snap.anchor)) byAnchor.set(snap.anchor, []);
        byAnchor.get(snap.anchor).push(snap.row);
      });

    // Insert in reverse anchor-position order so earlier inserts
    // don't invalidate later indices.
    // Collect all (insertIdx, rows[]) pairs first.
    const insertions = [];

    byAnchor.forEach((rows, anchor) => {
      if (anchor.startsWith('AFTER:')) {
        const key = anchor.slice(6);
        const idx = shotIndexMap.get(key);
        if (idx !== undefined) {
          insertions.push({ idx: idx + 1, rows });
        } else {
          // Shot no longer exists (moved to different day or removed).
          // Append to end of schedule as a fallback.
          insertions.push({ idx: schedule.length, rows });
        }
      } else if (anchor.startsWith('DAY_START:')) {
        const dayDesc = anchor.slice(10);
        const headerIdx = dayHeaderMap.get(dayDesc);
        if (headerIdx !== undefined) {
          // Insert right after the day header (before any shots)
          insertions.push({ idx: headerIdx + 1, rows });
        } else {
          // Day no longer exists (shots may have merged into fewer days).
          // Fall back to start of schedule after first header.
          const firstHeader = schedule.findIndex(r => r.isDayHeader);
          insertions.push({ idx: firstHeader >= 0 ? firstHeader + 1 : 0, rows });
        }
      }
    });

    // Sort descending by index so splices don't shift subsequent indices
    insertions.sort((a, b) => b.idx - a.idx);

    const result = [...schedule];
    insertions.forEach(({ idx, rows }) => {
      result.splice(idx, 0, ...rows.map(r => ({ ...r })));
    });

    return result;
  }

  // ── Patch wrapScheduleDays ──────────────────────────────────

  const _origWrap = window.wrapScheduleDays;
  if (!_origWrap) {
    console.warn('schedule-nonshot-preserve: wrapScheduleDays not found — load this after schedule.js');
    return;
  }

  if (window._nonshotPreservePatched) return;
  window._nonshotPreservePatched = true;

  window.wrapScheduleDays = async function () {
    const p = window.currentProject ? currentProject() : null;
    if (!p || !p.schedule) {
      return _origWrap.apply(this, arguments);
    }

    // 1. Snapshot before
    const snapshots = _snapshotNonShots(p.schedule);

    // 2. Run original (strips non-shots, rebuilds days, ripples times, renders)
    await _origWrap.apply(this, arguments);

    // 3. Nothing to restore?
    if (!snapshots.length) return;

    // 4. Re-insert non-shot rows
    p.schedule = _restoreNonShots(p.schedule, snapshots);

    // 5. Re-ripple times so the non-shot rows get correct timestamps
    //    Use rippleScheduleTimes directly to avoid another wrapScheduleDays call
    if (window.rippleScheduleTimes) {
      await rippleScheduleTimes();
    } else if (window.renderSchedule) {
      renderSchedule(p);
    }
  };

  console.log('schedule-nonshot-preserve: wrapScheduleDays patched ✓');

})();