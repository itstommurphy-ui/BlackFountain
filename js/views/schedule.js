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
function addScheduleRow() { document.getElementById('sched-edit-idx').value=''; ['time','scene','shot','desc','cast','pages','est'].forEach(f => document.getElementById('sched-'+f).value=''); openModal('modal-schedule'); }
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
  if (idx !== '') p.schedule[parseInt(idx)] = row;
  else p.schedule.push(row);
  saveStore(); closeModal('modal-schedule'); renderSchedule(p);
}

// CAST
function renderCast(p) {
  renderPersonnelTable(p.cast, 'cast-body', 'cast');
  renderPersonnelTable(p.extras, 'extras-body', 'extras');
  const btn = document.getElementById('cast-email-sel-btn');
  if (btn) btn.style.display = 'none';
}
function renderPersonnelTable(list, tbodyId, type) {
  const tbody = document.getElementById(tbodyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No entries</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((m,i) => `
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
  document.getElementById('personnel-type').value = type;
  document.getElementById('personnel-edit-idx').value = '';
  document.getElementById('modal-personnel-title').textContent = 'ADD ' + type.toUpperCase();
  ['name','role','number','email','notes','social'].forEach(f => document.getElementById('pers-'+f).value='');
  document.getElementById('pers-role-select').value = '';
  document.getElementById('pers-role-other').value = '';
  document.getElementById('pers-confirmed').value = 'green';
  _persSetCrewMode(type === 'unit');
  populateContactSelect('pers-contact-select');
  openModal('modal-personnel');
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
  document.getElementById('pers-social').value = m.social||'';
  document.getElementById('pers-confirmed').value = m.confirmed||'green';
  if (m.dept) document.getElementById('pers-dept').value = m.dept;
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
    social: document.getElementById('pers-social').value.trim(),
    confirmed: document.getElementById('pers-confirmed').value,
    dept: document.getElementById('pers-dept').value
  };
  if (idx !== '') p[type][parseInt(idx)] = m;
  else p[type].push(m);
  saveStore(); closeModal('modal-personnel');
  if (type === 'cast' || type === 'extras') renderCast(p);
  else if (type === 'unit') renderCrew(p);
  showToast('Saved', 'success');
}
// removePersonnel defined above near removeCSRow

// CREW
function renderCrew(p) {
  const el = document.getElementById('crew-sections');
  if (!el) return;
  const grouped = {};
  UNIT_DEPTS.forEach(d => grouped[d] = []);
  p.unit.forEach((m,i) => { const d = m.dept||'Other'; if (!grouped[d]) grouped[d]=[]; grouped[d].push({...m,_i:i}); });
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
            <th>Name</th><th>Role</th><th>Number</th><th>Email</th><th>Social</th><th>Confirmed</th><th></th>
          </tr></thead>
          <tbody>
            ${grouped[dept].map(m => `
              <tr onclick="editPersonnel('unit',${m._i})" style="cursor:pointer">
                <td style="width:28px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" class="crew-cb" data-type="unit" data-idx="${m._i}" onchange="_updateCrewEmailSelBtn()"></td>
                <td><strong>${m.name}</strong></td>
                <td>${m.role||'—'}</td><td>${m.number||'—'}</td>
                <td>${m.email||'—'}</td><td>${m.social||'—'}</td>
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

