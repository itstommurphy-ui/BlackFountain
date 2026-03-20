// ============================================================================
// SCHEDULE SECTION - All related code consolidated
// ============================================================================

// ----------------------------------------------------------------------------
// FROM: js/views/schedule.js
// ----------------------------------------------------------------------------

// SCHEDULE
function renderSchedule(p) {
  const tbody = document.getElementById('schedule-body');
  if (!p.schedule.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state" style="padding:30px"><div class="icon">🕐</div><h4>No shots scheduled</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = p.schedule.map((s,i) => `
    <tr data-ctx="schedule:${i}">
      <td>${s.time||'—'}</td><td>${s.scene||'—'}</td><td>${s.shot||'—'}</td>
      <td><span class="tag">${s.type||'—'}</span></td>
      <td>${s.desc||'—'}</td><td>${s.cast||'—'}</td>
      <td>${s.pages||'—'}</td><td>${s.est||'—'}</td>
      <td><button class="btn btn-sm btn-ghost btn-danger" onclick="removeScheduleRow(${i})">✕</button></td>
    </tr>
  `).join('');
}

function addScheduleRow() { 
  document.getElementById('sched-edit-idx').value=''; 
  ['time','scene','shot','desc','cast','pages','est'].forEach(f => document.getElementById('sched-'+f).value=''); 
  openModal('modal-schedule'); 
}

function removeScheduleRow(i) { 
  showConfirmDialog('Remove this schedule entry?', 'Remove', () => { 
    const p=currentProject(); 
    p.schedule.splice(i,1); 
    saveStore(); 
    renderSchedule(p); 
  }); 
}

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
  if (idx !== '') p.schedule[parseInt(idx)] = row;
  else p.schedule.push(row);
  saveStore(); closeModal('modal-schedule'); renderSchedule(p);
}

// ----------------------------------------------------------------------------
// FROM: js/views/production-plan.js (renderSection for schedule)
// ----------------------------------------------------------------------------

// In function renderSection(name):
// else if (name === 'schedule') renderSchedule(p);


// ----------------------------------------------------------------------------
// FROM: js/views/callsheet-html.js (modal handler)
// ----------------------------------------------------------------------------

// In the modals object:
// 'modal-schedule':     () => saveScheduleRow(),


// ----------------------------------------------------------------------------
// FROM: js/init.js (context menu for schedule)
// ----------------------------------------------------------------------------

// In function showContextMenu(args):
// case 'schedule':
//   items = [
//     { label: 'Delete', icon: '🗑', danger: true, fn: () => removeScheduleRow(+args[0]) }
//   ]; break;


// ----------------------------------------------------------------------------// FROM: js/settings.js (default data structure)
// ----------------------------------------------------------------------------

// In createNewProject():
// schedule: [],

// In _ensureProjectData():
// if (!p.schedule) p.schedule = [];


// ----------------------------------------------------------------------------
// FROM: html/views/project.html (Schedule section HTML)
// ----------------------------------------------------------------------------

/*
<!-- SECTION: SCHEDULE -->
<div id="section-schedule" style="display:none">
  <button class="btn-back" onclick="showSection('overview')">← Back to Overview</button>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 class="section-heading">ESTIMATED SCHEDULE</h3>
    <button class="btn btn-primary btn-sm" onclick="addScheduleRow()">+ Add Entry</button>
  </div>
  <div class="table-container">
    <table class="data-table" id="schedule-table">
      <thead><tr>
        <th>Time</th><th>Scene</th><th>Shot</th><th>Shot Type</th>
        <th>Description</th><th>Cast</th><th>Page/s</th><th>Est. (mins)</th><th></th>
      </tr></thead>
      <tbody id="schedule-body"></tbody>
    </table>
  </div>
</div>
*/

// ----------------------------------------------------------------------------
// FROM: html/views/project.html (Navigation tab)
// ----------------------------------------------------------------------------

/*
<div class="section-tab" onclick="showSection('schedule')">Schedule</div>
*/

// ----------------------------------------------------------------------------
// DATA STRUCTURE
// ----------------------------------------------------------------------------

/*
The schedule is stored in project.schedule as an array of objects:

{
  time: string,    // Call time (e.g., "6:00 AM")
  scene: string,  // Scene number (e.g., "1A", "24")
  shot: string,   // Shot number (e.g., "1", "2A")
  type: string,   // Shot type (e.g., "Wide", "Close-up", "Medium")
  desc: string,   // Description of the shot
  cast: string,   // Cast involved in this shot
  pages: string,  // Page count (e.g., "1/8")
  est: string     // Estimated duration in minutes
}
*/

// ----------------------------------------------------------------------------
// SCHEDULE MODAL (from callsheet-html.js or similar)
// ----------------------------------------------------------------------------

/*
The schedule modal (modal-schedule) should contain:
- sched-edit-idx: hidden input for edit index
- sched-time: input for time
- sched-scene: input for scene
- sched-shot: input for shot
- sched-type: select for shot type
- sched-desc: textarea for description
- sched-cast: input for cast
- sched-pages: input for pages
- sched-est: input for estimated minutes

Save button calls: saveScheduleRow()
*/
