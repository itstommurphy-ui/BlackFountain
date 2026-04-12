// ══════════════════════════════════════════════════════════════════════════════
// BLACK FOUNTAIN — SHARED PDF / PRINT SYSTEM
// bf-print.js  (load once, before schedule.js)
//
// Replaces the old _openPrintWindow in schedule.js with a consistent system.
// All existing _openPrintWindow(htmlContent, title) calls continue to work
// unchanged — they now go through _bfPrint() automatically.
//
// Additional usage:
//   _bfPrint({ title, subtitle, body, section })
//   _bfPrint({ title, subtitle, body, section, noAutoprint: true }) → returns window
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared stylesheet ─────────────────────────────────────────────────────────
// One source of truth. Every export gets this.

function _bfPrintCSS() {
  return `
    @page { margin: 18mm 20mm; size: A4; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      color: #111;
      background: #fff;
      line-height: 1.5;
      padding-bottom: 25px;
    }

    /* ── Page header ── */
    .bf-doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2pt solid #111;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .bf-doc-header-left {}
    .bf-doc-company {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #888;
      margin-bottom: 3px;
    }
    .bf-doc-title {
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 1px;
      color: #111;
      line-height: 1.1;
    }
    .bf-doc-subtitle {
      font-size: 9.5pt;
      color: #555;
      margin-top: 4px;
    }
    .bf-doc-logo {
      border: 1.5pt solid #111;
      padding: 5px 10px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-align: center;
      line-height: 1.4;
      color: #111;
      flex-shrink: 0;
    }

    /* ── Section headings ── */
    h2 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1pt solid #ccc;
      padding-bottom: 4px;
      margin: 20px 0 10px;
      color: #111;
    }
    h3 {
      font-size: 10pt;
      font-weight: 700;
      margin: 16px 0 8px;
      color: #333;
    }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 9.5pt;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 6px 8px;
      text-align: left;
      font-size: 8.5pt;
      font-weight: 600;
      letter-spacing: 0.3px;
      border: 0.5pt solid #111;
    }
    td {
      padding: 6px 8px;
      border: 0.5pt solid #ccc;
      vertical-align: top;
      line-height: 1.4;
    }
    tr:nth-child(even) td { background: #f8f8f8; }

    /* ── Meta / field blocks ── */
    .bf-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 20px;
      margin-bottom: 18px;
      padding: 12px 14px;
      border: 0.5pt solid #ccc;
      background: #fafafa;
    }
    .bf-meta-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #888;
      margin-bottom: 2px;
    }
    .bf-meta-value {
      font-size: 10pt;
      color: #111;
      border-bottom: 0.5pt solid #ddd;
      padding-bottom: 2px;
      min-height: 16px;
    }

    /* ── Field (brief style) ── */
    .bf-field {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .bf-field-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #888;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .bf-field-value {
      font-size: 10.5pt;
      color: #111;
      line-height: 1.65;
      padding-bottom: 6px;
      border-bottom: 0.5pt solid #eee;
    }

    /* ── Risk factor badges ── */
    .rf-low  { color: #1a7a30; font-weight: 700; }
    .rf-med  { color: #8a6000; font-weight: 700; }
    .rf-high { color: #a01020; font-weight: 700; }

    /* ── Persons at risk key ── */
    .bf-key {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 8.5pt;
      color: #555;
      padding: 8px 12px;
      border: 0.5pt solid #ddd;
      background: #fafafa;
      margin-bottom: 16px;
    }

    /* ── Signature block ── */
    .bf-sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 12px 14px;
      border: 0.5pt solid #ccc;
      margin-bottom: 16px;
    }
    .bf-sig-line {
      border-bottom: 0.5pt solid #999;
      height: 26pt;
      margin-top: 6px;
    }

    /* ── Stripboard strips ── */
    .bf-strip {
      display: flex;
      align-items: stretch;
      border: 0.5pt solid #ccc;
      margin-bottom: 3pt;
      page-break-inside: avoid;
      font-size: 9pt;
    }
    .bf-strip-swatch {
      width: 8pt;
      flex-shrink: 0;
    }
    .bf-strip-body {
      flex: 1;
      padding: 4pt 6pt;
    }
    .bf-strip-heading {
      font-weight: 700;
      font-size: 8pt;
      color: #fff;
      background: #1a1a1a;
      padding: 3pt 8pt;
      margin-bottom: 4pt;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* ── Day headers ── */
    .bf-day-header {
      background: #111;
      color: #fff;
      padding: 5pt 8pt;
      font-size: 10pt;
      font-weight: 700;
      margin: 14pt 0 6pt;
      letter-spacing: 0.5px;
    }

    /* ── Footer ── */
    .bf-doc-footer {
      position: fixed;
      bottom: 10mm;
      left: 20mm;
      right: 20mm;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #bbb;
      border-top: 0.5pt solid #e0e0e0;
      padding-top: 4pt;
    }

    /* ── Print layout fixes ── */
    @media print {
      body {
        padding-bottom: 30mm !important;
      }
      table {
        margin-bottom: 20mm !important;
        page-break-inside: auto;
      }
      .day-header td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    /* ── Print button (screen only) ── */
    .bf-print-btn {
      margin-bottom: 16px;
    }
    .bf-print-btn button {
      padding: 8px 18px;
      font-size: 12px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }
    @media print {
      .bf-print-btn { display: none; }
      body { padding: 0; }
    }
  `;
}

// ── Shell builder ─────────────────────────────────────────────────────────────

/**
 * _bfPrint(opts)
 *
 * opts: {
 *   title      — document title (e.g. "The Cake Man — Cast")
 *   subtitle   — smaller line below title (e.g. "Generated 9 Apr 2026")
 *   body       — HTML string for the main content area
 *   section    — section name shown in footer left (e.g. "Cast & Crew")
 *   noAutoprint — if true, returns the window instead of calling .print()
 * }
 *
 * OR call as _bfPrint(htmlContent, windowTitle) to match old _openPrintWindow API.
 */
function _bfPrint(optsOrHtml, legacyTitle) {
  // Backwards-compat: _openPrintWindow(htmlContent, title)
  let opts;
  if (typeof optsOrHtml === 'string') {
    // Legacy call — wrap the raw HTML in the new shell
    const p = currentProject();
    opts = {
      title:    legacyTitle || (p?.title || 'Black Fountain'),
      subtitle: 'Generated ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      body:     optsOrHtml,
      section:  '',
    };
  } else {
    opts = optsOrHtml;
  }

  const p           = currentProject();
  const companyName = window.store?.settings?.companyName || '';
  const projectTitle= p?.title || '';

  // Split "PROJECT — Section" title if it contains that pattern
  let docTitle   = opts.title || projectTitle;
  let docSection = opts.section || '';
  if (!docSection && docTitle.includes(' — ')) {
    const parts = docTitle.split(' — ');
    docTitle   = parts[0];
    docSection = parts.slice(1).join(' — ');
  }

  const subtitle = opts.subtitle ||
    'Generated ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${_bfEscHtml(opts.title || docTitle + (docSection ? ' — ' + docSection : ''))}</title>
  <style>${_bfPrintCSS()}</style>
</head>
<body>
  <div class="bf-print-btn"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>

  <div class="bf-doc-header">
    <div class="bf-doc-header-left">
      ${companyName ? `<div class="bf-doc-company">${_bfEscHtml(companyName)}</div>` : ''}
      <div class="bf-doc-title">${_bfEscHtml(docTitle)}${docSection ? `<span style="font-weight:400;opacity:0.55"> — ${_bfEscHtml(docSection)}</span>` : ''}</div>
      <div class="bf-doc-subtitle">${_bfEscHtml(subtitle)}</div>
    </div>
    <div class="bf-doc-logo">BLACK<br>FOUNTAIN</div>
  </div>

  ${opts.body || ''}

  <div class="bf-doc-footer">
    <span>${_bfEscHtml(docTitle)}${docSection ? ' — ' + _bfEscHtml(docSection) : ''}</span>
    <span>Black Fountain · blackfountain.io</span>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('Pop-up blocked — allow pop-ups and try again', 'info'); return null; }
  w.document.write(html);
  w.document.close();

  if (opts.noAutoprint) return w;

  // Auto-focus so Cmd+P works immediately, but don't auto-trigger print
  // (user clicks the button, or Cmd+P — avoids the "blank page" race on slow machines)
  w.focus();
  return w;
}

// Backwards-compat alias — all existing _openPrintWindow calls route here
function _openPrintWindow(htmlContent, title) {
  return _bfPrint(htmlContent, title);
}

function _bfEscHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ══════════════════════════════════════════════════════════════════════════════
// ENHANCED EXPORT FUNCTIONS
// These replace the bare-bones versions in schedule.js.
// Paste these over the existing functions of the same name.
// ══════════════════════════════════════════════════════════════════════════════

// ── Risk Assessment PDF ───────────────────────────────────────────────────────
// NOTE: This is the legacy CSV export used for schedule.js exportRiskPDF.
// The new A4 document version in risk.js (_raPrintFilled / _raPrintBlank)
// is the primary path. This one remains for the Export CSV button fallback.
function exportRiskPDF() {
  const p = currentProject();
  if (!p.risks?.length) { showToast('No risk assessment entries to export', 'info'); return; }
  // Delegate to the rich A4 version in risk.js if available
  if (typeof _raPrintFilled === 'function') { _raPrintFilled(); return; }
  // Fallback: basic table
  const rfClass = n => parseInt(n) <= 2 ? 'rf-low' : parseInt(n) <= 3 ? 'rf-med' : 'rf-high';
  const meta = p.riskMeta || {};
  const rows = p.risks.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${_bfEscHtml(r.hazard)}</td>
      <td>${_bfEscHtml(r.who)}</td>
      <td class="${rfClass(r.factor)}">${r.factor || '—'}</td>
      <td>${_bfEscHtml(r.controls)}</td>
      <td>${_bfEscHtml(r.further) || 'None'}</td>
      <td class="${rfClass(r.newfactor)}">${r.newfactor || '—'}</td>
    </tr>`).join('');

  _bfPrint({
    title:    p.title,
    section:  'Risk Assessment',
    subtitle: `PM: ${meta.pm || '—'} · Date: ${meta.date || '—'} · Location: ${meta.location || '—'}`,
    body: `
      <table>
        <thead><tr>
          <th style="width:24pt">#</th>
          <th>Hazard</th>
          <th>Who might be harmed &amp; how?</th>
          <th style="width:44pt">Risk Factor</th>
          <th>Control Measures</th>
          <th>Further Action?</th>
          <th style="width:44pt">Revised Risk Factor</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="bf-key">
        <strong style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1px;color:#555">Persons at risk:</strong>
        <span>C — Cast</span><span>CR — Crew</span><span>M — Members of Public</span>
        <span>O — Occupiers</span><span>V — Visitors</span><span>SC — Sub-Contractors</span>
      </div>
      <div class="bf-sig-grid">
        <div><div class="bf-meta-label">Assessor (printed)</div><div class="bf-sig-line"></div></div>
        <div><div class="bf-meta-label">Signature</div><div class="bf-sig-line"></div></div>
        <div><div class="bf-meta-label">Date Signed</div>
          <div class="bf-meta-value">${_bfEscHtml(meta.sigdate)}</div></div>
      </div>`,
  });
}

// ── Cast PDF ──────────────────────────────────────────────────────────────────
function exportCastPDF() {
  const p = currentProject();
  if (!p.cast?.length) { showToast('No cast to export', 'info'); return; }
  const rows = p.cast.map(c => `
    <tr>
      <td>${_bfEscHtml(c.name)}</td>
      <td>${_bfEscHtml(c.role)}</td>
      <td>${_bfEscHtml(c.number)}</td>
      <td>${_bfEscHtml(c.email)}</td>
      <td>${_bfEscHtml(c.notes)}</td>
      <td>${c.confirmed ? '✓' : ''}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Cast',
    body: `<table>
      <thead><tr><th>Name</th><th>Role / Character</th><th>Number</th><th>Email</th><th>Notes</th><th style="width:40pt">Confirmed</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Extras PDF ────────────────────────────────────────────────────────────────
function exportExtrasPDF() {
  const p = currentProject();
  if (!p.extras?.length) { showToast('No extras to export', 'info'); return; }
  const rows = p.extras.map(c => `
    <tr>
      <td>${_bfEscHtml(c.name)}</td>
      <td>${_bfEscHtml(c.role)}</td>
      <td>${_bfEscHtml(c.number)}</td>
      <td>${_bfEscHtml(c.email)}</td>
      <td>${_bfEscHtml(c.notes)}</td>
      <td>${c.confirmed ? '✓' : ''}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Supporting Artists (Extras)',
    body: `<table>
      <thead><tr><th>Name</th><th>Role</th><th>Number</th><th>Email</th><th>Notes</th><th style="width:40pt">Confirmed</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Crew PDF ──────────────────────────────────────────────────────────────────
function exportCrewPDF() {
  const p = currentProject();
  if (!p.crew?.length) { showToast('No crew to export', 'info'); return; }
  const sorted = [...p.crew].sort((a, b) => (a.dept || '').localeCompare(b.dept || ''));
  const rows = sorted.map(c => `
    <tr>
      <td>${_bfEscHtml(c.name)}</td>
      <td>${_bfEscHtml(c.dept)}</td>
      <td>${_bfEscHtml(c.role)}</td>
      <td>${_bfEscHtml(c.email)}</td>
      <td>${_bfEscHtml(c.number)}</td>
      <td>${_bfEscHtml(c.notes)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Crew',
    body: `<table>
      <thead><tr><th>Name</th><th>Department</th><th>Role</th><th>Email</th><th>Number</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Equipment PDF ─────────────────────────────────────────────────────────────
function exportEquipmentPDF() {
  const p = currentProject();
  if (!p.gear?.length) { showToast('No equipment to export', 'info'); return; }
  let body = '';
  p.gear.forEach(day => {
    body += `<h2>${_bfEscHtml(day.label || 'Gear Day')}</h2>`;
    if (!day.items?.length) { body += `<p style="color:#888;font-style:italic;font-size:9pt">No items</p>`; return; }
    const rows = day.items.map(i => `
      <tr>
        <td>${_bfEscHtml(i.name)}</td>
        <td>${_bfEscHtml(i.qty)}</td>
        <td>${_bfEscHtml(i.source)}</td>
        <td>${_bfEscHtml(i.notes)}</td>
        <td style="text-align:center">${i.checked ? '✓' : ''}</td>
      </tr>`).join('');
    body += `<table>
      <thead><tr><th>Item</th><th style="width:40pt">Qty</th><th>Source</th><th>Notes</th><th style="width:36pt">✓</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  });
  _bfPrint({ title: p.title, section: 'Equipment Checklist', body });
}

// ── Locations PDF ─────────────────────────────────────────────────────────────
function exportLocationsPDF() {
  const p = currentProject();
  if (!p.locations?.length) { showToast('No locations to export', 'info'); return; }
  const rows = p.locations.map(l => `
    <tr>
      <td><strong>${_bfEscHtml(l.name)}</strong></td>
      <td>${_bfEscHtml(l.scene)}</td>
      <td>${_bfEscHtml(l.suit)}</td>
      <td>${_bfEscHtml(l.contacted)}</td>
      <td>${_bfEscHtml(l.avail)}</td>
      <td>${_bfEscHtml(l.cost)}</td>
      <td>${_bfEscHtml(l.access)}</td>
      <td>${_bfEscHtml(l.recce)}</td>
      <td>${_bfEscHtml(l.decision)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Locations',
    body: `<table>
      <thead><tr>
        <th>Location</th><th>Scene</th><th>Suitability</th><th>Contacted</th>
        <th>Availability</th><th>Cost/Fee</th><th>Accessibility</th>
        <th style="width:48pt">Recce Done</th><th>Decision</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Props PDF ─────────────────────────────────────────────────────────────────
function exportPropsPDF() {
  const p = currentProject();
  if (!p.props?.length) { showToast('No props to export', 'info'); return; }
  const rows = p.props.map(pr => `
    <tr>
      <td>${_bfEscHtml(pr.name)}</td>
      <td style="text-align:center">${_bfEscHtml(pr.qty)}</td>
      <td>${_bfEscHtml(pr.chars)}</td>
      <td>${_bfEscHtml(pr.scenes)}</td>
      <td>${_bfEscHtml(pr.locs)}</td>
      <td>${_bfEscHtml(pr.pgs)}</td>
      <td>${_bfEscHtml(pr.notes)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Props List',
    body: `<table>
      <thead><tr><th>Prop</th><th style="width:36pt">Qty</th><th>Character/s</th><th>Scene/s</th><th>Location/s</th><th style="width:40pt">Page/s</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Wardrobe PDF ──────────────────────────────────────────────────────────────
function exportWardrobePDF() {
  const p = currentProject();
  if (!p.wardrobe?.length) { showToast('No wardrobe items to export', 'info'); return; }
  const rows = p.wardrobe.map(w => `
    <tr>
      <td>${_bfEscHtml(w.name)}</td>
      <td>${_bfEscHtml(w.chars)}</td>
      <td>${_bfEscHtml(w.scenes)}</td>
      <td>${_bfEscHtml(w.size)}</td>
      <td>${_bfEscHtml(w.condition)}</td>
      <td>${_bfEscHtml(w.loc)}</td>
      <td>${_bfEscHtml(w.notes)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Wardrobe / Costume / Make-Up',
    body: `<table>
      <thead><tr><th>Item</th><th>Character/s</th><th>Scene/s</th><th>Size</th><th>Condition</th><th>Location</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Sound Log PDF ─────────────────────────────────────────────────────────────
function exportSoundLogPDF() {
  const p = currentProject();
  if (!p.soundlog?.length) { showToast('No sound log entries to export', 'info'); return; }
  const rows = p.soundlog.map(s => `
    <tr>
      <td>${_bfEscHtml(s.scene)}</td>
      <td>${_bfEscHtml(s.shot)}</td>
      <td>${_bfEscHtml(s.take)}</td>
      <td>${_bfEscHtml(s.comments)}</td>
      <td>${_bfEscHtml(s.track1)}</td>
      <td>${_bfEscHtml(s.lav)}</td>
      <td>${_bfEscHtml(s.additional)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Sound Log',
    body: `<table>
      <thead><tr><th>Scene</th><th>Shot</th><th>Take</th><th>Comments</th><th>Track 1</th><th>Lav</th><th>Additional Audio</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Release Forms PDF ─────────────────────────────────────────────────────────
function exportReleasesPDF() {
  const p = currentProject();
  if (!p.releases?.length) { showToast('No release forms to export', 'info'); return; }
  const rows = p.releases.map(r => `
    <tr>
      <td>${r.type === 'talent' ? 'Talent Release' : 'Location Release'}</td>
      <td>${_bfEscHtml(r.name)}</td>
      <td style="text-align:center">${r.signed ? '✓ Signed' : '○ Unsigned'}</td>
      <td>${_bfEscHtml(r.dateSigned || r.date || '')}</td>
      <td>${_bfEscHtml(r.notes)}</td>
    </tr>`).join('');
  _bfPrint({
    title: p.title, section: 'Release Forms',
    body: `<table>
      <thead><tr><th>Type</th><th>Name</th><th style="width:56pt">Status</th><th style="width:56pt">Date Signed</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

// ── Stripboard PDF ────────────────────────────────────────────────────────────
function exportStripboardPDF() {
  const p = currentProject();
  if (!p?.stripboard) { showToast('No stripboard to export', 'info'); return; }
  const sb   = p.stripboard;
  const data = _sbBuildSceneData(p);
  const allKeys       = Object.keys(data);
  const scheduledKeys = new Set((sb.days || []).flatMap(d => d.sceneKeys || []));
  const unscheduled   = allKeys.filter(k => !scheduledKeys.has(k));

  // Tally total pages
  let totalEighths = 0;
  allKeys.forEach(k => {
    if (data[k]) totalEighths += Math.max(1, Math.round((data[k].scene.lineCount || 1) / 6.75));
  });
  const _eighths = n => n >= 8 ? `${Math.floor(n/8)}-${n%8||'0'}/8` : `${n}/8`;

  let body = `<p style="font-size:9pt;color:#555;margin-bottom:16px">
    ${scheduledKeys.size} of ${allKeys.length} scenes scheduled · ${sb.days.length} shoot day${sb.days.length !== 1 ? 's' : ''} · ~${_eighths(totalEighths)} pages
  </p>`;

  // Shoot days
  if (sb.days?.length) {
    sb.days.forEach((day, idx) => {
      const dayKeys = day.sceneKeys || [];
      let dayEighths = 0;
      dayKeys.forEach(k => {
        if (data[k]) dayEighths += Math.max(1, Math.round((data[k].scene.lineCount || 1) / 6.75));
      });
      body += `<div class="bf-day-header">Day ${idx + 1} — ${_bfEscHtml(day.label)}${day.date ? ' · ' + day.date : ''} &nbsp;|&nbsp; ${dayKeys.length} scene${dayKeys.length !== 1 ? 's' : ''} · ~${_eighths(dayEighths)} pages</div>`;
      if (!dayKeys.length) {
        body += `<p style="color:#888;font-style:italic;font-size:9pt;margin-bottom:8pt">No scenes scheduled</p>`;
      } else {
        const rows = dayKeys.map(k => {
          const d = data[k];
          if (!d) return `<tr><td colspan="4">${_bfEscHtml(k)}</td></tr>`;
          const [, swatch] = _sbStripColor(d.scene.intExt, d.scene.tod);
          const cast = d.cast.join(', ');
          return `<tr>
            <td style="width:8pt;background:${swatch};padding:0"></td>
            <td style="width:28pt">${_bfEscHtml(d.scene.sceneNumber || '')}</td>
            <td><strong>${_bfEscHtml(d.scene.location || k)}</strong>${cast ? `<br><span style="font-size:8pt;color:#666">${_bfEscHtml(cast)}</span>` : ''}</td>
            <td style="width:28pt;font-size:8.5pt;color:#555">${_bfEscHtml(d.scene.intExt || '')}</td>
            <td style="width:30pt;font-size:8.5pt;color:#555">${_bfEscHtml(d.scene.tod || '')}</td>
            <td style="width:36pt;text-align:right">${_eighths(Math.max(1, Math.round((d.scene.lineCount || 1) / 6.75)))}</td>
          </tr>`;
        }).join('');
        body += `<table style="margin-bottom:12pt">
          <thead><tr>
            <th style="width:8pt;padding:0"></th>
            <th style="width:28pt">Sc#</th>
            <th>Scene / Cast</th>
            <th style="width:28pt">Int/Ext</th>
            <th style="width:30pt">Time</th>
            <th style="width:36pt;text-align:right">Pages</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      }
    });
  }

  // Unscheduled
  if (unscheduled.length) {
    body += `<h2>Unscheduled (${unscheduled.length})</h2>`;
    const rows = unscheduled.map(k => {
      const d = data[k];
      return `<tr>
        <td>${_bfEscHtml(k)}</td>
        <td>${d ? _bfEscHtml(d.scene.location || d.scene.heading) : ''}</td>
        <td>${d ? _bfEscHtml(d.scene.intExt || '') : ''}</td>
        <td>${d ? _bfEscHtml(d.scene.tod || '') : ''}</td>
        <td style="text-align:right">${d ? _eighths(Math.max(1, Math.round((d.scene.lineCount || 1) / 6.75))) : ''}</td>
      </tr>`;
    }).join('');
    body += `<table>
      <thead><tr><th>Sc#</th><th>Scene</th><th>Int/Ext</th><th>Time</th><th style="text-align:right">Pages</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  _bfPrint({ title: p.title, section: 'Stripboard', body });
}

// Expose functions for onclick handlers
window._bfEscHtml = _bfEscHtml;
window._bfPrint = _bfPrint;
window.exportRiskPDF = exportRiskPDF;
window.exportCastPDF = exportCastPDF;
window.exportExtrasPDF = exportExtrasPDF;
window.exportCrewPDF = exportCrewPDF;
window.exportEquipmentPDF = exportEquipmentPDF;
window.exportLocationsPDF = exportLocationsPDF;
window.exportPropsPDF = exportPropsPDF;
window.exportWardrobePDF = exportWardrobePDF;
window.exportSoundLogPDF = exportSoundLogPDF;
window.exportReleasesPDF = exportReleasesPDF;
window.exportStripboardPDF = exportStripboardPDF;