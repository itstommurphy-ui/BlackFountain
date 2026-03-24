// ══════════════════════════════════════════
// BUDGET — PERSONNEL LINE SUGGESTIONS
// ══════════════════════════════════════════
// Adds a "👥 From Personnel" button to the
// budget toolbar. Opens a panel showing all
// cast / extras / crew as rows, each with
// checkboxes for which budget line types to
// generate. Amounts are left blank — structure
// only, user fills in rates.
//
// Drop AFTER budget.js in index.html.
// ══════════════════════════════════════════

(function () {

  // ── Line type definitions ──────────────────────────────────

  // Each entry: { id, label, section, dept, descFn }
  // descFn(name) → the budget line description string
  const LINE_TYPES = [
    {
      id:      'fee',
      label:   'Fee',
      // cast/extras → ATL Cast, crew → BTL their own dept
      section: null, // resolved per-person below
      dept:    null,
      descFn:  name => `Fee — ${name}`,
    },
    {
      id:      'travel',
      label:   'Travel / Mileage',
      section: 'btl',
      dept:    'Transport',
      descFn:  name => `Travel / Mileage — ${name}`,
    },
    {
      id:      'accommodation',
      label:   'Accommodation',
      section: 'btl',
      dept:    'Transport',
      descFn:  name => `Accommodation — ${name}`,
    },
    {
      id:      'meals',
      label:   'Meal Allowance',
      section: 'btl',
      dept:    'Catering',
      descFn:  name => `Meal Allowance — ${name}`,
    },
    {
      id:      'wardrobe',
      label:   'Costume / Wardrobe',
      section: 'btl',
      dept:    'Wardrobe',
      descFn:  name => `Costume / Wardrobe — ${name}`,
    },
  ];

  // ── Helper for display name ──────────────────────────────────

  function _personDisplayName(m) {
    return (m.name || '').trim() || (m.role || '').trim() || 'Unnamed';
  }

  // ── Resolve fee section/dept per person type ───────────────

  function _feeForPerson(personType, crewDept, crewRole) {
    if (personType === 'cast' || personType === 'extras') {
      return { section: 'atl', dept: 'Cast' };
    }
    // Check role for ATL-worthy positions
    const atlRoles = ['director', 'producer', 'executive producer', 'writer', 'screenwriter'];
    const roleMatch = atlRoles.some(r => (crewRole || '').toLowerCase().includes(r));
    const atlDepts  = ['Story & Rights', 'Producers', 'Director'];
    const deptMatch = atlDepts.includes(crewDept);

    if (roleMatch || deptMatch) {
      // Map to the correct ATL dept
      const role = (crewRole || '').toLowerCase();
      if (role.includes('director')) return { section: 'atl', dept: 'Director' };
      if (role.includes('writer') || role.includes('screenwriter')) return { section: 'atl', dept: 'Story & Rights' };
      return { section: 'atl', dept: 'Producers' };
    }

    const btlDepts = [
      'Production Design','Art Department','Camera','Lighting & Grip',
      'Sound','Wardrobe','Makeup & Hair','Locations','Transport',
      'Catering','Post-Production','VFX','Music','Marketing',
      'Insurance & Legal','Other'
    ];
    // Try to match BTL dept by role keyword
    const role = (crewRole || '').toLowerCase();
    if (role.includes('sound')) return { section: 'btl', dept: 'Sound' };
    if (role.includes('camera') || role.includes('cinematograph') || role.includes(' dp') || role.includes('dop')) return { section: 'btl', dept: 'Camera' };
    if (role.includes('edit')) return { section: 'btl', dept: 'Post-Production' };
    if (role.includes('makeup') || role.includes('hair')) return { section: 'btl', dept: 'Makeup & Hair' };
    if (role.includes('wardrobe') || role.includes('costume')) return { section: 'btl', dept: 'Wardrobe' };
    if (role.includes('location')) return { section: 'btl', dept: 'Locations' };

    const dept = btlDepts.includes(crewDept) ? crewDept : 'Other';
    return { section: 'btl', dept };
  }

  // ── Build the panel ────────────────────────────────────────

  window.openPersonnelBudgetPanel = function () {
    const p = currentProject();
    if (!p) return;

    const cast   = (p.cast   || []).map(m => ({ ...m, _type: 'cast' }));
    const extras = (p.extras || []).map(m => ({ ...m, _type: 'extras' }));
    const unit   = (p.unit   || []).map(m => ({ ...m, _type: 'unit' }));
    const all    = [...cast, ...extras, ...unit];

    if (!all.length) {
      showToast('No cast or crew added yet', 'info');
      return;
    }

    document.getElementById('_pers-bud-panel')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_pers-bud-panel';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    // Table rows — one per person
    const rowsHtml = all.map((m, i) => {
      const typeLabel = m._type === 'cast' ? 'Cast'
        : m._type === 'extras' ? 'Extra'
        : (m.dept || m.role || 'Crew');
      return `
        <tr data-person-idx="${i}">
          <td style="padding:6px 8px;white-space:nowrap">
            <strong style="font-size:12px">${_esc(_personDisplayName(m))}</strong>
            <span style="font-size:10px;color:var(--text3);margin-left:6px">${_esc(typeLabel)}</span>
          </td>
          ${LINE_TYPES.map(lt => `
            <td style="text-align:center;padding:6px 4px">
              <input type="checkbox" class="_pb-cb" 
                data-person-idx="${i}" data-line-type="${lt.id}"
                checked
                style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer">
            </td>`).join('')}
        </tr>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal" style="max-width:680px;width:95%;max-height:85vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>👥 BUDGET LINES FROM PERSONNEL</h3>
          <button class="modal-close" onclick="document.getElementById('_pers-bud-panel').remove()">✕</button>
        </div>

        <p style="font-size:12px;color:var(--text3);padding:0 20px 12px;margin:0">
          Select which line types to generate per person. Rates are left blank — fill them in afterwards.
          Lines already matching existing budget entries will be skipped.
        </p>

        <div style="overflow:auto;flex:1;padding:0 20px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid var(--border2)">
                <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text3);font-weight:600">Person</th>
                ${LINE_TYPES.map(lt => `
                  <th style="text-align:center;padding:6px 4px;font-size:11px;color:var(--text3);font-weight:600;min-width:70px">
                    ${_esc(lt.label)}
                    <br>
                    <button onclick="_pbToggleCol('${lt.id}')" 
                      style="font-size:9px;background:none;border:none;color:var(--accent);cursor:pointer;padding:2px 0">
                      all/none
                    </button>
                  </th>`).join('')}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>

        <div style="padding:16px 20px;border-top:1px solid var(--border2);display:flex;gap:8px;justify-content:space-between;align-items:center">
          <button class="btn btn-sm btn-ghost" onclick="_pbSelectAll(true)">Check all</button>
          <button class="btn btn-sm btn-ghost" onclick="_pbSelectAll(false)">Uncheck all</button>
          <div style="flex:1"></div>
          <button class="btn" onclick="document.getElementById('_pers-bud-panel').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="_pbGenerate()">Generate Lines</button>
        </div>
      </div>`;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Store people list for generate step
    window._pbPeople = all;
  };

  // ── Toggle column (all/none per line type) ─────────────────

  window._pbToggleCol = function (lineTypeId) {
    const cbs = [...document.querySelectorAll(`._pb-cb[data-line-type="${lineTypeId}"]`)];
    const anyUnchecked = cbs.some(cb => !cb.checked);
    cbs.forEach(cb => cb.checked = anyUnchecked);
  };

  window._pbSelectAll = function (checked) {
    document.querySelectorAll('._pb-cb').forEach(cb => cb.checked = checked);
  };

  // ── Generate lines ─────────────────────────────────────────

  window._pbGenerate = function () {
    const p       = currentProject();
    const people  = window._pbPeople;
    if (!p || !people) return;

    if (!p.budget) p.budget = [];

    // Build set of existing desc strings (lowercased) to skip dupes
    const existingDescs = new Set(p.budget.map(b => (b.desc || '').toLowerCase().trim()));

    const checked = [...document.querySelectorAll('._pb-cb:checked')];
    if (!checked.length) {
      showToast('Nothing selected', 'info');
      return;
    }

    // Group by person index so we add lines in person order
    const byPerson = new Map();
    checked.forEach(cb => {
      const pi = parseInt(cb.dataset.personIdx);
      const lt = cb.dataset.lineType;
      if (!byPerson.has(pi)) byPerson.set(pi, []);
      byPerson.get(pi).push(lt);
    });

    let added = 0;
    let skipped = 0;

    byPerson.forEach((lineTypeIds, pi) => {
      const person = people[pi];
      if (!person) return;

      lineTypeIds.forEach(ltId => {
        const lt = LINE_TYPES.find(l => l.id === ltId);
        if (!lt) return;

        const desc = lt.descFn(_personDisplayName(person));

        // Skip if already exists
        if (existingDescs.has(desc.toLowerCase().trim())) {
          skipped++;
          return;
        }

        let section, dept;
        if (lt.id === 'fee') {
          const resolved = _feeForPerson(person._type, person.dept, person.role);
          section = resolved.section;
          dept    = resolved.dept;
        } else {
          section = lt.section;
          dept    = lt.dept;
        }

        p.budget.push({
          section,
          dept,
          desc,
          vendor:  '',
          type:    'cash',
          rate:    '',
          qty:     1,
          actual:  null,
          notes:   '',
        });

        existingDescs.add(desc.toLowerCase().trim());
        added++;
      });
    });

    saveStore();
    document.getElementById('_pers-bud-panel').remove();
    renderBudget(p);

    const parts = [`Added ${added} budget line${added !== 1 ? 's' : ''}`];
    if (skipped) parts.push(`${skipped} skipped (already exist)`);
    showToast(parts.join(' · '), 'success');
  };

  // ── Inject button into budget toolbar ─────────────────────

  function _injectButton() {
    if (document.getElementById('_pb-btn')) return;

    const anchor = document.querySelector(
      '#section-budget button[onclick*="addBudgetLine"]'
    );
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.id        = '_pb-btn';
    btn.className = 'btn btn-sm btn-ghost';
    btn.title     = 'Generate budget lines from cast & crew';
    btn.textContent = '👥 From Personnel';
    btn.onclick   = openPersonnelBudgetPanel;

    anchor.parentElement.insertBefore(btn, anchor);
    console.log('budget-personnel-suggestions: injected button ✓');
  }

  // Patch showSection
  const _origShowSection = window.showSection;
  if (_origShowSection && !window._pbSectionPatched) {
    window._pbSectionPatched = true;
    window.showSection = function (name) {
      _origShowSection(name);
      if (name === 'budget') setTimeout(_injectButton, 100);
    };
  }

  // Patch renderBudget
  const _origRenderBudget = window.renderBudget;
  if (_origRenderBudget && !window._pbRenderPatched) {
    window._pbRenderPatched = true;
    window.renderBudget = function (p) {
      _origRenderBudget(p);
      setTimeout(_injectButton, 0);
    };
  }

  // ── Helper ─────────────────────────────────────────────────

  function _esc(s) {
    return String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

})();