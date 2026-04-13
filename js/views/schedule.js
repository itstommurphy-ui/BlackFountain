// ================================================================
// SMART PRODUCTION SCHEDULE ENGINE (v3.0 - Dynamic Flow & DnD)
// ================================================================

/**
 * 1. GENERATION: Create schedule from shot list.
 */
async function generateScheduleFromShots() {
  const p = currentProject();
  if (!p || !p.shots || !p.shots.length) {
    showToast('No shots in shot list. Add shots first.', 'info');
    return;
  }

  if (!p.schedule) p.schedule = [];
  
  // Get existing shot references to avoid duplicates
  const existingRefs = new Set(
    p.schedule
      .filter(s => !s.isDayHeader && s.sceneId && s.shotRef)
      .map(s => s.shotRef)
  );

  let added = 0;

  p.shots.forEach((shot, idx) => {
    // Unique ref per shot
    const ref = shot.sceneId
      ? `${shot.sceneId}::${shot.setup}::${shot.num}`
      : `${shot.sceneKey}::${shot.setup}::${shot.num}`;

    if (existingRefs.has(ref)) return;

    const totalTime = (parseInt(shot.setuptime) || 0) + (parseInt(shot.shoottime) || 0);

    p.schedule.push({
      time:     '',
      scene:    shot.scene || shot.sceneKey || '',
      shot:     shot.setup ? `${shot.setup}.${shot.num || ''}` : (shot.num || ''),
      shotNum:  shot.num,
      sceneKey: shot.sceneKey || '',
      sceneId:  shot.sceneId || '',
      shotRef:  ref,
      type:     shot.type     || '',
      desc:     shot.desc     || '',
      cast:     Array.isArray(shot.cast) ? shot.cast.join(', ') : (shot.cast || ''),
      pages:    shot.pages    || '',
      est:      totalTime     || 45,
      location: shot.location || '',
      extint:   shot.extint   || 'INT DAY',
      movement: shot.movement || 'Stationary',
    });
    existingRefs.add(ref);
    added++;
  });

  _applyProductionSort(p.schedule);
  await saveStore();
  await wrapScheduleDays();
  showToast(`Generated ${added} schedule entries from ${p.shots.length} shots`, 'success');
}

// ================================================================

/**
 * 1. THE FLOW ENGINE: This is the "Big Brain" core.
 * Instead of just calculating times, it re-paginates the entire production
 * whenever a limit (Wrap Time) or a duration (Mins) changes.
 */
async function wrapScheduleDays() {
  const p = currentProject();
  if (!p || !p.schedule) return;

  const DEFAULT_CALL = 420;  // 07:00
  const DEFAULT_WRAP = 1020; // 17:00
  const BUFFER = 15;

  const existingHeaders = p.schedule.filter(s => s.isDayHeader);
  let shots = p.schedule.filter(s => !s.isDayHeader && !s._nonShot && !s.isWrap);

  // Group shots by scene key so we never split a scene across days
  // Preserve the existing sort order within each scene group
  const sceneGroups = [];
  const seenScenes  = new Map(); // sceneKey → group index

  shots.forEach(shot => {
    const key = shot.sceneId || shot.sceneKey || shot.scene || '';
    if (!seenScenes.has(key)) {
      seenScenes.set(key, sceneGroups.length);
      sceneGroups.push([]);
    }
    sceneGroups[seenScenes.get(key)].push(shot);
  });

  const newSchedule = [];
  let dayNum       = 1;
  let currentShots = [];
  let currentMins  = 0;

  const getHeader = (num) => existingHeaders.find((h, i) => i + 1 === num);

  const getDayLimits = (num) => {
    const h = getHeader(num);
    return {
      call: h?.callTime ?? DEFAULT_CALL,
      wrap: h?.wrapTime ?? DEFAULT_WRAP,
    };
  };

  const flushDay = () => {
    const { call, wrap } = getDayLimits(dayNum);
    newSchedule.push({
      isDayHeader: true,
      desc:        `DAY ${dayNum}`,
      callTime:    call,
      wrapTime:    wrap,
      totalEst:    currentMins,
    });
    newSchedule.push(...currentShots);
    newSchedule.push({
      isWrap: true,
      desc:   'WRAP',
    });
    dayNum++;
    currentShots = [];
    currentMins  = 0;
  };

  sceneGroups.forEach(group => {
    const groupMins = group.reduce((sum, s) => sum + (parseInt(s.est) || 0), 0);
    const { call, wrap } = getDayLimits(dayNum);
    const dayLimit = wrap - call - BUFFER;

    // If adding this whole scene group would exceed the day limit,
    // and we already have shots on this day, flush first
    if (currentShots.length > 0 && currentMins + groupMins > dayLimit) {
      flushDay();
    }

    // If the scene itself is longer than a full day, add it anyway
    // (it'll show as overtime — better than infinite loop)
    currentShots.push(...group);
    currentMins += groupMins;
  });

  // Flush any remaining shots
  if (currentShots.length > 0) {
    flushDay();
  }

  p.schedule = newSchedule;
  await rippleScheduleTimes();
}

/**
 * 2. THE RIPPLE: Recalculates every timestamp in the project.
 */
async function rippleScheduleTimes() {
   const p = currentProject();
   if (!p.schedule) return;

   let runningTime = 420;
   let currentDayHeader = null;
   let lastDayWrap = 0;

   p.schedule.forEach((item, idx) => {
     if (item.isDayHeader) {
       // Before moving to new day, set the previous day's wrapTime if there was one
       if (currentDayHeader) {
         currentDayHeader.wrapTime = lastDayWrap;
       }
       currentDayHeader = item;
       runningTime = item.callTime || 420;
       lastDayWrap = runningTime;
       // Re-sum the day's total for the UI
       const dayShots = _getShotsForDay(p.schedule, idx);
       item.totalEst = dayShots.reduce((sum, s) => sum + (parseInt(s.est) || 0), 0);
     } else if (item.isWrap) {
       item.time = _formatTime(lastDayWrap);
     } else {
       item.time = _formatTime(runningTime);
       runningTime += (parseInt(item.est) || 0);
       lastDayWrap = runningTime;
     }
   });

   // Set wrapTime for the last day
   if (currentDayHeader) {
     currentDayHeader.wrapTime = lastDayWrap;
   }

   await saveStore();
   renderSchedule(p);
 }

// ================================================================
// THE BRAIN: Optimization & Conflict Detection
// ================================================================

/**
 * THE BRAIN: Optimization & Conflict Detection
 * Checks for both Actor Downtime and Scene Fragmentation.
 */
function getOptimizationSuggestion(shotIdx, schedule) {
   const shot = schedule[shotIdx];
   if (!shot || shot.isDayHeader) return null;
   if (shot._nonShot) return null;
   if (shot.isWrap) return null;

  const dayIndex = _findDayHeaderIndex(schedule, shotIdx);
  const dayShots = _getShotsForDay(schedule, dayIndex);
  const myPosInDay = dayShots.indexOf(shot);

  // --- LOGIC A: Scene Fragmentation (The "Reunite" Suggestion) ---
  const sameSceneShots = dayShots.filter(s => s.scene === shot.scene && s !== shot);
  if (sameSceneShots.length > 0) {
    const otherPositions = sameSceneShots.map(s => dayShots.indexOf(s));
    const minGap = Math.min(...otherPositions.map(p => Math.abs(p - myPosInDay)));

    if (minGap > 1) { // There are unrelated shots between shots of the SAME scene
      // target is the schedule index of sameSceneShots[0]
      const targetPos = schedule.indexOf(sameSceneShots[0]);
      return { 
        type: 'scene',
        targetPos, 
        message: `EFFICIENCY TIP: This is part of Scene ${shot.scene}. Click to group it with the other ${sameSceneShots.length} shots to avoid a lighting reset.`
      };
    }
  }

  // --- LOGIC B: Actor Downtime (The "Downtime" Suggestion) ---
  if (shot.cast) {
    const castStr = Array.isArray(shot.cast) ? shot.cast.join(', ') : (shot.cast || '');
    const actors = castStr.split(',').map(a => a.trim());
    for (const actor of actors) {
      const actorShots = dayShots.filter(s => {
        const sCastStr = Array.isArray(s.cast) ? s.cast.join(', ') : (s.cast || '');
        return sCastStr && sCastStr.includes(actor);
      });
      if (actorShots.length <= 1) continue;

      const otherPositions = actorShots.map(s => dayShots.indexOf(s)).filter(p => p !== myPosInDay);
      const minGap = Math.min(...otherPositions.map(p => Math.abs(p - myPosInDay)));

      if (minGap > 3) {
        const otherShot = actorShots.find(s => dayShots.indexOf(s) !== myPosInDay);
        const targetPos = schedule.indexOf(otherShot);
        const savings = (minGap - 1) * 45; // Estimate 45m per skipped shot
        return { 
          type: 'actor',
          actor,
          targetPos, 
          message: `AD TIP: ${actor} is currently waiting through ${minGap - 1} unrelated shots. Click to save them ~${savings}m of downtime.`
        };
      }
    }
  }
  return null;
}

/**
 * Helper to render cast pills
 */
function _renderCastPills(cast) {
  if (!cast) return '';
  const castStr = Array.isArray(cast) ? cast.join(', ') : cast;
  return castStr.split(',').map(c => `<span class="actor-pill">${c.trim()}</span>`).join('');
}

/**
 * Wand tooltip functions
 */
let wandTooltipEl = null;
function showWandTooltip(el, message) {
  if (!wandTooltipEl) {
    wandTooltipEl = document.createElement('div');
    wandTooltipEl.className = 'wand-tooltip';
    wandTooltipEl.style.cssText = [
      'position:fixed',
      'z-index:10000',
      'background:#222',
      'color:#fff',
      'padding:10px 14px',
      'border-radius:8px',
      'max-width:260px',
      'font-size:12px',
      'line-height:1.4',
      'border:1px solid #ffd700',
      'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
      'pointer-events:none',
      'white-space:normal',
      'word-break:break-word',
    ].join(';');
    document.body.appendChild(wandTooltipEl);
  }

  wandTooltipEl.textContent = message;
  wandTooltipEl.style.display = 'block';

  const rect   = el.getBoundingClientRect();
  const tipW   = 260;
  const tipH   = wandTooltipEl.offsetHeight || 80;
  const margin = 8;

  // Prefer showing above, fall back to below
  let top  = rect.top - tipH - 10;
  let left = rect.left + rect.width / 2 - tipW / 2;

  if (top < margin) top = rect.bottom + 10;
  if (left < margin) left = margin;
  if (left + tipW > window.innerWidth - margin) left = window.innerWidth - tipW - margin;
  if (top + tipH > window.innerHeight - margin) top = window.innerHeight - tipH - margin;

  wandTooltipEl.style.top  = top  + 'px';
  wandTooltipEl.style.left = left + 'px';
}
function hideWandTooltip() {
  if (wandTooltipEl) wandTooltipEl.style.display = 'none';
}

// Select all schedule entries
function _schedSelectAll() {
  document.querySelectorAll('.sched-cb').forEach(cb => cb.checked = true);
}

// Remove selected schedule entries
function _schedRemoveSelected() {
  const checked = document.querySelectorAll('.sched-cb:checked');
  if (!checked.length) {
    showToast('No entries selected', 'info');
    return;
  }
  showConfirmDialog(`Remove ${checked.length} selected entr${checked.length > 1 ? 'ies' : 'y'}?`, 'Remove', () => {
    const p = currentProject();
    const indices = [...checked].map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
    indices.forEach(i => p.schedule.splice(i, 1));
    saveStore();
    renderSchedule(p);
    showToast(`Removed ${indices.length} entr${indices.length > 1 ? 'ies' : 'y'}`, 'success');
  });
}

// Remove all schedule entries including day headers
function _schedRemoveAll() {
  const p = currentProject();
  if (!p.schedule || !p.schedule.length) {
    showToast('Schedule is already empty', 'info');
    return;
  }
  showConfirmDialog('Clear entire schedule (including all day headers)?', 'Clear All', () => {
    p.schedule = [];
    saveStore();
    renderSchedule(p);
    showToast('Schedule cleared', 'success');
  });
}

/**
 * 3. RENDER: The "Sweet" UI.
 * Features: Drag-and-drop rows, inline time editing, and the Magic Wand.
 */
function _doExport(type, fmt, p) {
  console.log('_doExport start', type, fmt);
  
  // Counter to prevent browser caching issues
  window._exportCount = (window._exportCount || 0) + 1;
  let content = '', filename = type, mimeType = 'text/plain';

  if (type === 'shotlist') {
    if (fmt === 'HTML') {
      content = '<html><head><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#333;color:#fff}</style></head><body><h1>Shot List</h1><table><tr><th>Scene</th><th>Setup</th><th>Shot</th><th>Type</th><th>Movement</th><th>Location</th><th>Ext/Int</th><th>Description</th><th>Cast</th><th>Est (mins)</th></tr>' + p.shots.map(s => `<tr><td>${s.scene||''}</td><td>${s.setup||''}</td><td>${s.num||''}</td><td>${s.type||''}</td><td>${s.movement||''}</td><td>${s.location||''}</td><td>${s.extint||''}</td><td>${s.desc||''}</td><td>${s.cast||''}</td><td>${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)}</td></tr>`).join('') + '</table></body></html>';
      filename = `shotlist-${window._exportCount}.html`; mimeType = 'text/html';
    } else if (fmt === 'CSV') {
      content = 'Scene,Setup,Shot,Type,Movement,Location,Ext/Int,Description,Cast,Est (mins)\n' + p.shots.map(s => `"${s.scene||''}","${s.setup||''}","${s.num||''}","${s.type||''}","${s.movement||''}","${s.location||''}","${s.extint||''}","${(s.desc||'').replace(/"/g,'\"')}","${s.cast||''}","${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)}"`).join('\n');
      filename = `shotlist-${window._exportCount}.csv`; mimeType = 'text/csv';
    } else {
      content = 'SHOT LIST\n' + '='.repeat(50) + '\n\n' + p.shots.map((s,i) => `${i+1}. SC ${s.scene||''} / SETUP ${s.setup||''} / SHOT ${s.num||''} (${s.type||''})\n   Movement: ${s.movement||''} | Location: ${s.location||''} | ${s.extint||''}\n   Description: ${s.desc||''}\n   Cast: ${s.cast||''} | Est: ${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)} mins\n`).join('\n');
      filename = `shotlist-${window._exportCount}.txt`;
    }
  } else {
    // Schedule export
    if (fmt === 'HTML') {
      let currentDay = '';
      const rows = p.schedule.map(s => {
        if (s.isDayHeader) { currentDay = s.desc; return null; }
        return { day: currentDay, time: s.time || '', scene: s.scene || '', shot: s.shot || '', type: s.type || '', desc: s.desc || '', cast: s.cast || '', pages: s.pages || '', est: s.est || '' };
      }).filter(r => r);
      content = '<html><head><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#333;color:#fff}.day{background:#ffd700;color:#000;font-weight:bold}</style></head><body><h1>Production Schedule</h1><table><tr><th>Day</th><th>Time</th><th>Scene</th><th>Shot</th><th>Type</th><th>Description</th><th>Cast</th><th>Pages</th><th>Est (mins)</th></tr>';
      let lastDay = '';
      rows.forEach(r => {
        const dayRow = r.day !== lastDay ? `<tr class="day"><td colspan="9">${r.day}</td></tr>` : '';
        lastDay = r.day;
        content += dayRow + `<tr><td></td><td>${r.time}</td><td>${r.scene}</td><td>${r.shot}</td><td>${r.type}</td><td>${r.desc}</td><td>${r.cast}</td><td>${r.pages}</td><td>${r.est}</td></tr>`;
      });
      content += '</table></body></html>';
      filename = `schedule-${window._exportCount}.html`; mimeType = 'text/html';
    } else if (fmt === 'CSV') {
      let currentDay = '';
      const rows = p.schedule.map(s => {
        if (s.isDayHeader) { currentDay = s.desc; return null; }
        return { day: currentDay, time: s.time || '', scene: s.scene || '', shot: s.shot || '', type: s.type || '', desc: s.desc || '', cast: s.cast || '', pages: s.pages || '', est: s.est || '' };
      }).filter(r => r);
      content = `Day,Time,Scene,Shot,Type,Description,Cast,Pages,Est (mins)\n`;
      let lastDay = '';
      rows.forEach(r => {
        const d = (r.day || '').replace(/"/g, '""');
        if (r.day !== lastDay) content += `"${r.day}","","","","","","","","\n`;
        lastDay = r.day;
        content += `"${r.day}","${r.time}","${r.scene}","${r.shot}","${r.type}","${(r.desc||'').replace(/"/g, '""')}","${r.cast}","${r.pages}","${r.est}"\n`;
      });
      filename = `schedule-${window._exportCount}.csv`; mimeType = 'text/csv';
    } else {
      let currentDay = '';
      const rows = p.schedule.map(s => {
        if (s.isDayHeader) { currentDay = s.desc; return null; }
        return { day: currentDay, time: s.time || '', scene: s.scene || '', shot: s.shot || '', type: s.type || '', desc: s.desc || '', cast: s.cast || '', pages: s.pages || '', est: s.est || '' };
      }).filter(r => r);
      let lastDay = '';
      content = 'PRODUCTION SCHEDULE\n' + '='.repeat(50) + '\n\n';
      rows.forEach(r => {
        if (r.day !== lastDay) { content += '\n' + r.day + '\n' + '-'.repeat(30) + '\n'; lastDay = r.day; }
        content += `${r.time} - SC ${r.scene} / ${r.shot} (${r.type})\n   ${r.desc}\n   Cast: ${r.cast} | Est: ${r.est} mins\n`;
      });
      filename = `schedule-${window._exportCount}.txt`;
    }
  }

  // PDF export - use the shared print system
  if (fmt === 'PDF') {
    let rowsHtml = '';
    
    if (type === 'shotlist') {
      const scenes = {};
      (p.shots || []).forEach(s => {
        const sc = s.scene || 'Unknown';
        if (!scenes[sc]) scenes[sc] = [];
        scenes[sc].push(s);
      });
      
      Object.keys(scenes).sort((a,b) => parseInt(a)||0 - parseInt(b)||0).forEach(scene => {
        rowsHtml += `<tr class="day-header"><td colspan="9">SCENE ${scene}</td></tr>`;
        scenes[scene].forEach(s => {
          const est = (parseInt(s.setuptime)||0) + (parseInt(s.shoottime)||0);
          rowsHtml += `<tr>
            <td>${s.setup||''}</td>
            <td>${s.num||''}</td>
            <td>${s.type||''}</td>
            <td>${s.movement||''}</td>
            <td>${s.location||''}</td>
            <td>${s.extint||''}</td>
            <td>${s.desc||''}</td>
            <td>${s.cast||''}</td>
            <td>${est}</td>
          </tr>`;
        });
      });
      const thead = '<th>Setup</th><th>Shot</th><th>Type</th><th>Movement</th><th>Location</th><th>Int/Ext</th><th>Description</th><th>Cast</th><th>Est (mins)</th>';
      _bfPrint({
        title: p.title,
        section: 'Shot List',
        body: `<style>
          table { width: 100%; border-collapse: collapse; }
          th { background: #1a1a2e; color: #e8e0ff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; }
          tr:nth-child(even) { background: #f7f7f7; }
          .day-header td { background: #ffd700; color: #000; font-weight: 700; padding: 6px 8px; }
        </style>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
      });
    } else {
      // Schedule
      let currentDay = '';
      (p.schedule || []).forEach(s => {
        if (s.isDayHeader) {
          currentDay = s.desc || '';
          rowsHtml += `<tr class="day-header"><td colspan="8">${currentDay}</td></tr>`;
        } else if (!s.isWrap) {
          rowsHtml += `<tr>
            <td>${s.time||''}</td>
            <td>${s.scene||''}</td>
            <td>${s.shot||''}</td>
            <td>${s.type||''}</td>
            <td>${s.desc||''}</td>
            <td>${s.cast||''}</td>
            <td>${s.pages||''}</td>
            <td>${s.est||''}</td>
          </tr>`;
        }
      });
      const thead = '<th>Time</th><th>Scene</th><th>Shot</th><th>Type</th><th>Description</th><th>Cast</th><th>Pages</th><th>Est (mins)</th>';
      _bfPrint({
        title: p.title,
        section: 'Production Schedule',
        body: `<style>
          table { width: 100%; border-collapse: collapse; }
          th { background: #1a1a2e; color: #e8e0ff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; }
          tr:nth-child(even) { background: #f7f7f7; }
          .day-header td { background: #ffd700; color: #000; font-weight: 700; padding: 6px 8px; }
        </style>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
      });
    }
    return;
  }

  // Regular file download for HTML/CSV/TXT
  const blob = new Blob([content], { type: mimeType });
  
  if (window.navigator.msSaveBlob) {
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: filename,
      style: 'display:none'
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
  
  showToast('Exported as ' + fmt, 'success');
}

function renderSchedule(p) {
  const container = document.getElementById('schedule-container');
  if (!p.schedule || !p.schedule.length) {
    container.innerHTML = `<div class="empty-state"><h4>No shots.</h4><button class="btn btn-primary" onclick="generateScheduleFromShots()">Generate from Shotlist</button></div>`;
    return;
  }

  const rows = p.schedule.map((s, i) => {
    if (s.isWrap) {
      return `
        <tr class="wrap-row" onclick="editScheduleRow(${i})">
          <td></td>
          <td style="color:#ff4d4d; font-weight:bold; width:90px;">${s.time||''}</td>
          <td><input type="text" class="desc-input" value="${s.desc||''}" onchange="updateWrapDesc(${i}, this.value)"></td>
          <td colspan="6"></td>
          <td><button class="btn-delete" onclick="removeScheduleRow(${i})">✕</button></td>
        </tr>`;
    }

    if (s.isDayHeader) {
      const isOvertime = (s.totalEst || 0) > 600;
      return `
        <tr class="day-header-row" data-idx="${i}">
          <td colspan="10" style="background:#111; border-left: 6px solid #ffd700; padding: 15px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                <strong style="font-size:1.1em; letter-spacing:1px;">${s.desc}</strong>
                <button onclick="wrapScheduleDays()" style="background:#333; color:#888; border:none; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer;">Recalculate Days</button>
              </div>
              <div style="display:flex; gap:20px; align-items:center; font-size:12px;">
                <label>Call: <input type="time" class="time-input" value="${_minToInput(s.callTime||420)}" onchange="updateDayTime(${i}, 'callTime', this.value)"></label>
                <label>Wrap: <input type="time" class="time-input" value="${_minToInput(s.wrapTime||1020)}" onchange="updateDayTime(${i}, 'wrapTime', this.value)"></label>
                <span>Work: <b style="color:${isOvertime ? '#ff4d4d' : '#00ff88'}">${Math.floor((s.totalEst||0)/60)}h ${(s.totalEst||0)%60}m</b></span>
              </div>
            </div>
          </td>
        </tr>`;
    }

    // If it's a scene fragment, highlight the row slightly
    // Skip _nonShot rows from optimization suggestions
    const suggestion = (!s._nonShot) ? getOptimizationSuggestion(i, p.schedule) : null;
    const rowStyle = (suggestion && suggestion.type === 'scene') ? 'border-left: 4px solid #ff4d4d; background: rgba(255, 77, 77, 0.05);' : '';
    
    const wand = suggestion ? `
      <span class="magic-wand" 
            onclick="event.stopPropagation();moveShot(${i}, ${suggestion.targetPos})" 
            onmouseover="showWandTooltip(this, '${suggestion.message.replace(/'/g, "\\'")}')" 
            onmouseout="hideWandTooltip()">
        🪄
      </span>` : '';

    const castHtml = _renderCastPills(s.cast);

    return `
      <tr class="sched-row" style="${rowStyle}" onclick="editScheduleRow(${i})" draggable="true" ondragstart="dragShot(event, ${i})" ondragover="allowDrop(event)" ondrop="dropShot(event, ${i})">
        <td class="drag-handle">⠿</td>
        <td style="color:#ffd700; font-weight:bold; width:90px;">${s.time||''}</td>
        <td>${s.scene||''}</td>
        <td>${s.shot||''}</td>
        <td><span class="tag-type">${s.type||''}</span></td>
        <td><input type="text" class="desc-input" value="${s.desc||''}" onchange="updateShotDesc(${i}, this.value)"></td>
        <td>${castHtml} ${wand}</td>
        <td style="width:40px;">${s.pages||''}</td>
        <td><input type="number" class="est-input" value="${s.est}" onchange="updateShotDuration(${i}, this.value)"></td>
        <td><button class="btn-delete" onclick="removeScheduleRow(${i})">✕</button></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <style>
      .time-input { background:#222; border:1px solid #444; color:#ffd700; border-radius:4px; padding:2px; cursor:pointer; }
      .desc-input { background:#222; border:1px solid #444; color:#ccc; border-radius:4px; padding:2px; width:100%; box-sizing:border-box; }
      .desc-input:focus { border-color:#ffd700; outline:none; }
      .drag-handle { color:#444; cursor:grab; font-size:18px; width:20px; text-align:center; }
      .sched-row { transition: background 0.3s ease; }
      .sched-row:active { cursor:grabbing; background:#222; }
      .magic-wand { position: relative; cursor: pointer; margin-left: 8px; font-size: 1.2em; }
      .wand-tooltip { 
        display: none; position: fixed; z-index: 1000;
        background: #222; color: #fff; padding: 10px 14px; border-radius: 8px; width: 240px;
        font-size: 12px; line-height: 1.4; border: 1px solid #ffd700;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      @keyframes glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; filter: drop-shadow(0 0 5px #ffd700); } }
      .actor-pill { background:#2a2a2a; padding:2px 6px; border-radius:10px; font-size:10px; margin-right:4px; border:1px solid #444; }
      .est-input { width:45px; background:#000; border:1px solid #333; color:#fff; text-align:center; font-weight:bold; }
      .sched-header { background:#1a1a1a; color:#888; font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
      .sched-header th { padding:8px 4px; border-bottom:1px solid #333; }
    </style>
    <table class="data-table" style="width:100%; border-collapse:collapse;">
      <thead><tr class="sched-header">
        <th></th>
        <th>Time</th>
        <th>Scene</th>
        <th>Shot</th>
        <th>Type</th>
        <th>Description</th>
        <th>Cast</th>
        <th>Pages</th>
        <th>Est (mins)</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * 4. DRAG & DROP LOGIC
 */
let draggedIdx = null;
function dragShot(e, idx) { draggedIdx = idx; e.dataTransfer.setData("text", idx); }
function allowDrop(e) { e.preventDefault(); }
async function dropShot(e, targetIdx) {
  e.preventDefault();
  const p = currentProject();
  const item = p.schedule.splice(draggedIdx, 1)[0];
  p.schedule.splice(targetIdx, 0, item);
  // Re-run the flow engine to see if the move changes day breaks
  await wrapScheduleDays();
  showToast('Order Updated', 'success');
}

/**
 * 5. SMART ACTIONS
 */
async function updateDayTime(idx, field, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const p = currentProject();
  p.schedule[idx][field] = (h * 60) + m;
  
  // Changing a limit "re-jigs" the whole schedule
  await wrapScheduleDays(); 
}

async function updateShotDuration(idx, val) {
  const p = currentProject();
  p.schedule[idx].est = parseInt(val) || 0;
  // Longer shots might push following scenes to the next day
  await wrapScheduleDays();
}

async function updateShotDesc(idx, val) {
  const p = currentProject();
  const scheduleRow = p.schedule[idx];
  
  // Update schedule row
  scheduleRow.desc = val;
  
  // Also update the corresponding shot in shotlist
  if (scheduleRow.shotRef && p.shots) {
    const [scenePart, setupPart, numPart] = scheduleRow.shotRef.split('::');
    const targetShot = p.shots.find(s => {
      const shotScene = s.sceneId || s.sceneKey || s.scene || '';
      return shotScene === scenePart && s.setup == setupPart && s.num == numPart;
    });
    if (targetShot) {
      targetShot.desc = val;
    }
  }
  
  // Save the project so the description persists
  await saveStore();
}

async function moveShot(from, to) {
  hideWandTooltip();
  const p = currentProject();
  const item = p.schedule.splice(from, 1)[0];
  p.schedule.splice(to, 0, item);
  await rippleScheduleTimes(); // ← was wrapScheduleDays()
  showToast('Optimized Location', 'success');
}

async function updateWrapDesc(idx, val) {
  const p = currentProject();
  p.schedule[idx].desc = val;
  await saveStore();
  renderSchedule(p);
}

// 6. ACTIONS & HELPERS

// Export function for schedule
function exportSchedule(event) {
  event.stopPropagation();
  const p = currentProject();
  if (!p?.schedule?.length) { showToast('No schedule to export', 'info'); return; }

  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:4px 0;min-width:150px;z-index:9999';
  
  ['HTML', 'CSV', 'Text', 'PDF'].forEach(fmt => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:block;width:100%;padding:8px 12px;text-align:left;background:none;border:none;cursor:pointer;color:var(--text)';
    btn.textContent = '📄 ' + fmt;
    btn.onclick = (e) => {
      e.stopPropagation();
      menu.remove();
      if (fmt === 'PDF') {
        // Use bf-print system like shotlist.js
        let currentDay = '';
        let rowsHtml = '';
        p.schedule.forEach(s => {
          if (s.isDayHeader) {
            currentDay = s.desc || '';
            rowsHtml += `<tr class="day-header"><td colspan="8">${_bfEscHtml(currentDay)}</td></tr>`;
          } else if (!s.isWrap) {
            rowsHtml += `<tr>
              <td>${_bfEscHtml(s.time)}</td>
              <td>${_bfEscHtml(s.scene)}</td>
              <td>${_bfEscHtml(s.shot)}</td>
              <td>${_bfEscHtml(s.type)}</td>
              <td>${_bfEscHtml(s.desc)}</td>
              <td>${_bfEscHtml(s.cast)}</td>
              <td>${_bfEscHtml(s.pages)}</td>
              <td>${_bfEscHtml(s.est)}</td>
            </tr>`;
          }
        });
        const thead = '<th>Time</th><th>Scene</th><th>Shot</th><th>Type</th><th>Description</th><th>Cast</th><th>Pages</th><th>Est (mins)</th>';
        const tableHtml = `<style>
          table { width: 100%; border-collapse: collapse; }
          th { background: #1a1a2e; color: #e8e0ff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; }
          tr:nth-child(even) { background: #f7f7f7; }
          .day-header td { background: #ffd700 !important; color: #000 !important; font-weight: 700; padding: 6px 8px; }
        </style>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
        _bfPrint({
          title: p.title,
          section: 'Production Schedule',
          body: tableHtml
        });
      } else {
        _doExport('schedule', fmt, p);
      }
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const rect = event.target.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';

  // Single cleanup listener
  setTimeout(() => {
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    document.addEventListener('click', close);
  }, 0);
}

function _applyProductionSort(arr) {
  arr.sort((a, b) => {
    if (a.location !== b.location) return (a.location || '').localeCompare(b.location || '');
    if (a.extint !== b.extint) return (a.extint || '').localeCompare(b.extint || '');
    return (parseInt(a.scene) || 0) - (parseInt(b.scene) || 0);
  });
}

function _findDayHeaderIndex(sched, shotIdx) {
  for (let i = shotIdx; i >= 0; i--) { if (sched[i].isDayHeader) return i; }
  return 0;
}

function _getShotsForDay(sched, headerIdx) {
  const shots = [];
  for (let i = headerIdx + 1; i < sched.length; i++) {
    if (sched[i].isDayHeader) break;
    shots.push(sched[i]);
  }
  return shots;
}

function _formatTime(minutes) {
  let m = minutes % 1440;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function _minToInput(mins) {
  const h = Math.floor((mins || 0) / 60).toString().padStart(2, '0');
  const m = ((mins || 0) % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function _timeToMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}

function _parseTimeToMin(timeStr) {
  if (!timeStr) return 0;
  // Assume HH:MM or H:MM
  const parts = timeStr.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return (h * 60) + m;
}

function _sortDayShotsByTime(schedule, shotIdx) {
  // Find the day header for this shot
  let dayStart = -1;
  for (let i = shotIdx; i >= 0; i--) {
    if (schedule[i].isDayHeader) {
      dayStart = i;
      break;
    }
  }
  if (dayStart === -1) return;

  // Collect shots until next day header or wrap
  const shots = [];
  const indices = [];
  for (let i = dayStart + 1; i < schedule.length; i++) {
    if (schedule[i].isDayHeader) break;
    if (!schedule[i].isWrap) {
      shots.push(schedule[i]);
      indices.push(i);
    }
  }

  // Sort shots by time
  shots.sort((a, b) => _parseTimeToMin(a.time) - _parseTimeToMin(b.time));

  // Replace in schedule
  indices.forEach((idx, pos) => {
    schedule[idx] = shots[pos];
  });
}
function addScheduleRow() { document.getElementById('sched-edit-idx').value=''; ['time','scene','shot','desc','cast','pages','est'].forEach(f => document.getElementById('sched-'+f).value=''); openModal('modal-schedule'); }
function editScheduleRow(idx) {
  const p = currentProject();
  const row = p.schedule[idx];
  document.getElementById('sched-edit-idx').value = idx;
  document.getElementById('sched-time').value = row.time || '';
  document.getElementById('sched-scene').value = row.scene || '';
  document.getElementById('sched-shot').value = row.shot || '';
  document.getElementById('sched-desc').value = row.desc || '';
  document.getElementById('sched-cast').value = row.cast || '';
  document.getElementById('sched-pages').value = row.pages || '';
  document.getElementById('sched-est').value = row.est || '';
  openModal('modal-schedule');
}
function removeScheduleRow(i) { showConfirmDialog('Remove this schedule entry?', 'Remove', () => { const p=currentProject(); p.schedule.splice(i,1); saveStore(); renderSchedule(p); }); }
function saveScheduleRow() {
  const p=currentProject();
  const row = {
    time: document.getElementById('sched-time').value,
    scene: document.getElementById('sched-scene').value,
    shot: document.getElementById('sched-shot').value,
    type: document.getElementById('sched-type').value,
    desc: document.getElementById('sched-desc').value,
    cast: document.getElementById('sched-cast').value,
    pages: document.getElementById('sched-pages').value,
    est: document.getElementById('sched-est').value,
  };
  const idx = document.getElementById('sched-edit-idx').value;
  if (idx !== '') {
    const editIdx = parseInt(idx);
    const wasWrap = p.schedule[editIdx].isWrap;
    p.schedule[editIdx] = { ...row, isWrap: wasWrap };
    // Sort the day's shots by time, unless it was a wrap row
    if (!wasWrap) {
      _sortDayShotsByTime(p.schedule, editIdx);
    }
  } else {
    p.schedule.push(row);
  }
  saveStore(); closeModal('modal-schedule'); renderSchedule(p);
}

// CAST
function renderCast(p) {
  renderPersonnelTable(p.cast, 'cast-body', 'cast');
  renderPersonnelTable(p.extras, 'extras-body', 'extras');
  const btn = document.getElementById('cast-email-sel-btn');
  if (btn) btn.style.display = 'none';
}

// Sorting state for personnel tables
let _sortState = {
  cast: { column: null, direction: null },
  extras: { column: null, direction: null },
  crew: { column: null, direction: null },
  props: { column: null, direction: null },
  wardrobe: { column: null, direction: null }
};

// Sort table function
function _sortTable(tableType, column) {
  const state = _sortState[tableType];
  if (!state) return;
  
  // Cycle through: null -> asc -> desc -> null
  if (state.column === column) {
    if (state.direction === 'asc') {
      state.direction = 'desc';
    } else if (state.direction === 'desc') {
      state.column = null;
      state.direction = null;
    }
  } else {
    state.column = column;
    state.direction = 'asc';
  }
  
  // Update sort indicators
  _updateSortIndicators(tableType);
  
  // Re-render the table
  const p = currentProject();
  if (tableType === 'cast') renderPersonnelTable(p.cast, 'cast-body', 'cast');
  else if (tableType === 'extras') renderPersonnelTable(p.extras, 'extras-body', 'extras');
  else if (tableType === 'crew') renderCrew(p);
  else if (tableType === 'props') renderPropTable('props', 'props-body', p);
  else if (tableType === 'wardrobe') renderWardrobeTable(p);
}

function _updateSortIndicators(tableType) {
  const state = _sortState[tableType];
  if (!state) return;
  
  // Get all sort indicators for this table type
  const indicators = document.querySelectorAll(`#${tableType}-table .sort-indicator, #${tableType}-body .sort-indicator, .team-section .sort-indicator`);
  const allIndicators = document.querySelectorAll('.sort-indicator');
  
  allIndicators.forEach(ind => {
    const id = ind.id;
    if (id && id.startsWith(`${tableType}-sort-`)) {
      const col = id.replace(`${tableType}-sort-`, '');
      if (state.column === col) {
        ind.textContent = state.direction === 'asc' ? '▲' : '▼';
      } else {
        ind.textContent = '';
      }
    }
  });
}

function _getSortedList(list, tableType) {
  const state = _sortState[tableType];
  if (!state.column || !state.direction) return list;
  
  return [...list].sort((a, b) => {
    let valA = a[state.column] || '';
    let valB = b[state.column] || '';
    
    // Handle string columns specifically (case-insensitive)
    const stringColumns = ['name', 'role', 'chars', 'scenes', 'locs', 'loc', 'pgs'];
    if (stringColumns.includes(state.column)) {
      valA = (a[state.column] || '').toLowerCase();
      valB = (b[state.column] || '').toLowerCase();
    }
    
    if (valA < valB) return state.direction === 'asc' ? -1 : 1;
    if (valA > valB) return state.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderPersonnelTable(list, tbodyId, type) {
  const tbody = document.getElementById(tbodyId);
  // Apply sorting
  const sortedList = _getSortedList(list, type);
  if (!sortedList.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No entries</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = sortedList.map((m,i) => `
    <tr data-type="${type}" data-idx="${i}" oncontextmenu="showCastCtxMenu(event,'${type}',${i})" onclick="editPersonnel('${type}',${i})" style="cursor:pointer">
      <td style="width:28px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" class="cast-cb" data-type="${type}" data-idx="${i}" onchange="_updateCastEmailSelBtn()" style="cursor:pointer"></td>
      <td><strong>${m.name}</strong></td>
      <td>${m.role||'—'}</td>
      <td>${m.number||'—'}</td>
      <td>${m.email||'—'}</td>
      <td>${m.notes||'—'}</td>
      <td><span class="conf-dot conf-${m.confirmed||'green'}" title="${m.confirmed}"></span></td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-ghost" onclick="editPersonnel('${type}',${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removePersonnel('${type}',${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function _persRoleToggle() {
  const isOther = document.getElementById('pers-role-select').value === 'other';
  document.getElementById('pers-role-other').style.display = isOther ? '' : 'none';
  if (!isOther) document.getElementById('pers-role-other').value = '';
}
function _persSetCrewMode(isUnit) {
  document.getElementById('pers-role-label').textContent = isUnit ? 'Role' : 'Role / Character';
  document.getElementById('pers-role').style.display = isUnit ? 'none' : '';
  document.getElementById('pers-role-select-group').style.display = isUnit ? '' : 'none';
  document.getElementById('pers-role-other').style.display = 'none';
  document.getElementById('pers-dept-group').style.display = isUnit ? 'block' : 'none';
  document.getElementById('pers-social-group').style.display = isUnit ? 'block' : 'none';
}
function addPersonnel(type) {
  console.log('addPersonnel called with type:', type);
  document.getElementById('personnel-type').value = type;
  document.getElementById('personnel-edit-idx').value = '';
  document.getElementById('modal-personnel-title').textContent = 'ADD ' + type.toUpperCase();
  ['name','role','number','email','notes'].forEach(f => document.getElementById('pers-'+f).value='');
  document.getElementById('pers-socials-container').innerHTML = '';
  addSocialField('pers-socials-container', 'instagram', '');
  document.getElementById('pers-role-select').value = '';
  document.getElementById('pers-role-other').value = '';
  document.getElementById('pers-confirmed').value = 'green';
  // Clear contact dropdown and linked badge
  const persContactSelect = document.getElementById('pers-contact-select');
  if (persContactSelect) persContactSelect.value = '';
  const badge = document.getElementById('_pers-linked-badge');
  if (badge) badge.remove();
  window._persContactId = null;
  _persSetCrewMode(type === 'unit');
  openModal('modal-personnel');
  _persPopulateContactSelect();
  if (typeof ContactAnchor !== 'undefined') {
    setTimeout(() => ContactAnchor.attachPicker(
      document.getElementById('pers-name'),
      contact => {
        document.getElementById('pers-name').value   = contact.name;
        document.getElementById('pers-number').value = contact.phone || '';
        document.getElementById('pers-email').value  = contact.email || '';
        window._persContactId = contact.id;
        // Show badge
        const badge = document.getElementById('_pers-linked-badge');
        if (badge) badge.remove();
        const b = document.createElement('div');
        b.id = '_pers-linked-badge';
        b.style.cssText = 'font-size:11px;color:var(--accent2);margin-top:4px';
        b.innerHTML = `⚭ Linked to contact: <strong>${contact.name}</strong> <button onclick="window._persContactId=null;this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">Unlink</button>`;
        document.getElementById('pers-name').parentElement.appendChild(b);
      }
    ), 0);
  }
}
function editPersonnel(type, i) {
  const p = currentProject();
  const m = p[type][i];
  document.getElementById('personnel-type').value = type;
  document.getElementById('personnel-edit-idx').value = i;
  document.getElementById('modal-personnel-title').textContent = 'EDIT ' + type.toUpperCase();
  document.getElementById('pers-name').value = m.name||'';
  document.getElementById('pers-role').value = m.role||'';
  document.getElementById('pers-number').value = m.number||'';
  document.getElementById('pers-email').value = m.email||'';
  document.getElementById('pers-notes').value = m.notes||'';
  const socialsContainer = document.getElementById('pers-socials-container');
  socialsContainer.innerHTML = '';
  if (m.social) {
    const socialParts = m.social.split(',').map(s => s.trim()).filter(Boolean);
    socialParts.forEach(s => {
      const sepIdx = s.indexOf('||');
      const platform = sepIdx >= 0 ? s.slice(0, sepIdx) : 'instagram';
      const handle = sepIdx >= 0 ? s.slice(sepIdx + 2) : s;
      addSocialField('pers-socials-container', platform, handle);
    });
  } else {
    addSocialField('pers-socials-container', 'instagram', '');
  }
  document.getElementById('pers-confirmed').value = m.confirmed||'green';
  if (m.dept) document.getElementById('pers-dept').value = m.dept;
  // Clear any existing linked badge when editing
  const existingBadge = document.getElementById('_pers-linked-badge');
  if (existingBadge) existingBadge.remove();
  window._persContactId = m.contactId || null;
  _persSetCrewMode(type === 'unit');
  if (type === 'unit') {
    const sel = document.getElementById('pers-role-select');
    const knownOption = [...sel.options].some(o => o.value !== 'other' && o.text === m.role);
    if (knownOption) {
      sel.value = m.role;
      document.getElementById('pers-role-other').style.display = 'none';
    } else if (m.role) {
      sel.value = 'other';
      document.getElementById('pers-role-other').style.display = '';
      document.getElementById('pers-role-other').value = m.role;
    } else {
      sel.value = '';
    }
  }
  openModal('modal-personnel');
  _persPopulateContactSelect();
}
function savePersonnel() {
  const p = currentProject();
  const type = document.getElementById('personnel-type').value;
  const idx = document.getElementById('personnel-edit-idx').value;
  const name = document.getElementById('pers-name').value.trim();
  if (!name) { showToast('Name required', 'info'); return; }
  const roleRaw = type === 'unit'
    ? (document.getElementById('pers-role-select').value === 'other'
        ? document.getElementById('pers-role-other').value.trim()
        : document.getElementById('pers-role-select').value)
    : document.getElementById('pers-role').value.trim();
  const m = {
    name, role: roleRaw,
    number: document.getElementById('pers-number').value.trim(),
    email: document.getElementById('pers-email').value.trim(),
    notes: document.getElementById('pers-notes').value.trim(),
    social: collectSocials('pers-socials-container'),
    confirmed: document.getElementById('pers-confirmed').value,
    dept: document.getElementById('pers-dept').value
  };
  if (window._persContactId) {
    m.contactId = window._persContactId;
    window._persContactId = null;
  }
  if (idx !== '') p[type][parseInt(idx)] = m;
  else p[type].push(m);
  saveStore(); closeModal('modal-personnel');
  if (type === 'cast' || type === 'extras') renderCast(p);
  else if (type === 'unit') renderCrew(p);
  showToast('Saved', 'success');
}
// removePersonnel defined above near removeCSRow
function removePersonnel(type, idx) {
  const p = currentProject();
  if (!p) return;
  const i = parseInt(idx);
  const name = type === 'cast' ? p.cast[i]?.name : type === 'extras' ? p.extras[i]?.name : p.unit[i]?.name;
  showConfirmDialog(`Remove ${name || 'this entry'}?`, 'Remove', () => {
    if (type === 'cast') {
      p.cast.splice(i, 1);
      saveStore();
      renderCast(p);
    } else if (type === 'extras') {
      p.extras.splice(i, 1);
      saveStore();
      renderCast(p);
    } else if (type === 'unit') {
      p.unit.splice(i, 1);
      saveStore();
      renderCrew(p);
    }
  });
}

// CREW
function renderCrew(p) {
  const el = document.getElementById('crew-sections');
  if (!el) return;
  const grouped = {};
  UNIT_DEPTS.forEach(d => grouped[d] = []);
  // Get sorted list if sorting is active
  const sortedUnit = _getSortedList(p.unit || [], 'crew');
  sortedUnit.forEach((m,i) => { const d = m.dept||'Other'; if (!grouped[d]) grouped[d]=[]; grouped[d].push({...m,_i:i}); });
  el.innerHTML = UNIT_DEPTS.filter(d => grouped[d].length).map(dept => `
    <div class="team-section">
      <div class="team-section-header">
        <span>${dept}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="emailCrewDept('${dept.replace(/'/g,"\\'")}')">✉️ Email Dept</button>
          <button class="btn btn-sm" onclick="addUnitMember('${dept.replace(/'/g,"\\'")}')">+ Add</button>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table" style="table-layout:fixed;width:100%">
          <thead><tr>
            <th style="width:40px"><input type="checkbox" onchange="_crewSelectAll(this,'${dept.replace(/'/g,"\\'")}')"></th>
            <th style="width:150px" onclick="_sortTable('crew','name')" style="cursor:pointer" class="sortable-header">Name <span class="sort-indicator" id="crew-sort-name"></span></th>
            <th style="width:150px" onclick="_sortTable('crew','role')" style="cursor:pointer" class="sortable-header">Role <span class="sort-indicator" id="crew-sort-role"></span></th>
            <th style="width:100px">Number</th>
            <th style="width:180px">Email</th>
            <th style="width:100px">Social</th>
            <th style="width:80px">Confirmed</th>
            <th style="width:70px"></th>
          </tr></thead>
          <tbody>
            ${grouped[dept].map(m => `
              <tr data-type="unit" data-idx="${m._i}" oncontextmenu="showCrewCtxMenu(event,${m._i})" style="cursor:pointer">
                <td style="width:28px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" class="crew-cb" data-type="unit" data-idx="${m._i}" onchange="_updateCrewEmailSelBtn()"></td>
                <td><strong>${m.name}</strong></td>
                <td>${m.role||'—'}</td><td>${m.number||'—'}</td>
                <td>${m.email||'—'}</td><td>${m.social ? renderSocialLinks(m.social) : '—'}</td>
                <td><span class="conf-dot conf-${m.confirmed||'green'}"></span></td>
                <td onclick="event.stopPropagation()">
                  <button class="btn btn-sm btn-ghost" onclick="editPersonnel('unit',${m._i})">✎</button>
                  <button class="btn btn-sm btn-ghost btn-danger" onclick="removePersonnel('unit',${m._i})">✕</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('') || `<div class="empty-state"><div class="icon">👥</div><h4>No crew added yet</h4></div>`;
  _updateCrewEmailSelBtn();
}
function renderUnit(p) { renderCrew(p); } // backward compat
function addUnitMember(dept) {
  addPersonnel('unit');
  if (dept) setTimeout(() => { document.getElementById('pers-dept').value = dept; }, 50);
}
function _updateCrewEmailSelBtn() {
  const n = document.querySelectorAll('.crew-cb:checked').length;
  const btn = document.getElementById('crew-email-sel-btn');
  const dropdown = document.getElementById('crew-bulk-dropdown');
  if (btn) btn.style.display = n ? '' : 'none';
  if (dropdown) dropdown.style.display = n ? '' : 'none';
}
function _crewSelectAll(cb, dept) {
  document.querySelectorAll('.crew-cb').forEach(c => {
    const row = c.closest('tr');
    if (!dept || row?.closest('.team-section')?.querySelector('.team-section-header span')?.textContent === dept) {
      c.checked = cb.checked;
    }
  });
  _updateCrewEmailSelBtn();
}
function emailAllCrew() {
  const p = currentProject();
  const emails = (p.unit||[]).map(m=>m.email).filter(Boolean);
  if (!emails.length) { showToast('No email addresses found in crew','info'); return; }
  const subject = encodeURIComponent(p.title+' - Crew Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding '+p.title+'.\n\nBest regards');
  window.location.href = 'mailto:'+emails.join(',')+'?subject='+subject+'&body='+body;
}
function emailCrewDept(dept) {
  const p = currentProject();
  const emails = (p.unit||[]).filter(m=>(m.dept||'Other')===dept&&m.email).map(m=>m.email);
  if (!emails.length) { showToast('No email addresses in '+dept+' department','info'); return; }
  const subject = encodeURIComponent(p.title+' - '+dept+' Department');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding '+p.title+'.\n\nBest regards');
  window.location.href = 'mailto:'+emails.join(',')+'?subject='+subject+'&body='+body;
}
function emailSelectedCrew() {
  const p = currentProject();
  const emails = [...document.querySelectorAll('.crew-cb:checked')]
    .map(cb=>p.unit[parseInt(cb.dataset.idx)]?.email).filter(Boolean);
  if (!emails.length) { showToast('No email addresses in selection','info'); return; }
  const subject = encodeURIComponent(p.title+' - Crew Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding '+p.title+'.\n\nBest regards');
  window.location.href = 'mailto:'+emails.join(',')+'?subject='+subject+'&body='+body;
}

function showCrewCtxMenu(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  _dismissCtxMenu();
  const p = currentProject();
  const u = p.unit?.[idx];
  if (!u) return;
  const menu = document.createElement('div');
  menu.id = '_ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:4px 0;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.4);font-size:13px';
  const items = [
    { label: '✎ Edit', action: () => editPersonnel('unit', idx) },
    { label: '✉️ Email', action: () => u.email ? window.location.href = `mailto:${u.email}?subject=${encodeURIComponent(p.title)}` : showToast('No email address attached to contact', 'error') },
    { sep: true },
    { label: '🗑 Remove from Project', action: () => removePersonnel('unit', idx), danger: true },
  ];
  items.forEach(item => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0';
      menu.appendChild(sep);
      return;
    }
    const el = document.createElement('div');
    el.style.cssText = `padding:7px 14px;cursor:pointer;color:${item.danger ? '#e55' : 'var(--text)'};white-space:nowrap`;
    el.textContent = item.label;
    el.addEventListener('mouseenter', () => el.style.background = 'var(--surface3)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('mousedown', e2 => { e2.stopPropagation(); _dismissCtxMenu(); item.action(); });
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  const mw = 190, mh = menu.offsetHeight || 120;
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => document.addEventListener('mousedown', _dismissCtxMenu, { once: true }), 0);
}

function showCastCtxMenu(e, type, idx) {
  e.preventDefault();
  e.stopPropagation();
  _dismissCtxMenu();
  const p = currentProject();
  const item = p[type]?.[idx];
  if (!item) return;
  const menu = document.createElement('div');
  menu.id = '_ctx-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:4px 0;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.4);font-size:13px';
  const items = [
    { label: '✎ Edit', action: () => editPersonnel(type, idx) },
    { label: '✉️ Email', action: () => item.email ? window.location.href = `mailto:${item.email}?subject=${encodeURIComponent(p.title)}` : showToast('No email address attached to contact', 'error') },
    { sep: true },
    { label: '🗑 Remove from Project', action: () => removePersonnel(type, idx), danger: true },
  ];
  items.forEach(item => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0';
      menu.appendChild(sep);
      return;
    }
    const el = document.createElement('div');
    el.style.cssText = `padding:7px 14px;cursor:pointer;color:${item.danger ? '#e55' : 'var(--text)'};white-space:nowrap`;
    el.textContent = item.label;
    el.addEventListener('mouseenter', () => el.style.background = 'var(--surface3)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('mousedown', e2 => { e2.stopPropagation(); _dismissCtxMenu(); item.action(); });
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  const mw = 190, mh = menu.offsetHeight || 120;
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => document.addEventListener('mousedown', _dismissCtxMenu, { once: true }), 0);
}

// CAST multi-select
function _updateCastEmailSelBtn() {
  const n = document.querySelectorAll('.cast-cb:checked').length;
  const emailBtn        = document.getElementById('cast-email-sel-btn');
  const castRemoveBtn   = document.getElementById('cast-remove-sel-btn');
  const extrasRemoveBtn = document.getElementById('extras-remove-sel-btn');
  const dropdown        = document.getElementById('cast-bulk-dropdown');
  if (emailBtn)        emailBtn.style.display        = n ? '' : 'none';
  if (castRemoveBtn)   castRemoveBtn.style.display   = n ? '' : 'none';
  if (extrasRemoveBtn) extrasRemoveBtn.style.display = n ? '' : 'none';
  if (dropdown)        dropdown.style.display        = n ? '' : 'none';
}
function removeSelectedPersonnel() {
  const checked = [...document.querySelectorAll('.cast-cb:checked, .crew-cb:checked')];
  if (!checked.length) return;
  showConfirmDialog(`Remove ${checked.length} selected entr${checked.length !== 1 ? 'ies' : 'y'}?`, 'Remove', () => {
    const p = currentProject();
    // Group by type, sort descending so splice indices stay valid
    const byType = {};
    checked.forEach(cb => {
      const t = cb.dataset.type, i = parseInt(cb.dataset.idx);
      if (!byType[t]) byType[t] = [];
      byType[t].push(i);
    });
    for (const [type, indices] of Object.entries(byType)) {
      indices.sort((a, b) => b - a).forEach(i => p[type].splice(i, 1));
    }
    saveStore();
    renderCast(p);
    renderCrew(p);
    showToast(`${checked.length} entr${checked.length !== 1 ? 'ies' : 'y'} removed`, 'info');
  });
}
function _castSelectAll(type, checked) {
  document.querySelectorAll(`.cast-cb[data-type="${type}"]`).forEach(cb=>cb.checked=checked);
  _updateCastEmailSelBtn();
}
function emailSelectedCast() {
  const p = currentProject();
  const emails = [...document.querySelectorAll('.cast-cb:checked')]
    .map(cb=>p[cb.dataset.type][parseInt(cb.dataset.idx)]?.email).filter(Boolean);
  if (!emails.length) { showToast('No email addresses in selection','info'); return; }
  const subject = encodeURIComponent(p.title+' - Cast Communication');
  const body = encodeURIComponent('Hi,\n\nI wanted to reach out regarding '+p.title+'.\n\nBest regards');
  window.location.href = 'mailto:'+emails.join(',')+'?subject='+subject+'&body='+body;
}

// ==================== EXPORT FUNCTIONS ====================

// Helper to create and download a file
function _downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CAST & EXTRAS CSV EXPORT
function exportCastCSV() {
  const p = currentProject();
  if (!p.cast?.length) { showToast('No cast to export', 'info'); return; }
  const csv = 'Name,Role/Character,Number,Email,Notes,Confirmed\n' + p.cast.map(c => `"${(c.name||'').replace(/"/g,'""')}","${(c.role||'').replace(/"/g,'""')}","${c.number||''}","${c.email||''}","${(c.notes||'').replace(/"/g,'""')}","${c.confirmed?'Yes':'No'}"`).join('\n');
  _downloadFile(csv, 'cast.csv', 'text/csv');
}

// EXTRAS CSV EXPORT
function exportExtrasCSV() {
  const p = currentProject();
  if (!p.extras?.length) { showToast('No extras to export', 'info'); return; }
  const csv = 'Name,Role,Number,Email,Notes,Confirmed\n' + p.extras.map(e => `"${(e.name||'').replace(/"/g,'""')}","${(e.role||'').replace(/"/g,'""')}","${e.number||''}","${e.email||''}","${(e.notes||'').replace(/"/g,'""')}","${e.confirmed?'Yes':'No'}"`).join('\n');
  _downloadFile(csv, 'extras.csv', 'text/csv');
}

// CREW CSV EXPORT
function exportCrewCSV() {
  const p = currentProject();
  if (!p.unit?.length) { showToast('No crew to export', 'info'); return; }
  const csv = 'Name,Department,Role,Email,Number,Notes\n' + p.unit.map(u => `"${(u.name||'').replace(/"/g,'""')}","${(u.dept||'').replace(/"/g,'""')}","${(u.role||'').replace(/"/g,'""')}","${u.email||''}","'${u.number||''}","${(u.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'crew.csv', 'text/csv');
}

// EQUIPMENT CSV EXPORT
function exportEquipmentCSV() {
  const p = currentProject();
  const hasEquipment = p.gearList?.some(d => d.categories?.some(c => c.items?.length));
  if (!hasEquipment) { showToast('No equipment to export', 'info'); return; }
  let csv = 'Day,Category,Item,Pre,Post\n';
  p.gearList.forEach(day => {
    day.categories.forEach(cat => {
      cat.items.forEach(i => {
        csv += `"${(day.label||'').replace(/"/g,'""')}","${(cat.name||'').replace(/"/g,'""')}","${(i.name||'').replace(/"/g,'""')}","${i.pre?'Yes':'No'}","${i.post?'Yes':'No'}"\n`;
      });
    });
  });
  _downloadFile(csv, 'equipment.csv', 'text/csv');
}

// LOCATIONS CSV EXPORT
function exportLocationsCSV() {
  const p = currentProject();
  if (!p.locations?.length) { showToast('No locations to export', 'info'); return; }
  const suitLabel = {suitable:'Suitable',possible:'Possibly Suitable',unsuitable:'Unsuitable'};
  const csv = 'Location,Scene,Suitability,Contacted,Availability,Cost/Fee,Accessibility,Recce Done,Decision\n' + p.locations.map(l => `"${((l.location||l.name)||'').replace(/"/g,'""')}","${(l.scene||l.name||'').replace(/"/g,'""')}","${suitLabel[l.suit]||''}","${l.contacted||''}","${l.avail||''}","${l.cost||''}","${l.access||''}","${l.recce||''}","${l.decision||''}"`).join('\n');
  _downloadFile(csv, 'locations.csv', 'text/csv');
}

// PROPS CSV EXPORT
function exportPropsCSV() {
  const p = currentProject();
  if (!p.props?.length) { showToast('No props to export', 'info'); return; }
  const csv = 'Prop,Quantity,Character/s,Scene/s,Location/s,Page/s,Notes\n' + p.props.map(pr => `"${(pr.name||'').replace(/"/g,'""')}","${pr.qty||''}","${pr.chars||''}","${pr.scenes||''}","${pr.locs||''}","${pr.pgs||''}","${(pr.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'props.csv', 'text/csv');
}

// WARDROBE CSV EXPORT
function exportWardrobeCSV() {
  const p = currentProject();
  if (!p.wardrobe?.length) { showToast('No wardrobe items to export', 'info'); return; }
  const csv = 'Item,Character/s,Scene/s,Size,Condition,Location,Notes\n' + p.wardrobe.map(w => `"${(w.name||'').replace(/"/g,'""')}","${w.chars||''}","${w.scenes||''}","${w.size||''}","${w.condition||''}","${w.loc||''}","${(w.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'wardrobe.csv', 'text/csv');
}

// SOUND LOG CSV EXPORT
function exportSoundLogCSV() {
  const p = currentProject();
  if (!p.soundlog?.length) { showToast('No sound log entries to export', 'info'); return; }
  const csv = 'Scene,Shot,Take,Comments,Track 1,Lav,Additional Audio\n' + p.soundlog.map(s => `"${s.scene||''}","${s.shot||''}","${s.take||''}","${(s.comments||'').replace(/"/g,'""')}","${s.track1||''}","${s.lav||''}","${(s.additional||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'soundlog.csv', 'text/csv');
}

// RISK ASSESSMENT CSV EXPORT
function exportRiskCSV() {
  const p = currentProject();
  if (!p.risks?.length) { showToast('No risk assessment entries to export', 'info'); return; }
  const csv = 'Hazard,Who might be harmed & how?,Risk Factor,Control Measures,Further Controls?,New Risk Factor\n' + 
    p.risks.map(r => `"${(r.hazard||'').replace(/"/g,'""')}","${(r.who||'').replace(/"/g,'""')}","${r.factor||''}","${(r.controls||'').replace(/"/g,'""')}","${(r.further||'').replace(/"/g,'""')}","${r.newfactor||''}"`).join('\n');
  _downloadFile(csv, 'risk-assessment.csv', 'text/csv');
}







// ═══════════════════════════════════════════════════════════════
// CONTACT DROPDOWN FOR PERSONNEL MODAL
// ═══════════════════════════════════════════════════════════════

/** Populate the 'Select existing contact' dropdown in the personnel modal */
function _persPopulateContactSelect() {
  const select = document.getElementById('pers-contact-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Select existing contact —</option>';

  // Use ContactAnchor if available — covers all projects
  if (typeof ContactAnchor !== 'undefined') {
    const contacts = ContactAnchor.searchContacts('', 200);
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    contacts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ name: c.name, phone: c.phone || '', email: c.email || '' });
      opt.textContent = c.name + (c.phone ? ' — ' + c.phone : '');
      select.appendChild(opt);
    });
    return;
  }

  // Fallback: scan projects manually
  const seen = new Set();
  const addPerson = (name, phone, email) => {
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const opt = document.createElement('option');
    opt.value = JSON.stringify({ name, phone: phone || '', email: email || '' });
    opt.textContent = name + (phone ? ' — ' + phone : '');
    select.appendChild(opt);
  };
  (store.projects || []).forEach(p => {
    (p.contacts || []).forEach(c => addPerson(c.name, c.phone, c.email));
    (p.cast || []).forEach(r => addPerson(r.name, r.number || r.phone, r.email));
    (p.extras || []).forEach(r => addPerson(r.name, r.number || r.phone, r.email));
    (p.unit || []).forEach(r => addPerson(r.name, r.number || r.phone, r.email));
  });
  (store.contacts || []).forEach(c => addPerson(c.name, c.phone, c.email));
}

/** Handle selection from the 'Select existing contact' dropdown */
function autofillPersonnelFromContact() {
  const select = document.getElementById('pers-contact-select');
  const data = select?.value;
  if (!data) return;

  try {
    const contact = JSON.parse(data);
    document.getElementById('pers-name').value = contact.name || '';
    document.getElementById('pers-number').value = contact.phone || '';
    document.getElementById('pers-email').value = contact.email || '';

    // Show linked badge
    const badge = document.getElementById('_pers-linked-badge');
    if (badge) badge.remove();
    const b = document.createElement('div');
    b.id = '_pers-linked-badge';
    b.style.cssText = 'font-size:11px;color:var(--accent2);margin-top:4px';
    b.innerHTML = `⚭ Linked to contact: <strong>${contact.name}</strong> <button onclick="window._persContactId=null;this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">Unlink</button>`;
    document.getElementById('pers-name').parentElement.appendChild(b);
  } catch (e) {
    console.error('Failed to parse contact data:', e);
  }
}

window._persPopulateContactSelect = _persPopulateContactSelect;
window.autofillPersonnelFromContact = autofillPersonnelFromContact;
window.exportSchedule = exportSchedule;
window._doExport = _doExport;

