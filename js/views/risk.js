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
          <div class="ra-date-wrapper" onclick="document.getElementById('risk-date').showPicker()">
            <input class="ra-meta-input" id="risk-date" type="date" value="${_raEsc(p.riskMeta.date)}" oninput="saveRiskMeta()">
          </div>
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Shoot Location</div>
          <input class="ra-meta-input" id="risk-location" value="${_raEsc(p.riskMeta.location)}" oninput="saveRiskMeta()" placeholder="Location">
        </div>
        <div class="ra-meta-field">
          <div class="ra-meta-label">Review Date</div>
          <div class="ra-date-wrapper" onclick="document.getElementById('risk-review').showPicker()">
            <input class="ra-meta-input" id="risk-review" type="date" value="${_raEsc(p.riskMeta.review || '')}" oninput="saveRiskMeta()">
          </div>
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
            <div class="ra-date-wrapper" onclick="document.getElementById('risk-sigdate').showPicker()">
              <input class="ra-meta-input" id="risk-sigdate" type="date" value="${_raEsc(p.riskMeta.sigdate)}" oninput="saveRiskMeta()">
            </div>
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
            <div class="ra-date-wrapper" onclick="document.getElementById('risk-approvedate').showPicker()">
              <input class="ra-meta-input" id="risk-approvedate" type="date" value="${_raEsc(p.riskMeta.approvedate||'')}" oninput="saveRiskMeta()">
            </div>
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

/* A4 page illusion - paper style */
.ra-page {
  background: #fafafa;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 36px;
  box-shadow: 0 2px 20px rgba(0,0,0,.12);
  color: #111;
  background-color: #fdfbf7;
}

/* Header */
.ra-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #333;
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.ra-doc-company {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #666;
  margin-bottom: 4px;
}
.ra-doc-title {
  font-family: Georgia, serif;
  font-size: 22px;
  letter-spacing: 3px;
  color: #111;
  margin-bottom: 4px;
}
.ra-doc-project {
  font-size: 13px;
  color: #444;
}
.ra-doc-logo-box {
  border: 1.5px solid #333;
  padding: 6px 12px;
  font-family: Georgia, serif;
  font-size: 11px;
  letter-spacing: 2px;
  text-align: center;
  line-height: 1.5;
  color: #111;
  flex-shrink: 0;
}

/* Meta grid */
.ra-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 20px;
  margin-bottom: 20px;
  padding: 14px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
.ra-meta-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #666;
  margin-bottom: 4px;
  font-family: Georgia, serif;
}
.ra-meta-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid #999;
  background: transparent;
  color: #111;
  font-size: 13px;
  padding: 3px 0;
  outline: none;
  font-family: Georgia, serif;
}
.ra-date-wrapper {
  position: relative;
  cursor: pointer;
}
.ra-date-wrapper input[type="date"] {
  cursor: pointer;
  padding-right: 20px;
}
.ra-date-wrapper input[type="date"]::-webkit-calendar-picker-indicator {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

/* Legend */
.ra-matrix-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #666;
  margin-bottom: 16px;
  font-family: Georgia, serif;
}
.ra-matrix-note { color: #666; }
.ra-matrix-label { color: #444; }
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
  background: #e8e6e1;
  color: #222;
  padding: 9px 10px;
  text-align: left;
  font-size: 10px;
  font-family: Georgia, serif;
  letter-spacing: 0.5px;
  border: 1px solid #bbb;
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
  border: 1px solid #bbb;
  vertical-align: top;
  line-height: 1.55;
  color: #111;
  background: #fff;
}
.ra-td-num { text-align: center; color: #666; font-family: Georgia, serif; font-size: 11px; }
.ra-td-rf  { text-align: center; }
.ra-td-actions { text-align: center; white-space: nowrap; }
.ra-placeholder { color: #999; font-style: italic; font-size: 11px; }
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

.ra-row:hover .ra-td { background: #f5f3ef; }
.ra-empty-row td { border: 1px solid #bbb; }

.ra-add-row {
  margin-top: 8px;
  padding: 10px 16px;
  border: 1px dashed #bbb;
  border-radius: 4px;
  text-align: center;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all .15s;
}
.ra-add-row:hover { border-color: #333; color: #333; background: #f5f3ef; }

.ra-row-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #666;
  cursor: pointer;
  padding: 2px 7px;
  font-size: 12px;
  margin: 0 1px;
}
.ra-row-btn:hover { border-color: #bbb; color: #111; }
.ra-row-btn-del:hover { border-color: #c00; color: #c00; }

/* Persons key */
.ra-key-section {
  margin-bottom: 20px;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
.ra-key-title {
  font-size: 9px;
  font-family: Georgia, serif;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #666;
  margin-bottom: 8px;
}
.ra-key-chips { display: flex; flex-wrap: wrap; gap: 12px; }
.ra-key-chip { font-size: 11px; color: #444; font-family: Georgia, serif; }

/* Signature block */
.ra-sig-block {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 20px;
  background: #fff;
}
.ra-sig-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
.ra-sig-line {
  border-bottom: 1px solid #bbb;
  height: 28px;
  margin-top: 6px;
}

/* Document footer */
.ra-doc-footer {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #888;
  border-top: 1px solid #ccc;
  padding-top: 10px;
  margin-top: 8px;
  font-family: Georgia, serif;
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
  background: #fdfbf7;
  border: 1px solid #ccc;
  border-radius: 8px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 24px rgba(0,0,0,.2);
}
.ra-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #ccc;
  font-family: Georgia, serif;
  font-size: 14px;
  letter-spacing: 1px;
  color: #111;
  flex-shrink: 0;
}
.ra-edit-close {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
}
.ra-edit-close:hover { color: #111; }
.ra-edit-body { padding: 16px 18px; flex: 1; overflow-y: auto; }
.ra-edit-row { margin-bottom: 14px; }
.ra-edit-row-split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ra-edit-field {}
.ra-edit-wide { width: 100%; }
.ra-edit-label {
  display: block;
  font-size: 10px;
  font-family: Georgia, serif;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-bottom: 6px;
}
.ra-edit-textarea {
  width: 100%;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #111;
  font-size: 13px;
  font-family: Georgia, serif;
  line-height: 1.5;
  resize: vertical;
}
.ra-edit-textarea:focus { outline: none; border-color: #333; }
.ra-edit-select {
  width: 100%;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #111;
  font-size: 13px;
  font-family: Georgia, serif;
}
.ra-edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid #ccc;
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

function exportRiskCSV() {
  const p = currentProject();
  if (!p.risks || !p.risks.length) {
    showToast('No hazards to export', 'info');
    return;
  }
  const rows = [['#', 'Hazard', 'Who might be harmed', 'Risk Factor', 'Control Measures', 'Further Action', 'Revised Risk Factor']];
  p.risks.forEach((r, i) => {
    rows.push([
      i + 1,
      r.hazard || '',
      r.who || '',
      r.factor || '',
      r.controls || '',
      r.further || '',
      r.newfactor || ''
    ]);
  });
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `risk-assessment-${(p.title||'project').replace(/\s+/g,'-').toLowerCase()}.csv`;
  a.click();
}

// ══════════════════════════════════════════════════════════════════════════════════════
// RELEASE FORMS
// ══════════════════════════════════════════
function renderReleases(p) {
  if(!p.releases) p.releases=[];
  const el=document.getElementById('releases-list');
  if(!p.releases.length){el.innerHTML=`<div class="empty-state"><div class="icon">📝</div><h4>No release forms yet</h4><p>Add talent or location release forms</p></div>`;
  } else {
    el.innerHTML=p.releases.map((r,i)=>`
      <div class="breakdown-card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div><span class="tag">${r.type==='talent'?'TALENT RELEASE':'LOCATION RELEASE'}</span> &nbsp; <strong>${r.name||'Unnamed'}</strong></div>
          <div style="display:flex;gap:8px">
            <span class="chip" style="color:${r.signed?'var(--green)':'var(--orange)'}">${r.signed?'● Signed':'○ Unsigned'}</span>
            <button class="btn btn-sm btn-ghost" onclick="toggleSigned(${i})">${r.signed?'Mark Unsigned':'Mark Signed'}</button>
            <button class="btn btn-sm btn-danger" onclick="removeRelease(${i})">✕</button>
          </div>
        </div>
        ${r.type==='talent'?`
          <div class="form-row">
            <div class="form-group"><label class="form-label">Talent Name</label><input class="form-input" value="${r.talentName||''}" onchange="updateRelease(${i},'talentName',this.value)" placeholder="Full name"></div>
            <div class="form-group"><label class="form-label">Character Name</label><input class="form-input" value="${r.charName||''}" onchange="updateRelease(${i},'charName',this.value)" placeholder="Character"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Address</label><input class="form-input" value="${r.address||''}" onchange="updateRelease(${i},'address',this.value)"></div>
            <div class="form-group"><label class="form-label">Phone</label><input class="form-input" value="${r.phone||''}" onchange="updateRelease(${i},'phone',this.value)"></div>
          </div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" value="${r.email||''}" onchange="updateRelease(${i},'email',this.value)" type="email"></div>
        `:`
          <div class="form-group"><label class="form-label">Property / Location Name</label><input class="form-input" value="${r.property||''}" onchange="updateRelease(${i},'property',this.value)" placeholder="e.g. The Old Mill, Manchester"></div>
          <div class="form-group"><label class="form-label">Property Address</label><input class="form-input" value="${r.address||''}" onchange="updateRelease(${i},'address',this.value)"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Owner / Contact Name</label><input class="form-input" value="${r.owner||''}" onchange="updateRelease(${i},'owner',this.value)"></div>
            <div class="form-group"><label class="form-label">Date Signed</label><input class="form-input" type="date" value="${r.dateSigned||''}" onchange="updateRelease(${i},'dateSigned',this.value)"></div>
          </div>
        `}
        <div class="form-group" style="margin-top:8px"><label class="form-label">Notes</label><input class="form-input" value="${r.notes||''}" onchange="updateRelease(${i},'notes',this.value)" placeholder="Any notes..."></div>
      </div>
    `).join('');
  }
}
function addRelease(type){const p=currentProject();if(!p.releases)p.releases=[];p.releases.push({type,name:type==='talent'?'New Talent':'New Location',signed:false});saveStore();renderReleases(p);}
function toggleSigned(i){const p=currentProject();p.releases[i].signed=!p.releases[i].signed;saveStore();renderReleases(p);}
function removeRelease(i){showConfirmDialog('Remove this release form?','Remove',()=>{const p=currentProject();p.releases.splice(i,1);saveStore();renderReleases(p);});}
function updateRelease(i,field,val){const p=currentProject();p.releases[i][field]=val;if(field==='talentName'||field==='property')p.releases[i].name=val;saveStore();}

// ══════════════════════════════════════════
// TECH SCOUT CHECKLIST
// ══════════════════════════════════════════
const TECH_SCOUT_ITEMS = {
  'Story': ['Storytelling: Does the location meet the scene requirements, and fit the director\'s tone?','Anachronisms: Does the setting fit the time period and story setting?'],
  'Sight': ['Wide Shot Test: Is a wide frame acceptable? Any problematic visual elements?','360 Test: Are there any problematic directions that should be avoided?','Commercial Clearance: Any properties that require commercial clearance?','Indoor Staging: Does your cast, crew and gear fit inside?','Sunlight: Any sunlight considerations? Morning? Noon? Afternoon? Evening?','VFX Needs: Would anything need to be removed or added in post?'],
  'Sound': ['HVAC: Can you turn off heating, ventilation and air conditioning?','Refrigerators: Can you turn off any noisy appliances?','Reverberation: Can you record clean dialogue? Do you need to dampen echoes?'],
  'Surroundings': ['Roads & Traffic: Any traffic concerns? Noise or continuity issues?','Schools: Schoolyard noise? Continuity issues?','Playgrounds: Will playground noise affect sound?','Factories/Warehouses: Any noise from machinery?','Airports: Will airplane noise affect sound?','Air Traffic: Any significant air traffic overhead?','Sufficient Parking: Is there sufficient parking for talent, crew, and vehicles?','Staging Talent: Is there a dedicated quiet space for talent and extras?'],
  'Weather': ['Temperature: Will the location be too hot or cold?','Rain/Snow: Will precipitation have a potential impact?','Indoor Impacts: Will sound from precipitation affect the shoot?'],
  'Power': ['Accessible Outlets: Are there enough outlets? How many? Where?','Access to Breakers: Does the electrical crew have access to the circuit breaker?','Breaker Isolation: How many breaker circuits? What\'s the rating?','Isolation of Hair & Makeup: Is there a dedicated space and breaker for H&M?'],
  'Facilities': ['Bathrooms-to-Person Ratio: How many people on set per bathroom?','Access to Water Shut Off: Do you have access in case of emergency?','Access to Gas Shut Off: Do you have access in case of emergency?'],
  'Contracts': ['Contract Signed: Has the location owner signed a location release?','Insurance/Liability: Does your production insurance cover this location?','Contingency Plans: Are there clauses for date changes in the contract?'],
};

function _techScoutTabsHtml(p) {
  const scouts = p.techScouts || [];
  const tabs = scouts.map((s, i) =>
    `<button class="btn btn-sm${i === _activeTechScoutIdx ? ' btn-primary' : ''}" onclick="_selectTechScout(${i})">${(s.name||'Scout '+(i+1)).slice(0,22)}</button>`
  ).join('');
  const delBtn = scouts.length > 0 ? `<button class="btn btn-sm btn-ghost btn-danger" onclick="removeTechScout(${_activeTechScoutIdx})" title="Delete this checklist" style="margin-left:4px">🗑</button>` : '';
  const minBtn = scouts.length > 0 ? `<button class="btn btn-sm btn-ghost" onclick="_techScoutMinimized=!_techScoutMinimized;renderTechScouts(currentProject())" style="margin-left:auto" title="${_techScoutMinimized?'Expand':'Collapse'}">${_techScoutMinimized ? '▸ Expand' : '▾ Collapse'}</button>` : '';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%">${tabs}${delBtn}${minBtn}</div>`;
}

function _techScoutContent(scout, si) {
  const checksDone = Object.values(scout.checks || {}).filter(Boolean).length;
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const pct = checksTotal ? Math.round(checksDone / checksTotal * 100) : 0;
  return `
    <div style="display:grid;grid-template-columns:1fr 160px;gap:10px;margin-bottom:16px;align-items:end">
      <div class="form-group" style="margin:0"><label class="form-label">Location Name</label><input class="form-input" value="${(scout.name||'').replace(/"/g,'&quot;')}" onchange="updateTechScout(${si},'name',this.value);renderTechScoutTabs(currentProject())"></div>
      <div class="form-group" style="margin:0"><label class="form-label">Date</label><input class="form-input" type="date" value="${scout.date||''}" onchange="updateTechScout(${si},'date',this.value)"></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:8px 12px;background:var(--surface2);border-radius:6px">
      <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div id="tech-progress-bar-${si}" style="width:${pct}%;height:100%;background:var(--accent2);border-radius:4px;transition:width .3s"></div></div>
      <span id="tech-progress-label-${si}" style="font-size:12px;color:var(--text2);white-space:nowrap">${checksDone}/${checksTotal} checked (${pct}%)</span>
    </div>
    ${Object.entries(TECH_SCOUT_ITEMS).map(([cat,items])=>`
      <div style="margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:14px;letter-spacing:1px;color:var(--accent2);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${items.map((item,ii)=>{
            const key=cat+'_'+ii;
            const checked=(scout.checks||{})[key];
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:var(--surface2);border-radius:6px;cursor:pointer${checked?';border-left:2px solid var(--accent2)':''}" onclick="toggleTechCheck(${si},'${key}')">
              <div class="equip-check${checked?' checked':''}" style="margin-top:1px;flex-shrink:0"></div>
              <span style="font-size:12px;color:var(--text2);line-height:1.4">${item}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="form-group" style="margin-top:8px"><label class="form-label">Notes — ${cat}</label><textarea class="form-textarea" style="min-height:50px" onchange="updateTechScout(${si},'notes_${cat}',this.value)">${(scout['notes_'+cat])||''}</textarea></div>
      </div>
    `).join('')}
    <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap">
      <button class="btn btn-sm btn-primary" onclick="_techScoutMinimized=true;renderTechScouts(currentProject())" title="Auto-saves on every change">✓ Save &amp; Collapse</button>
      <button class="btn btn-sm btn-ghost" onclick="_printTechScout(${si})">⎙ Print</button>
      <button class="btn btn-sm btn-ghost" onclick="_downloadTechScout(${si})">⬇ Export HTML</button>
    </div>`;
}

function renderTechScoutTabs(p) {
  const tabBar = document.getElementById('techscout-tabs');
  if (tabBar) tabBar.innerHTML = _techScoutTabsHtml(p);
}

function renderTechScouts(p) {
  const el = document.getElementById('techscout-list');
  if (!el) return;
  if (!p.techScouts || !p.techScouts.length) {
    el.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">No tech scout checklists yet — click "+ New Checklist" to add one.</p>`;
    return;
  }
  _activeTechScoutIdx = Math.min(_activeTechScoutIdx, p.techScouts.length - 1);
  const scout = p.techScouts[_activeTechScoutIdx];
  el.innerHTML = `
    <div id="techscout-tabs" style="margin-bottom:${_techScoutMinimized ? 4 : 14}px">${_techScoutTabsHtml(p)}</div>
    ${_techScoutMinimized ? '' : `<div class="breakdown-card" style="margin-bottom:0">${_techScoutContent(scout, _activeTechScoutIdx)}</div>`}`;
}

function _selectTechScout(i) {
  _activeTechScoutIdx = i;
  renderTechScouts(currentProject());
  document.getElementById('techscout-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addTechScout() {
  const p = currentProject();
  if (!p.techScouts) p.techScouts = [];
  p.techScouts.push({ name: '', date: '', checks: {} });
  _activeTechScoutIdx = p.techScouts.length - 1;
  saveStore();
  renderTechScouts(p);
}
function removeTechScout(i) {
  showConfirmDialog('Remove this tech scout checklist?', 'Remove', () => {
    const p = currentProject();
    p.techScouts.splice(i, 1);
    _activeTechScoutIdx = Math.max(0, i - 1);
    saveStore();
    renderTechScouts(p);
  });
}
function updateTechScout(i, field, val) { const p = currentProject(); p.techScouts[i][field] = val; saveStore(); }
function toggleTechCheck(si, key) {
  const p = currentProject();
  if (!p.techScouts[si].checks) p.techScouts[si].checks = {};
  p.techScouts[si].checks[key] = !p.techScouts[si].checks[key];
  saveStore();
  const checkEl = event.currentTarget.querySelector('.equip-check');
  if (checkEl) checkEl.classList.toggle('checked', p.techScouts[si].checks[key]);
  // Update progress bar and counter
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const checksDone = Object.values(p.techScouts[si].checks).filter(Boolean).length;
  const pct = checksTotal ? Math.round(checksDone / checksTotal * 100) : 0;
  const bar = document.getElementById(`tech-progress-bar-${si}`);
  const label = document.getElementById(`tech-progress-label-${si}`);
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `${checksDone}/${checksTotal} checked (${pct}%)`;
}
function openTechScoutForLocation(locName) {
  const p = currentProject();
  if (!p) return;
  if (!p.techScouts) p.techScouts = [];
  let idx = p.techScouts.findIndex(s => s.name && s.name.toLowerCase() === locName.toLowerCase());
  if (idx === -1) {
    p.techScouts.push({ name: locName, date: '', checks: {} });
    idx = p.techScouts.length - 1;
    saveStore();
  }
  _activeTechScoutIdx = idx;
  renderTechScouts(p);
  setTimeout(() => document.getElementById('techscout-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// ── SCOUTING INTERCONNECT HELPERS ────────────────────────────────────────────

function _getScoutStatus(locName) {
  const key = locName.toLowerCase();
  const sheets = [], techSheets = [];
  store.projects.forEach(p => {
    (p.scoutingSheets || []).forEach((s, idx) => {
      if (s.name?.toLowerCase() === key)
        sheets.push({ projectTitle: p.title, projectId: p.id, idx, date: s.date, suitability: s.suitability });
    });
    (p.techScouts || []).forEach((s, idx) => {
      if (s.name?.toLowerCase() === key) {
        const done = Object.values(s.checks || {}).filter(Boolean).length;
        const total = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
        techSheets.push({ projectTitle: p.title, projectId: p.id, idx, date: s.date, done, total });
      }
    });
  });
  return { sheets, techSheets };
}

function _scoutIconHtml(locName) {
  const st = _getScoutStatus(locName);
  const total = st.sheets.length + st.techSheets.length;
  if (!total) return '';
  const safe = locName.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button class="btn btn-sm" onclick="event.stopPropagation();openScoutStatusModal('${safe}')" style="margin-left:6px;padding:1px 7px;font-size:11px;line-height:1.6;background:rgba(0,120,220,.15);border-color:rgba(0,120,220,.3);color:#60aaff;vertical-align:middle" title="Scouting data available — click to view">🗺 ${total}</button>`;
}

function openScoutStatusModal(locName) {
  const st = _getScoutStatus(locName);
  document.getElementById('scout-status-modal-name').textContent = locName;
  const suitColorMap = {'Not Suitable':'var(--red)','Poor':'#e06c00','Fair':'#d4a017','Good':'var(--green)','Excellent':'#0088ff'};
  const body = document.getElementById('scout-status-modal-body');
  body.innerHTML = `
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      <strong>${locName}</strong>: ${st.sheets.length} scouting sheet${st.sheets.length!==1?'s':''}, ${st.techSheets.length} tech checklist${st.techSheets.length!==1?'s':''}.
    </p>
    ${st.sheets.length ? `
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-display);font-size:11px;letter-spacing:1.5px;color:var(--accent2);margin-bottom:8px">SCOUTING SHEETS</div>
        ${st.sheets.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${s.projectTitle}</div>
              ${s.date ? `<div style="font-size:11px;color:var(--text3)">${s.date}</div>` : ''}
            </div>
            ${s.suitability ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--surface3);color:${suitColorMap[s.suitability]||'var(--text2)'}">${s.suitability}</span>` : ''}
            <button class="btn btn-sm btn-primary" onclick="closeModal('modal-scout-status');navigateToScoutSheet('${s.projectId}',${s.idx})">View →</button>
          </div>`).join('')}
      </div>` : ''}
    ${st.techSheets.length ? `
      <div>
        <div style="font-family:var(--font-display);font-size:11px;letter-spacing:1.5px;color:var(--accent2);margin-bottom:8px">TECH CHECKLISTS</div>
        ${st.techSheets.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface2);border-radius:6px;margin-bottom:6px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${s.projectTitle}</div>
              ${s.date ? `<div style="font-size:11px;color:var(--text3)">${s.date}</div>` : ''}
            </div>
            <span style="font-size:11px;color:var(--text2)">${s.done}/${s.total}</span>
            <button class="btn btn-sm btn-primary" onclick="closeModal('modal-scout-status');navigateToTechScout('${s.projectId}',${s.idx})">View →</button>
          </div>`).join('')}
      </div>` : ''}`;
  openModal('modal-scout-status');
}

function navigateToScoutSheet(projectId, idx) {
  showProjectView(projectId);
  _activeScoutIdx = idx;
  _scoutMinimized = false;
  showSection('locations');
  setTimeout(() => document.getElementById('scouting-list')?.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function navigateToTechScout(projectId, idx) {
  showProjectView(projectId);
  _activeTechScoutIdx = idx;
  _techScoutMinimized = false;
  showSection('locations');
  setTimeout(() => document.getElementById('techscout-list')?.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function openCreateScoutModal(locName, type) {
  document.getElementById('create-scout-loc-name').value = locName;
  document.getElementById('create-scout-type').value = type;
  document.getElementById('create-scout-modal-title').textContent = type === 'scout' ? 'Create Scouting Sheet' : 'Create Tech Checklist';
  document.getElementById('create-scout-loc-display').textContent = locName;
  const sel = document.getElementById('create-scout-project-select');
  if (!store.projects.length) { showToast('No projects found', 'info'); return; }
  sel.innerHTML = store.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  openModal('modal-create-scout');
}

function confirmCreateScout() {
  const locName = document.getElementById('create-scout-loc-name').value;
  const type = document.getElementById('create-scout-type').value;
  const projectId = document.getElementById('create-scout-project-select').value;
  const p = store.projects.find(pr => pr.id === projectId);
  if (!p) return;
  closeModal('modal-create-scout');
  if (type === 'scout') {
    if (!p.scoutingSheets) p.scoutingSheets = [];
    let idx = p.scoutingSheets.findIndex(s => s.name?.toLowerCase() === locName.toLowerCase());
    if (idx === -1) { p.scoutingSheets.push({ name: locName, date: '', scoutedBy: '' }); idx = p.scoutingSheets.length - 1; saveStore(); }
    navigateToScoutSheet(projectId, idx);
  } else {
    if (!p.techScouts) p.techScouts = [];
    let idx = p.techScouts.findIndex(s => s.name?.toLowerCase() === locName.toLowerCase());
    if (idx === -1) { p.techScouts.push({ name: locName, date: '', checks: {} }); idx = p.techScouts.length - 1; saveStore(); }
    navigateToTechScout(projectId, idx);
  }
  showToast(`Opened for "${locName}" in ${p.title}`, 'success');
}

// ── PRINT / DOWNLOAD ──────────────────────────────────────────────────────────

function _scoutPrintStyles() {
  return `body{font-family:Georgia,serif;color:#111;background:#fff;max-width:900px;margin:0 auto;padding:24px}
    h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;font-weight:normal;color:#555;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .panel{border:1px solid #ccc;border-radius:6px;padding:12px}
    .panel-head{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:8px;font-family:sans-serif}
    .field{margin-bottom:10px}.label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-family:sans-serif;margin-bottom:2px}
    .value{font-size:13px;line-height:1.5;min-height:20px;border-bottom:1px solid #eee;padding-bottom:4px}
    .pros{border-left:3px solid #2a8;padding-left:8px}.cons{border-left:3px solid #c44;padding-left:8px}
    .suit{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:bold}
    @media print{body{padding:0}button{display:none}}
    .bf-footer{position:fixed;bottom:6mm;right:12mm;font-size:9px;color:#bbb;font-family:Arial,sans-serif}`;
}

function _scoutHtmlDoc(s, projectTitle) {
  const f = (label, val) => `<div class="field"><div class="label">${label}</div><div class="value">${val||''}</div></div>`;
  const suitColor = {'Excellent':'#0088ff','Good':'#2a8a50','Fair':'#b8860b','Poor':'#c04a00','Not Suitable':'#c03030'};
  const suitStyle = suitColor[s.suitability] ? `color:${suitColor[s.suitability]}` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scouting Sheet — ${s.name||'Location'}</title>
    <style>${_scoutPrintStyles()}</style></head><body>
    <h1>Scouting Sheet — ${s.name||'Location'}</h1>
    <h2>${projectTitle || ''} ${s.date ? '| '+s.date : ''} ${s.scoutedBy ? '| Scouted by '+s.scoutedBy : ''}</h2>
    <div class="grid">
      <div class="panel"><div class="panel-head">Site Info</div>${f('Address',s.address)}${f('Contact Person',s.contact)}</div>
      <div class="panel"><div class="panel-head">Evaluation</div>
        <div class="field"><div class="label">Overall Suitability</div><div class="value"><span class="suit" style="${suitStyle}">${s.suitability||'—'}</span></div></div>
        ${f('General Notes',s.info)}</div>
    </div>
    <div class="grid">
      <div class="panel"><div class="panel-head">Technical</div>${f('Lighting',s.lighting)}${f('Sound',s.sound)}${f('Power & Electrical',s.power)}</div>
      <div class="panel"><div class="panel-head">Production</div>${f('Accessibility',s.accessibility)}${f('Permissions / Legal',s.permissions)}${f('Logistics',s.logistics)}</div>
    </div>
    <div class="grid">
      <div class="panel pros"><div class="panel-head">Pros</div><div class="value">${s.pros||''}</div></div>
      <div class="panel cons"><div class="panel-head">Cons</div><div class="value">${s.cons||''}</div></div>
    </div>
    <div class="grid">
      <div class="panel"><div class="panel-head">Set Dressing Notes</div><div class="value">${s.setDressing||''}</div></div>
      <div class="panel"><div class="panel-head">Networking Notes</div><div class="value">${s.networking||''}</div></div>
    </div>
    <div class="bf-footer">Powered by Black Fountain · blackfountain.io</div>
    </body></html>`;
}

function _printScoutingSheet(i) {
  const p = currentProject(); if (!p) return;
  const s = p.scoutingSheets[i]; if (!s) return;
  const w = window.open('', '_blank');
  w.document.write(_scoutHtmlDoc(s, p.title));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function _downloadScoutingSheet(i) {
  const p = currentProject(); if (!p) return;
  const s = p.scoutingSheets[i]; if (!s) return;
  const html = _scoutHtmlDoc(s, p.title);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = `scouting-sheet-${(s.name||'location').replace(/\s+/g,'-').toLowerCase()}.html`;
  a.click();
}

function _techScoutHtmlDoc(scout, projectTitle) {
  const checksTotal = Object.values(TECH_SCOUT_ITEMS).reduce((a,b) => a + b.length, 0);
  const checksDone = Object.values(scout.checks || {}).filter(Boolean).length;
  const cats = Object.entries(TECH_SCOUT_ITEMS).map(([cat, items]) => {
    const rows = items.map((item, ii) => {
      const key = cat+'_'+ii;
      const checked = (scout.checks||{})[key];
      return `<tr><td style="padding:5px 8px;font-size:12px;border-bottom:1px solid #eee">${checked ? '☑' : '☐'} ${item}</td></tr>`;
    }).join('');
    const notes = (scout['notes_'+cat]) || '';
    return `<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#555;border-bottom:2px solid #ccc;padding-bottom:4px;margin-top:20px">${cat}</h3>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${notes ? `<div style="margin-top:6px;font-size:12px;color:#444;padding:6px 8px;background:#f9f9f9;border-radius:4px"><em>Notes: ${notes}</em></div>` : ''}`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tech Scout — ${scout.name||'Location'}</title>
    <style>body{font-family:sans-serif;color:#111;max-width:900px;margin:0 auto;padding:24px}
    h1{font-size:20px}h2{font-weight:normal;color:#555;font-size:13px;margin-bottom:16px}
    @media print{body{padding:0}button{display:none}}</style></head><body>
    <h1>Tech Scout Checklist — ${scout.name||'Location'}</h1>
    <h2>${projectTitle||''} ${scout.date ? '| '+scout.date : ''} &nbsp;|&nbsp; ${checksDone}/${checksTotal} items checked</h2>
    ${cats}
    <div class="bf-footer">Powered by Black Fountain · blackfountain.io</div>
    </body></html>`;
}

function _printTechScout(i) {
  const p = currentProject(); if (!p) return;
  const s = p.techScouts[i]; if (!s) return;
  const w = window.open('', '_blank');
  w.document.write(_techScoutHtmlDoc(s, p.title));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function _downloadTechScout(i) {
  const p = currentProject(); if (!p) return;
  const s = p.techScouts[i]; if (!s) return;
  const html = _techScoutHtmlDoc(s, p.title);
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = `tech-scout-${(s.name||'location').replace(/\s+/g,'-').toLowerCase()}.html`;
  a.click();
}

// ── LOCATION AUTOCOMPLETE (Nominatim / OpenStreetMap) ──────────────────────
// Attach to any input with data-loc-auto attribute
// Usage in HTML:  <input data-loc-auto placeholder="Search location…">
// Usage in JS-generated inputs: call attachLocAuto(inputElement) after creation

(function() {
  let _acTimer = null;
  let _acActive = null; // currently open dropdown element

  function buildDropdown() {
    const d = document.createElement('div');
    d.className = 'loc-auto-dropdown';
    d.style.cssText = `
      position:absolute; z-index:9999; background:#fff; color:#111;
      border:1px solid #ccc; border-radius:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.15); max-height:220px;
      overflow-y:auto; width:100%; top:100%; left:0; margin-top:4px;
    `;
    return d;
  }

  function closeDropdown() {
    if (_acActive) { _acActive.remove(); _acActive = null; }
  }

  function search(input, query) {
    if (query.length < 3) { closeDropdown(); return; }
    clearTimeout(_acTimer);
    _acTimer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        renderDropdown(input, data);
      } catch(e) { /* silently fail if offline */ }
    }, 350);
  }

  function renderDropdown(input, results) {
    closeDropdown();
    if (!results || !results.length) return;

    const wrap = input.parentElement;
    const prevPos = getComputedStyle(wrap).position;
    if (prevPos === 'static') wrap.style.position = 'relative';

    const d = buildDropdown();
    results.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;line-height:1.4;color:#111;';
      const main = r.namedetails && r.namedetails.name ? r.namedetails.name : r.display_name.split(',')[0];
      const rest = r.display_name.split(',').slice(1, 4).join(',').trim();
      item.innerHTML = `<strong>${main}</strong><br><span style="font-size:11px;opacity:.6">${rest}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = r.display_name;
        input.dataset.lat = r.lat;
        input.dataset.lon = r.lon;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('loc-selected', { bubbles: true }));
        closeDropdown();
      });
      item.addEventListener('mouseover', () => item.style.background = '#f5f5f5');
      item.addEventListener('mouseout',  () => item.style.background = '');
      d.appendChild(item);
    });
    wrap.appendChild(d);
    _acActive = d;
  }

  function attachLocAuto(input) {
    if (input.dataset.locAutoAttached) return;
    input.dataset.locAutoAttached = '1';
    input.addEventListener('input',  () => search(input, input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
    input.addEventListener('blur',   () => setTimeout(closeDropdown, 150));
  }

  // Attach to static inputs on page load
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-loc-auto]').forEach(attachLocAuto);
  });

  // Expose globally so dynamic inputs (callsheet rows etc) can also use it
  window.attachLocAuto = attachLocAuto;
  document.addEventListener('click', e => { if (_acActive && !_acActive.contains(e.target)) closeDropdown(); });
})();

// ── HOSPITAL AUTOCOMPLETE ───────────────────────────────────────────────────
// Like attachLocAuto but searches specifically for hospitals/A&E near the city

(function() {
  let _hTimer = null;
  let _hActive = null;

  function buildDropdown() {
    const d = document.createElement('div');
    d.style.cssText = `
      position:absolute; z-index:9999; background:#fff; color:#111;
      border:1px solid #ccc; border-radius:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.15); max-height:220px;
      overflow-y:auto; width:100%; top:100%; left:0; margin-top:4px;
    `;
    return d;
  }

  function closeDropdown() {
    if (_hActive) { _hActive.remove(); _hActive = null; }
  }

  function getCityForRow(input) {
    // Walk up to the <tr>, then find the city input in the same row
    const tr = input.closest('tr');
    if (!tr) return '';
    const cityInput = tr.querySelector('td:nth-child(2) input');
    return cityInput ? cityInput.value.trim() : '';
  }

  function search(input, query) {
    if (query.length < 2) { closeDropdown(); return; }
    clearTimeout(_hTimer);
    _hTimer = setTimeout(async () => {
      try {
        const city = getCityForRow(input);
        // Search for hospitals — if we have a city, bias strongly toward it
        const q = city ? `hospital ${query} ${city}` : `hospital ${query}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&namedetails=1&limit=6&q=${encodeURIComponent(q)}`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        // Filter to only hospital/clinic type results
        const hospitals = data.filter(r =>
          ['hospital','clinic','doctors','pharmacy','health','emergency'].some(t =>
            (r.type||'').includes(t) || (r.class||'').includes(t) || (r.display_name||'').toLowerCase().includes(t)
          )
        );
        renderDropdown(input, hospitals.length ? hospitals : data.slice(0, 4));
      } catch(e) {}
    }, 350);
  }

  function renderDropdown(input, results) {
    closeDropdown();
    if (!results || !results.length) return;

    const wrap = input.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    const d = buildDropdown();
    results.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;line-height:1.4;color:#111;';
      const name = r.namedetails?.name || r.display_name.split(',')[0];
      const addr = r.address;
      const parts = [addr?.road, addr?.city || addr?.town || addr?.village, addr?.postcode].filter(Boolean);
      item.innerHTML = `<strong>🏥 ${name}</strong><br><span style="font-size:11px;opacity:.5">${parts.join(', ')}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        // Fill with name + postcode — most useful for a callsheet
        const postcode = addr?.postcode ? ` · ${addr.postcode}` : '';
        input.value = name + postcode;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDropdown();
      });
      item.addEventListener('mouseover', () => item.style.background = '#f5f5f5');
      item.addEventListener('mouseout',  () => item.style.background = '');
      d.appendChild(item);
    });
    wrap.appendChild(d);
    _hActive = d;
  }

  function attachHospAuto(input) {
    if (input.dataset.hospAutoAttached) return;
    input.dataset.hospAutoAttached = '1';
    input.addEventListener('input',  () => search(input, input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
    input.addEventListener('blur',   () => setTimeout(closeDropdown, 150));
  }

  window.attachHospAuto = attachHospAuto;
  document.addEventListener('click', e => { if (_hActive && !_hActive.contains(e.target)) closeDropdown(); });
})();

// ── CALLSHEET WEATHER (Open-Meteo, free, no key) ───────────────────────────

async function fetchCallsheetWeather(csIdx) {
  const p = currentProject();
  const c = p.callsheets[csIdx];
  if (!c || !c.date) { showToast('Set a date first', 'info'); return; }

  let lat, lon, resolvedName;
  const firstRow = (c.locRows || [])[0] || {};
  const firstLoc = firstRow.city || firstRow.loc || '';

  // Prefer coords already stored by the autocomplete on a location input
  const locInputs = document.querySelectorAll('[data-loc-auto]');
  for (const inp of locInputs) {
    if (inp.dataset.lat && inp.dataset.lon) {
      lat = parseFloat(inp.dataset.lat);
      lon = parseFloat(inp.dataset.lon);
      resolvedName = inp.value;
      break;
    }
  }

  // Fallback: geocode the freetext location, but confirm with user first
  if ((!lat || !lon) && firstLoc) {
    try {
      showToast('Finding location…', 'info');
      const cc = (navigator.language || 'en-GB').split('-')[1]?.toLowerCase() || 'gb';
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(firstLoc)}`);
      const geoData = await geo.json();

      if (!geoData.length) { showToast('Could not find that location', 'info'); return; }

      // If there are multiple results or the name is ambiguous, confirm with user
      const candidates = geoData.slice(0, 5).map(r => {
        const a = r.address;
        const parts = [r.name, a?.county || a?.state_district, a?.state, a?.country].filter(Boolean);
        return { label: parts.join(', '), lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
      });

      // Show a quick picker toast/modal
      const confirmed = await confirmWeatherLocation(candidates, firstLoc);
      if (!confirmed) return;
      lat = confirmed.lat;
      lon = confirmed.lon;
      resolvedName = confirmed.label;
    } catch(e) {
      showToast('Could not find that location', 'info'); return;
    }
  }

  if (!lat || !lon) { showToast('Add a location first so we know where to check', 'info'); return; }

  try {
    showToast(`Fetching weather for ${resolvedName}…`, 'info');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${c.date}&end_date=${c.date}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.daily?.weathercode) { showToast('No forecast data for that date', 'info'); return; }

    const code = data.daily.weathercode[0];
    const tMax = Math.round(data.daily.temperature_2m_max[0]);
    const tMin = Math.round(data.daily.temperature_2m_min[0]);
    const rain = data.daily.precipitation_sum[0]?.toFixed(1);
    const wind = Math.round(data.daily.windspeed_10m_max[0]);

    const WMO = {
      0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
      61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',
      75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',
      82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',
      95:'Thunderstorm',96:'Thunderstorm + hail',99:'Heavy thunderstorm'
    };
    const EMOJI = {
      0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',51:'🌦',53:'🌦',55:'🌧',
      61:'🌧',63:'🌧',65:'🌧',71:'🌨',73:'🌨',75:'🌨',77:'🌨',80:'🌦',
      81:'🌧',82:'⛈',85:'🌨',86:'🌨',95:'⛈',96:'⛈',99:'⛈'
    };

    c.weather       = `${EMOJI[code] || '🌡'} ${WMO[code] || 'Unknown'}`;
    c.weatherDetail = `${tMin}°C – ${tMax}°C · Rain ${rain}mm · Wind ${wind}km/h`;
    saveStore();
    renderCallsheet(p);
    showToast(`Weather updated for ${resolvedName} ✓`, 'success');
  } catch(e) {
    showToast('Could not fetch weather — check connection', 'info');
  }
}

// Small inline location picker — returns a promise resolving to {lat,lon,label} or null
function confirmWeatherLocation(candidates, originalQuery) {
  return new Promise(resolve => {
    // Remove any existing picker
    document.getElementById('weather-loc-picker')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'weather-loc-picker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#111;border-radius:10px;padding:24px;max-width:420px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;';
    box.innerHTML = `
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Confirm Location</div>
      <div style="font-size:13px;color:#555;margin-bottom:16px;">We searched for <strong>"${originalQuery}"</strong> — which did you mean?</div>
      <div id="wlp-options" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;"></div>
      <button style="width:100%;padding:8px;background:#f0f0f0;border:none;border-radius:6px;cursor:pointer;font-size:13px;color:#555;" id="wlp-cancel">Cancel</button>
    `;

    candidates.forEach(c => {
      const btn = document.createElement('button');
      btn.style.cssText = 'width:100%;padding:10px 14px;background:#f8f8f8;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;text-align:left;';
      btn.textContent = c.label;
      btn.addEventListener('mouseover', () => btn.style.background = '#e8f0fe');
      btn.addEventListener('mouseout',  () => btn.style.background = '#f8f8f8');
      btn.addEventListener('click', () => { overlay.remove(); resolve(c); });
      box.querySelector('#wlp-options').appendChild(btn);
    });

    box.querySelector('#wlp-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// ══════════════════════════════════════════
