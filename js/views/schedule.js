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
  
  ['HTML', 'CSV', 'Text'].forEach(fmt => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:block;width:100%;padding:8px 12px;text-align:left;background:none;border:none;cursor:pointer;color:var(--text)';
    btn.textContent = '📄 ' + fmt;
    btn.onclick = (e) => {
      e.stopPropagation();
      menu.remove();
      _doExport('schedule', fmt, p);
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
    <tr data-ctx="personnel:${type}:${i}" onclick="editPersonnel('${type}',${i})" style="cursor:pointer">
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
        <table class="data-table">
          <thead><tr>
            <th style="width:28px;padding:6px 4px"><input type="checkbox" onchange="_crewSelectAll(this,'${dept.replace(/'/g,"\\'")}')"></th>
            <th onclick="_sortTable('crew','name')" style="cursor:pointer" class="sortable-header">Name <span class="sort-indicator" id="crew-sort-name"></span></th><th onclick="_sortTable('crew','role')" style="cursor:pointer" class="sortable-header">Role <span class="sort-indicator" id="crew-sort-role"></span></th><th>Number</th><th>Email</th><th>Social</th><th>Confirmed</th><th></th>
          </tr></thead>
          <tbody>
            ${grouped[dept].map(m => `
              <tr onclick="editPersonnel('unit',${m._i})" style="cursor:pointer">
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

// Helper to open a new window with HTML content for PDF-like printing
function _openPrintWindow(htmlContent, title) {
  const w = window.open('', '_blank');
  if (!w) { showToast('Pop-up blocked — allow pop-ups and try again', 'info'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:24px;max-width:960px;margin:0 auto}
    h1{font-size:18px;margin-bottom:4px}
    h3{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f0f0f0;padding:8px;text-align:left;font-size:11px;border:1px solid #ccc}
    td{padding:8px;border:1px solid #e0e0e0;font-size:11px}
    tr:nth-child(even){background:#fafafa}
    .no-print{margin-bottom:16px}
    .no-print button{padding:8px 16px;font-size:13px;cursor:pointer}
    @media print{.no-print{display:none}}
  </style></head><body>
    <div class="no-print"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    ${htmlContent}
  </body></html>`);
  w.document.close();
}

// CAST & EXTRAS EXPORT
function exportCastPDF() {
  const p = currentProject();
  if (!p.cast?.length) { showToast('No cast to export', 'info'); return; }
  const rows = p.cast.map(c => `<tr><td>${c.name||''}</td><td>${c.role||''}</td><td>${c.number||''}</td><td>${c.email||''}</td><td>${c.notes||''}</td><td>${c.confirmed?'Yes':'No'}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Cast</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Name</th><th>Role/Character</th><th>Number</th><th>Email</th><th>Notes</th><th>Confirmed</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Cast');
}

function exportCastCSV() {
  const p = currentProject();
  if (!p.cast?.length) { showToast('No cast to export', 'info'); return; }
  const csv = 'Name,Role/Character,Number,Email,Notes,Confirmed\n' + p.cast.map(c => `"${(c.name||'').replace(/"/g,'""')}","${(c.role||'').replace(/"/g,'""')}","${c.number||''}","${c.email||''}","${(c.notes||'').replace(/"/g,'""')}","${c.confirmed?'Yes':'No'}"`).join('\n');
  _downloadFile(csv, 'cast.csv', 'text/csv');
}

function exportExtrasPDF() {
  const p = currentProject();
  if (!p.extras?.length) { showToast('No extras to export', 'info'); return; }
  const rows = p.extras.map(e => `<tr><td>${e.name||''}</td><td>${e.role||''}</td><td>${e.number||''}</td><td>${e.email||''}</td><td>${e.notes||''}</td><td>${e.confirmed?'Yes':'No'}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Supporting Artists (Extras)</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Name</th><th>Role</th><th>Number</th><th>Email</th><th>Notes</th><th>Confirmed</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Extras');
}

function exportExtrasCSV() {
  const p = currentProject();
  if (!p.extras?.length) { showToast('No extras to export', 'info'); return; }
  const csv = 'Name,Role,Number,Email,Notes,Confirmed\n' + p.extras.map(e => `"${(e.name||'').replace(/"/g,'""')}","${(e.role||'').replace(/"/g,'""')}","${e.number||''}","${e.email||''}","${(e.notes||'').replace(/"/g,'""')}","${e.confirmed?'Yes':'No'}"`).join('\n');
  _downloadFile(csv, 'extras.csv', 'text/csv');
}

// CREW EXPORT
function exportCrewPDF() {
  const p = currentProject();
  if (!p.unit?.length) { showToast('No crew to export', 'info'); return; }
  let rows = '';
  p.unit.forEach(u => {
    rows += `<tr><td>${u.name||''}</td><td>${u.dept||''}</td><td>${u.role||''}</td><td>${u.email||''}</td><td>${u.number||''}</td><td>${u.notes||''}</td></tr>`;
  });
  _openPrintWindow(`<h1>${p.title} — Crew</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Name</th><th>Department</th><th>Role</th><th>Email</th><th>Number</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Crew');
}

function exportCrewCSV() {
  const p = currentProject();
  if (!p.unit?.length) { showToast('No crew to export', 'info'); return; }
  const csv = 'Name,Department,Role,Email,Number,Notes\n' + p.unit.map(u => `"${(u.name||'').replace(/"/g,'""')}","${(u.dept||'').replace(/"/g,'""')}","${(u.role||'').replace(/"/g,'""')}","${u.email||''}","${u.number||''}","${(u.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'crew.csv', 'text/csv');
}

// EQUIPMENT EXPORT
function exportEquipmentPDF() {
  const p = currentProject();
  const hasEquipment = p.gearList?.some(d => d.categories?.some(c => c.items?.length));
  if (!hasEquipment) { showToast('No equipment to export', 'info'); return; }
  let html = `<h1>${p.title} — Equipment Checklist</h1><p>Generated: ${new Date().toLocaleDateString()}</p>`;
  p.gearList.forEach((day, dayIdx) => {
    const rows = day.categories.flatMap(cat => 
      cat.items.map(i => `<tr><td>${cat.name||''}</td><td>${i.name||''}</td><td>${i.pre?'✓':'○'}</td><td>${i.post?'✓':'○'}</td></tr>`)
    ).join('');
    if (rows) html += `<h3>${day.label||('Day '+(dayIdx+1))}</h3><table><thead><tr><th>Category</th><th>Item</th><th>Pre</th><th>Post</th></tr></thead><tbody>${rows}</tbody></table>`;
  });
  _openPrintWindow(html, p.title + ' - Equipment');
}

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

// LOCATIONS EXPORT
function exportLocationsPDF() {
  const p = currentProject();
  if (!p.locations?.length) { showToast('No locations to export', 'info'); return; }
  const rows = p.locations.map(l => `<tr><td>${l.name||''}</td><td>${l.scene||''}</td><td>${l.suitability||''}</td><td>${l.contacted?'Yes':'No'}</td><td>${l.availability||''}</td><td>${l.cost||''}</td><td>${l.accessibility||''}</td><td>${l.recce?'Yes':'No'}</td><td>${l.decision||''}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Locations</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Location</th><th>Scene</th><th>Suitability</th><th>Contacted</th><th>Availability</th><th>Cost/Fee</th><th>Accessibility</th><th>Recce Done</th><th>Decision</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Locations');
}

function exportLocationsCSV() {
  const p = currentProject();
  if (!p.locations?.length) { showToast('No locations to export', 'info'); return; }
  const csv = 'Location,Scene,Suitability,Contacted,Availability,Cost/Fee,Accessibility,Recce Done,Decision\n' + p.locations.map(l => `"${(l.name||'').replace(/"/g,'""')}","${l.scene||''}","${l.suitability||''}","${l.contacted?'Yes':'No'}","${l.availability||''}","${l.cost||''}","${l.accessibility||''}","${l.recce?'Yes':'No'}","${l.decision||''}"`).join('\n');
  _downloadFile(csv, 'locations.csv', 'text/csv');
}

// PROPS EXPORT
function exportPropsPDF() {
  const p = currentProject();
  if (!p.props?.length) { showToast('No props to export', 'info'); return; }
  const rows = p.props.map(pr => `<tr><td>${pr.name||''}</td><td>${pr.qty||''}</td><td>${pr.chars||''}</td><td>${pr.scenes||''}</td><td>${pr.locs||''}</td><td>${pr.pgs||''}</td><td>${pr.notes||''}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Props List</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Prop</th><th>Quantity</th><th>Character/s</th><th>Scene/s</th><th>Location/s</th><th>Page/s</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Props');
}

function exportPropsCSV() {
  const p = currentProject();
  if (!p.props?.length) { showToast('No props to export', 'info'); return; }
  const csv = 'Prop,Quantity,Character/s,Scene/s,Location/s,Page/s,Notes\n' + p.props.map(pr => `"${(pr.name||'').replace(/"/g,'""')}","${pr.qty||''}","${pr.chars||''}","${pr.scenes||''}","${pr.locs||''}","${pr.pgs||''}","${(pr.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'props.csv', 'text/csv');
}

// WARDROBE EXPORT
function exportWardrobePDF() {
  const p = currentProject();
  if (!p.wardrobe?.length) { showToast('No wardrobe items to export', 'info'); return; }
  const rows = p.wardrobe.map(w => `<tr><td>${w.name||''}</td><td>${w.chars||''}</td><td>${w.scenes||''}</td><td>${w.size||''}</td><td>${w.condition||''}</td><td>${w.loc||''}</td><td>${w.notes||''}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Wardrobe</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Item</th><th>Character/s</th><th>Scene/s</th><th>Size</th><th>Condition</th><th>Location</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Wardrobe');
}

function exportWardrobeCSV() {
  const p = currentProject();
  if (!p.wardrobe?.length) { showToast('No wardrobe items to export', 'info'); return; }
  const csv = 'Item,Character/s,Scene/s,Size,Condition,Location,Notes\n' + p.wardrobe.map(w => `"${(w.name||'').replace(/"/g,'""')}","${w.chars||''}","${w.scenes||''}","${w.size||''}","${w.condition||''}","${w.loc||''}","${(w.notes||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'wardrobe.csv', 'text/csv');
}

// SOUND LOG EXPORT
function exportSoundLogPDF() {
  const p = currentProject();
  if (!p.soundlog?.length) { showToast('No sound log entries to export', 'info'); return; }
  const rows = p.soundlog.map(s => `<tr><td>${s.scene||''}</td><td>${s.shot||''}</td><td>${s.take||''}</td><td>${s.comments||''}</td><td>${s.track1||''}</td><td>${s.lav||''}</td><td>${s.additional||''}</td></tr>`).join('');
  _openPrintWindow(`<h1>${p.title} — Sound Log</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Scene</th><th>Shot</th><th>Take</th><th>Comments</th><th>Track 1</th><th>Lav</th><th>Additional Audio</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Sound Log');
}

function exportSoundLogCSV() {
  const p = currentProject();
  if (!p.soundlog?.length) { showToast('No sound log entries to export', 'info'); return; }
  const csv = 'Scene,Shot,Take,Comments,Track 1,Lav,Additional Audio\n' + p.soundlog.map(s => `"${s.scene||''}","${s.shot||''}","${s.take||''}","${(s.comments||'').replace(/"/g,'""')}","${s.track1||''}","${s.lav||''}","${(s.additional||'').replace(/"/g,'""')}"`).join('\n');
  _downloadFile(csv, 'soundlog.csv', 'text/csv');
}

// RISK ASSESSMENT EXPORT
function exportRiskPDF() {
  const p = currentProject();
  if (!p.risks?.length) { showToast('No risk assessment entries to export', 'info'); return; }
  const rows = p.risks.map(r => `<tr><td>${r.hazard||''}</td><td>${r.who||''}</td><td>${r.factor||''}</td><td>${r.controls||''}</td><td>${r.further||''}</td><td>${r.newfactor||''}</td></tr>`).join('');
  const meta = p.riskMeta || {};
  _openPrintWindow(`<h1>${p.title} — Risk Assessment</h1>
    <p><strong>Production Manager:</strong> ${meta.pm||''} | <strong>Date of Assessment:</strong> ${meta.date||''} | <strong>Location:</strong> ${meta.location||''}</p>
    <table><thead><tr><th>Hazard</th><th>Who might be harmed & how?</th><th>Risk Factor</th><th>Control Measures</th><th>Further Controls?</th><th>New Risk Factor</th></tr></thead><tbody>${rows}</tbody></table>
    <p><strong>Completed by:</strong> ${meta.signatory||''} | <strong>Date:</strong> ${meta.sigdate||''}</p>`, p.title + ' - Risk Assessment');
}

function exportRiskCSV() {
  const p = currentProject();
  if (!p.risks?.length) { showToast('No risk assessment entries to export', 'info'); return; }
  const csv = 'Hazard,Who might be harmed & how?,Risk Factor,Control Measures,Further Controls?,New Risk Factor\n' + 
    p.risks.map(r => `"${(r.hazard||'').replace(/"/g,'""')}","${(r.who||'').replace(/"/g,'""')}","${r.factor||''}","${(r.controls||'').replace(/"/g,'""')}","${(r.further||'').replace(/"/g,'""')}","${r.newfactor||''}"`).join('\n');
  _downloadFile(csv, 'risk-assessment.csv', 'text/csv');
}

// RELEASE FORMS EXPORT
function exportReleasesPDF() {
  const p = currentProject();
  if (!p.releases?.length) { showToast('No release forms to export', 'info'); return; }
  let rows = '';
  p.releases.forEach(r => {
    rows += `<tr><td>${r.type||''}</td><td>${r.name||''}</td><td>${r.date||''}</td><td>${r.notes||''}</td></tr>`;
  });
  _openPrintWindow(`<h1>${p.title} — Release Forms</h1><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Type</th><th>Name</th><th>Date</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`, p.title + ' - Release Forms');
}

// Helper to convert newlines to <br> tags for proper line break display
function _formatTextWithBreaks(text) {
  if (!text) return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

// PROJECT BRIEF EXPORT
function exportBriefPDF() {
  const p = currentProject();
  if (!p || !p.brief) { showToast('No project brief to export', 'info'); return; }
  
  // Generate clean export HTML without interactive elements
  let html = '';
  
  // Add template info if a template is selected
  if (p.brief.template) {
    const tmpl = BRIEF_TEMPLATES.find(t => t.id === p.brief.template);
    if (tmpl) {
      html += `<p style="font-size:12px;color:#666;margin-bottom:20px">Template: ${tmpl.name}</p>`;
    }
  }
  
  // Add removed fields notice if any
  if (p.brief.removedKeys && p.brief.removedKeys.length > 0) {
    html += `<p style="font-size:11px;color:#888;margin-bottom:16px;font-style:italic">(${p.brief.removedKeys.length} hidden field${p.brief.removedKeys.length !== 1 ? 's' : ''})</p>`;
  }
  
  if (p.brief.template) {
    const tmpl = BRIEF_TEMPLATES.find(t => t.id === p.brief.template);
    if (tmpl) {
      const visibleFields = tmpl.fields.filter(f => !p.brief.removedKeys.includes(f.key));
      visibleFields.forEach(f => {
        const value = (p.brief.fields[f.key] || '').trim();
        html += `<div style="margin-bottom:20px">
          <div style="font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${f.label}</div>
          <div style="font-size:13px;line-height:1.6;padding:8px 0;border-bottom:1px solid #eee">${value ? _formatTextWithBreaks(value) : '<span style="color:#ccc">—</span>'}</div>
        </div>`;
      });
    }
  }
  
  // Custom fields
  if (p.brief.customFields && p.brief.customFields.length > 0) {
    p.brief.customFields.forEach(f => {
      const value = (p.brief.fields[f.key] || '').trim();
      html += `<div style="margin-bottom:20px">
        <div style="font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${f.label}</div>
        <div style="font-size:13px;line-height:1.6;padding:8px 0;border-bottom:1px solid #eee">${value ? _formatTextWithBreaks(value) : '<span style="color:#ccc">—</span>'}</div>
      </div>`;
    });
  }
  
  if (!html) {
    html = '<p style="color:#888;font-style:italic">No content</p>';
  }
  
  _openPrintWindow(`<h1>${p.title} — Project Brief</h1><p>Generated: ${new Date().toLocaleDateString()}</p>${html}`, p.title + ' - Project Brief');
}

// Helper to format pages in eighths (film industry standard)
function _formatPagesEighths(scene) {
  const lineCount = scene.lineCount || 1;
  const eighths = Math.max(1, Math.round(lineCount / 6.75));
  return eighths >= 8 ? Math.floor(eighths/8) + '-' + (eighths%8||'0') + '/8' : eighths + '/8';
}

// STRIPBOARD EXPORT
function exportStripboardPDF() {
  const p = currentProject();
  const stripboardContent = document.getElementById('stripboard-content');
  if (!stripboardContent) { showToast('No stripboard to export', 'info'); return; }
  
  // Generate clean print-friendly HTML
  let html = '';
  const sb = p.stripboard || { days: [] };
  const data = _sbBuildSceneData(p);
  const allKeys = Object.keys(data);
  const scheduledKeys = new Set((sb.days || []).flatMap(d => d.sceneKeys || []));
  const unscheduled = allKeys.filter(k => !scheduledKeys.has(k));
  
  // Summary stats - calculate total pages in eighths
  const scheduledSc = scheduledKeys.size;
  let totalEighths = 0;
  allKeys.forEach(k => {
    if (data[k]) {
      const lineCount = data[k].scene.lineCount || 1;
      totalEighths += Math.max(1, Math.round(lineCount / 6.75));
    }
  });
  const totalPages = totalEighths >= 8 ? Math.floor(totalEighths/8) + '-' + (totalEighths%8||'0') + '/8' : totalEighths + '/8';
  html += `<p style="font-size:12px;color:#666;margin-bottom:20px">${scheduledSc} of ${allKeys.length} scenes scheduled · ${sb.days.length} day${sb.days.length !== 1 ? 's' : ''} · ~${totalPages} pages</p>`;
  
  // Unscheduled scenes
  if (unscheduled.length > 0) {
    html += `<h3 style="font-size:14px;margin:20px 0 10px;border-bottom:1px solid #ccc;padding-bottom:4px">Unscheduled (${unscheduled.length})</h3>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:20px">`;
    html += `<thead><tr><th style="background:#f0f0f0;padding:8px;text-align:left;font-size:11px;border:1px solid #ccc">Scene</th><th style="background:#f0f0f0;padding:8px;text-align:left;font-size:11px;border:1px solid #ccc">Description</th><th style="background:#f0f0f0;padding:8px;text-align:left;font-size:11px;border:1px solid #ccc">Pages</th></tr></thead><tbody>`;
    unscheduled.forEach(key => {
      const d = data[key];
      const pages = d ? _formatPagesEighths(d.scene) : '1/8';
      html += `<tr><td style="padding:8px;border:1px solid #e0e0e0;font-size:11px">${key}</td><td style="padding:8px;border:1px solid #e0e0e0;font-size:11px">${d ? _sbEsc(d.scene.heading) : ''}</td><td style="padding:8px;border:1px solid #e0e0e0;font-size:11px">${pages}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  
  // Scheduled days
  if (sb.days && sb.days.length > 0) {
    html += `<h3 style="font-size:14px;margin:20px 0 10px;border-bottom:1px solid #ccc;padding-bottom:4px">Shoot Days</h3>`;
    sb.days.forEach((day, idx) => {
      const dayScenes = day.sceneKeys || [];
      let dayEighths = 0;
      dayScenes.forEach(k => {
        if (data[k]) {
          const lineCount = data[k].scene.lineCount || 1;
          dayEighths += Math.max(1, Math.round(lineCount / 6.75));
        }
      });
      const dayPages = dayEighths >= 8 ? Math.floor(dayEighths/8) + '-' + (dayEighths%8||'0') + '/8' : dayEighths + '/8';
      html += `<div style="margin-bottom:24px">`;
      html += `<div style="font-size:13px;font-weight:600;margin-bottom:8px">Day ${idx + 1}: ${_sbEsc(day.label)} ${day.date ? '(' + day.date + ')' : ''} — ${dayScenes.length} scenes, ~${dayPages} pages</div>`;
      if (dayScenes.length > 0) {
        html += `<table style="width:100%;border-collapse:collapse">`;
        html += `<thead><tr><th style="background:#f0f0f0;padding:6px;text-align:left;font-size:10px;border:1px solid #ccc;width:60px">Scene</th><th style="background:#f0f0f0;padding:6px;text-align:left;font-size:10px;border:1px solid #ccc">Description</th><th style="background:#f0f0f0;padding:6px;text-align:left;font-size:10px;border:1px solid #ccc;width:50px">Pages</th></tr></thead><tbody>`;
        dayScenes.forEach(key => {
          const d = data[key];
          const pages = d ? _formatPagesEighths(d.scene) : '1/8';
          html += `<tr><td style="padding:6px;border:1px solid #e0e0e0;font-size:11px">${key}</td><td style="padding:6px;border:1px solid #e0e0e0;font-size:11px">${d ? _sbEsc(d.scene.heading) : ''}</td><td style="padding:6px;border:1px solid #e0e0e0;font-size:11px">${pages}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<p style="color:#888;font-style:italic;font-size:11px">No scenes scheduled</p>`;
      }
      html += `</div>`;
    });
  }
  
  if (!html) {
    html = '<p style="color:#888;font-style:italic">No stripboard data</p>';
  }
  
  _openPrintWindow(`<h1>${p.title} — Stripboard</h1><p>Generated: ${new Date().toLocaleDateString()}</p>${html}`, p.title + ' - Stripboard');
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

