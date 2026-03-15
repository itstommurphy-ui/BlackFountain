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
}
function renderPersonnelTable(list, tbodyId, type) {
  const tbody = document.getElementById(tbodyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><h4>No entries</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((m,i) => `
    <tr data-ctx="personnel:${type}:${i}">
      <td><strong>${m.name}</strong></td>
      <td>${m.role||'—'}</td>
      <td>${m.number||'—'}</td>
      <td>${m.email||'—'}</td>
      <td>${m.notes||'—'}</td>
      <td><span class="conf-dot conf-${m.confirmed||'green'}" title="${m.confirmed}"></span></td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editPersonnel('${type}',${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removePersonnel('${type}',${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addPersonnel(type) {
  document.getElementById('personnel-type').value = type;
  document.getElementById('personnel-edit-idx').value = '';
  document.getElementById('modal-personnel-title').textContent = 'ADD ' + type.toUpperCase();
  ['name','role','number','email','notes','social'].forEach(f => document.getElementById('pers-'+f).value='');
  document.getElementById('pers-confirmed').value = 'green';
  document.getElementById('pers-dept-group').style.display = (type === 'unit') ? 'block' : 'none';
  document.getElementById('pers-social-group').style.display = (type === 'unit') ? 'block' : 'none';
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
  document.getElementById('pers-dept-group').style.display = (type === 'unit') ? 'block' : 'none';
  document.getElementById('pers-social-group').style.display = (type === 'unit') ? 'block' : 'none';
  openModal('modal-personnel');
}
function savePersonnel() {
  const p = currentProject();
  const type = document.getElementById('personnel-type').value;
  const idx = document.getElementById('personnel-edit-idx').value;
  const name = document.getElementById('pers-name').value.trim();
  if (!name) { showToast('Name required', 'info'); return; }
  const m = {
    name, role: document.getElementById('pers-role').value.trim(),
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
  else if (type === 'unit') renderUnit(p);
  showToast('Saved', 'success');
}
// removePersonnel defined above near removeCSRow

// UNIT LIST
function renderUnit(p) {
  const el = document.getElementById('unit-sections');
  const grouped = {};
  UNIT_DEPTS.forEach(d => grouped[d] = []);
  p.unit.forEach((m,i) => { const d = m.dept||'Other'; if (!grouped[d]) grouped[d]=[]; grouped[d].push({...m,_i:i}); });
  el.innerHTML = UNIT_DEPTS.filter(d => grouped[d].length).map(dept => `
    <div class="team-section">
      <div class="team-section-header">
        ${dept}
        <button class="btn btn-sm" onclick="addUnitMember('${dept}')">+ Add</button>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Role</th><th>Number</th><th>Email</th><th>Social</th><th>Confirmed</th><th></th></tr></thead>
          <tbody>
            ${grouped[dept].map(m => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.role||'—'}</td><td>${m.number||'—'}</td>
                <td>${m.email||'—'}</td><td>${m.social||'—'}</td>
                <td><span class="conf-dot conf-${m.confirmed||'green'}"></span></td>
                <td>
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
}
function addUnitMember(dept) {
  addPersonnel('unit');
  if (dept) setTimeout(() => { document.getElementById('pers-dept').value = dept; }, 50);
}

