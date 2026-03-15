// BUDGET
const ATL_DEPTS = ['Story & Rights','Producers','Director','Cast'];
const BTL_DEPTS = ['Production Design','Art Department','Camera','Lighting & Grip','Sound','Wardrobe','Makeup & Hair','Locations','Transport','Catering','Post-Production','VFX','Music','Marketing','Insurance & Legal','Other'];
const DEPT_COLORS = ['#F5E642','#52BE80','#FF8C42','#D4AC0D','#FF8FAB','#E74C3C','#9B59B6','#C39BD3','#2E86C1','#1ABC9C','#E67E22','#EC407A'];
const DEPT_TEXT   = ['#1a1a1a','#fff','#fff','#fff','#1a1a1a','#fff','#fff','#1a1a1a','#fff','#fff','#fff','#fff'];

function deptPillStyle(dept) {
  let h = 0;
  for (let i = 0; i < dept.length; i++) h = ((h * 31) + dept.charCodeAt(i)) >>> 0;
  const idx = h % DEPT_COLORS.length;
  return `background:${DEPT_COLORS[idx]};color:${DEPT_TEXT[idx]}`;
}

function fmtMoney(n) { return '£' + (parseFloat(n)||0).toFixed(2); }

function renderBudgetSection(lines, sectionId, sectionLabel, sectionClass, addFn) {
  const el = document.getElementById(sectionId);
  const est = lines.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const act = lines.filter(b => b.actual !== '' && b.actual != null).reduce((s,b) => s + (parseFloat(b.actual)||0), 0);
  const hasActual = lines.some(b => b.actual !== '' && b.actual != null);

  let rows = '';
  if (!lines.length) {
    rows = `<tr><td colspan="8" style="padding:28px;text-align:center;color:var(--text3);font-size:12px">No ${sectionLabel} lines yet — click "+ ${sectionLabel.includes('Above')?'ATL':'BTL'} Line" to add one</td></tr>`;
  } else {
    rows = lines.map(b => {
      const p = currentProject();
      const i = p.budget.indexOf(b);
      const lineEst = (parseFloat(b.rate)||0) * (parseFloat(b.qty)||1);
      const lineAct = (b.actual !== '' && b.actual != null) ? parseFloat(b.actual)||0 : null;
      const lineVar = lineAct !== null ? lineAct - lineEst : null;
      const varClass = lineVar === null ? 'variance-zero' : lineVar > 0 ? 'variance-pos' : lineVar < 0 ? 'variance-neg' : 'variance-zero';
      return `<tr data-ctx="budget:${i}">
        <td><span class="dept-pill" style="${deptPillStyle(b.dept||'Other')}">${(b.dept||'Other').replace(/</g,'&lt;')}</span></td>
        <td style="color:var(--text)">${(b.desc||'—').replace(/</g,'&lt;')}</td>
        <td class="num">${b.rate ? fmtMoney(b.rate) : '—'}</td>
        <td class="num">${b.qty != null && b.qty !== '' ? b.qty : '1'}</td>
        <td class="num">${fmtMoney(lineEst)}</td>
        <td class="${varClass}">${lineAct !== null ? fmtMoney(lineAct) : '<span style="opacity:0.35">—</span>'}</td>
        <td class="${varClass}">${lineVar !== null ? (lineVar >= 0 ? '+' : '') + fmtMoney(lineVar) : '<span style="opacity:0.35">—</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-ghost" onclick="editBudgetLine(${i})" title="Edit">✎</button>
          <button class="btn btn-sm btn-ghost btn-danger" onclick="removeBudgetLine(${i})" title="Delete">✕</button>
        </td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="budget-section-head ${sectionClass}">
      <span>${sectionLabel}</span>
      <span style="font-size:10px;opacity:0.7">${lines.length} line${lines.length!==1?'s':''}</span>
    </div>
    <table class="budget-table">
      <thead><tr>
        <th>Department</th><th>Description</th>
        <th class="num">Rate</th><th class="num">Qty</th>
        <th class="num">Estimated</th><th class="num">Actual</th><th class="num">Variance</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
      ${lines.length ? `<tfoot><tr class="budget-total-row">
        <td colspan="4" style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6">${sectionLabel} Total</td>
        <td class="num">${fmtMoney(est)}</td>
        <td class="num">${hasActual ? fmtMoney(act) : '—'}</td>
        <td class="num ${est && hasActual ? (act-est > 0 ? 'variance-pos' : act-est < 0 ? 'variance-neg' : 'variance-zero') : ''}">${hasActual && est ? (act-est >= 0 ? '+' : '') + fmtMoney(act-est) : '—'}</td>
        <td></td>
      </tr></tfoot>` : ''}
    </table>`;
}

function renderBudget(p) {
  if (!p.budget) p.budget = [];
  const atl = p.budget.filter(b => b.section === 'atl');
  const btl = p.budget.filter(b => b.section !== 'atl');

  renderBudgetSection(atl, 'budget-atl-section', 'Above The Line', 'atl', 'atl');
  renderBudgetSection(btl, 'budget-btl-section', 'Below The Line', 'btl', 'btl');

  const atlEst = atl.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const btlEst = btl.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const atlAct = atl.filter(b=>b.actual!==''&&b.actual!=null).reduce((s,b)=>s+(parseFloat(b.actual)||0),0);
  const btlAct = btl.filter(b=>b.actual!==''&&b.actual!=null).reduce((s,b)=>s+(parseFloat(b.actual)||0),0);
  const totalEst = atlEst + btlEst;
  const hasAct = p.budget.some(b=>b.actual!==''&&b.actual!=null);
  const totalAct = atlAct + btlAct;
  const variance = totalAct - totalEst;
  const varColor = variance > 0 ? 'var(--red)' : variance < 0 ? 'var(--green)' : 'var(--text2)';

  document.getElementById('budget-summary-bar').innerHTML = `
    <div class="bsb-card atl"><div class="bsb-label">ATL Estimated</div><div class="bsb-amount">${fmtMoney(atlEst)}</div></div>
    <div class="bsb-card btl"><div class="bsb-label">BTL Estimated</div><div class="bsb-amount">${fmtMoney(btlEst)}</div></div>
    <div class="bsb-card grand"><div class="bsb-label">Total Estimated</div><div class="bsb-amount">${fmtMoney(totalEst)}</div></div>
    ${hasAct ? `<div class="bsb-card grand"><div class="bsb-label">Total Actual</div><div class="bsb-amount">${fmtMoney(totalAct)}</div></div>
    <div class="bsb-card"><div class="bsb-label">Variance</div><div class="bsb-amount" style="color:${varColor}">${variance>=0?'+':''}${fmtMoney(variance)}</div></div>` : ''}`;
}

function updateBudgetEstPreview() {
  const rate = parseFloat(document.getElementById('bud-rate').value) || 0;
  const qty  = parseFloat(document.getElementById('bud-qty').value)  || 1;
  const est  = rate * qty;
  const el   = document.getElementById('bud-est-preview');
  el.textContent = est > 0 ? `= ${fmtMoney(est)} estimated` : '';
}

function addBudgetLine(section) {
  document.getElementById('budget-edit-idx').value = '';
  document.getElementById('bud-section').value = section || 'btl';
  document.getElementById('bud-dept').value = '';
  document.getElementById('bud-desc').value = '';
  document.getElementById('bud-rate').value = '';
  document.getElementById('bud-qty').value = '';
  document.getElementById('bud-actual').value = '';
  document.getElementById('bud-notes').value = '';
  document.getElementById('bud-est-preview').textContent = '';
  document.getElementById('budget-modal-title').textContent = section === 'atl' ? 'ADD ATL LINE' : 'ADD BTL LINE';
  const depts = section === 'atl' ? ATL_DEPTS : BTL_DEPTS;
  document.getElementById('bud-dept-list').innerHTML = depts.map(d => `<option value="${d}">`).join('');
  openModal('modal-budget');
}

function editBudgetLine(i) {
  const b = currentProject().budget[i];
  document.getElementById('budget-edit-idx').value = i;
  document.getElementById('bud-section').value = b.section || 'btl';
  document.getElementById('bud-dept').value = b.dept || '';
  document.getElementById('bud-desc').value = b.desc || '';
  document.getElementById('bud-rate').value = b.rate || '';
  document.getElementById('bud-qty').value = b.qty || '';
  document.getElementById('bud-actual').value = b.actual != null ? b.actual : '';
  document.getElementById('bud-notes').value = b.notes || '';
  document.getElementById('budget-modal-title').textContent = 'EDIT BUDGET LINE';
  const section = b.section || 'btl';
  const depts = section === 'atl' ? ATL_DEPTS : BTL_DEPTS;
  document.getElementById('bud-dept-list').innerHTML = depts.map(d => `<option value="${d}">`).join('');
  updateBudgetEstPreview();
  openModal('modal-budget');
}

function removeBudgetLine(i) {
  showConfirmDialog('Remove this budget line?', 'Remove', () => {
    const p = currentProject();
    p.budget.splice(i, 1);
    saveStore();
    renderBudget(p);
  });
}

function saveBudgetLine() {
  const p = currentProject();
  const actualVal = document.getElementById('bud-actual').value;
  const b = {
    section: document.getElementById('bud-section').value || 'btl',
    dept:    document.getElementById('bud-dept').value || 'Other',
    desc:    document.getElementById('bud-desc').value,
    rate:    document.getElementById('bud-rate').value,
    qty:     document.getElementById('bud-qty').value || 1,
    actual:  actualVal !== '' ? actualVal : null,
    notes:   document.getElementById('bud-notes').value,
  };
  const idx = document.getElementById('budget-edit-idx').value;
  if (idx !== '') p.budget[parseInt(idx)] = b; else p.budget.push(b);
  saveStore();
  closeModal('modal-budget');
  renderBudget(p);
  showToast('Saved', 'success');
}

// EQUIPMENT
function renderEquipment(p) {
  if (!p.equipment || typeof p.equipment !== 'object') p.equipment = {};
  const el = document.getElementById('equip-grid');
  el.innerHTML = EQUIP_CATEGORIES.map(cat => {
    const items = p.equipment[cat] || [];
    return `
      <div class="equip-section">
        <h4>${cat}</h4>
        ${items.map((item,i) => `
          <div class="equip-item">
            <div class="equip-check${item.checked?' checked':''}" onclick="toggleEquip('${cat}',${i})"></div>
            <span class="equip-item-name${item.checked?' checked':''}">${item.name}</span>
            <button style="margin-left:auto;background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px" onclick="removeEquipItem('${cat}',${i})">✕</button>
          </div>
        `).join('')}
        <div style="margin-top:8px">
          <button class="btn btn-sm btn-ghost" style="width:100%;font-size:11px" onclick="quickAddEquip('${cat}')">+ Add item</button>
        </div>
      </div>
    `;
  }).join('');
}
function toggleEquip(cat,i) {
  const p=currentProject();
  if (!p.equipment[cat]) p.equipment[cat]=[];
  p.equipment[cat][i].checked = !p.equipment[cat][i].checked;
  saveStore(); renderEquipment(p);
}
function removeEquipItem(cat,i) {
  showConfirmDialog('Remove this equipment item?', 'Remove', () => {
    const p=currentProject();
    p.equipment[cat].splice(i,1);
    saveStore(); renderEquipment(p);
  });
}
function quickAddEquip(cat) {
  document.getElementById('equip-cat').value=cat;
  document.getElementById('equip-name').value='';
  openModal('modal-equip');
}
function addEquipItem() { document.getElementById('equip-name').value=''; openModal('modal-equip'); }
function saveEquipItem() {
  const p=currentProject();
  const cat=document.getElementById('equip-cat').value;
  const name=document.getElementById('equip-name').value.trim();
  if(!name){showToast('Item name required','info');return;}
  if(!p.equipment[cat]) p.equipment[cat]=[];
  p.equipment[cat].push({name,checked:false});
  saveStore(); closeModal('modal-equip'); renderEquipment(p); showToast('Item added','success');
}
function resetEquipChecks() {
  const p=currentProject();
  Object.keys(p.equipment).forEach(cat => p.equipment[cat].forEach(i=>i.checked=false));
  saveStore(); renderEquipment(p); showToast('Checks reset','info');
}

