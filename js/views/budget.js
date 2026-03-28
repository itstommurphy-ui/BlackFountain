// BUDGET
const _collapsedBudgetDepts = new Set();
const _collapsedBudgetSections = new Set();
let _budDragSrcIdx = null;
let _budDragSrcSection = null;

function _budDragStart(e, i, section) {
  _budDragSrcIdx = i;
  _budDragSrcSection = section;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', i); // required for Firefox
  setTimeout(() => document.querySelector(`tr[data-ctx="budget:${i}"]`)?.classList.add('bud-dragging'), 0);
}

function _budDragEnd() {
  document.querySelectorAll('.bud-dragging,.bud-drag-over').forEach(el => el.classList.remove('bud-dragging','bud-drag-over'));
  _budDragSrcIdx = null;
  _budDragSrcSection = null;
}

function _budDragOver(e, section) {
  if (_budDragSrcSection !== section) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tr = e.target.closest('tr[data-ctx^="budget:"]');
  document.querySelectorAll('.bud-drag-over').forEach(el => el.classList.remove('bud-drag-over'));
  if (tr) tr.classList.add('bud-drag-over');
}

function _budDrop(e, i, section) {
  e.preventDefault();
  document.querySelectorAll('.bud-dragging,.bud-drag-over').forEach(el => el.classList.remove('bud-dragging','bud-drag-over'));
  if (_budDragSrcIdx === null || _budDragSrcIdx === i || _budDragSrcSection !== section) return;
  const p = currentProject();
  const [item] = p.budget.splice(_budDragSrcIdx, 1);
  p.budget.splice(i > _budDragSrcIdx ? i - 1 : i, 0, item);
  _budDragSrcIdx = null;
  _budDragSrcSection = null;
  saveStore();
  renderBudget(p);
}

function toggleBudgetSection(sectionClass) {
  if (_collapsedBudgetSections.has(sectionClass)) _collapsedBudgetSections.delete(sectionClass);
  else _collapsedBudgetSections.add(sectionClass);
  renderBudget(currentProject());
}

function toggleBudgetLock(sec) {
  const p = currentProject();
  if (!p.budgetLocked) p.budgetLocked = {};
  p.budgetLocked[sec] = !p.budgetLocked[sec];
  saveStore();
  renderBudget(p);
  showToast(p.budgetLocked[sec] ? `${sec.toUpperCase()} estimates locked` : `${sec.toUpperCase()} unlocked`, 'info');
}

function cycleBudgetPayStatus(i) {
  const p = currentProject();
  const b = p.budget[i];
  if (!b.payStatus) b.payStatus = 'invoiced';
  else if (b.payStatus === 'invoiced') b.payStatus = 'paid';
  else b.payStatus = null;
  saveStore();
  renderBudget(p);
}

let _budCurrencySymbol = '£';

const BUDGET_TEMPLATES = {
  shortfilm: {
    label: 'Short Film',
    desc: 'Indie / micro-budget short — cast, small crew, basic equipment',
    lines: [
      { section:'atl', dept:'Story & Rights', desc:'Script / Story Rights', type:'cash' },
      { section:'atl', dept:'Producers',      desc:'Producer Fee',          type:'deferred' },
      { section:'atl', dept:'Director',       desc:'Director Fee',          type:'deferred' },
      { section:'atl', dept:'Cast',           desc:'Lead Actor',            type:'deferred' },
      { section:'atl', dept:'Cast',           desc:'Supporting Actor',      type:'deferred' },
      { section:'btl', dept:'Camera',             desc:'Director of Photography', type:'deferred' },
      { section:'btl', dept:'Camera',             desc:'Camera Equipment Hire',   type:'cash' },
      { section:'btl', dept:'Lighting & Grip',    desc:'Lighting Package',         type:'cash' },
      { section:'btl', dept:'Sound',              desc:'Sound Recordist',          type:'deferred' },
      { section:'btl', dept:'Sound',              desc:'Sound Equipment Hire',     type:'cash' },
      { section:'btl', dept:'Production Design',  desc:'Production Designer',      type:'deferred' },
      { section:'btl', dept:'Production Design',  desc:'Set Dressing & Props',     type:'cash' },
      { section:'btl', dept:'Wardrobe',           desc:'Costume / Wardrobe',       type:'cash' },
      { section:'btl', dept:'Makeup & Hair',      desc:'Makeup & Hair Artist',     type:'cash' },
      { section:'btl', dept:'Locations',          desc:'Location Fees',            type:'cash' },
      { section:'btl', dept:'Transport',          desc:'Vehicle Hire / Fuel',      type:'cash' },
      { section:'btl', dept:'Catering',           desc:'Catering (per shoot day)', type:'cash' },
      { section:'btl', dept:'Post-Production',    desc:'Editor',                   type:'deferred' },
      { section:'btl', dept:'Post-Production',    desc:'Colour Grade',             type:'cash' },
      { section:'btl', dept:'Post-Production',    desc:'Sound Mix & Mastering',    type:'cash' },
      { section:'btl', dept:'Music',              desc:'Score / Music Licensing',  type:'cash' },
      { section:'btl', dept:'Insurance & Legal',  desc:'Production Insurance',     type:'cash' },
    ]
  },
  musicvideo: {
    label: 'Music Video',
    desc: 'Director, DP, small crew, one-to-two day shoot',
    lines: [
      { section:'atl', dept:'Director',      desc:'Director Fee',               type:'cash' },
      { section:'atl', dept:'Producers',     desc:'Producer / Line Producer',   type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Director of Photography',    type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Camera Package (per day)',   type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Focus Puller',               type:'cash' },
      { section:'btl', dept:'Lighting & Grip',   desc:'Gaffer',                     type:'cash' },
      { section:'btl', dept:'Lighting & Grip',   desc:'Lighting & Grip Package',    type:'cash' },
      { section:'btl', dept:'Sound',             desc:'Playback Operator',          type:'cash' },
      { section:'btl', dept:'Production Design', desc:'Art Director',               type:'cash' },
      { section:'btl', dept:'Production Design', desc:'Set Build / Dressing',       type:'cash' },
      { section:'btl', dept:'Makeup & Hair',     desc:'Makeup & Hair Artist',       type:'cash' },
      { section:'btl', dept:'Wardrobe',          desc:'Stylist',                    type:'cash' },
      { section:'btl', dept:'Locations',         desc:'Location Fee',               type:'cash' },
      { section:'btl', dept:'Transport',         desc:'Equipment Transport',        type:'cash' },
      { section:'btl', dept:'Catering',          desc:'Crew Catering',              type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Edit',                       type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Colour Grade',               type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Online / VFX',               type:'cash' },
    ]
  },
  documentary: {
    label: 'Documentary',
    desc: 'Interview-led or observational doc, small team',
    lines: [
      { section:'atl', dept:'Director',      desc:'Director',                    type:'cash' },
      { section:'atl', dept:'Producers',     desc:'Executive Producer',          type:'cash' },
      { section:'atl', dept:'Story & Rights',desc:'Research / Archive Clearance',type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Camera Operator / DP',        type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Camera Package',              type:'cash' },
      { section:'btl', dept:'Sound',             desc:'Sound Recordist',             type:'cash' },
      { section:'btl', dept:'Sound',             desc:'Sound Equipment',             type:'cash' },
      { section:'btl', dept:'Locations',         desc:'Access Fees / Permits',       type:'cash' },
      { section:'btl', dept:'Transport',         desc:'Travel & Accommodation',      type:'cash' },
      { section:'btl', dept:'Catering',          desc:'Crew Catering',               type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Editor',                      type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Colour Grade',                type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Sound Mix',                   type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Subtitles / Closed Captions', type:'cash' },
      { section:'btl', dept:'Music',             desc:'Music Licensing',             type:'cash' },
      { section:'btl', dept:'Insurance & Legal', desc:'E&O Insurance',               type:'cash' },
    ]
  },
  commercial: {
    label: 'Commercial / Ad',
    desc: 'Agency-commissioned, professional crew',
    lines: [
      { section:'atl', dept:'Director',      desc:'Director Fee',              type:'cash' },
      { section:'atl', dept:'Producers',     desc:'Executive Producer',        type:'cash' },
      { section:'atl', dept:'Producers',     desc:'Line Producer',             type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Director of Photography',   type:'cash' },
      { section:'btl', dept:'Camera',            desc:'Camera Package (per day)',  type:'cash' },
      { section:'btl', dept:'Camera',            desc:'1st AC / Focus Puller',     type:'cash' },
      { section:'btl', dept:'Lighting & Grip',   desc:'Gaffer',                    type:'cash' },
      { section:'btl', dept:'Lighting & Grip',   desc:'Grip',                      type:'cash' },
      { section:'btl', dept:'Lighting & Grip',   desc:'Lighting Package',          type:'cash' },
      { section:'btl', dept:'Sound',             desc:'Production Sound Mixer',    type:'cash' },
      { section:'btl', dept:'Production Design', desc:'Production Designer',       type:'cash' },
      { section:'btl', dept:'Production Design', desc:'Set Build',                 type:'cash' },
      { section:'btl', dept:'Makeup & Hair',     desc:'Makeup Artist',             type:'cash' },
      { section:'btl', dept:'Wardrobe',          desc:'Stylist',                   type:'cash' },
      { section:'btl', dept:'Locations',         desc:'Location Fee',              type:'cash' },
      { section:'btl', dept:'Locations',         desc:'Location Manager',          type:'cash' },
      { section:'btl', dept:'Transport',         desc:'Vehicles & Equipment',      type:'cash' },
      { section:'btl', dept:'Catering',          desc:'Crew Catering (per day)',   type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Offline Edit',              type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Online / VFX',              type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Colour Grade',              type:'cash' },
      { section:'btl', dept:'Post-Production',   desc:'Sound Design & Mix',        type:'cash' },
      { section:'btl', dept:'Insurance & Legal', desc:'Production Insurance',      type:'cash' },
    ]
  },
};

const CURRENCY_OPTIONS = [
  { symbol: '£',   label: '£  GBP — British Pound' },
  { symbol: '$',   label: '$  USD — US Dollar' },
  { symbol: '€',   label: '€  EUR — Euro' },
  { symbol: 'CA$', label: 'CA$ — Canadian Dollar' },
  { symbol: 'AU$', label: 'AU$ — Australian Dollar' },
  { symbol: '¥',   label: '¥  JPY — Japanese Yen' },
  { symbol: '₹',   label: '₹  INR — Indian Rupee' },
];

let _budgetSort = { atl: { col: null, dir: 1 }, btl: { col: null, dir: 1 } };
let _budShowPct  = false;
let _budDeptFilter = null;

function _setBudgetSort(col, sec) {
  const s = _budgetSort[sec];
  if (s.col === col) {
    if (s.dir === 1) { s.dir = -1; }
    else { s.col = null; s.dir = 1; }
  } else {
    s.col = col; s.dir = 1;
  }
  renderBudget(currentProject());
}
function toggleBudgetPct() {
  _budShowPct = !_budShowPct;
  renderBudget(currentProject());
}
function _setBudgetDeptFilter(dept) {
  _budDeptFilter = _budDeptFilter === dept ? null : dept;
  renderBudget(currentProject());
}

function _editBudgetCell(td, i, field) {
  const p = currentProject();
  const b = p.budget[i];
  const current = field === 'actual'
    ? (b.actual != null && b.actual !== '' ? b.actual : '')
    : (b[field] != null ? b[field] : '');
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.value = current;
  inp.className = 'bud-cell-input';
  inp.min = 0;
  inp.step = field === 'qty' ? 0.5 : 0.01;
  inp.placeholder = field === 'actual' ? 'actual' : '0';
  td.innerHTML = '';
  td.appendChild(inp);
  inp.focus();
  inp.select();
  let done = false;
  const save = () => {
    if (done) return; done = true;
    p.budget[i][field] = field === 'actual'
      ? (inp.value !== '' ? inp.value : null)
      : inp.value;
    saveStore();
    renderBudget(p);
  };
  const cancel = () => { if (done) return; done = true; renderBudget(p); };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.removeEventListener('blur', save); cancel(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const row = td.closest('tr');
      const editables = [...row.querySelectorAll('td.bud-editable[data-bud-field]')];
      const ci = editables.indexOf(td);
      const next = e.shiftKey ? editables[ci - 1] : editables[ci + 1];
      inp.removeEventListener('blur', save);
      if (!done) {
        done = true;
        p.budget[i][field] = field === 'actual' ? (inp.value !== '' ? inp.value : null) : inp.value;
        saveStore();
      }
      if (next) {
        _editBudgetCell(next, parseInt(next.dataset.budIdx), next.dataset.budField);
      } else {
        renderBudget(p);
      }
    }
    e.stopPropagation();
  });
  inp.addEventListener('click', e => e.stopPropagation());
}

function openCopyBudgetModal() {
  const p = currentProject();
  if (!p.budget || !p.budget.length) { showToast('No budget lines to copy', 'info'); return; }
  const others = store.projects.filter(o => o.id !== p.id);
  if (!others.length) { showToast('No other projects to copy to', 'info'); return; }
  document.getElementById('copy-budget-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'copy-budget-modal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>COPY BUDGET TO PROJECT</h3>
        <button class="modal-close" onclick="document.getElementById('copy-budget-modal').remove()">✕</button>
      </div>
      <p style="font-size:12px;color:var(--text3);margin:0 0 16px">${p.budget.length} lines will be copied. Existing budget in the target will be replaced.</p>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
        ${others.map(o => `
          <div class="tpl-pick-card" onclick="confirmCopyBudgetToProject('${o.id}')">
            <div style="font-weight:700;font-size:13px">${o.title.replace(/</g,'&lt;')}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">${o.budget?.length ? o.budget.length+' existing lines — will be replaced' : 'Empty budget'}</div>
          </div>`).join('')}
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="btn" onclick="document.getElementById('copy-budget-modal').remove()">Cancel</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function confirmCopyBudgetToProject(targetId) {
  const src = currentProject();
  const target = store.projects.find(p => p.id === targetId);
  if (!target) return;
  document.getElementById('copy-budget-modal')?.remove();
  const doIt = () => {
    target.budget = src.budget.map(b => ({...b}));
    if (src.budgetCurrency)    target.budgetCurrency    = src.budgetCurrency;
    if (src.budgetContingency) target.budgetContingency = src.budgetContingency;
    if (src.budgetCap)         target.budgetCap         = src.budgetCap;
    saveStore();
    showToast(`Budget copied to "${target.title}"`, 'success');
  };
  if (target.budget?.length) {
    showConfirmDialog(`Replace ${target.budget.length} existing lines in "${target.title.replace(/</g,'&lt;')}"?`, 'Replace', doIt);
  } else { doIt(); }
}

let _budSearchQuery = '';

function _setBudgetSearch(q) {
  _budSearchQuery = q.toLowerCase().trim();
  renderBudget(currentProject());
}

function moveBudgetLineSection(i) {
  const p = currentProject();
  p.budget[i].section = p.budget[i].section === 'atl' ? 'btl' : 'atl';
  saveStore();
  renderBudget(p);
  showToast(`Moved to ${p.budget[i].section.toUpperCase()}`, 'success');
}

function quickAddBudgetLine(sec) {
  const dept = (document.getElementById(`baq-${sec}-dept`)?.value || '').trim() || 'Other';
  const desc = (document.getElementById(`baq-${sec}-desc`)?.value || '').trim();
  const rate = document.getElementById(`baq-${sec}-rate`)?.value || '';
  const qty  = document.getElementById(`baq-${sec}-qty`)?.value  || 1;
  if (!desc && !rate) { showToast('Enter a description or rate', 'info'); return; }
  const p = currentProject();
  p.budget.push({ section: sec, dept, desc, rate, qty, actual: null, notes: '', type: 'cash' });
  saveStore();
  document.getElementById(`baq-${sec}-dept`).value = '';
  document.getElementById(`baq-${sec}-desc`).value = '';
  document.getElementById(`baq-${sec}-rate`).value = '';
  document.getElementById(`baq-${sec}-qty`).value  = '1';
  renderBudget(p);
  setTimeout(() => document.getElementById(`baq-${sec}-desc`)?.focus(), 0);
}

function importBudgetCSV() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => _parseBudgetCSV(ev.target.result);
    reader.readAsText(file);
  };
  inp.click();
}

function _parseBudgetCSV(text) {
  const parseRow = row => {
    const cells = []; let inQ = false, cell = '';
    for (const c of row + ',') {
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cells.push(cell.trim()); cell = ''; }
      else cell += c;
    }
    return cells;
  };
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length < 2) { showToast('CSV appears empty', 'info'); return; }
  const header = parseRow(rawLines[0]).map(h => h.toLowerCase().replace(/^"|"$/g,''));
  const col = f => header.findIndex(h => h.includes(f));
  const idx = {
    section: col('section'), dept: col('dept'), desc: col('desc'),
    vendor: col('vendor'),
    type: col('type'), rate: col('rate'), qty: col('qty') < 0 ? col('unit') : col('qty'),
    actual: col('actual'), notes: col('note'),
  };
  const get = (cells, i) => i >= 0 ? (cells[i]||'').replace(/^"|"$/g,'').trim() : '';
  const skip = /TOTAL|subtotal|CONTINGENCY|GRAND/i;
  const newLines = [];
  for (let r = 1; r < rawLines.length; r++) {
    const cells = parseRow(rawLines[r]);
    if (cells.every(c => !c)) continue;
    const desc = get(cells, idx.desc);
    if (skip.test(desc)) continue;
    const dept = get(cells, idx.dept) || 'Other';
    if (!dept && !desc) continue;
    const secRaw = get(cells, idx.section).toLowerCase();
    const section = secRaw.includes('above') || secRaw === 'atl' ? 'atl' : 'btl';
    const typeRaw = get(cells, idx.type).toLowerCase();
    const type = ['cash','inkind','deferred'].includes(typeRaw) ? typeRaw : 'cash';
    const rate = parseFloat(get(cells, idx.rate)) || '';
    const qty  = parseFloat(get(cells, idx.qty))  || 1;
    const actRaw = get(cells, idx.actual);
    const actual = actRaw !== '' ? (parseFloat(actRaw) || null) : null;
    if (!desc && !rate) continue;
    newLines.push({ section, dept, desc, vendor: get(cells, idx.vendor), type, rate, qty, actual, notes: get(cells, idx.notes) });
  }
  if (!newLines.length) { showToast('No valid budget lines found in CSV', 'info'); return; }
  showConfirmDialog(`Import ${newLines.length} line${newLines.length!==1?'s':''} from CSV?`, 'Import', () => {
    const p = currentProject();
    if (!p.budget) p.budget = [];
    newLines.forEach(l => p.budget.push(l));
    saveStore(); renderBudget(p);
    showToast(`${newLines.length} lines imported`, 'success');
  });
}

function toggleBudgetDept(sectionClass, dept) {
  const key = `${sectionClass}:${dept}`;
  if (_collapsedBudgetDepts.has(key)) _collapsedBudgetDepts.delete(key);
  else _collapsedBudgetDepts.add(key);
  const p = currentProject();
  renderBudget(p);
}

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

function fmtMoney(n) { return _budCurrencySymbol + (parseFloat(n)||0).toFixed(2); }

function _budTypePill(type) {
  if (!type || type === 'cash') return '';
  const s = type === 'inkind' ? 'background:#52BE80;color:#fff' : 'background:#9B59B6;color:#fff';
  const l = type === 'inkind' ? 'In-Kind' : 'Deferred';
  return `<span class="dept-pill" style="${s};margin-right:4px">${l}</span>`;
}

function renderBudgetSection(lines, sectionId, sectionLabel, sectionClass) {
  const el = document.getElementById(sectionId);
  const p = currentProject();

  // Dept filter + text search
  let displayLines = lines;
  if (_budDeptFilter)   displayLines = displayLines.filter(b => (b.dept||'Other') === _budDeptFilter);
  if (_budSearchQuery)  displayLines = displayLines.filter(b =>
    (b.desc||'').toLowerCase().includes(_budSearchQuery) ||
    (b.dept||'').toLowerCase().includes(_budSearchQuery) ||
    (b.notes||'').toLowerCase().includes(_budSearchQuery)
  );

  // Sort (flat, no dept grouping when active)
  const secSort = _budgetSort[sectionClass];
  const isSorted = !!secSort.col;
  let workingLines = [...displayLines];
  if (isSorted) {
    workingLines.sort((a, b) => {
      let av, bv;
      const lineEst = x => (parseFloat(x.rate)||0)*(parseFloat(x.qty)||1);
      switch (secSort.col) {
        case 'dept':     av = a.dept||''; bv = b.dept||''; break;
        case 'desc':     av = a.desc||''; bv = b.desc||''; break;
        case 'vendor':   av = a.vendor||''; bv = b.vendor||''; break;
        case 'rate':     av = parseFloat(a.rate)||0; bv = parseFloat(b.rate)||0; break;
        case 'qty':      av = parseFloat(a.qty)||0;  bv = parseFloat(b.qty)||0;  break;
        case 'est':      av = lineEst(a); bv = lineEst(b); break;
        case 'actual':   av = parseFloat(a.actual)||0; bv = parseFloat(b.actual)||0; break;
        case 'variance': av = a.actual!=null ? (parseFloat(a.actual)||0)-lineEst(a) : -Infinity;
                         bv = b.actual!=null ? (parseFloat(b.actual)||0)-lineEst(b) : -Infinity; break;
        default: return 0;
      }
      return av < bv ? -secSort.dir : av > bv ? secSort.dir : 0;
    });
  }

  // Dept grouping (disabled when sorted)
  const deptOrder = [];
  const depts = {};
  workingLines.forEach(b => {
    const d = b.dept || 'Other';
    if (!depts[d]) { depts[d] = []; deptOrder.push(d); }
    depts[d].push(b);
  });

  const est      = displayLines.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const act      = displayLines.filter(b => b.actual !== '' && b.actual != null).reduce((s,b) => s + (parseFloat(b.actual)||0), 0);
  const hasActual = displayLines.some(b => b.actual !== '' && b.actual != null);
  const multipleDepts = deptOrder.length > 1 && !isSorted;
  const locked = !!(p.budgetLocked?.[sectionClass]);

  // Column visibility
  const hiddenCols = p.budgetHiddenCols || [];
  const colVis = col => !hiddenCols.includes(col);

  // Dynamic colspan for dept header row (desc always visible, rest conditional)
  const deptHeaderSpan = 1 + (colVis('dept')?1:0) + (colVis('vendor')?1:0) + (colVis('rate')?1:0) + (colVis('qty')?1:0);

  // % of total (full project budget, not just this section)
  const totalBudgetEst = _budShowPct
    ? p.budget.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0) : 0;

  // Sort header helper (4th param = data-ctx id for right-click column hide)
  const sIcon = col => secSort.col === col
    ? (secSort.dir === 1 ? ' ▲' : ' ▼')
    : ' <span style="opacity:0.25">⇅</span>';
  const sHead = (col, label, cls='', ctxId='') =>
    `<th class="${cls}" ${ctxId ? `data-ctx="bud-col:${ctxId}"` : ''} onclick="event.stopPropagation();_setBudgetSort('${col}','${sectionClass}')" style="cursor:pointer;user-select:none${secSort.col===col?';color:var(--text)':''}">${label}${sIcon(col)}</th>`;

  // Visible column count for empty state colspan
  const visibleColCount = 4 + (colVis('dept')?1:0) + (colVis('vendor')?1:0) + (colVis('rate')?1:0) + (colVis('qty')?1:0) + (colVis('actual')?1:0) + (colVis('variance')?1:0);

  let rows = '';
  if (!workingLines.length) {
    rows = `<tr><td colspan="${visibleColCount}" style="padding:28px;text-align:center;color:var(--text3);font-size:12px">${
      _budDeptFilter ? `No lines for "${_budDeptFilter}" in this section` :
      `No ${sectionLabel} lines yet — click "+ ${sectionLabel.includes('Above')?'ATL':'BTL'} Line" to add one`
    }</td></tr>`;
  } else {
    deptOrder.forEach(dept => {
      const items = depts[dept];
      const deptEst    = items.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
      const deptHasAct = items.some(b => b.actual !== '' && b.actual != null);
      const deptAct    = deptHasAct ? items.filter(b=>b.actual!==''&&b.actual!=null).reduce((s,b)=>s+(parseFloat(b.actual)||0),0) : null;
      const collapsed  = multipleDepts && _collapsedBudgetDepts.has(`${sectionClass}:${dept}`);
      const deptEscJs  = dept.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const deptEscHtml = dept.replace(/</g,'&lt;');

      if (multipleDepts) {
        const deptVar = deptAct !== null ? deptAct - deptEst : null;
        const deptActColor = deptAct !== null ? (deptAct > deptEst ? 'var(--red)' : deptAct < deptEst ? 'var(--green)' : 'var(--text3)') : '';
        const deptContPct = p.budgetDeptContingency?.[dept] ?? null;
        const deptContId = `dct-${sectionClass}-${dept.replace(/\W/g,'_')}`;
        const deptContEl = `<span id="${deptContId}" onclick="event.stopPropagation();editDeptContingency('${sectionClass}','${deptEscJs}')" data-tip="Click to set dept contingency %" style="font-size:10px;color:${deptContPct?'#f5a623':'var(--text3)'};cursor:pointer;margin-left:8px;opacity:${deptContPct?1:0.4}">${deptContPct?'+'+deptContPct+'%':'+ cont%'}</span>`;
        rows += `<tr class="budget-dept-header" onclick="toggleBudgetDept('${sectionClass}','${deptEscJs}')">
          <td></td>
          <td colspan="${deptHeaderSpan}">
            <span class="dept-pill bud-dept-filter-pill" style="${deptPillStyle(dept)}" onclick="event.stopPropagation();_setBudgetDeptFilter('${deptEscJs}')" data-tip="Filter to ${deptEscHtml}">${deptEscHtml}</span>
            <span style="margin-left:8px;font-size:11px;color:var(--text3)">${items.length} line${items.length!==1?'s':''}</span>
            ${deptContEl}
          </td>
          <td class="num" style="font-size:11px;font-weight:600">${fmtMoney(deptEst)}</td>
          ${colVis('actual') ? `<td class="num" style="font-size:11px;font-weight:600;color:${deptActColor}">${deptAct !== null ? fmtMoney(deptAct) : ''}</td>` : ''}
          ${colVis('variance') ? `<td class="num" style="font-size:11px;font-weight:600;color:${deptActColor}">${deptVar !== null ? (deptVar >= 0 ? '+' : '') + fmtMoney(deptVar) : ''}</td>` : ''}
          <td style="text-align:right;color:var(--text3);padding-right:14px">${collapsed ? '▸' : '▾'}</td>
        </tr>`;
      }

      if (!collapsed) {
        items.forEach(b => {
          const i = p.budget.indexOf(b);
          const lineEst = (parseFloat(b.rate)||0) * (parseFloat(b.qty)||1);
          const lineAct = (b.actual !== '' && b.actual != null) ? parseFloat(b.actual)||0 : null;
          const lineVar = lineAct !== null ? lineAct - lineEst : null;
          const varClass = lineVar === null ? 'variance-zero' : lineVar > 0 ? 'variance-pos' : lineVar < 0 ? 'variance-neg' : 'variance-zero';
          const notesEl = b.notes ? ` <span data-tip="${b.notes.replace(/"/g,'&quot;')}" style="cursor:help;opacity:0.5;font-size:11px">📝</span>` : '';
          const pctEl    = _budShowPct && totalBudgetEst > 0 ? `<span class="pct-badge">${(lineEst/totalBudgetEst*100).toFixed(1)}%</span>` : '';
          const deptPill = multipleDepts ? '' : `<span class="dept-pill bud-dept-filter-pill" style="${deptPillStyle(b.dept||'Other')}" onclick="event.stopPropagation();_setBudgetDeptFilter('${(b.dept||'Other').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')" data-tip="Filter to ${(b.dept||'Other').replace(/</g,'&lt;')}">${(b.dept||'Other').replace(/</g,'&lt;')}</span>`;
          const sec = sectionClass;
          const dragHandle = (isSorted || locked) ? '' : `<span class="bud-handle" draggable="true" ondragstart="_budDragStart(event,${i},'${sec}')" ondragend="_budDragEnd()" onclick="event.stopPropagation()">⠿</span>`;
          const rowStatusClass = lineAct !== null ? (lineAct > lineEst ? 'bud-row-over' : lineAct < lineEst ? 'bud-row-under' : '') : '';
          const rateCell = locked
            ? `<td class="num">${b.rate ? fmtMoney(b.rate) : '<span style="opacity:0.35">—</span>'}</td>`
            : `<td class="num bud-editable" onclick="event.stopPropagation();_editBudgetCell(this,${i},'rate')" data-bud-idx="${i}" data-bud-field="rate" data-tip="Click to edit rate">${b.rate ? fmtMoney(b.rate) : '<span style="opacity:0.35">—</span>'}</td>`;
          const qtyCell = locked
            ? `<td class="num">${b.qty != null && b.qty !== '' ? b.qty : '1'}</td>`
            : `<td class="num bud-editable" onclick="event.stopPropagation();_editBudgetCell(this,${i},'qty')" data-bud-idx="${i}" data-bud-field="qty" data-tip="Click to edit qty">${b.qty != null && b.qty !== '' ? b.qty : '1'}</td>`;
          rows += `<tr class="${rowStatusClass}" data-ctx="budget:${i}" onclick="${locked ? '' : `editBudgetLine(${i})`}" style="cursor:${locked ? 'default' : 'pointer'}"
            ondragover="${(isSorted||locked) ? '' : `_budDragOver(event,'${sec}')`}" ondrop="${(isSorted||locked) ? '' : `_budDrop(event,${i},'${sec}')`}">
            <td onclick="event.stopPropagation()" style="white-space:nowrap">${dragHandle}<input type="checkbox" class="budget-cb" data-idx="${i}" onchange="_updateBudgetSelBtn()" style="cursor:pointer;width:14px;height:14px;accent-color:var(--accent)"></td>
            ${colVis('dept') ? `<td>${deptPill}</td>` : ''}
            <td style="color:var(--text)">${_budTypePill(b.type)}${(b.desc||'—').replace(/</g,'&lt;')}${notesEl}</td>
            ${colVis('vendor') ? `<td style="color:var(--text2);font-size:12px">${(b.vendor||'').replace(/</g,'&lt;') || '<span style="opacity:0.25">—</span>'}</td>` : ''}
            ${colVis('rate') ? rateCell : ''}${colVis('qty') ? qtyCell : ''}
            <td class="num">${fmtMoney(lineEst)}${pctEl}</td>
            ${colVis('actual') ? `<td class="${varClass} bud-editable" onclick="event.stopPropagation();_editBudgetCell(this,${i},'actual')" data-bud-idx="${i}" data-bud-field="actual" data-tip="Click to enter actual">${lineAct !== null ? fmtMoney(lineAct) : '<span style="opacity:0.35">—</span>'}</td>` : ''}
            ${colVis('variance') ? `<td class="${varClass}">${lineVar !== null ? (lineVar >= 0 ? '+' : '') + fmtMoney(lineVar) : '<span style="opacity:0.35">—</span>'}</td>` : ''}
            <td style="white-space:nowrap" onclick="event.stopPropagation()">
              <button class="btn btn-sm btn-ghost" onclick="editBudgetLine(${i})" title="Edit">✎</button>
              <button class="btn btn-sm btn-ghost btn-danger" onclick="removeBudgetLine(${i})" title="Delete">✕</button>
              <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();cycleBudgetPayStatus(${i})" title="${b.payStatus === 'invoiced' ? 'Mark as paid' : b.payStatus === 'paid' ? 'Clear payment status' : 'Mark as invoiced'}" style="color:${b.payStatus === 'paid' ? 'var(--green)' : b.payStatus === 'invoiced' ? '#f5a623' : 'var(--text3)'}">${b.payStatus === 'paid' ? '✓' : b.payStatus === 'invoiced' ? '⏳' : '○'}</button>
            </td>
          </tr>`;
        });
      }
    });
  }

  const sectionCollapsed = _collapsedBudgetSections.has(sectionClass);
  const pctTotalEl = _budShowPct && totalBudgetEst > 0 ? `<span class="pct-badge" style="font-size:11px">${(est/totalBudgetEst*100).toFixed(1)}%</span>` : '';
  el.innerHTML = `
    <div class="budget-section-head ${sectionClass}" onclick="toggleBudgetSection('${sectionClass}')" style="cursor:pointer;border-radius:${sectionCollapsed?'8px':'8px 8px 0 0'};margin-bottom:${sectionCollapsed?'4px':'0'}">
      <span>${sectionLabel}</span>
      <span style="display:flex;align-items:center;gap:10px">
        ${locked ? '<span style="font-size:10px;color:#f5a623;opacity:0.9">estimates locked</span>' : ''}
        <span style="font-size:10px;opacity:0.7">${lines.length} line${lines.length!==1?'s':''}</span>
        <button onclick="event.stopPropagation();toggleBudgetLock('${sectionClass}')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0 2px;line-height:1;color:inherit" data-tip="${locked ? 'Unlock estimated values' : 'Lock estimated values'}">${locked ? '🔒' : '🔓'}</button>
        <span style="font-size:12px">${sectionCollapsed ? '▸' : '▾'}</span>
      </span>
    </div>
    ${sectionCollapsed ? '' : `<div style="overflow-x:auto;border:1px solid var(--border2);border-top:none;border-radius:0 0 8px 8px;margin-bottom:4px">
    <table class="budget-table" style="border:none;border-radius:0">
      <thead><tr>
        <th style="width:32px"><input type="checkbox" onchange="_budgetSelectAll(this)" style="cursor:pointer;width:14px;height:14px;accent-color:var(--accent)" title="Select all"></th>
        ${colVis('dept') ? sHead('dept','Dept','','dept') : ''}${sHead('desc','Description')}${colVis('vendor') ? sHead('vendor','Vendor','','vendor') : ''}
        ${colVis('rate') ? sHead('rate','Rate','num','rate') : ''}${colVis('qty') ? sHead('qty','Qty','num','qty') : ''}
        ${sHead('est','Estimated','num')}${colVis('actual') ? sHead('actual','Actual','num','actual') : ''}${colVis('variance') ? sHead('variance','Variance','num','variance') : ''}
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
      ${displayLines.length ? `<tfoot><tr class="budget-total-row">
        <td colspan="${deptHeaderSpan + 1}" style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6">${sectionLabel} Total</td>
        <td class="num">${fmtMoney(est)}${pctTotalEl}</td>
        ${colVis('actual') ? `<td class="num">${hasActual ? fmtMoney(act) : '—'}</td>` : ''}
        ${colVis('variance') ? `<td class="num ${est && hasActual ? (act-est > 0 ? 'variance-pos' : act-est < 0 ? 'variance-neg' : 'variance-zero') : ''}">${hasActual && est ? (act-est >= 0 ? '+' : '') + fmtMoney(act-est) : '—'}</td>` : ''}
        <td></td>
      </tr></tfoot>` : ''}
    </table>
    </div>`}`;
}

function _updateBudgetSelBtn() {
  const n = document.querySelectorAll('.budget-cb:checked').length;
  const dropdown = document.getElementById('budget-bulk-dropdown');
  if (dropdown) dropdown.style.display = n ? '' : 'none';
}

function _budgetSelectAll(headerCb) {
  headerCb.closest('table').querySelectorAll('.budget-cb').forEach(cb => cb.checked = headerCb.checked);
  _updateBudgetSelBtn();
}

function removeSelectedBudgetLines() {
  const checked = [...document.querySelectorAll('.budget-cb:checked')];
  if (!checked.length) return;
  showConfirmDialog(`Remove ${checked.length} budget line${checked.length!==1?'s':''}?`, 'Remove', () => {
    const p = currentProject();
    checked.map(cb => parseInt(cb.dataset.idx)).sort((a,b) => b-a).forEach(i => p.budget.splice(i, 1));
    saveStore();
    renderBudget(p);
    showToast(`${checked.length} line${checked.length!==1?'s':''} removed`, 'info');
  });
}

function bulkBudgetMoveSection(sec) {
  const checked = [...document.querySelectorAll('.budget-cb:checked')];
  if (!checked.length) return;
  const p = currentProject();
  checked.forEach(cb => { p.budget[parseInt(cb.dataset.idx)].section = sec; });
  saveStore(); renderBudget(p);
  showToast(`${checked.length} line${checked.length!==1?'s':''} moved to ${sec.toUpperCase()}`, 'success');
}

function bulkBudgetMoveDept() {
  const checked = [...document.querySelectorAll('.budget-cb:checked')];
  if (!checked.length) return;
  const p = currentProject();
  // Determine which section the first checked line is in to show relevant depts
  const firstSec = p.budget[parseInt(checked[0].dataset.idx)]?.section || 'btl';
  const depts = firstSec === 'atl' ? ATL_DEPTS : BTL_DEPTS;

  document.getElementById('bulk-dept-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'bulk-dept-modal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:320px">
      <h4 style="margin:0 0 14px">Move ${checked.length} line${checked.length!==1?'s':''} to dept</h4>
      <select id="bulk-dept-select" class="form-input" style="margin-bottom:14px">
        ${depts.map(d => `<option value="${d.replace(/"/g,'&quot;')}">${d}</option>`).join('')}
      </select>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" onclick="document.getElementById('bulk-dept-modal').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="_confirmBulkDept()">Move</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function _confirmBulkDept() {
  const dept = document.getElementById('bulk-dept-select')?.value;
  if (!dept) return;
  const checked = [...document.querySelectorAll('.budget-cb:checked')];
  const p = currentProject();
  checked.forEach(cb => { p.budget[parseInt(cb.dataset.idx)].dept = dept; });
  saveStore(); renderBudget(p);
  document.getElementById('bulk-dept-modal')?.remove();
  showToast(`${checked.length} line${checked.length!==1?'s':''} moved to ${dept}`, 'success');
}

function editDeptContingency(sec, dept) {
  const p = currentProject();
  if (!p.budgetDeptContingency) p.budgetDeptContingency = {};
  const current = p.budgetDeptContingency[dept] ?? '';
  const id = `dct-${sec}-${dept.replace(/\W/g,'_')}`;
  const el = document.getElementById(id);
  if (!el) return;
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = 0; inp.max = 100; inp.step = 1;
  inp.value = current; inp.className = 'bud-cell-input';
  inp.style.cssText = 'width:50px;text-align:center;';
  inp.placeholder = '0';
  el.innerHTML = ''; el.appendChild(inp);
  inp.focus(); inp.select();
  let done = false;
  const save = () => {
    if (done) return; done = true;
    const val = parseFloat(inp.value);
    if (!isNaN(val) && val > 0) p.budgetDeptContingency[dept] = val;
    else delete p.budgetDeptContingency[dept];
    saveStore(); renderBudget(p);
  };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.removeEventListener('blur', save); done = true; renderBudget(p); }
    e.stopPropagation();
  });
}

function toggleBudgetColVisibility(colId) {
  const p = currentProject();
  if (!p.budgetHiddenCols) p.budgetHiddenCols = [];
  const idx = p.budgetHiddenCols.indexOf(colId);
  if (idx >= 0) p.budgetHiddenCols.splice(idx, 1);
  else p.budgetHiddenCols.push(colId);
  saveStore(); renderBudget(p);
  showToast(idx >= 0 ? `${colId} column shown` : `${colId} column hidden`, 'info');
}

function openBudgetColumnsModal() {
  const p = currentProject();
  const hidden = p.budgetHiddenCols || [];
  const cols = [
    {id:'dept', label:'Department'},
    {id:'vendor', label:'Vendor'},
    {id:'rate', label:'Rate'},
    {id:'qty', label:'Qty / Units'},
    {id:'actual', label:'Actual'},
    {id:'variance', label:'Variance'},
  ];
  document.getElementById('bud-cols-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'bud-cols-modal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:280px">
      <h4 style="margin:0 0 14px">Show / hide columns</h4>
      ${cols.map(c => `
        <label style="display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer;font-size:13px">
          <input type="checkbox" ${hidden.includes(c.id)?'':'checked'} onchange="toggleBudgetColVisibility('${c.id}')" style="width:15px;height:15px;accent-color:var(--accent)">
          ${c.label}
        </label>`).join('')}
      <div style="margin-top:14px;text-align:right">
        <button class="btn" onclick="document.getElementById('bud-cols-modal').remove()">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function setBudgetField(field, val) {
  const p = currentProject();
  p[field] = field === 'budgetCurrency' ? val : (parseFloat(val) || 0);
  saveStore();
  renderBudget(p);
}

function renderBudget(p) {
  if (!p.budget) p.budget = [];
  _budCurrencySymbol = p.budgetCurrency || '£';
  const pctBtn = document.getElementById('budget-pct-btn');
  if (pctBtn) pctBtn.style.background = _budShowPct ? 'var(--accent)' : '';
  if (pctBtn) pctBtn.style.color = _budShowPct ? '#000' : '';
  const atl = p.budget.filter(b => b.section === 'atl');
  const btl = p.budget.filter(b => b.section !== 'atl');

  // Dept filter bar
  const filterBar = document.getElementById('budget-dept-filter-bar');
  if (filterBar) {
    filterBar.innerHTML = _budDeptFilter
      ? `<div style="display:flex;align-items:center;gap:8px;padding:6px 0 10px;font-size:12px">
           <span style="color:var(--text3)">Filtering by:</span>
           <span class="dept-pill" style="${deptPillStyle(_budDeptFilter)}">${_budDeptFilter.replace(/</g,'&lt;')}</span>
           <button class="btn btn-sm btn-ghost" onclick="_setBudgetDeptFilter(null)">✕ Clear</button>
         </div>` : '';
  }

  renderBudgetSection(atl, 'budget-atl-section', 'Above The Line', 'atl');
  renderBudgetSection(btl, 'budget-btl-section', 'Below The Line', 'btl');

  // Quick-add dept selects
  const qaAtlSel = document.getElementById('baq-atl-dept');
  if (qaAtlSel && qaAtlSel.options.length <= 1)
    ATL_DEPTS.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; qaAtlSel.appendChild(o); });
  const qaBtlSel = document.getElementById('baq-btl-dept');
  if (qaBtlSel && qaBtlSel.options.length <= 1)
    BTL_DEPTS.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; qaBtlSel.appendChild(o); });
  // Show/hide quick-add bars with section collapse state
  const qaAtl = document.getElementById('bud-qa-atl');
  if (qaAtl) qaAtl.style.display = _collapsedBudgetSections.has('atl') ? 'none' : '';
  const qaBtl = document.getElementById('bud-qa-btl');
  if (qaBtl) qaBtl.style.display = _collapsedBudgetSections.has('btl') ? 'none' : '';

  const atlEst = atl.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const btlEst = btl.reduce((s,b) => s + (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const atlAct = atl.filter(b=>b.actual!==''&&b.actual!=null).reduce((s,b)=>s+(parseFloat(b.actual)||0),0);
  const btlAct = btl.filter(b=>b.actual!==''&&b.actual!=null).reduce((s,b)=>s+(parseFloat(b.actual)||0),0);
  const totalEst = atlEst + btlEst;
  const hasAct = p.budget.some(b=>b.actual!==''&&b.actual!=null);
  const totalAct = atlAct + btlAct;
  const variance = totalAct - totalEst;
  const varColor = variance > 0 ? 'var(--red)' : variance < 0 ? 'var(--green)' : 'var(--text2)';

  const contingencyPct = parseFloat(p.budgetContingency) || 0;
  // Per-dept contingency (overrides global % for configured depts)
  const deptContingency = p.budgetDeptContingency || {};
  const hasDeptContingency = Object.keys(deptContingency).length > 0;
  let contingencyAmt;
  if (hasDeptContingency) {
    // Group lines by dept, apply dept-specific % or fall back to global
    const deptGroups = {};
    p.budget.forEach(b => {
      const d = b.dept || 'Other';
      if (!deptGroups[d]) deptGroups[d] = 0;
      deptGroups[d] += (parseFloat(b.rate)||0) * (parseFloat(b.qty)||1);
    });
    contingencyAmt = Object.entries(deptGroups).reduce((sum, [d, dEst]) => {
      const pct = deptContingency[d] != null ? deptContingency[d] : contingencyPct;
      return sum + dEst * pct / 100;
    }, 0);
  } else {
    contingencyAmt = totalEst * contingencyPct / 100;
  }
  const grandTotal = totalEst + contingencyAmt;

  const cap = parseFloat(p.budgetCap) || 0;
  const remaining = cap > 0 ? cap - grandTotal : null;

  // Type breakdown
  const inkindEst  = p.budget.filter(b => b.type === 'inkind').reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const deferredEst = p.budget.filter(b => b.type === 'deferred').reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const cashEst = totalEst - inkindEst - deferredEst;
  const showTypeBreakdown = inkindEst > 0 || deferredEst > 0;

  // Spend progress bar (when actuals exist)
  const spendBase = grandTotal > 0 ? grandTotal : totalEst;
  const spendPct = spendBase > 0 && hasAct ? Math.min((totalAct / spendBase) * 100, 100) : 0;
  const spendOver = hasAct && totalAct > spendBase;
  const spendBarHtml = hasAct && totalEst > 0 ? `
    <div style="flex-basis:100%;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:12px 16px;box-shadow:var(--shadow)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="bsb-label">Spend Progress</span>
        <span style="font-size:12px;font-family:var(--font-mono);font-weight:700;color:${spendOver?'var(--red)':'var(--text2)'}">${(hasAct&&spendBase>0?totalAct/spendBase*100:0).toFixed(1)}%</span>
      </div>
      <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${spendPct}%;background:${spendOver?'var(--red)':'var(--green)'};border-radius:4px;transition:width 0.3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text3)">
        <span>${fmtMoney(totalAct)} actual</span>
        <span>${fmtMoney(spendBase)} ${contingencyAmt>0?'incl. contingency':'estimated'}</span>
      </div>
    </div>` : '';

  document.getElementById('budget-summary-bar').innerHTML = `
    <div class="bsb-card atl"><div class="bsb-label">ATL Estimated</div><div class="bsb-amount">${fmtMoney(atlEst)}</div></div>
    <div class="bsb-card btl"><div class="bsb-label">BTL Estimated</div><div class="bsb-amount">${fmtMoney(btlEst)}</div></div>
    <div class="bsb-card grand"><div class="bsb-label">Total Estimated</div><div class="bsb-amount">${fmtMoney(totalEst)}</div></div>
    ${hasAct ? `
    <div class="bsb-card grand"><div class="bsb-label">Total Actual</div><div class="bsb-amount">${fmtMoney(totalAct)}</div></div>
    <div class="bsb-card"><div class="bsb-label">Variance</div><div class="bsb-amount" style="color:${varColor}">${variance>=0?'+':''}${fmtMoney(variance)}</div></div>
    ` : ''}
    ${spendBarHtml}
    <div class="bsb-divider"></div>
    <div class="bsb-card bsb-config">
      <div class="bsb-label">Currency</div>
      <select class="bsb-input" onchange="setBudgetField('budgetCurrency',this.value)" style="margin-top:2px">
        ${CURRENCY_OPTIONS.map(c => `<option value="${c.symbol}"${(p.budgetCurrency||'£')===c.symbol?' selected':''}>${c.label}</option>`).join('')}
      </select>
    </div>
    <div class="bsb-card bsb-config">
      <div class="bsb-label">Contingency %</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
        <input type="number" class="bsb-input" value="${contingencyPct||''}" placeholder="0" min="0" max="100" step="0.5"
          onchange="setBudgetField('budgetContingency',this.value)" style="width:52px">
        ${contingencyAmt > 0 ? `<span style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">= ${fmtMoney(contingencyAmt)}</span>` : ''}
      </div>
    </div>
    ${contingencyAmt > 0 ? `<div class="bsb-card grand"><div class="bsb-label">Grand Total</div><div class="bsb-amount">${fmtMoney(grandTotal)}</div></div>` : ''}
    <div class="bsb-card bsb-config">
      <div class="bsb-label">Budget Cap</div>
      <input type="number" class="bsb-input" value="${cap||''}" placeholder="No cap" min="0" step="100"
        onchange="setBudgetField('budgetCap',this.value)" style="width:96px;margin-top:2px">
    </div>
    ${remaining !== null ? `<div class="bsb-card ${remaining < 0 ? 'bsb-over' : 'bsb-remain'}">
      <div class="bsb-label">${remaining < 0 ? 'Over Budget' : 'Remaining'}</div>
      <div class="bsb-amount" style="color:${remaining < 0 ? 'var(--red)' : 'var(--green)'}">${remaining < 0 ? '' : ''}${fmtMoney(remaining)}</div>
    </div>` : ''}
    ${showTypeBreakdown ? `
    <div class="bsb-divider"></div>
    <div class="bsb-card"><div class="bsb-label">Cash</div><div class="bsb-amount" style="font-size:16px">${fmtMoney(cashEst)}</div></div>
    ${inkindEst > 0 ? `<div class="bsb-card"><div class="bsb-label">In-Kind</div><div class="bsb-amount" style="font-size:16px;color:#52BE80">${fmtMoney(inkindEst)}</div></div>` : ''}
    ${deferredEst > 0 ? `<div class="bsb-card"><div class="bsb-label">Deferred</div><div class="bsb-amount" style="font-size:16px;color:#9B59B6">${fmtMoney(deferredEst)}</div></div>` : ''}
    ` : ''}`;
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
  document.getElementById('bud-vendor').value = '';
  document.getElementById('bud-rate').value = '';
  document.getElementById('bud-qty').value = '';
  document.getElementById('bud-actual').value = '';
  document.getElementById('bud-notes').value = '';
  document.getElementById('bud-type').value = 'cash';
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
  document.getElementById('bud-vendor').value = b.vendor || '';
  document.getElementById('bud-rate').value = b.rate || '';
  document.getElementById('bud-qty').value = b.qty || '';
  document.getElementById('bud-actual').value = b.actual != null ? b.actual : '';
  document.getElementById('bud-notes').value = b.notes || '';
  document.getElementById('bud-type').value = b.type || 'cash';
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

function duplicateBudgetLine(i) {
  const p = currentProject();
  const src = p.budget[i];
  const copy = { ...src, actual: null, notes: src.notes || '' };
  p.budget.splice(i + 1, 0, copy);
  saveStore();
  renderBudget(p);
  showToast('Line duplicated', 'success');
}

function saveBudgetLine() {
  const p = currentProject();
  const actualVal = document.getElementById('bud-actual').value;
  const b = {
    section: document.getElementById('bud-section').value || 'btl',
    dept:    document.getElementById('bud-dept').value || 'Other',
    desc:    document.getElementById('bud-desc').value,
    vendor:  document.getElementById('bud-vendor').value,
    rate:    document.getElementById('bud-rate').value,
    qty:     document.getElementById('bud-qty').value || 1,
    actual:  actualVal !== '' ? actualVal : null,
    notes:   document.getElementById('bud-notes').value,
    type:    document.getElementById('bud-type').value || 'cash',
  };
  const idx = document.getElementById('budget-edit-idx').value;
  if (idx !== '') p.budget[parseInt(idx)] = b; else p.budget.push(b);
  saveStore();
  closeModal('modal-budget');
  renderBudget(p);
  showToast('Saved', 'success');
}

function exportBudgetCSV() {
  const p = currentProject();
  if (!p.budget || !p.budget.length) { showToast('No budget lines to export', 'info'); return; }

  const contingencyPct = parseFloat(p.budgetContingency) || 0;
  const totalEst = p.budget.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const contingencyAmt = totalEst * contingencyPct / 100;
  const grandTotal = totalEst + contingencyAmt;

  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
  let csv = 'Section,Department,Description,Vendor,Type,Unit Rate,Qty,Estimated,Actual,Variance,Notes,Payment\n';

  [['atl','Above The Line'],['btl','Below The Line']].forEach(([sec, secLabel]) => {
    const lines = p.budget.filter(b => (sec === 'atl') === (b.section === 'atl'));
    if (!lines.length) return;

    const deptOrder = [];
    const depts = {};
    lines.forEach(b => {
      const d = b.dept||'Other';
      if (!depts[d]) { depts[d]=[]; deptOrder.push(d); }
      depts[d].push(b);
    });

    deptOrder.forEach(dept => {
      depts[dept].forEach(b => {
        const est = (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1);
        const act = b.actual != null && b.actual !== '' ? parseFloat(b.actual)||0 : '';
        const vrn = act !== '' ? act - est : '';
        csv += [esc(secLabel),esc(dept),esc(b.desc),esc(b.vendor||''),esc(b.type||'cash'),parseFloat(b.rate)||0,parseFloat(b.qty)||1,est.toFixed(2),act!==''?Number(act).toFixed(2):'',vrn!==''?Number(vrn).toFixed(2):'',esc(b.notes),esc(b.payStatus||'')].join(',') + '\n';
      });
      if (deptOrder.length > 1 && depts[dept].length > 1) {
        const dEst = depts[dept].reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
        csv += [esc(secLabel),esc(dept),'"— subtotal"','','','',dEst.toFixed(2),'','',''].join(',') + '\n';
      }
    });

    const secEst = lines.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
    csv += [esc(secLabel),'',`"${secLabel} TOTAL"`, '','','',secEst.toFixed(2),'','',''].join(',') + '\n\n';
  });

  csv += `,,TOTAL ESTIMATED,,,,${totalEst.toFixed(2)}\n`;
  if (contingencyPct > 0) {
    csv += `,,CONTINGENCY (${contingencyPct}%),,,,${contingencyAmt.toFixed(2)}\n`;
    csv += `,,GRAND TOTAL,,,,${grandTotal.toFixed(2)}\n`;
  }

  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(p.title||'budget').replace(/[^a-z0-9]/gi,'_')}_budget.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Budget exported as CSV', 'success');
}

function exportBudgetPrint() {
  const p = currentProject();
  if (!p.budget || !p.budget.length) { showToast('No budget lines to export', 'info'); return; }

  const contingencyPct = parseFloat(p.budgetContingency) || 0;
  const totalEst = p.budget.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
  const contingencyAmt = totalEst * contingencyPct / 100;
  const grandTotal = totalEst + contingencyAmt;
  const cap = parseFloat(p.budgetCap) || 0;

  let tablesHtml = '';
  [['atl','Above The Line'],['btl','Below The Line']].forEach(([sec, secLabel]) => {
    const lines = p.budget.filter(b => (sec === 'atl') === (b.section === 'atl'));
    if (!lines.length) return;

    const deptOrder = [];
    const depts = {};
    lines.forEach(b => {
      const d = b.dept||'Other';
      if (!depts[d]) { depts[d]=[]; deptOrder.push(d); }
      depts[d].push(b);
    });

    let rows = '';
    deptOrder.forEach(dept => {
      depts[dept].forEach(b => {
        const est = (parseFloat(b.rate)||0)*(parseFloat(b.qty)||1);
        const act = b.actual != null && b.actual !== '' ? parseFloat(b.actual)||0 : null;
        const vrn = act !== null ? act - est : null;
        const typeLabel = b.type === 'inkind' ? ' <em>[In-Kind]</em>' : b.type === 'deferred' ? ' <em>[Deferred]</em>' : '';
        rows += `<tr>
          <td>${dept.replace(/</g,'&lt;')}</td>
          <td>${(b.desc||'').replace(/</g,'&lt;')}${typeLabel}</td>
          <td style="text-align:right">£${(parseFloat(b.rate)||0).toFixed(2)}</td>
          <td style="text-align:right">${b.qty||1}</td>
          <td style="text-align:right">£${est.toFixed(2)}</td>
          <td style="text-align:right">${act !== null ? '£'+act.toFixed(2) : '—'}</td>
          <td style="text-align:right">${vrn !== null ? (vrn>=0?'+':'')+fmtMoney(Math.abs(vrn)).replace('£',vrn<0?'-£':'£') : '—'}</td>
        </tr>`;
      });
      if (deptOrder.length > 1 && depts[dept].length > 1) {
        const dEst = depts[dept].reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
        rows += `<tr class="subtotal"><td colspan="4">${dept.replace(/</g,'&lt;')} subtotal</td><td style="text-align:right">£${dEst.toFixed(2)}</td><td></td><td></td></tr>`;
      }
    });

    const secEst = lines.reduce((s,b) => s+(parseFloat(b.rate)||0)*(parseFloat(b.qty)||1), 0);
    const secActLines = lines.filter(b=>b.actual!=null&&b.actual!=='');
    const secAct = secActLines.reduce((s,b)=>s+(parseFloat(b.actual)||0),0);
    const secHasAct = secActLines.length > 0;

    tablesHtml += `<h3>${secLabel}</h3>
    <table>
      <thead><tr><th>Department</th><th>Description</th><th>Rate</th><th>Qty</th><th>Estimated</th><th>Actual</th><th>Variance</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total"><td colspan="4">${secLabel} Total</td><td style="text-align:right">£${secEst.toFixed(2)}</td><td style="text-align:right">${secHasAct?'£'+secAct.toFixed(2):'—'}</td><td></td></tr></tfoot>
    </table>`;
  });

  const w = window.open('', '_blank');
  if (!w) { showToast('Pop-up blocked — allow pop-ups and try again', 'info'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${p.title.replace(/</g,'&lt;')} — Budget</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:24px;max-width:960px;margin:0 auto}
    h1{font-size:18px;margin-bottom:4px}
    h3{font-size:12px;margin:24px 0 6px;border-bottom:2px solid #000;padding-bottom:4px;text-transform:uppercase;letter-spacing:.07em}
    .meta{font-size:11px;color:#555;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{background:#f0f0f0;padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border:1px solid #ccc}
    td{padding:5px 8px;border:1px solid #e0e0e0;vertical-align:middle}
    tr.subtotal td{background:#f8f8f8;font-style:italic;font-size:11px}
    tr.total td{background:#e8e8e8;font-weight:700}
    .summary{margin-top:24px;border:2px solid #000;padding:12px 16px}
    .summary table{margin:0}
    .summary td{border:none;padding:4px 8px}
    .grand td{font-weight:700;font-size:14px;border-top:2px solid #000}
    .over td{color:#c0392b}
    @media print{.no-print{display:none}}
    footer{position:fixed;bottom:6mm;right:12mm;font-size:9px;color:#bbb;font-family:Arial,sans-serif}
  </style></head><body>
    <div class="no-print" style="margin-bottom:16px"><button onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer">🖨 Print / Save PDF</button></div>
    <h1>${p.title.replace(/</g,'&lt;')} — Budget</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}${(Array.isArray(p.directors) && p.directors.length) || p.director ? ' · Director: '+(Array.isArray(p.directors) ? p.directors.join(', ') : p.director).replace(/</g,'&lt;'):''}${p.company?' · '+p.company.replace(/</g,'&lt;'):''}</div>
    ${tablesHtml}
    <div class="summary">
      <table>
        <tr><td>Total Estimated</td><td style="text-align:right;font-weight:700">£${totalEst.toFixed(2)}</td></tr>
        ${contingencyPct > 0 ? `<tr><td>Contingency (${contingencyPct}%)</td><td style="text-align:right">£${contingencyAmt.toFixed(2)}</td></tr>` : ''}
        <tr class="grand"><td>Grand Total</td><td style="text-align:right">£${grandTotal.toFixed(2)}</td></tr>
        ${cap > 0 ? `<tr class="${grandTotal > cap ? 'over' : ''}"><td>${grandTotal > cap ? 'Over Budget' : 'Remaining'}</td><td style="text-align:right">£${Math.abs(cap-grandTotal).toFixed(2)}</td></tr>` : ''}
      </table>
    </div>
    <footer>Powered by Black Fountain · blackfountain.io</footer>
  </body></html>`);
  w.document.close();
}

function openBudgetTemplateModal() {
  document.getElementById('budget-template-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'budget-template-modal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>BUDGET TEMPLATES</h3>
        <button class="modal-close" onclick="document.getElementById('budget-template-modal').remove()">✕</button>
      </div>
      <p style="font-size:12px;color:var(--text3);margin:0 0 16px">Pick a template to add common line items. Rates are left blank for you to fill in.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(BUDGET_TEMPLATES).map(([key, tpl]) => `
          <div class="tpl-pick-card" onclick="applyBudgetTemplate('${key}')">
            <div style="font-weight:700;font-size:13px">${tpl.label}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">${tpl.desc}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px;opacity:0.7">${tpl.lines.length} line items</div>
          </div>`).join('')}
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="btn" onclick="document.getElementById('budget-template-modal').remove()">Cancel</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function applyBudgetTemplate(key) {
  const tpl = BUDGET_TEMPLATES[key];
  if (!tpl) return;
  const p = currentProject();
  const doApply = () => {
    tpl.lines.forEach(line => p.budget.push({ ...line, rate: '', qty: 1, actual: null, notes: '' }));
    saveStore();
    document.getElementById('budget-template-modal')?.remove();
    renderBudget(p);
    showToast(`${tpl.lines.length} lines added from "${tpl.label}" template`, 'success');
  };
  if (p.budget && p.budget.length > 0) {
    document.getElementById('budget-template-modal')?.remove();
    showConfirmDialog(
      `Add ${tpl.lines.length} lines from "${tpl.label}" to your existing budget?`,
      'Add Lines', doApply
    );
  } else {
    doApply();
  }
}

// EQUIPMENT
function renderEquipment(project) {
  const p = project || currentProject();
  if (!p) return;
  if (!p.equipment) p.equipment = {};
  if (!p.gearList) p.gearList = [];

  const grid = document.getElementById('equip-grid');
  const toolbar = document.getElementById('gear-toolbar');

  // Toolbar: Gear Pool count
  let poolCount = (p.gearPool || []).length;
  toolbar.innerHTML = `
    <button class="btn btn-sm btn-ghost" onclick="openUnsortedGear()">
      <span style="background:var(--accent);color:#000;padding:1px 6px;border-radius:10px;font-size:10px;margin-right:5px">${poolCount}</span>
      Master Gear Pool
    </button>
  `;

  if (p.gearList.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center;padding:100px 0;width:100%;color:var(--text3)">
        <div style="font-size:48px;margin-bottom:16px;opacity:0.2">🛠️</div>
        <h3>No gear days created yet.</h3>
        <p style="font-size:12px;margin-top:8px">Create your first shoot day to start building your gear checklist.</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="addGearDay()">+ Add Gear Day</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = p.gearList.map((day, dayIdx) => {
    const renderCol = (type) => {
      const isPre = type === 'pre';
      const label = isPre ? 'Pre check' : 'Post check';
      
      let totalItems = 0;
      let checkedItems = 0;
      day.categories.forEach(cat => {
        cat.items.forEach(item => {
          totalItems++;
          if (item[type]) checkedItems++;
        });
      });

      return `
        <div class="gear-col">
          <div class="gear-col-header ${type}">
            <div class="gear-col-label">${label}</div>
            <div class="gear-col-stats">${checkedItems} / ${totalItems} checked</div>
          </div>
          ${day.categories.map((cat, catIdx) => `
            <div class="gear-cat-card" 
              ondragover="event.preventDefault(); this.style.borderColor='var(--accent)'" 
              ondragleave="this.style.borderColor=''"
              ondrop="_gearItemDrop(event, ${dayIdx}, ${catIdx})">
              <input class="gear-cat-name" value="${(cat.name||'').replace(/"/g,'&quot;')}" 
                style="background:transparent;border:none;border-bottom:1px solid var(--border);width:100%;outline:none;padding-bottom:4px;margin-bottom:10px"
                onblur="updateGearCatName(${dayIdx}, ${catIdx}, this.value)"
                onkeydown="if(event.key==='Enter')this.blur()">
              ${cat.items.map((item, itemIdx) => `
                <div class="gear-item-row" style="position:relative" draggable="true"
                  ondragstart="_gearItemDragStart(event, ${dayIdx}, ${catIdx}, ${itemIdx})"
                  ondragend="this.style.opacity='1'">
                  <div class="gear-item-check ${item[type]?'checked':''}" onclick="toggleGearCheck(${dayIdx}, ${catIdx}, ${itemIdx}, '${type}')"></div>
                  <input class="gear-item-name ${item[type]?'checked':''}" value="${(item.name||'').replace(/"/g,'&quot;')}"
                    style="background:transparent;border:none;flex:1;outline:none;font-size:11px;color:inherit;cursor:grab"
                    onblur="updateGearItemName(${dayIdx}, ${catIdx}, ${itemIdx}, this.value)"
                    onkeydown="if(event.key==='Enter')this.blur()">
                  <button class="btn-ghost btn-remove" style="padding:2px 4px;font-size:10px" onclick="removeGearItemFromDay(${dayIdx}, ${catIdx}, ${itemIdx})" title="Remove item">✕</button>
                </div>
              `).join('')}
              <div style="display:flex;gap:4px;margin-top:8px">
                <button class="btn btn-sm btn-ghost" style="flex:1;font-size:10px" onclick="addGearItemToDay(${dayIdx}, ${catIdx})">+ Add item</button>
                <button class="btn btn-sm btn-ghost" style="font-size:10px" onclick="openUnsortedGear(${dayIdx}, ${catIdx})" title="Checkout from pool">📋</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    return `
      <div class="gear-day" draggable="true" 
        ondragstart="_gearDayDragStart(event, ${dayIdx})"
        ondragover="event.preventDefault(); this.style.boxShadow='0 0 0 2px var(--accent)'"
        ondragleave="this.style.boxShadow=''"
        ondrop="_gearDayDrop(event, ${dayIdx})">
        <div class="gear-day-header" style="cursor:move">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1">
              <input class="gear-day-title" value="${(day.label||'').replace(/"/g,'&quot;')}" 
                style="background:transparent;border:none;width:100%;outline:none;margin-bottom:4px;font-weight:bold;cursor:text"
                onclick="event.stopPropagation()"
                onblur="updateGearDayLabel(${dayIdx}, this.value)"
                onkeydown="if(event.key==='Enter')this.blur()">
              <div class="gear-day-shoots">
                ${(day.shoots || []).map((s, sIdx) => `
                  <input value="${s.replace(/"/g,'&quot;')}" 
                    style="background:transparent;border:none;width:100%;outline:none;font-size:11px;color:var(--text3)"
                    onblur="updateGearDayShoot(${dayIdx}, ${sIdx}, this.value)"
                    onkeydown="if(event.key==='Enter')this.blur()">
                `).join('')}
                ${!(day.shoots?.length) ? '<div style="opacity:0.5;font-style:italic" onclick="editGearDay('+dayIdx+')">No shoot info added (click to edit)</div>' : ''}
              </div>
            </div>
            <div class="dropdown">
              <button class="btn btn-sm btn-ghost dropdown-toggle" style="padding:4px">⋮</button>
              <div class="dropdown-menu">
                <div class="dropdown-item" onclick="duplicateGearDay(${dayIdx})">⧉ Duplicate Day</div>
                <div class="dropdown-item" onclick="editGearDay(${dayIdx})">✎ Edit Details</div>
                <div class="dropdown-item" onclick="addGearCategoryToDay(${dayIdx})">+ Add Category</div>
                <div class="dropdown-item danger" onclick="removeGearDay(${dayIdx})">🗑 Remove Day</div>
              </div>
            </div>
          </div>
        </div>
        <div class="gear-columns">
          ${renderCol('pre')}
          ${renderCol('post')}
        </div>
      </div>
    `;
  }).join('');
}

function updateGearDayLabel(idx, val) {
  const p = currentProject();
  if (p.gearList[idx].label === val) return;
  p.gearList[idx].label = val;
  saveStore();
}

function updateGearDayShoot(dayIdx, sIdx, val) {
  const p = currentProject();
  if (p.gearList[dayIdx].shoots[sIdx] === val) return;
  p.gearList[dayIdx].shoots[sIdx] = val;
  saveStore();
}

function updateGearCatName(dayIdx, catIdx, val) {
  const p = currentProject();
  if (p.gearList[dayIdx].categories[catIdx].name === val) return;
  p.gearList[dayIdx].categories[catIdx].name = val;
  saveStore();
}

function updateGearItemName(dayIdx, catIdx, itemIdx, val) {
  const p = currentProject();
  if (p.gearList[dayIdx].categories[catIdx].items[itemIdx].name === val) return;
  p.gearList[dayIdx].categories[catIdx].items[itemIdx].name = val;
  saveStore();
}

function removeGearItemFromDay(dayIdx, catIdx, itemIdx) {
  showConfirmDialog('Remove this item from the day?', 'Remove', () => {
    const p = currentProject();
    p.gearList[dayIdx].categories[catIdx].items.splice(itemIdx, 1);
    saveStore(); renderEquipment(p);
  });
}

function addGearDay() {
  const p = currentProject();
  const nextDay = p.gearList.length + 1;
  p.gearList.push({
    id: makeId(),
    label: `Day ${nextDay}`,
    shoots: [`Shoot 1: 8:00am - 1:00pm`],
    categories: [
      { name: 'Cameras', items: [] },
      { name: 'Lenses', items: [] }
    ]
  });
  saveStore(); renderEquipment(p);
}

function duplicateGearDay(idx) {
  const p = currentProject();
  const original = p.gearList[idx];
  if (!original) return;

  // Deep clone and reset check status
  const clone = JSON.parse(JSON.stringify(original));
  clone.id = makeId();
  clone.label = original.label + ' (Copy)';
  clone.categories.forEach(cat => {
    cat.items.forEach(item => {
      item.pre = false;
      item.post = false;
    });
  });

  p.gearList.splice(idx + 1, 0, clone);
  saveStore(); renderEquipment(p);
  showToast('Day duplicated', 'success');
}

function removeGearDay(idx) {
  showConfirmDialog('Remove this gear day?', 'Remove', () => {
    const p = currentProject();
    p.gearList.splice(idx, 1);
    saveStore(); renderEquipment(p);
  });
}

function toggleGearCheck(dayIdx, catIdx, itemIdx, type) {
  const p = currentProject();
  const item = p.gearList[dayIdx].categories[catIdx].items[itemIdx];
  item[type] = !item[type];
  saveStore(); renderEquipment(p);
}

function addGearItemToDay(dayIdx, catIdx) {
  const p = currentProject();
  showPromptDialog('Enter gear item name(s). Separate multiple items with commas or new lines:', 'Add Item(s)', (text) => {
    if (!text) return;
    // Split by comma OR newline
    const names = text.split(/[,\n]/).map(n => n.trim()).filter(n => n);
    if (!names.length) return;
    
    names.forEach(name => {
      p.gearList[dayIdx].categories[catIdx].items.push({ name, pre: false, post: false });
    });
    
    saveStore(); renderEquipment(p);
    showToast(`${names.length} item${names.length!==1?'s':''} added`, 'success');
  }, { 
    title: 'Add Gear',
    fields: [{ id: 'names', type: 'textarea', placeholder: 'e.g. Canon C200, Sony a7iii, Tripod' }]
  });
}

function addGearCategoryToDay(dayIdx) {
  const p = currentProject();
  showPromptDialog('Enter category name:', 'Add Category', (name) => {
    if (!name) return;
    p.gearList[dayIdx].categories.push({ name, items: [] });
    saveStore(); renderEquipment(p);
  }, { title: 'Add Category' });
}

function resetEquipChecks() {
  const p = currentProject();
  p.gearList.forEach(day => {
    day.categories.forEach(cat => {
      cat.items.forEach(item => {
        item.pre = false;
        item.post = false;
      });
    });
  });
  saveStore(); renderEquipment(p);
  showToast('All checks reset', 'info');
}

function openUnsortedGear(targetDayIdx, targetCatIdx) {
  const p = currentProject();
  if (!p.gearPool) p.gearPool = [];
  
  // If targeting a specific day/category, show checkout dialog
  if (typeof targetDayIdx === 'number' && typeof targetCatIdx === 'number') {
    _showGearPoolCheckout(targetDayIdx, targetCatIdx);
    return;
  }
  
  // Otherwise show full gear pool management
  _showGearPoolManager();
}

const GEAR_CATEGORIES = [
  'Cameras', 'Lenses', 'Tripods & Supports', 'Lighting', 'Grip',
  'Sound Recording', 'Sound Mixing', 'Power', 'Accessories', 'Computers', 'Other'
];

function _showGearPoolManager() {
  const p = currentProject();
  if (!p.gearPool) p.gearPool = [];
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '1000';
  
  // Group items by category
  const itemsByCategory = {};
  GEAR_CATEGORIES.forEach(cat => itemsByCategory[cat] = []);
  p.gearPool.forEach(item => {
    const cat = item.category || 'Other';
    if (!itemsByCategory[cat]) cat = 'Other';
    itemsByCategory[cat].push(item);
  });
  
  const renderPoolItems = () => {
    if (p.gearPool.length === 0) {
      return '<div style="text-align:center;padding:40px;color:var(--text3)">No items in pool. Add some below!</div>';
    }
    
    let html = '';
    GEAR_CATEGORIES.forEach(cat => {
      const items = itemsByCategory[cat] || [];
      if (items.length === 0) return;
      
      html += `<div style="margin-bottom:16px">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;font-weight:600">${cat}</div>`;
      
      html += items.map((item, idx) => {
        // Find actual index in original array
        const actualIdx = p.gearPool.indexOf(item);
        return `
          <div class="gear-pool-item" style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:4px;margin-bottom:4px">
            <span style="flex:1;font-size:13px">${(item.name||'').replace(/</g,'&lt;')}</span>
            <button class="btn btn-sm btn-ghost" onclick="_removeFromGearPool(${actualIdx})" title="Remove">✕</button>
          </div>`;
      }).join('');
      
      html += '</div>';
    });
    
    return html;
  };
  
  // Build category options
  const catOptions = GEAR_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:500px;width:90%;max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h3>Master Gear Pool</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px">
        <p style="color:var(--text2);font-size:12px;margin-bottom:16px">
          Add gear here once, then quickly check it out to multiple shoot days.
        </p>
        <div id="_gearPoolItems">${renderPoolItems()}</div>
      </div>
      <div style="padding:16px;border-top:1px solid var(--border)">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <select id="_poolCategory" class="form-select" style="width:160px">
            ${catOptions}
          </select>
          <input type="text" id="_newPoolItem" class="form-input" style="flex:1" 
            placeholder="Enter item name(s) - separate multiple with commas"
            onkeydown="if(event.key==='Enter')_addToGearPool()">
        </div>
        <button class="btn btn-primary" onclick="_addToGearPool()" style="width:100%">+ Add to Pool</button>
      </div>
    </div>`;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', e => { 
    if (e.target === overlay) overlay.remove(); 
  });
  
  // Focus input
  setTimeout(() => document.getElementById('_newPoolItem')?.focus(), 50);
}

function _addToGearPool() {
  const input = document.getElementById('_newPoolItem');
  const categorySelect = document.getElementById('_poolCategory');
  if (!input || !categorySelect) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  const category = categorySelect.value;
  const p = currentProject();
  if (!p.gearPool) p.gearPool = [];
  
  // Split by comma
  const names = text.split(',').map(n => n.trim()).filter(n => n);
  names.forEach(name => {
    p.gearPool.push({ name, category, pre: false, post: false });
  });
  
  saveStore();
  
  // Re-render the pool items (same logic as _showGearPoolManager)
  const itemsContainer = document.getElementById('_gearPoolItems');
  if (itemsContainer) {
    if (p.gearPool.length === 0) {
      itemsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No items in pool. Add some below!</div>';
    } else {
      // Group items by category
      const itemsByCategory = {};
      GEAR_CATEGORIES.forEach(cat => itemsByCategory[cat] = []);
      p.gearPool.forEach(item => {
        const cat = item.category || 'Other';
        if (!itemsByCategory[cat]) cat = 'Other';
        itemsByCategory[cat].push(item);
      });
      
      let html = '';
      GEAR_CATEGORIES.forEach(cat => {
        const items = itemsByCategory[cat] || [];
        if (items.length === 0) return;
        
        html += `<div style="margin-bottom:16px">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;font-weight:600">${cat}</div>`;
        
        html += items.map((item, idx) => {
          const actualIdx = p.gearPool.indexOf(item);
          return `
            <div class="gear-pool-item" style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:4px;margin-bottom:4px">
              <span style="flex:1;font-size:13px">${(item.name||'').replace(/</g,'&lt;')}</span>
              <button class="btn btn-sm btn-ghost" onclick="_removeFromGearPool(${actualIdx})" title="Remove">✕</button>
            </div>`;
        }).join('');
        
        html += '</div>';
      });
      
      itemsContainer.innerHTML = html;
    }
  }
  
  input.value = '';
  input.focus();
  
  // Update toolbar count
  renderEquipment(p);
}

function _removeFromGearPool(idx) {
  const p = currentProject();
  if (!p.gearPool || !p.gearPool[idx]) return;
  
  p.gearPool.splice(idx, 1);
  saveStore();
  
  // Re-render the pool items with categories
  const itemsContainer = document.getElementById('_gearPoolItems');
  if (itemsContainer) {
    if (p.gearPool.length === 0) {
      itemsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No items in pool. Add some below!</div>';
    } else {
      const itemsByCategory = {};
      GEAR_CATEGORIES.forEach(cat => itemsByCategory[cat] = []);
      p.gearPool.forEach(item => {
        const cat = item.category || 'Other';
        if (!itemsByCategory[cat]) cat = 'Other';
        itemsByCategory[cat].push(item);
      });
      
      let html = '';
      GEAR_CATEGORIES.forEach(cat => {
        const items = itemsByCategory[cat] || [];
        if (items.length === 0) return;
        
        html += `<div style="margin-bottom:16px">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;font-weight:600">${cat}</div>`;
        
        html += items.map((item, i) => {
          const actualIdx = p.gearPool.indexOf(item);
          return `
            <div class="gear-pool-item" style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:4px;margin-bottom:4px">
              <span style="flex:1;font-size:13px">${(item.name||'').replace(/</g,'&lt;')}</span>
              <button class="btn btn-sm btn-ghost" onclick="_removeFromGearPool(${actualIdx})" title="Remove">✕</button>
            </div>`;
        }).join('');
        
        html += '</div>';
      });
      
      itemsContainer.innerHTML = html;
    }
  }
  
  renderEquipment(p);
}

function _showGearPoolCheckout(targetDayIdx, targetCatIdx) {
  const p = currentProject();
  if (!p.gearPool || p.gearPool.length === 0) {
    showToast('No items in gear pool. Add some first!', 'info');
    return;
  }
  
  const day = p.gearList[targetDayIdx];
  const targetCategory = day?.categories[targetCatIdx];
  if (!day || !targetCategory) {
    showToast('Invalid day or category', 'error');
    return;
  }
  
  // Get items already in this category to filter them out
  const existingNames = new Set(targetCategory.items.map(i => i.name.toLowerCase()));
  const availableItems = p.gearPool.filter(item => !existingNames.has(item.name.toLowerCase()));
  
  if (availableItems.length === 0) {
    showToast('All pool items are already in this category!', 'info');
    return;
  }
  
  // Group available items by category
  const itemsByCategory = {};
  GEAR_CATEGORIES.forEach(cat => itemsByCategory[cat] = []);
  availableItems.forEach((item, idx) => {
    const cat = item.category || 'Other';
    if (!itemsByCategory[cat]) cat = 'Other';
    itemsByCategory[cat].push({ ...item, poolIndex: idx });
  });
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '1000';
  
  // Build category-grouped HTML
  let itemsHtml = '';
  GEAR_CATEGORIES.forEach(cat => {
    const items = itemsByCategory[cat] || [];
    if (items.length === 0) return;
    
    const isMatch = cat.toLowerCase() === targetCategory.name.toLowerCase() || 
      _categoryMatches(cat, targetCategory.name);
    
    itemsHtml += `<div style="margin-bottom:16px${isMatch ? ';border-left:3px solid var(--accent);padding-left:12px' : ''}">
      <div style="font-size:11px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;font-weight:600">
        ${cat}${isMatch ? ' ← will be added here' : ''}
      </div>`;
    
    itemsHtml += items.map(item => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:4px;margin-bottom:4px;cursor:pointer">
        <input type="checkbox" class="_poolCheck" value="${item.poolIndex}" data-category="${cat}" style="width:16px;height:16px">
        <span style="flex:1;font-size:13px">${(item.name||'').replace(/</g,'&lt;')}</span>
      </label>
    `).join('');
    
    itemsHtml += '</div>';
  });
  
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:500px;width:90%;max-height:80vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h3>Checkout from Pool</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="padding:0 16px">
        <p style="color:var(--text2);font-size:12px">
          Adding to: <strong>${day.label}</strong> → <strong>${targetCategory.name}</strong>
        </p>
        <p style="color:var(--text3);font-size:11px;margin-top:4px">
          Items will be automatically routed to matching categories in your gear day.
        </p>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px" id="_poolCheckoutItems">
        ${itemsHtml}
      </div>
      <div style="padding:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <label style="font-size:12px;color:var(--text2);cursor:pointer">
          <input type="checkbox" id="_selectAllPool" onchange="_toggleSelectAllPool()"> Select All
        </label>
        <button class="btn btn-primary" onclick="_checkoutFromPool(${targetDayIdx}, ${targetCatIdx})">Add Selected</button>
      </div>
    </div>`;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', e => { 
    if (e.target === overlay) overlay.remove(); 
  });
}

// Helper to match categories intelligently
function _categoryMatches(poolCat, dayCat) {
  const pc = poolCat.toLowerCase();
  const dc = dayCat.toLowerCase();
  
  // Exact match
  if (pc === dc) return true;
  
  // Camera variations
  if ((pc.includes('camera') && dc.includes('camera')) ||
      (pc.includes('lens') && dc.includes('lens')) ||
      (pc.includes('tripod') && dc.includes('tripod') || pc.includes('support') && dc.includes('support')) ||
      (pc.includes('light') && dc.includes('light')) ||
      (pc.includes('grip') && dc.includes('grip')) ||
      (pc.includes('sound') && dc.includes('sound')) ||
      (pc.includes('power') && dc.includes('power')) ||
      (pc.includes('accessories') && dc.includes('accessories')) ||
      (pc.includes('computer') && dc.includes('computer'))) {
    return true;
  }
  
  return false;
}

function _toggleSelectAllPool() {
  const selectAll = document.getElementById('_selectAllPool');
  const checkboxes = document.querySelectorAll('._poolCheck');
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

function _checkoutFromPool(targetDayIdx, targetCatIdx) {
  const p = currentProject();
  const checked = document.querySelectorAll('._poolCheck:checked');
  
  if (checked.length === 0) {
    showToast('No items selected', 'info');
    return;
  }
  
  const day = p.gearList[targetDayIdx];
  const targetCategory = day?.categories[targetCatIdx];
  if (!day || !targetCategory) return;
  
  // Get items already in all categories of this day
  const existingByCategory = {};
  day.categories.forEach(cat => {
    existingByCategory[cat.name.toLowerCase()] = new Set(cat.items.map(i => i.name.toLowerCase()));
  });
  
  const pool = p.gearPool || [];
  let addedCount = 0;
  
  checked.forEach(cb => {
    const poolIdx = parseInt(cb.value);
    const poolItem = pool[poolIdx];
    if (!poolItem) return;
    
    const itemCategory = poolItem.category || 'Other';
    
    // Find matching category in the day
    let targetCat = day.categories.find(cat => 
      _categoryMatches(itemCategory, cat.name) || 
      cat.name.toLowerCase() === itemCategory.toLowerCase()
    );
    
    // If no match, use the originally selected category
    if (!targetCat) {
      targetCat = targetCategory;
    }
    
    // Check if item already exists in that category
    const existingSet = existingByCategory[targetCat.name.toLowerCase()];
    if (existingSet && existingSet.has(poolItem.name.toLowerCase())) {
      return; // Already exists in this category
    }
    
    // Add item to the category
    targetCat.items.push({ name: poolItem.name, pre: false, post: false });
    
    // Update tracking
    if (!existingSet) {
      existingByCategory[targetCat.name.toLowerCase()] = new Set();
    }
    existingByCategory[targetCat.name.toLowerCase()].add(poolItem.name.toLowerCase());
    
    addedCount++;
  });
  
  saveStore();
  renderEquipment(p);
  
  // Close modal
  document.querySelector('.modal-overlay.open')?.remove();
  
  showToast(`${addedCount} item${addedCount !== 1 ? 's' : ''} added from pool`, 'success');
}

function editGearDay(idx) {
  const p = currentProject();
  const day = p.gearList[idx];
  
  showPromptDialog('Edit day information:', 'Save Changes', (vals) => {
    if (!vals.label) return;
    day.label = vals.label;
    day.shoots = vals.shoots.split(',').map(s => s.trim()).filter(s => s);
    saveStore(); renderEquipment(p);
  }, { 
    title: 'Edit Day',
    fields: [
      { id: 'label', label: 'Day Label', value: day.label, placeholder: 'e.g. Day 1: Saturday 14 March' },
      { id: 'shoots', label: 'Shoot Info (comma separated)', value: day.shoots.join(', '), placeholder: 'e.g. Shoot 1: 8:00am - 1:00pm' }
    ]
  });
}

function exportGearPrint() {
  const p = currentProject();
  if (!p.gearList || !p.gearList.length) { showToast('No gear days to export', 'info'); return; }

  let html = '';
  p.gearList.forEach(day => {
    html += `
      <div class="day-print">
        <h2>${(day.label || 'Untitled Day').replace(/</g,'&lt;')}</h2>
        <div class="meta">${(day.shoots || []).map(s => `<span>${s.replace(/</g,'&lt;')}</span>`).join(' · ')}</div>
        
        <div class="grid">
          <div class="col">
            <h3>PRE-CHECK</h3>
            ${day.categories.map(cat => `
              <div class="cat">
                <div class="cat-name">${cat.name.replace(/</g,'&lt;')}</div>
                ${cat.items.map(it => `
                  <div class="item">
                    <div class="check ${it.pre?'checked':''}"></div>
                    <span>${it.name.replace(/</g,'&lt;')}</span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <div class="col">
            <h3>POST-CHECK</h3>
            ${day.categories.map(cat => `
              <div class="cat">
                <div class="cat-name">${cat.name.replace(/</g,'&lt;')}</div>
                ${cat.items.map(it => `
                  <div class="item">
                    <div class="check ${it.post?'checked':''}"></div>
                    <span>${it.name.replace(/</g,'&lt;')}</span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });

  const w = window.open('', '_blank');
  if (!w) { showToast('Pop-up blocked', 'info'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${p.title.replace(/</g,'&lt;')} — Gear List</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:20px;max-width:1000px;margin:0 auto}
    h1{font-size:24px;margin-bottom:20px;text-align:center;text-transform:uppercase;letter-spacing:2px}
    .day-print{margin-bottom:40px;page-break-inside:avoid}
    h2{font-size:18px;margin:0 0 4px;border-bottom:2px solid #000;padding-bottom:4px}
    .meta{font-size:11px;color:#666;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:30px}
    h3{font-size:11px;background:#f0f0f0;padding:4px 8px;margin:0 0 10px;text-align:center;letter-spacing:1px}
    .cat{margin-bottom:15px}
    .cat-name{font-weight:bold;font-size:10px;text-transform:uppercase;margin-bottom:5px;border-bottom:1px solid #eee}
    .item{display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #f9f9f9}
    .check{width:12px;height:12px;border:1px solid #000;border-radius:2px;flex-shrink:0}
    .check.checked{background:#000;position:relative}
    .check.checked::after{content:'✓';color:#fff;font-size:10px;position:absolute;top:-1px;left:1px}
    @media print{.no-print{display:none}}
    .no-print{margin-bottom:20px;text-align:center}
    footer{margin-top:40px;font-size:9px;color:#999;text-align:center}
  </style></head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:10px 20px;cursor:pointer">🖨 Print Gear List</button></div>
    <h1>${p.title.replace(/</g,'&lt;')} — GEAR LIST</h1>
    ${html}
    <footer>Powered by Black Fountain</footer>
  </body></html>`);
  w.document.close();
}

function _gearDayDragStart(e, idx) {
  window._gearDayDragSrc = idx;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
}

function _gearDayDrop(e, targetIdx) {
  e.preventDefault();
  if (window._gearDayDragSrc === undefined || window._gearDayDragSrc === targetIdx) return;
  const p = currentProject();
  const movedDay = p.gearList.splice(window._gearDayDragSrc, 1)[0];
  p.gearList.splice(targetIdx, 0, movedDay);
  saveStore(); renderEquipment(p);
  window._gearDayDragSrc = undefined;
}

function _gearItemDragStart(e, dayIdx, catIdx, itemIdx) {
  window._gearItemDragSrc = { dayIdx, catIdx, itemIdx };
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
  setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
}

function _gearItemDrop(e, targetDayIdx, targetCatIdx) {
  e.preventDefault();
  const src = window._gearItemDragSrc;
  if (!src) return;
  
  const p = currentProject();
  const item = p.gearList[src.dayIdx].categories[src.catIdx].items.splice(src.itemIdx, 1)[0];
  p.gearList[targetDayIdx].categories[targetCatIdx].items.push(item);
  
  saveStore(); renderEquipment(p);
  window._gearItemDragSrc = null;
}

