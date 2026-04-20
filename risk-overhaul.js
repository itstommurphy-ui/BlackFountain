// ══════════════════════════════════════════════════════════════════════════════
// RISK ASSESSMENT — A4 DOCUMENT VIEW
// Replaces the old table-based render entirely.
// Writes into #section-riskassess (the existing shell div in project.html).
// ══════════════════════════════════════════════════════════════════════════════

// ── Risk factor helpers ───────────────────────────────────────────────────────

const RF_LABELS = { 1:'1 – Low', 2:'2 – Low', 3:'3 – Medium', 4:'4 – High', 5:'5 – High', 6:'6 – High' };
const RF_CLASS  = n => n <= 2 ? 'rf-low' : n <= 3 ? 'rf-med' : 'rf-high';

// ── Main render ───────────────────────────────────────────────────────────────

function renderRiskAssessment(p) {
  if (!p.riskMeta) p.riskMeta = { pm:'', date:'', location:'', signatory:'', sigdate:'' };
  if (!p.risks)    p.risks    = [];

  const sec = document.getElementById('section-riskassess');
  if (!sec) return;

  const projTitle  = p.title  || 'Untitled Project';
  const companyName = (window.store?.settings?.companyName) || '';

  sec.innerHTML = `
    <div class="ra-toolbar">
      <button class="btn-back" onclick="showSection('overview')">← Back to Overview</button>
      <div class="ra-toolbar-actions">
        <button class="btn btn-sm btn-ghost" onclick="_raPrintBlank()">🖨 Print Blank</button>
        <button class="btn btn-sm btn-ghost" onclick="_raPrintFilled()">🖨 Print Filled</button>
        <button class="btn btn-sm btn-ghost" onclick="exportRiskCSV()">📊 Export CSV</button>
        <button class="btn btn-sm btn-primary" onclick="addRiskRow()">+ Add Hazard</button>
      </div>
    </div>

    <div class="ra-page" id="ra-page">

      <!-- DOCUMENT HEADER -->
      <div class="ra-doc-header">
        <div class="ra-doc-header-left">
          <div class="ra-doc-company">${_raEsc(companyName)}</div>
          <div class="ra-doc-title">PRODUCTION RISK ASSESSMENT</div>
          <div class="ra-doc-project">${_raEsc(projTitle)}</div>
        </div>
        <div class="ra-doc-header-right">
          <div class="ra-doc-logo-box">BLACK<br>FOUNTAIN</div>
        </div>
      </div>

      <!-- ASSESSMENT META -->
      <div class="ra-meta-grid">
        <div class="ra-meta-field">
          <div class="ra-meta-label">Production / Project</div>
          <input class="ra-meta-input" id="risk-project" value="${_raEsc(p.riskMeta.project || projTitle)}" oninput="saveRiskMeta()" placeholder="Production title">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Production Manager</div>
          <input class="ra-meta-input" id="risk-pm" value="${_raEsc(p.riskMeta.pm)}" oninput="saveRiskMeta()" placeholder="Name">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Date of Assessment</div>
          <input class="ra-meta-input" id="risk-date" type="date" value="${_raEsc(p.riskMeta.date)}" oninput="saveRiskMeta()">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Shoot Location</div>
          <input class="ra-meta-input" id="risk-location" value="${_raEsc(p.riskMeta.location)}" oninput="saveRiskMeta()" placeholder="Location">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Review Date</div>
          <input class="ra-meta-input" id="risk-review" type="date" value="${_raEsc(p.riskMeta.review || '')}" oninput="saveRiskMeta()">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Ref. No.</div>
          <input class="ra-meta-input" id="risk-ref" value="${_raEsc(p.riskMeta.ref || '')}" oninput="saveRiskMeta()" placeholder="e.g. GT-RA-001">
        </div>
      </div>

      <!-- RISK MATRIX LEGEND -->
      <div class="ra-matrix-legend">
        <div class="ra-matrix-label">Risk Factor = Likelihood × Severity &nbsp;|&nbsp;</div>
        <span class="ra-rf-chip rf-low">1–2 Low</span>
        <span class="ra-rf-chip rf-med">3 Medium</span>
        <span class="ra-rf-chip rf-high">4–6 High</span>
        <div class="ra-matrix-note">(1 = negligible · 2 = minor · 3 = moderate · 4 = significant · 5 = major · 6 = critical)</div>
      </div>

      <!-- HAZARD TABLE -->
      <div class="ra-table-wrap" id="ra-table-wrap">
        <table class="ra-table" id="ra-table">
          <thead>
            <tr>
              <th class="ra-th ra-th-num">#</th>
              <th class="ra-th ra-th-hazard">Hazard</th>
              <th class="ra-th ra-th-who">Who might be harmed &amp; how?</th>
              <th class="ra-th ra-th-rf">Risk<br>Factor</th>
              <th class="ra-th ra-th-controls">Control Measures</th>
              <th class="ra-th ra-th-further">Further Action Required?</th>
              <th class="ra-th ra-th-rf">Revised<br>Risk Factor</th>
              <th class="ra-th ra-th-actions no-print"></th>
            </tr>
          </thead>
          <tbody id="risk-body">
            ${_raRenderRows(p)}
          </tbody>
        </table>
        <div class="ra-add-row no-print" onclick="addRiskRow()">+ Add hazard row</div>
      </div>

      <!-- PERSONS AT RISK KEY -->
      <div class="ra-key-section">
        <div class="ra-key-title">PERSONS AT RISK KEY</div>
        <div class="ra-key-chips">
          <span class="ra-key-chip">C — Cast</span>
          <span class="ra-key-chip">CR — Crew</span>
          <span class="ra-key-chip">M — Members of Public</span>
          <span class="ra-key-chip">O — Occupiers / Location Owner</span>
          <span class="ra-key-chip">V — Visitors</span>
          <span class="ra-key-chip">SC — Sub-Contractors</span>
        </div>
      </div>

      <!-- SIGNATURE BLOCK -->
      <div class="ra-sig-block">
        <div class="ra-sig-row">
          <div class="ra-sig-field">
            <div class="ra-meta-label">Assessor Name (printed)</div>
            <input class="ra-meta-input" id="risk-signatory" value="${_raEsc(p.riskMeta.signatory)}" oninput="saveRiskMeta()" placeholder="Full name">
          </div>
          <div class="ra-sig-field">
            <div class="ra-meta-label">Signature</div>
            <div class="ra-sig-line"></div>
          </div>
          <div class="ra-sig-field">
            <div class="ra-meta-label">Date Signed</div>
            <input class="ra-meta-input" id="risk-sigdate" value="${_raEsc(p.riskMeta.sigdate)}" oninput="saveRiskMeta()" placeholder="DD/MM/YYYY">
          </div>
        </div>
        <div class="ra-sig-row" style="margin-top:12px">
          <div class="ra-sig-field">
            <div class="ra-meta-label">Reviewed / Approved by</div>
            <input class="ra-meta-input" id="risk-approver" value="${_raEsc(p.riskMeta.approver||'')}" oninput="saveRiskMeta()" placeholder="Name">
          </div>
          <div class="ra-sig-field">
            <div class="ra-meta-label">Signature</div>
            <div class="ra-sig-line"></div>
          </div>
          <div class="ra-sig-field">
            <div class="ra-meta-label">Date</div>
            <input class="ra-meta-input" id="risk-approvedate" value="${_raEsc(p.riskMeta.approvedate||'')}" oninput="saveRiskMeta()" placeholder="DD/MM/YYYY">
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="ra-doc-footer">
        <span>This document should be reviewed before each shoot day and updated as necessary.</span>
        <span>Black Fountain · blackfountain.io</span>
      </div>

    </div><!-- /ra-page -->

    <!-- INLINE EDIT MODAL -->
    <div class="ra-edit-overlay" id="ra-edit-overlay" style="display:none" onclick="_raCloseEdit(event)">
      <div class="ra-edit-panel" id="ra-edit-panel" onclick="event.stopPropagation()">
        <div class="ra-edit-header">
          <span id="ra-edit-title">Edit Hazard</span>
          <button class="ra-edit-close" onclick="_raCloseEdit()">✕</button>
        </div>
        <input type="hidden" id="risk-edit-idx">
        <div class="ra-edit-body">
          <div class="ra-edit-row">
            <div class="ra-edit-field ra-edit-wide">
              <label class="ra-edit-label">Hazard / Activity</label>
              <textarea class="ra-edit-textarea" id="risk-hazard" rows="2" placeholder="Describe the hazard or activity that poses a risk…"></textarea>
            </div>
          </div>
          <div class="ra-edit-row">
            <div class="ra-edit-field ra-edit-wide">
              <label class="ra-edit-label">Who might be harmed &amp; how?</label>
              <textarea class="ra-edit-textarea" id="risk-who" rows="2" placeholder="e.g. Cast — risk of trip/fall. Crew — manual handling injury. M — unauthorised access."></textarea>
            </div>
          </div>
          <div class="ra-edit-row ra-edit-row-split">
            <div class="ra-edit-field">
              <label class="ra-edit-label">Initial Risk Factor</label>
              <select class="ra-edit-select" id="risk-factor">
                <option value="">— Select —</option>
                <option value="1">1 – Low</option>
                <option value="2">2 – Low</option>
                <option value="3">3 – Medium</option>
                <option value="4">4 – High</option>
                <option value="5">5 – High</option>
                <option value="6">6 – Critical</option>
              </select>
            </div>
            <div class="ra-edit-field">
              <label class="ra-edit-label">Revised Risk Factor</label>
              <select class="ra-edit-select" id="risk-newfactor">
                <option value="">— Select —</option>
                <option value="1">1 – Low</option>
                <option value="2">2 – Low</option>
                <option value="3">3 – Medium</option>
                <option value="4">4 – High</option>
                <option value="5">5 – High</option>
                <option value="6">6 – Critical</option>
              </select>
            </div>
          </div>
          <div class="ra-edit-row">
            <div class="ra-edit-field ra-edit-wide">
              <label class="ra-edit-label">Control Measures in Place</label>
              <textarea class="ra-edit-textarea" id="risk-controls" rows="3" placeholder="List all current controls, PPE, procedures, supervision arrangements…"></textarea>
            </div>
          </div>
          <div class="ra-edit-row">
            <div class="ra-edit-field ra-edit-wide">
              <label class="ra-edit-label">Further Action Required?</label>
              <textarea class="ra-edit-textarea" id="risk-further" rows="2" placeholder="List any additional controls needed, or write 'None' if risks are adequately controlled."></textarea>
            </div>
          </div>
        </div>
        <div class="ra-edit-footer">
          <button class="btn btn-sm btn-ghost" onclick="_raCloseEdit()">Cancel</button>
          <button class="btn btn-sm btn-primary" onclick="saveRiskRow()">Save Hazard</button>
        </div>
      </div>
    </div>
  `;

  _raInjectStyles();
}

// ── Row renderer ──────────────────────────────────────────────────────────────

function _raRenderRows(p) {
  if (!p.risks || !p.risks.length) {
    return `<tr class="ra-empty-row">
      <td colspan="8" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;font-style:italic">
        No hazards added yet — click "+ Add Hazard" above or the row below to begin.
      </td>
    </tr>`;
  }
  return p.risks.map((r, i) => {
    const rf1 = parseInt(r.factor) || 0;
    const rf2 = parseInt(r.newfactor) || 0;
    return `
    <tr class="ra-row" data-ctx="risk:${i}">
      <td class="ra-td ra-td-num">${i + 1}</td>
      <td class="ra-td ra-td-hazard"><strong>${_raEsc(r.hazard) || '<span class="ra-placeholder">—</span>'}</strong></td>
      <td class="ra-td ra-td-who">${_raEsc(r.who) || '<span class="ra-placeholder">—</span>'}</td>
      <td class="ra-td ra-td-rf">${rf1 ? `<span class="ra-rf-badge ${RF_CLASS(rf1)}">${rf1}</span>` : '<span class="ra-placeholder">—</span>'}</td>
      <td class="ra-td ra-td-controls">${_raEsc(r.controls) || '<span class="ra-placeholder">—</span>'}</td>
      <td class="ra-td ra-td-further">${_raEsc(r.further) || '<span class="ra-placeholder">None</span>'}</td>
      <td class="ra-td ra-td-rf">${rf2 ? `<span class="ra-rf-badge ${RF_CLASS(rf2)}">${rf2}</span>` : '<span class="ra-placeholder">—</span>'}</td>
      <td class="ra-td ra-td-actions no-print">
        <button class="ra-row-btn" onclick="editRiskRow(${i})" title="Edit">✎</button>
        <button class="ra-row-btn ra-row-btn-del" onclick="removeRiskRow(${i})" title="Delete">✕</button>
      </td>
    </tr>`;
  }).join('');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function saveRiskMeta() {
  const p = currentProject();
  if (!p.riskMeta) p.riskMeta = {};
  ['pm','date','location','signatory','sigdate','ref','review','project','approver','approvedate'].forEach(f => {
    const el = document.getElementById('risk-' + f);
    if (el) p.riskMeta[f] = el.value;
  });
  saveStore();
}

function addRiskRow() {
  document.getElementById('risk-edit-idx').value = '';
  ['hazard','who','controls','further'].forEach(f => document.getElementById('risk-' + f).value = '');
  document.getElementById('risk-factor').value    = '';
  document.getElementById('risk-newfactor').value = '';
  document.getElementById('ra-edit-title').textContent = 'Add Hazard';
  document.getElementById('ra-edit-overlay').style.display = 'flex';
}

function editRiskRow(i) {
  const r = currentProject().risks[i];
  document.getElementById('risk-edit-idx').value      = i;
  document.getElementById('risk-hazard').value        = r.hazard   || '';
  document.getElementById('risk-who').value           = r.who      || '';
  document.getElementById('risk-factor').value        = r.factor   || '';
  document.getElementById('risk-newfactor').value     = r.newfactor|| '';
  document.getElementById('risk-controls').value      = r.controls || '';
  document.getElementById('risk-further').value       = r.further  || '';
  document.getElementById('ra-edit-title').textContent = `Edit Hazard ${i + 1}`;
  document.getElementById('ra-edit-overlay').style.display = 'flex';
}

function saveRiskRow() {
  const p = currentProject();
  if (!p.risks) p.risks = [];
  const r = {
    hazard:    document.getElementById('risk-hazard').value,
    who:       document.getElementById('risk-who').value,
    factor:    document.getElementById('risk-factor').value,
    newfactor: document.getElementById('risk-newfactor').value,
    controls:  document.getElementById('risk-controls').value,
    further:   document.getElementById('risk-further').value,
  };
  const idx = document.getElementById('risk-edit-idx').value;
  if (idx !== '') p.risks[parseInt(idx)] = r;
  else            p.risks.push(r);
  saveStore();
  document.getElementById('ra-edit-overlay').style.display = 'none';
  document.getElementById('risk-body').innerHTML = _raRenderRows(p);
  showToast('Hazard saved', 'success');
}

function removeRiskRow(i) {
  showConfirmDialog('Remove this hazard?', 'Remove', () => {
    const p = currentProject();
    p.risks.splice(i, 1);
    saveStore();
    document.getElementById('risk-body').innerHTML = _raRenderRows(p);
  });
}

function _raCloseEdit(e) {
  if (e && e.target !== document.getElementById('ra-edit-overlay')) return;
  document.getElementById('ra-edit-overlay').style.display = 'none';
}

// ── Print helpers ─────────────────────────────────────────────────────────────

function _raPrintFilled() {
  const page = document.getElementById('ra-page');
  if (!page) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Risk Assessment</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;background:#fff;padding:12mm}
      .ra-toolbar,.ra-edit-overlay,.no-print{display:none!important}
      .ra-page{border:none;box-shadow:none;padding:0;max-width:none;width:100%}
      .ra-doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2pt solid #111;padding-bottom:10px;margin-bottom:14px}
      .ra-doc-company{font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:3px}
      .ra-doc-title{font-size:16pt;font-weight:bold;letter-spacing:2px;margin-bottom:4px}
      .ra-doc-project{font-size:11pt;color:#333}
      .ra-doc-logo-box{border:1.5pt solid #111;padding:6px 10px;font-size:8pt;font-weight:bold;letter-spacing:1px;text-align:center;line-height:1.4}
      .ra-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;border:0.5pt solid #ccc;padding:10px}
      .ra-meta-label{font-size:7pt;text-transform:uppercase;letter-spacing:1px;color:#777;margin-bottom:3px}
      .ra-meta-input{border:none;border-bottom:0.5pt solid #999;width:100%;font-size:10pt;padding:2px 0;background:transparent;color:#111}
      .ra-matrix-legend{font-size:8pt;color:#555;margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .ra-rf-chip{padding:1px 8px;border-radius:3pt;font-size:7.5pt;font-weight:bold}
      .rf-low{background:#d4edda;color:#155724}.rf-med{background:#fff3cd;color:#856404}.rf-high{background:#f8d7da;color:#721c24}
      .ra-table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:14px}
      .ra-th{background:#1a1a1a;color:#fff;padding:7px 8px;text-align:left;font-size:8pt;letter-spacing:0.5px;border:0.5pt solid #111}
      .ra-td{padding:8px;border:0.5pt solid #bbb;vertical-align:top;line-height:1.5}
      .ra-td-num{width:24pt;text-align:center;color:#777;font-size:8pt}
      .ra-td-rf{width:48pt;text-align:center}
      .ra-rf-badge{display:inline-block;width:22pt;height:22pt;line-height:22pt;text-align:center;border-radius:50%;font-weight:bold;font-size:11pt}
      .ra-placeholder{color:#ccc}
      .ra-add-row{display:none}
      .ra-key-section{margin-bottom:14px;padding:8px 10px;border:0.5pt solid #ddd;background:#fafafa}
      .ra-key-title{font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#555}
      .ra-key-chips{display:flex;flex-wrap:wrap;gap:8px}
      .ra-key-chip{font-size:8pt;color:#444}
      .ra-sig-block{border:0.5pt solid #ccc;padding:12px;margin-bottom:14px}
      .ra-sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
      .ra-sig-field{}
      .ra-sig-line{border-bottom:1pt solid #999;height:24pt;margin-top:8px}
      .ra-doc-footer{display:flex;justify-content:space-between;font-size:7.5pt;color:#aaa;border-top:0.5pt solid #ddd;padding-top:8px;margin-top:8px}
      .ra-matrix-note{display:none}
      .ra-row-btn{display:none}
    </style></head><body>
    ${page.innerHTML}
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function _raPrintBlank() {
  const p = currentProject();
  const companyName = (window.store?.settings?.companyName) || '';
  const projTitle   = p.title || 'Untitled Project';
  // Generate N blank rows (8 by default)
  const blankRows = Array.from({ length: 8 }, (_, i) => `
    <tr>
      <td class="ra-td ra-td-num" style="height:60pt">${i + 1}</td>
      <td class="ra-td"></td><td class="ra-td"></td>
      <td class="ra-td ra-td-rf"></td><td class="ra-td"></td>
      <td class="ra-td"></td><td class="ra-td ra-td-rf"></td>
    </tr>`).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Risk Assessment — Blank</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;background:#fff;padding:12mm}
      .ra-doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2pt solid #111;padding-bottom:10px;margin-bottom:14px}
      .ra-doc-company{font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:3px}
      .ra-doc-title{font-size:16pt;font-weight:bold;letter-spacing:2px;margin-bottom:4px}
      .ra-doc-project{font-size:11pt;color:#333}
      .ra-doc-logo-box{border:1.5pt solid #111;padding:6px 10px;font-size:8pt;font-weight:bold;letter-spacing:1px;text-align:center;line-height:1.4}
      .ra-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;border:0.5pt solid #ccc;padding:10px}
      .ra-meta-label{font-size:7pt;text-transform:uppercase;letter-spacing:1px;color:#777;margin-bottom:3px}
      .ra-meta-line{border-bottom:0.5pt solid #999;height:18pt;margin-top:2px}
      .ra-matrix-legend{font-size:8pt;color:#555;margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .ra-rf-chip{padding:1px 8px;border-radius:3pt;font-size:7.5pt;font-weight:bold}
      .rf-low{background:#d4edda;color:#155724}.rf-med{background:#fff3cd;color:#856404}.rf-high{background:#f8d7da;color:#721c24}
      .ra-table{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:14px}
      .ra-th{background:#1a1a1a;color:#fff;padding:7px 8px;text-align:left;font-size:8pt;letter-spacing:0.5px;border:0.5pt solid #111}
      .ra-td{padding:8px;border:0.5pt solid #bbb;vertical-align:top}
      .ra-td-num{width:24pt;text-align:center;color:#777;font-size:8pt}
      .ra-td-rf{width:48pt}
      .ra-key-section{margin-bottom:14px;padding:8px 10px;border:0.5pt solid #ddd;background:#fafafa}
      .ra-key-title{font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#555}
      .ra-key-chips{display:flex;flex-wrap:wrap;gap:8px}
      .ra-key-chip{font-size:8pt;color:#444}
      .ra-sig-block{border:0.5pt solid #ccc;padding:12px;margin-bottom:14px}
      .ra-sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:12px}
      .ra-sig-line{border-bottom:1pt solid #999;height:28pt;margin-top:8px}
      .ra-doc-footer{display:flex;justify-content:space-between;font-size:7.5pt;color:#aaa;border-top:0.5pt solid #ddd;padding-top:8px;margin-top:8px}
    </style></head><body>
    <div class="ra-doc-header">
      <div class="ra-doc-header-left">
        <div class="ra-doc-company">${companyName}</div>
        <div class="ra-doc-title">PRODUCTION RISK ASSESSMENT</div>
        <div class="ra-doc-project">${projTitle}</div>
      </div>
      <div class="ra-doc-logo-box">BLACK<br>FOUNTAIN</div>
    </div>
    <div class="ra-meta-grid">
      <div><div class="ra-meta-label">Production / Project</div><div class="ra-meta-line"></div></div>
      <div><div class="ra-meta-label">Production Manager</div><div class="ra-meta-line"></div></div>
      <div><div class="ra-meta-label">Date of Assessment</div><div class="ra-meta-line"></div></div>
      <div><div class="ra-meta-label">Shoot Location</div><div class="ra-meta-line"></div></div>
      <div><div class="ra-meta-label">Review Date</div><div class="ra-meta-line"></div></div>
      <div><div class="ra-meta-label">Ref. No.</div><div class="ra-meta-line"></div></div>
    </div>
    <div class="ra-matrix-legend">
      Risk Factor = Likelihood × Severity &nbsp;|&nbsp;
      <span class="ra-rf-chip rf-low">1–2 Low</span>
      <span class="ra-rf-chip rf-med">3 Medium</span>
      <span class="ra-rf-chip rf-high">4–6 High</span>
    </div>
    <table class="ra-table">
      <thead><tr>
        <th class="ra-th" style="width:24pt">#</th>
        <th class="ra-th">Hazard</th>
        <th class="ra-th">Who might be harmed &amp; how?</th>
        <th class="ra-th" style="width:48pt">Risk<br>Factor</th>
        <th class="ra-th">Control Measures</th>
        <th class="ra-th">Further Action?</th>
        <th class="ra-th" style="width:48pt">Revised<br>Risk Factor</th>
      </tr></thead>
      <tbody>${blankRows}</tbody>
    </table>
    <div class="ra-key-section">
      <div class="ra-key-title">Persons at Risk Key</div>
      <div class="ra-key-chips">
        <span class="ra-key-chip">C — Cast</span>
        <span class="ra-key-chip">CR — Crew</span>
        <span class="ra-key-chip">M — Members of Public</span>
        <span class="ra-key-chip">O — Occupiers / Location Owner</span>
        <span class="ra-key-chip">V — Visitors</span>
        <span class="ra-key-chip">SC — Sub-Contractors</span>
      </div>
    </div>
    <div class="ra-sig-block">
      <div class="ra-sig-row">
        <div><div class="ra-meta-label">Assessor Name (printed)</div><div class="ra-sig-line"></div></div>
        <div><div class="ra-meta-label">Signature</div><div class="ra-sig-line"></div></div>
        <div><div class="ra-meta-label">Date Signed</div><div class="ra-sig-line"></div></div>
      </div>
      <div class="ra-sig-row">
        <div><div class="ra-meta-label">Reviewed / Approved by</div><div class="ra-sig-line"></div></div>
        <div><div class="ra-meta-label">Signature</div><div class="ra-sig-line"></div></div>
        <div><div class="ra-meta-label">Date</div><div class="ra-sig-line"></div></div>
      </div>
    </div>
    <div class="ra-doc-footer">
      <span>This document should be reviewed before each shoot day and updated as necessary.</span>
      <span>Black Fountain · blackfountain.io</span>
    </div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _raEsc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Styles (injected once) ────────────────────────────────────────────────────

let _raStylesInjected = false;
function _raInjectStyles() {
  if (_raStylesInjected) return;
  _raStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
/* ── Risk Assessment Layout ─────────────────────── */
.ra-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}
.ra-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* A4 page illusion */
.ra-page {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 4px;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 36px;
  box-shadow: 0 2px 20px rgba(0,0,0,.12);
}

/* Header */
.ra-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--text);
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.ra-doc-company {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text3);
  margin-bottom: 4px;
}
.ra-doc-title {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 3px;
  color: var(--text);
  margin-bottom: 4px;
}
.ra-doc-project {
  font-size: 13px;
  color: var(--text2);
}
.ra-doc-logo-box {
  border: 1.5px solid var(--text);
  padding: 6px 12px;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 2px;
  text-align: center;
  line-height: 1.5;
  color: var(--text);
  flex-shrink: 0;
}

/* Meta grid */
.ra-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 20px;
  margin-bottom: 20px;
  padding: 14px 16px;
  border: 1px solid var(--border2);
  border-radius: 4px;
  background: var(--surface2);
}
.ra-meta-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text3);
  margin-bottom: 4px;
  font-family: var(--font-mono);
}
.ra-meta-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border2);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  padding: 3px 0;
  outline: none;
  font-family: var(--font-body);
}
.ra-meta-input:focus { border-bottom-color: var(--accent); }

/* Legend */
.ra-matrix-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text3);
  margin-bottom: 16px;
  font-family: var(--font-mono);
}
.ra-matrix-note { color: var(--text3); }
.ra-matrix-label { color: var(--text2); }
.ra-rf-chip {
  padding: 2px 10px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
}
.rf-low  { background: rgba(40,167,69,.15);  color: #28a745; }
.rf-med  { background: rgba(255,193,7,.15);  color: #c79400; }
.rf-high { background: rgba(220,53,69,.15);  color: var(--red, #dc3545); }

/* Table */
.ra-table-wrap { margin-bottom: 20px; }
.ra-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ra-th {
  background: var(--surface3, var(--surface2));
  color: var(--text2);
  padding: 9px 10px;
  text-align: left;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
  border: 1px solid var(--border2);
  white-space: nowrap;
  font-weight: 600;
}
.ra-th-num     { width: 30px; text-align: center; }
.ra-th-hazard  { width: 16%; }
.ra-th-who     { width: 18%; }
.ra-th-rf      { width: 64px; text-align: center; }
.ra-th-controls{ width: 22%; }
.ra-th-further { width: 14%; }
.ra-th-actions { width: 56px; }
.ra-td {
  padding: 10px;
  border: 1px solid var(--border2);
  vertical-align: top;
  line-height: 1.55;
  color: var(--text);
}
.ra-td-num { text-align: center; color: var(--text3); font-family: var(--font-mono); font-size: 11px; }
.ra-td-rf  { text-align: center; }
.ra-td-actions { text-align: center; white-space: nowrap; }
.ra-placeholder { color: var(--text3); font-style: italic; font-size: 11px; }
.ra-rf-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 13px;
  font-family: var(--font-mono);
}
.ra-rf-badge.rf-low  { background: rgba(40,167,69,.15);  color: #28a745; border: 1px solid rgba(40,167,69,.3); }
.ra-rf-badge.rf-med  { background: rgba(255,193,7,.15);  color: #c79400; border: 1px solid rgba(255,193,7,.4); }
.ra-rf-badge.rf-high { background: rgba(220,53,69,.15);  color: var(--red, #dc3545); border: 1px solid rgba(220,53,69,.3); }

.ra-row:hover .ra-td { background: var(--surface2); }
.ra-empty-row td { border: 1px solid var(--border2); }

.ra-add-row {
  margin-top: 8px;
  padding: 10px 16px;
  border: 1px dashed var(--border2);
  border-radius: 4px;
  text-align: center;
  font-size: 12px;
  color: var(--text3);
  cursor: pointer;
  transition: all .15s;
}
.ra-add-row:hover { border-color: var(--accent); color: var(--accent); background: var(--surface2); }

.ra-row-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text3);
  cursor: pointer;
  padding: 2px 7px;
  font-size: 12px;
  margin: 0 1px;
}
.ra-row-btn:hover { border-color: var(--border2); color: var(--text); }
.ra-row-btn-del:hover { border-color: var(--red); color: var(--red); }

/* Persons key */
.ra-key-section {
  margin-bottom: 20px;
  padding: 10px 14px;
  border: 1px solid var(--border2);
  border-radius: 4px;
  background: var(--surface2);
}
.ra-key-title {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text3);
  margin-bottom: 8px;
}
.ra-key-chips { display: flex; flex-wrap: wrap; gap: 12px; }
.ra-key-chip { font-size: 11px; color: var(--text2); font-family: var(--font-mono); }

/* Signature block */
.ra-sig-block {
  border: 1px solid var(--border2);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 20px;
}
.ra-sig-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
.ra-sig-line {
  border-bottom: 1px solid var(--border2);
  height: 28px;
  margin-top: 6px;
}

/* Document footer */
.ra-doc-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text3);
  border-top: 1px solid var(--border2);
  padding-top: 10px;
  margin-top: 8px;
  font-family: var(--font-mono);
}

/* ── Edit overlay ───────────────────────────────── */
.ra-edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ra-edit-panel {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 8px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.ra-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border2);
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--text);
  flex-shrink: 0;
}
.ra-edit-close {
  background: none;
  border: none;
  color: var(--text3);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
}
.ra-edit-close:hover { color: var(--text); }
.ra-edit-body { padding: 16px 18px; flex: 1; overflow-y: auto; }
.ra-edit-row { margin-bottom: 14px; }
.ra-edit-row-split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ra-edit-field {}
.ra-edit-wide { width: 100%; }
.ra-edit-label {
  display: block;
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text3);
  margin-bottom: 6px;
}
.ra-edit-textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-body);
  line-height: 1.5;
  resize: vertical;
}
.ra-edit-textarea:focus { outline: none; border-color: var(--accent); }
.ra-edit-select {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-mono);
}
.ra-edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border2);
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 700px) {
  .ra-page { padding: 18px 14px; }
  .ra-meta-grid { grid-template-columns: 1fr 1fr; }
  .ra-sig-row { grid-template-columns: 1fr; }
  .ra-edit-row-split { grid-template-columns: 1fr; }
}
  `;
  document.head.appendChild(s);
}
