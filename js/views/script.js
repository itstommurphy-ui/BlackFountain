// SCRIPT & DOCUMENTS
let _pendingScriptFile = null; // { file, dataUrl }
let _pendingBdText = null;     // extracted text when uploading via breakdown section
let _scriptUploadContext = 'script'; // 'script' or 'breakdown'

function handleScriptUpload(files) {
  const p = currentProject();
  if (!p || !files || !files.length) return;
  // Process one file at a time via the naming modal; queue remainder
  _scriptUploadQueue = Array.from(files);
  _processNextScriptUpload();
}

let _scriptUploadQueue = [];

function _processNextScriptUpload() {
  const p = currentProject();
  if (!p || !_scriptUploadQueue.length) return;
  const file = _scriptUploadQueue.shift();
  const reader = new FileReader();
  reader.onload = e => {
    _scriptUploadContext = 'script';
    _pendingScriptFile = { file, dataUrl: e.target.result };
    openScriptUploadModal(p, file, 'script');
  };
  reader.readAsDataURL(file);
}

function openScriptUploadModal(p, file, context = 'script') {
  _scriptUploadContext = context;
  const nameNoExt = file.name.replace(/\.[^.]+$/, '');
  document.getElementById('su-name').value = nameNoExt;
  document.getElementById('su-version').value = '';

  const bdSection = document.getElementById('su-breakdown-section');

  if (context === 'breakdown') {
    // Uploading via breakdown section — no need to ask about importing to breakdown
    bdSection.innerHTML = '';
  } else {
    _migrateBreakdowns(p);
    const bds = p.scriptBreakdowns || [];
    const existingScripts = (p.scripts || []).slice().sort((a, b) => b.uploadedAt - a.uploadedAt);

    if (!bds.length) {
      // No breakdowns yet — offer to auto-create one
      bdSection.innerHTML = `
        <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;color:var(--text2);padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius)">
          <input type="checkbox" id="su-create-bd" checked style="width:14px;height:14px;accent-color:var(--accent)">
          Also import into a new Script Breakdown
        </label>`;
    } else {
      // Breakdowns exist — offer versioning + optional new breakdown
      const scriptOpts = existingScripts.length
        ? existingScripts.map(s => `<option value="${s.id}">${s.name}${s.label ? ' — ' + s.label : ''}</option>`).join('')
        : '<option value="">— None —</option>';
      bdSection.innerHTML = `
        <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
          <div style="padding:10px 12px;background:var(--surface2);border-bottom:1px solid var(--border)">
            <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;color:var(--text2)">
              <input type="checkbox" id="su-is-version" style="width:14px;height:14px;accent-color:var(--accent)" onchange="document.getElementById('su-version-row').style.display=this.checked?'block':'none'">
              This is a new version of an existing script
            </label>
            <div id="su-version-row" style="display:none;margin-top:8px">
              <label class="form-label" style="margin-bottom:4px">Which script?</label>
              <select class="form-select" id="su-parent-script" style="font-size:12px">${scriptOpts}</select>
            </div>
          </div>
          <div style="padding:10px 12px">
            <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;color:var(--text2)">
              <input type="checkbox" id="su-create-bd" style="width:14px;height:14px;accent-color:var(--accent)">
              Also import into a new Script Breakdown
            </label>
          </div>
        </div>`;
    }
  }

  openModal('modal-script-upload');
}

async function confirmScriptUpload() {
  const p = currentProject();
  if (!p || !_pendingScriptFile) return;

  const name = document.getElementById('su-name').value.trim() || _pendingScriptFile.file.name;
  const version = document.getElementById('su-version').value.trim();

  // Always add to Script & Docs
  if (!p.scripts) p.scripts = [];
  const scriptId = makeId();
  p.scripts.unshift({
    id: scriptId,
    name,
    label: version,
    dataUrl: _pendingScriptFile.dataUrl,
    size: _pendingScriptFile.file.size,
    type: _pendingScriptFile.file.type,
    origExt: _pendingScriptFile.file.name.split('.').pop().toLowerCase(),
    uploadedAt: Date.now()
  });

  if (_scriptUploadContext === 'breakdown') {
    // Uploaded via breakdown — use pre-extracted text to create breakdown
    if (_pendingBdText) {
      _createBreakdown(p, name, version, _pendingBdText);
    }
    saveStore();
    closeModal('modal-script-upload');
    renderScript(p);
    renderBreakdown(p);
  } else {
    // Uploaded via Script & Docs — optionally create a breakdown
    const createBd = document.getElementById('su-create-bd')?.checked;
    if (createBd) {
      const file = _pendingScriptFile.file;
      const fname = file.name.toLowerCase();
      if (fname.endsWith('.pdf')) {
        _extractTextForBreakdown(p, file, name, version);
      } else {
        const dataUrl = _pendingScriptFile.dataUrl;
        let text = '';
        try {
          const b64 = dataUrl.split(',')[1];
          text = decodeURIComponent(escape(atob(b64)));
        } catch(e) { try { text = atob(dataUrl.split(',')[1]); } catch(e2) {} }
        if (fname.endsWith('.fdx')) {
          try {
            const xml = new DOMParser().parseFromString(text, 'text/xml');
            const extracted = Array.from(xml.querySelectorAll('Paragraph'))
              .map(par => Array.from(par.querySelectorAll('Text')).map(t => t.textContent).join(''))
              .filter(s => s.trim()).join('\n');
            if (extracted.trim()) text = extracted;
          } catch(e) {}
        } else {
          text = _stripFountainMarkup(text);
        }
        if (text.trim()) _createBreakdown(p, name, version, text.trim());
      }
    }
    saveStore();
    closeModal('modal-script-upload');
    renderScript(p);
  }

  _pendingScriptFile = null;
  _pendingBdText = null;

  // Process next file in queue if any
  if (_scriptUploadQueue.length) _processNextScriptUpload();
}

async function _extractTextForBreakdown(p, file, name, version, scriptId) {
  try {
    showToast('Reading PDF for breakdown…', 'info');
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.filter(it => typeof it.str === 'string' && it.str !== '');
      if (!items.length) { text += '\n'; continue; }
      // Group into lines by Y coordinate
      const lineGroups = [];
      let curY = null, curGroup = [];
      for (const item of items) {
        const y = item.transform[5];
        if (curY === null || Math.abs(y - curY) > 2) {
          if (curGroup.length) lineGroups.push({ y: curY, items: curGroup });
          curGroup = [item]; curY = y;
        } else { curGroup.push(item); }
      }
      if (curGroup.length) lineGroups.push({ y: curY, items: curGroup });
      lineGroups.sort((a, b) => b.y - a.y); // top-to-bottom (PDF Y increases upward)
      // Estimate left margin and character width to reconstruct indentation
      const allX = lineGroups.flatMap(g => g.items.map(it => it.transform[4]));
      const leftMargin = Math.min(...allX);
      const widthSamples = items.map(it => it.width / (it.str.length || 1)).filter(w => w > 1);
      const charWidth = widthSamples.length ? widthSamples.reduce((a, b) => a + b) / widthSamples.length : 7.2;
      for (const group of lineGroups) {
        group.items.sort((a, b) => a.transform[4] - b.transform[4]);
        const lineX = group.items[0].transform[4];
        const indent = Math.max(0, Math.round((lineX - leftMargin) / charWidth));
        const lineStr = ' '.repeat(indent) + group.items.map(it => it.str).join('');
        text += lineStr.trimEnd() + '\n';
      }
      text += '\n';
    }
    if (text.trim()) { _createBreakdown(p, name, version, text.trim(), scriptId || null); saveStore(); }
  } catch(e) { showToast('Could not read PDF for breakdown: ' + e.message, 'error'); }
}

function renderScript(p) {
  const el = document.getElementById('script-files-list');
  if (!el) return;
  if (!p.scripts || !p.scripts.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📜</div><h4>No documents yet</h4><p>Upload your script, sides, audition pieces or other documents</p></div>`;
    return;
  }
  // Newest first
  const sorted = [...p.scripts].sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
  el.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>
          <th>File</th>
          <th>Version / Notes</th>
          <th>Size</th>
          <th>Last Modified</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${sorted.map(s => {
            const editable = _isScriptEditable(s);
            const ts = s.editedAt || s.uploadedAt;
            const tsLabel = s.editedAt ? 'Edited ' : 'Uploaded ';
            return `
            <tr data-ctx="script-file:${s.id}" oncontextmenu="showScriptCtxMenu(event,'${s.id}')" style="cursor:context-menu">
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <span>${scriptFileIcon(s.type)}</span>
                  <span class="script-filename" data-id="${s.id}" title="Click to preview" onclick="openScriptPreview('${s.id}')" style="cursor:pointer;color:var(--accent)">${s.name.replace(/</g,'&lt;')}</span>
                  <button class="btn btn-sm" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();openScriptRename('${s.id}')" title="Rename">✏️</button>
                </div>
              </td>
              <td><input class="form-input form-input-sm" style="width:100%" value="${(s.label||'').replace(/"/g,'&quot;')}" placeholder="e.g. Draft 3, Sides for Scene 12..." onchange="updateScriptLabel('${s.id}',this.value)"></td>
              <td style="white-space:nowrap">${formatFileSize(s.size)}</td>
              <td style="white-space:nowrap;font-size:11px">${tsLabel}${new Date(ts).toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'})}</td>
              <td style="display:flex;gap:5px;flex-wrap:nowrap">
                ${false && editable ? `<button class="btn btn-sm btn-primary" onclick="openScriptEditor('${s.id}')" title="Edit in browser">✏ Edit</button>` : ''}
                <button class="btn btn-sm" onclick="shareScriptFile('${s.id}')" title="Share">↗</button>
                <button class="btn btn-sm" onclick="downloadScriptFile('${s.id}')" title="Download">⬇</button>
                <button class="btn btn-sm btn-danger" onclick="removeScriptFile('${s.id}')" title="Remove">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function scriptFileIcon(type) {
  if (!type) return '📄';
  if (type.includes('pdf')) return '📕';
  if (type.includes('word') || type.includes('openxmlformats') || type.includes('msword')) return '📘';
  if (type.includes('text') || type.includes('fountain') || type.includes('rtf')) return '📝';
  return '📄';
}

// ── SCRIPT EDITOR ──
let _seId = null, _seDirty = false, _seTodIdx = -1, _seTodMode = 'tod';
const SE_CHAR_INDENT = '                         '; // 25 spaces ≈ character (centred on page)
const SE_DIAL_INDENT = '          ';               // 10 spaces ≈ dialogue indent
// Page-break gap structure: each page block = content lines + gap lines
const SE_CONTENT_LINES = 27; // script content lines per page
const SE_GAP_VIS       = 4;  // visible blank margin lines on each side of the bar
const SE_GAP_BAR       = 2;  // lines covered by the dark bar
const SE_GAP_TOTAL     = SE_GAP_VIS * 2 + SE_GAP_BAR; // 10 gap lines total
const SE_PAGE_BLOCK    = SE_CONTENT_LINES + SE_GAP_TOTAL; // 38 lines per page unit

function _isScriptEditable(s) {
  const ext = (s.name || '').toLowerCase().split('.').pop();
  return ['txt', 'fountain', 'rtf', 'fdx', 'md'].includes(ext) || (s.type || '').startsWith('text/');
}

function _decodeScriptText(s) {
  try { return decodeURIComponent(escape(atob(s.dataUrl.split(',')[1]))); }
  catch(e) { try { return atob(s.dataUrl.split(',')[1]); } catch(e2) { return ''; } }
}

function newScriptEditor() {
  const p = currentProject(); if (!p) return;
  if (!p.scripts) p.scripts = [];
  const blank = { id: makeId(), name: 'Untitled Script.fountain', label: 'Draft 1',
    dataUrl: 'data:text/plain;base64,' + btoa(''), size: 0,
    type: 'text/plain', uploadedAt: Date.now() };
  p.scripts.unshift(blank); saveStore();
  renderScript(p);
  openScriptEditor(blank.id);
}

function openScriptEditor(id) {
  const p = currentProject(); if (!p) return;
  const s = p.scripts.find(x => x.id === id); if (!s) return;
  if (!_isScriptEditable(s)) { showToast('This file type cannot be edited in the browser — download it to edit externally', 'info'); return; }
  const text = _seAddGapLines(_seStripGapLines(_decodeScriptText(s)));
  _seId = id; _seDirty = false;

  const ext  = s.name.toLowerCase().split('.').pop();
  const badge = ext === 'fountain' ? 'Fountain' : ext === 'fdx' ? 'Final Draft XML' : ext.toUpperCase();
  const isFdx = ext === 'fdx';
  const fdxNote = isFdx ? `<div style="background:rgba(212,170,44,0.12);border:1px solid rgba(212,170,44,0.3);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--accent);margin:0 0 12px;box-sizing:border-box">⚠ Editing raw Final Draft XML — save will preserve FDX structure. For full formatting control use Final Draft.</div>` : '';
  const PAGE_LINES = SE_PAGE_BLOCK;
  const ELEMENT_LABELS = { scene: 'Scene Heading', character: 'Character', dialogue: 'Dialogue', parenthetical: 'Parenthetical', transition: 'Transition', action: 'Action', empty: '' };
  const ELEMENT_COLORS = { scene: 'var(--accent2)', character: 'var(--green)', dialogue: 'var(--text2)', transition: 'var(--orange)', parenthetical: 'var(--text3)', action: 'var(--text3)', empty: 'var(--text3)' };

  const ov = document.createElement('div');
  ov.id = '_scriptEditor'; ov.className = 'script-editor-overlay';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', `Editing ${s.name}`);
  ov.innerHTML = `
    <div class="script-editor-topbar">
      <button class="btn btn-sm btn-ghost" onclick="_scriptEditorClose()" aria-label="Close editor">✕ Close</button>
      <div style="flex:1;min-width:0">
        <div class="script-editor-title">${s.name.replace(/</g,'&lt;')}</div>
        ${s.label ? `<div class="script-editor-sub">${s.label.replace(/</g,'&lt;')}</div>` : ''}
      </div>
      <span class="script-editor-badge">${badge}</span>
      <span class="script-editor-status" id="_seStatus" style="color:var(--text3)"></span>
      <button class="btn btn-sm btn-primary" onclick="_scriptEditorSave()" id="_seSaveBtn">💾 Save</button>
    </div>
    <div class="script-editor-body">
      <nav class="script-editor-nav" aria-label="Scene navigator">
        <div class="script-editor-nav-header">Scenes</div>
        <div id="_seNav"><div class="se-nav-empty">No scenes yet</div></div>
      </nav>
      <div class="script-editor-main">
        <div class="script-editor-page">
          <div id="_seBreaks" style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:3"></div>
          ${fdxNote}<div class="se-ta-wrap">
            <div id="_seRender" class="se-render-layer" aria-hidden="true"></div>
            <textarea id="_seTextarea" class="script-editor-ta"
              aria-label="Script editor — ${s.name.replace(/"/g,'&quot;')}"
              spellcheck="true" autocomplete="off" autocorrect="on" autocapitalize="sentences"
              style="position:relative;z-index:2"
            >${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>
        </div>
      </div>
    </div>
    <div class="script-editor-footer">
      <span id="_seStats">Counting…</span>
      <span id="_seElement"></span>
      <span id="_seCursor">Ln 1, Col 1</span>
    </div>`;
  document.body.appendChild(ov);

  const ta = document.getElementById('_seTextarea');
  ta.focus(); ta.setSelectionRange(0, 0);

  function markDirty() {
    _seDirty = true;
    const stEl = document.getElementById('_seStatus');
    if (stEl) { stEl.textContent = '● Unsaved'; stEl.style.color = 'var(--orange)'; }
  }
  function updateStats() {
    const v = ta.value;
    const words = v.trim() ? v.trim().split(/\s+/).length : 0;
    const totalLines = v.split('\n').length;
    const pages = Math.max(1, Math.ceil(totalLines / PAGE_LINES));
    document.getElementById('_seStats').textContent =
      `${words.toLocaleString()} words · ${totalLines.toLocaleString()} lines · ~${pages} pg`;
  }
  function updateCursor() {
    const before = ta.value.substring(0, ta.selectionStart);
    const allLines = ta.value.split('\n');
    const lineNum = before.split('\n').length - 1;
    document.getElementById('_seCursor').textContent = `Ln ${lineNum + 1}, Col ${(before.split('\n').pop().length) + 1}`;
    let elType = _seDetectElement(allLines[lineNum] || '');
    // Detect dialogue: look back at preceding non-empty line
    if (elType === 'action') {
      for (let i = lineNum - 1; i >= Math.max(0, lineNum - 6); i--) {
        const pl = (allLines[i] || '').trim(); if (!pl) continue;
        const pt = _seDetectElement(pl);
        if (pt === 'character' || pt === 'parenthetical') elType = 'dialogue';
        break;
      }
    }
    const elEl = document.getElementById('_seElement');
    if (elEl) { elEl.textContent = ELEMENT_LABELS[elType] || ''; elEl.style.color = ELEMENT_COLORS[elType] || 'var(--text3)'; }
    _seUpdateNav(ta);
  }
  function autoScroll() {
    const main = document.querySelector('.script-editor-main');
    if (!main) return;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 25.65;
    const LINES_PER_PAGE = SE_PAGE_BLOCK;
    const MARGIN = 60;
    const mainRect = main.getBoundingClientRect();
    // Use actual caret viewport Y so text-wrap is handled correctly
    const caretViewY = _seCaretPos(ta).y;
    // Page-snap: when cursor enters a new page, bring that line to MARGIN from top
    const lineNum = ta.value.substring(0, ta.selectionStart).split('\n').length - 1;
    if (lineNum > 0 && lineNum % LINES_PER_PAGE === 0) {
      main.scrollTop = Math.max(0, main.scrollTop + caretViewY - mainRect.top - MARGIN);
      return;
    }
    // Standard: keep caret in the visible viewport
    if (caretViewY + lh + MARGIN > mainRect.bottom) {
      main.scrollTop += caretViewY + lh + MARGIN - mainRect.bottom;
    } else if (caretViewY < mainRect.top + MARGIN) {
      main.scrollTop = Math.max(0, main.scrollTop - (mainRect.top + MARGIN - caretViewY));
    }
  }
  function autoExpand() {
    ta.style.height = '1px';
    ta.style.height = Math.max(840, ta.scrollHeight) + 'px';
    _seRenderUpdate(ta);
    autoScroll();
  }
  updateStats(); updateCursor(); autoExpand(); _seUpdatePageBreaks(ta);

  ta.addEventListener('input', () => {
    markDirty();
    // Auto-uppercase: scene heading lines AND indented character lines
    const { lineStart, lineEnd, text: lt } = _seGetCurLine(ta);
    const isScene = /^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)\s/i.test(lt);
    const isCharLine = /^ {20,}\S/.test(lt);
    if ((isScene || isCharLine) && lt !== lt.toUpperCase()) {
      const ss = ta.selectionStart, se = ta.selectionEnd;
      ta.value = ta.value.substring(0, lineStart) + lt.toUpperCase() + ta.value.substring(lineEnd);
      ta.setSelectionRange(ss, se);
    }
    autoExpand();
    _seUpdateAutocomplete(ta);
    _seUpdatePageBreaks(ta);
    updateStats(); updateCursor();
  });
  ta.addEventListener('click', () => { _seJumpOutOfBarZone(ta); updateCursor(); autoScroll(); });
  ta.addEventListener('keyup', e => { if (e.key !== 'Tab') { _seJumpOutOfBarZone(ta); updateCursor(); autoScroll(); } });
  ta.addEventListener('keydown', e => {
    // Time-of-day dropdown navigation
    const dd = document.getElementById('_seTodDrop');
    if (dd) {
      if (e.key === 'ArrowDown') { e.preventDefault(); _seTodHighlight(Math.min(_seTodIdx + 1, dd.children.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); _seTodHighlight(Math.max(_seTodIdx - 1, 0)); return; }
      if (e.key === 'Escape') { _seHideTod(); return; }
      if ((e.key === 'Tab' || e.key === 'Enter') && (_seTodIdx >= 0 || dd.children.length > 0)) {
        const item = _seTodIdx >= 0 ? dd.children[_seTodIdx].textContent : dd.children[0].textContent;
        e.preventDefault(); _seTodAccept(item); return;
      }
    }

    if (e.key === ' ') {
      // Auto-uppercase INT./EXT. prefix when user types the space after the period
      const { lineStart, lineEnd, text: lt } = _seGetCurLine(ta);
      const cursorOff = ta.selectionStart - lineStart;
      const lineToHere = lt.substring(0, cursorOff);
      if (/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.)$/i.test(lineToHere)) {
        e.preventDefault();
        const newLine = lineToHere.toUpperCase() + ' ' + lt.substring(cursorOff);
        ta.value = ta.value.substring(0, lineStart) + newLine + ta.value.substring(lineEnd);
        ta.setSelectionRange(lineStart + lineToHere.length + 1, lineStart + lineToHere.length + 1);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
    }

    // SE_CHAR_INDENT / SE_DIAL_INDENT are module-level constants

    // Backspace: collapse page gap if cursor is in the gap zone or at start of a new page
    if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && ta.selectionStart === ta.selectionEnd) {
      const cursor = ta.selectionStart;
      const lineNum = ta.value.substring(0, cursor).split('\n').length - 1;
      const posInBlock = lineNum % SE_PAGE_BLOCK;
      const inGap = posInBlock >= SE_CONTENT_LINES;
      const atPageStart = posInBlock === 0 && lineNum >= SE_PAGE_BLOCK && cursor === (ta.value.lastIndexOf('\n', cursor - 1) + 1);
      if (inGap || atPageStart) {
        e.preventDefault();
        const blockStart = inGap ? lineNum - posInBlock : lineNum - SE_PAGE_BLOCK;
        const gapFrom = blockStart + SE_CONTENT_LINES;
        const gapTo   = blockStart + SE_PAGE_BLOCK;
        const lines = ta.value.split('\n');
        const before = lines.slice(0, gapFrom).join('\n');
        const after  = lines.slice(gapTo).join('\n');
        ta.value = before + (after.length ? '\n' + after : '');
        ta.setSelectionRange(before.length, before.length);
        autoExpand(); markDirty(); updateStats(); updateCursor();
        _seUpdatePageBreaks(ta); return;
      }
    }

    // Backspace on empty indented line (char mode, no name) → collapse to action
    if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && ta.selectionStart === ta.selectionEnd) {
      const { lineStart, lineEnd, text: lt } = _seGetCurLine(ta);
      if (/^ +$/.test(lt) && lt.length >= 20) {
        e.preventDefault();
        ta.value = ta.value.substring(0, lineStart) + ta.value.substring(lineEnd);
        ta.setSelectionRange(lineStart, lineStart);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
    }

    // Shift+Enter = plain newline (no auto-formatting)
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const pos = ta.selectionStart;
      ta.value = ta.value.substring(0, pos) + '\n' + ta.value.substring(pos);
      ta.setSelectionRange(pos + 1, pos + 1);
      autoExpand(); markDirty(); updateStats(); updateCursor(); return;
    }

    if (e.key === 'Enter') {
      const { lineStart, lineEnd, text: lt } = _seGetCurLine(ta);
      const cursor = ta.selectionStart;
      const allLines = ta.value.split('\n');
      const lineNum = ta.value.substring(0, lineStart).split('\n').length - 1;
      let elType = _seDetectElement(lt);
      // Page break: if pressing Enter at the end of the last content line in a page block,
      // auto-insert the gap lines and jump cursor to the start of the next page.
      if (lineNum % SE_PAGE_BLOCK === SE_CONTENT_LINES - 1 && cursor >= lineEnd) {
        e.preventDefault();
        const gapStr = '\n'.repeat(SE_GAP_TOTAL + 1);
        ta.value = ta.value.substring(0, cursor) + gapStr + ta.value.substring(cursor);
        ta.setSelectionRange(cursor + gapStr.length, cursor + gapStr.length);
        autoExpand(); markDirty(); updateStats(); updateCursor();
        _seUpdatePageBreaks(ta);
        return;
      }
      // Resolve dialogue context
      if (elType === 'action') {
        for (let i = lineNum - 1; i >= Math.max(0, lineNum - 6); i--) {
          const pl = (allLines[i] || '').trim(); if (!pl) continue;
          const pt = _seDetectElement(pl);
          if (pt === 'character' || pt === 'parenthetical') elType = 'dialogue';
          break;
        }
      }

      // Empty indented line (char or dialogue indent) → collapse to action
      if (/^ +$/.test(lt) && lt.length >= SE_DIAL_INDENT.length) {
        e.preventDefault();
        ta.value = ta.value.substring(0, lineStart) + ta.value.substring(lineEnd);
        ta.setSelectionRange(lineStart, lineStart);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
      // Scene heading → action (plain newline, left-aligned)
      if (elType === 'scene') {
        e.preventDefault();
        ta.value = ta.value.substring(0, cursor) + '\n' + ta.value.substring(cursor);
        ta.setSelectionRange(cursor + 1, cursor + 1);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
      // Action (with content) → blank line + character (centred)
      if (elType === 'action') {
        e.preventDefault();
        ta.value = ta.value.substring(0, cursor) + '\n\n' + SE_CHAR_INDENT + ta.value.substring(cursor);
        ta.setSelectionRange(cursor + 2 + SE_CHAR_INDENT.length, cursor + 2 + SE_CHAR_INDENT.length);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
      // Empty plain line → plain newline (no assumption)
      if (elType === 'empty') {
        // let browser handle normally
      }
      // Character → dialogue (indented)
      if (elType === 'character') {
        e.preventDefault();
        ta.value = ta.value.substring(0, cursor) + '\n' + SE_DIAL_INDENT + ta.value.substring(cursor);
        ta.setSelectionRange(cursor + 1 + SE_DIAL_INDENT.length, cursor + 1 + SE_DIAL_INDENT.length);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
      // Parenthetical → dialogue (insert after full line, indented)
      if (elType === 'parenthetical') {
        e.preventDefault();
        ta.value = ta.value.substring(0, lineEnd) + '\n' + SE_DIAL_INDENT + ta.value.substring(lineEnd);
        ta.setSelectionRange(lineEnd + 1 + SE_DIAL_INDENT.length, lineEnd + 1 + SE_DIAL_INDENT.length);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
      // Dialogue → blank line + character (centred)
      if (elType === 'dialogue') {
        e.preventDefault();
        ta.value = ta.value.substring(0, cursor) + '\n\n' + SE_CHAR_INDENT + ta.value.substring(cursor);
        ta.setSelectionRange(cursor + 2 + SE_CHAR_INDENT.length, cursor + 2 + SE_CHAR_INDENT.length);
        autoExpand(); markDirty(); updateStats(); updateCursor(); return;
      }
    }

    if (e.key === 'Tab') {
      // Tab on empty or dialogue line in dialogue context → insert parenthetical ()
      const { lineStart, lineEnd, text: lt } = _seGetCurLine(ta);
      const curType = _seDetectElement(lt);
      if (curType === 'empty' || curType === 'dialogue') {
        const allLines = ta.value.split('\n');
        const lineNum = ta.value.substring(0, lineStart).split('\n').length - 1;
        for (let i = lineNum - 1; i >= Math.max(0, lineNum - 5); i--) {
          const pl = allLines[i] || ''; if (!pl.trim()) continue;
          const pt = _seDetectElement(pl);
          if (pt === 'character' || pt === 'dialogue' || pt === 'parenthetical') {
            e.preventDefault();
            ta.value = ta.value.substring(0, lineStart) + SE_CHAR_INDENT + '()' + ta.value.substring(lineEnd);
            ta.setSelectionRange(lineStart + SE_CHAR_INDENT.length + 1, lineStart + SE_CHAR_INDENT.length + 1);
            autoExpand(); markDirty(); updateStats(); updateCursor(); return;
          }
          break;
        }
      }
      e.preventDefault();
      _seTabCycle(ta, e.shiftKey);
      markDirty(); updateStats(); updateCursor(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); _seWrapMarkup(ta, '**'); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); _seWrapMarkup(ta, '*'); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') { e.preventDefault(); _seWrapMarkup(ta, '_'); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); _scriptEditorSave(); }
  });
}

function _seGetCurLine(ta) {
  const val = ta.value, start = ta.selectionStart;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const le = val.indexOf('\n', start);
  const lineEnd = le === -1 ? val.length : le;
  return { lineStart, lineEnd, text: val.substring(lineStart, lineEnd) };
}

function _seDetectElement(line) {
  const t = line.trim();
  if (!t) return 'empty';
  const sp = line.length - line.trimStart().length;
  if (/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)(\s|$)/i.test(t)) return 'scene';
  if (/^(FADE (IN|OUT|TO):|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:)/i.test(t)) return 'transition';
  if (/^\(.*\)\s*$/.test(t)) return 'parenthetical';
  // Properly-indented character name (≥20 spaces, all-caps)
  if (sp >= 20 && /^[A-Z][A-Z0-9 '\-\.]*$/.test(t) && t.length < 50) return 'character';
  // Dialogue (8–19 spaces of indent)
  if (sp >= 8 && sp < 20) return 'dialogue';
  // Legacy / manually typed character name (no indent, all-caps)
  if (/^[A-Z][A-Z0-9 '\-\.]*$/.test(t) && t.length < 50 && !/[a-z]/.test(t)) return 'character';
  return 'action';
}

function _seTabCycle(ta, shiftKey) {
  const { lineStart, lineEnd, text } = _seGetCurLine(ta);
  const trim = text.trim();
  const curType = _seDetectElement(text);
  let newText;
  if (!shiftKey) {
    if (curType === 'scene') {
      newText = trim.replace(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)\s*/i, '');
    } else if (curType === 'character') {
      newText = 'INT. ' + (trim || 'LOCATION - DAY');
    } else {
      newText = SE_CHAR_INDENT + trim.toUpperCase();
    }
  } else {
    if (curType === 'character') {
      newText = trim.charAt(0).toUpperCase() + trim.slice(1).toLowerCase();
    } else if (curType === 'scene') {
      newText = trim.replace(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)\s*/i, '').toUpperCase();
    } else {
      newText = 'INT. ' + trim.toUpperCase();
    }
  }
  const before = ta.value.substring(0, lineStart);
  const after = ta.value.substring(lineEnd);
  const cursorOff = ta.selectionStart - lineStart;
  ta.value = before + newText + after;
  const newPos = lineStart + Math.min(cursorOff, newText.length);
  ta.setSelectionRange(newPos, newPos);
}

function _seUpdateNav(ta) {
  const nav = document.getElementById('_seNav');
  if (!nav) return;
  const lines = ta.value.split('\n');
  const scenes = [];
  lines.forEach((ln, idx) => {
    if (/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)[ \t]/i.test(ln.trim())) scenes.push({ line: idx, text: ln.trim() });
  });
  if (!scenes.length) { nav.innerHTML = '<div class="se-nav-empty">No scenes yet</div>'; return; }
  const cursorLine = ta.value.substring(0, ta.selectionStart).split('\n').length - 1;
  let activeIdx = -1;
  for (let i = scenes.length - 1; i >= 0; i--) { if (scenes[i].line <= cursorLine) { activeIdx = i; break; } }
  nav.innerHTML = scenes.map((sc, i) =>
    `<div class="se-nav-item${i === activeIdx ? ' se-nav-active' : ''}" onclick="_seJumpToLine(${sc.line})" title="${sc.text.replace(/"/g,'&quot;')}"><span class="se-nav-num">${i + 1}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${sc.text.replace(/</g,'&lt;')}</span></div>`
  ).join('');
}

function _seJumpToLine(lineIdx) {
  const ta = document.getElementById('_seTextarea'); if (!ta) return;
  const lines = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < lineIdx && i < lines.length; i++) pos += lines[i].length + 1;
  ta.focus(); ta.setSelectionRange(pos, pos);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 26;
  const main = document.querySelector('.script-editor-main');
  if (main) main.scrollTop = Math.max(0, lineIdx * lh + 72 - main.clientHeight / 2);
  _seUpdateNav(ta);
}

const SE_TOD = ['AFTERNOON','CONTINUOUS','CONTINUOUS (LATER)','DAWN','DAY','DUSK',
  'EVENING','FLASHBACK','INTERCUT WITH','LATER','MIDDAY','MOMENTS LATER',
  'MORNING','NIGHT','SAME TIME','SUNRISE','SUNSET'];

function _seCaretPos(ta) {
  const taRect = ta.getBoundingClientRect();
  const cs = getComputedStyle(ta);
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;top:${taRect.top}px;left:${taRect.left}px;width:${ta.clientWidth}px;font:${cs.font};line-height:${cs.lineHeight};padding:${cs.padding};box-sizing:${cs.boxSizing};white-space:pre-wrap;word-wrap:break-word;overflow:hidden`;
  div.textContent = ta.value.substring(0, ta.selectionStart);
  const span = document.createElement('span'); span.textContent = '\u200b';
  div.appendChild(span); document.body.appendChild(div);
  const sr = span.getBoundingClientRect(); document.body.removeChild(div);
  return { x: sr.left, y: sr.top - ta.scrollTop };
}

function _seTodPrefix(ta) {
  const { lineStart, text } = _seGetCurLine(ta);
  const lineToHere = text.substring(0, ta.selectionStart - lineStart);
  const m = lineToHere.match(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)\s+.+\s+-\s+(\w*)$/i);
  return m ? m[2].toUpperCase() : null;
}

function _seHideTod() {
  document.getElementById('_seTodDrop')?.remove();
  _seTodIdx = -1;
}

function _seTodHighlight(idx) {
  const dd = document.getElementById('_seTodDrop'); if (!dd) return;
  _seTodIdx = idx;
  Array.from(dd.children).forEach((el, i) => el.classList.toggle('active', i === idx));
}

function _seTodAccept(item) {
  const ta = document.getElementById('_seTextarea'); if (!ta) return;
  const { lineStart, lineEnd, text } = _seGetCurLine(ta);
  if (_seTodMode === 'char') {
    // Replace whole trimmed line with the selected character name, preserving indent
    const indent = text.match(/^( *)/)[1];
    ta.value = ta.value.substring(0, lineStart) + indent + item + ta.value.substring(lineEnd);
    ta.setSelectionRange(lineStart + indent.length + item.length, lineStart + indent.length + item.length);
  } else {
    const lineToHere = text.substring(0, ta.selectionStart - lineStart);
    const m = lineToHere.match(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.?)\s+.+\s+-\s+(\w*)$/i);
    if (!m) { _seHideTod(); return; }
    const partial = m[2];
    const insertStart = ta.selectionStart - partial.length;
    ta.value = ta.value.substring(0, insertStart) + item + ta.value.substring(ta.selectionStart);
    ta.setSelectionRange(insertStart + item.length, insertStart + item.length);
  }
  _seHideTod();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
}

function _seShowTod(items, ta) {
  document.getElementById('_seTodDrop')?.remove();
  _seTodIdx = -1;
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 26;
  const pos = _seCaretPos(ta);
  const dd = document.createElement('div');
  dd.id = '_seTodDrop'; dd.className = 'se-tod-drop';
  dd.style.left = pos.x + 'px'; dd.style.top = (pos.y + lh) + 'px';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'se-tod-item'; row.textContent = item;
    row.onmouseenter = () => _seTodHighlight(i);
    row.onmousedown = e => { e.preventDefault(); _seTodAccept(item); };
    dd.appendChild(row);
  });
  document.body.appendChild(dd);
  const dr = dd.getBoundingClientRect();
  if (dr.right > window.innerWidth - 8) dd.style.left = (window.innerWidth - dr.width - 8) + 'px';
  if (dr.bottom > window.innerHeight - 8) dd.style.top = (pos.y - dr.height) + 'px';
}

function _seGetCharNames(ta) {
  const names = new Set();
  ta.value.split('\n').forEach(line => {
    if (/^ {20,}\S/.test(line) && _seDetectElement(line) === 'character') names.add(line.trim());
  });
  return Array.from(names).sort();
}

function _seCharPrefix(ta) {
  const { lineStart, text } = _seGetCurLine(ta);
  if (!/^ {20,}/.test(text)) return null; // must be character-indented (≥20 spaces)
  const lineToHere = text.substring(0, ta.selectionStart - lineStart);
  const trimmed = lineToHere.trim();
  return trimmed.length >= 1 ? trimmed.toUpperCase() : null;
}

function _seUpdateAutocomplete(ta) {
  // TOD suggestions: after "INT. LOC - X"
  const todPrefix = _seTodPrefix(ta);
  if (todPrefix) {
    const matches = SE_TOD.filter(t => t.startsWith(todPrefix));
    if (matches.length && !(matches.length === 1 && matches[0] === todPrefix)) {
      _seTodMode = 'tod'; _seShowTod(matches, ta); return;
    }
  }
  // Character name suggestions: on indented (character) lines
  const charPrefix = _seCharPrefix(ta);
  if (charPrefix) {
    const matches = _seGetCharNames(ta).filter(n => n.startsWith(charPrefix) && n !== charPrefix);
    if (matches.length) { _seTodMode = 'char'; _seShowTod(matches, ta); return; }
  }
  _seHideTod();
}

// Strip gap lines from saved text (gap = SE_GAP_TOTAL+ consecutive newlines → single newline)
function _seStripGapLines(text) {
  return text.replace(new RegExp('\n{' + (SE_GAP_TOTAL + 1) + ',}', 'g'), '\n');
}

// Insert gap lines after every SE_CONTENT_LINES lines when more content follows
function _seAddGapLines(text) {
  const lines = text.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    if ((i + 1) % SE_CONTENT_LINES === 0 && (i + 1) < lines.length) {
      for (let g = 0; g < SE_GAP_TOTAL; g++) result.push('');
    }
  }
  return result.join('\n');
}

// If cursor is in the dark bar zone (not the visible margin lines), jump to next content block
function _seJumpOutOfBarZone(ta) {
  const cursorPos = ta.selectionStart;
  const lineNum = ta.value.substring(0, cursorPos).split('\n').length - 1;
  const posInBlock = lineNum % SE_PAGE_BLOCK;
  const barStart = SE_CONTENT_LINES + SE_GAP_VIS;
  const barEnd   = barStart + SE_GAP_BAR;
  if (posInBlock < barStart || posInBlock >= barEnd) return;
  const blockStart = lineNum - posInBlock;
  const nextContent = blockStart + SE_PAGE_BLOCK;
  const lines = ta.value.split('\n');
  while (lines.length <= nextContent) lines.push('');
  ta.value = lines.join('\n');
  const prefix = ta.value.split('\n').slice(0, nextContent).join('\n');
  ta.setSelectionRange(prefix.length + 1, prefix.length + 1);
}

function _seUpdatePageBreaks(ta) {
  const overlay = document.getElementById('_seBreaks'); if (!overlay) return;
  const cs  = getComputedStyle(ta);
  const lh  = parseFloat(cs.lineHeight) || 25.65;
  const barH = SE_GAP_BAR * lh; // bar covers 2 blank lines (~51px)
  const PAGE_TOP_PAD  = 96;
  const totalLines = ta.value.split('\n').length;
  const numBreaks  = Math.floor(totalLines / SE_PAGE_BLOCK);
  let html = '';
  for (let i = 1; i <= numBreaks; i++) {
    const top = PAGE_TOP_PAD + (i * SE_PAGE_BLOCK - SE_GAP_TOTAL + SE_GAP_VIS) * lh;
    html += `<div class="se-page-break" style="top:${top.toFixed(1)}px;height:${barH.toFixed(1)}px"><span style="font-size:8px;color:rgba(255,255,255,0.5);font-family:sans-serif;letter-spacing:1px">${i} / ${i + 1}</span></div>`;
  }
  overlay.innerHTML = html;
  const page = document.querySelector('.script-editor-page');
  if (page) page.style.minHeight = (PAGE_TOP_PAD + (numBreaks + 1) * SE_PAGE_BLOCK * lh + 120) + 'px';
}

function _seEsc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _seRenderUpdate(ta) {
  const el = document.getElementById('_seRender'); if (!el) return;
  const lines = ta.value.split('\n');
  el.innerHTML = lines.map(line => {
    const type = _seDetectElement(line);
    let html = _seEsc(line)
      // bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<span class="se-mk">**</span><strong>$1</strong><span class="se-mk">**</span>')
      // italic: *text* (not double-asterisk)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<span class="se-mk">*</span><em>$1</em><span class="se-mk">*</span>')
      // underline: _text_
      .replace(/_(.+?)_/g, '<span class="se-mk">_</span><span style="text-decoration:underline">$1</span><span class="se-mk">_</span>');
    if (type === 'scene') return `<div class="se-scene-line">${html || '\u200b'}</div>`;
    return `<div>${html || '\u200b'}</div>`;
  }).join('');
}

function _seWrapMarkup(ta, marker) {
  const ss = ta.selectionStart, se = ta.selectionEnd;
  const v = ta.value;
  if (ss === se) {
    // No selection — insert empty markers, place cursor between them
    ta.value = v.substring(0, ss) + marker + marker + v.substring(ss);
    ta.setSelectionRange(ss + marker.length, ss + marker.length);
  } else {
    const wrapped = marker + v.substring(ss, se) + marker;
    ta.value = v.substring(0, ss) + wrapped + v.substring(se);
    ta.setSelectionRange(ss, ss + wrapped.length);
  }
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
}

function _scriptEditorSave() {
  const p = currentProject(); if (!p) return;
  const s = p.scripts.find(x => x.id === _seId); if (!s) return;
  const ta = document.getElementById('_seTextarea'); if (!ta) return;
  const text = _seStripGapLines(ta.value);
  try { s.dataUrl = 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(text))); }
  catch(e) { s.dataUrl = 'data:text/plain;base64,' + btoa(text); }
  s.size = new Blob([text]).size;
  s.editedAt = Date.now();
  saveStore(); renderScript(p);
  _seDirty = false;
  const el = document.getElementById('_seStatus');
  if (el) { el.textContent = '✓ Saved'; el.style.color = 'var(--green)'; }
}

function _scriptEditorClose() {
  _seHideTod();
  if (_seDirty) {
    showConfirmDialog('You have unsaved changes. Close without saving?', 'Close', () => {
      document.getElementById('_scriptEditor')?.remove();
      _seId = null; _seDirty = false;
    }, { zIndex: 10000 });
    return;
  }
  document.getElementById('_scriptEditor')?.remove();
  _seId = null;
}

function updateScriptLabel(id, val) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  if (s) { s.label = val; saveStore(); }
}

function openScriptRename(id) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  if (!s) return;
  const ovId = '_rename-' + id;
  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:22px 20px 18px;width:340px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;font-weight:700">Rename File</span>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <input id="_rename-input-${id}" class="form-input" style="width:100%;margin-bottom:14px" value="${s.name.replace(/"/g,'&quot;')}">
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="applyScriptRename('${id}','${ovId}')">Rename</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const inp = document.getElementById('_rename-input-' + id);
  if (inp) { inp.focus(); inp.select(); inp.onkeydown = e => { if (e.key === 'Enter') applyScriptRename(id, ovId); }; }
}

function applyScriptRename(id, ovId) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  const inp = document.getElementById('_rename-input-' + id);
  const newName = inp?.value.trim();
  if (s && newName) {
    s.name = newName;
    saveStore();
    renderScript(p);
  }
  document.getElementById(ovId)?.remove();
}

function openScriptPreview(id) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  if (!s) return;

  const ovId = '_sp_' + id;
  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.className = 'script-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';

  const isPdf  = s.type.includes('pdf');
  const isImg  = s.type.startsWith('image/');
  const textExts = ['txt', 'fountain', 'fdx', 'md', 'rtf'];
  const fileExt = s.name.split('.').pop().toLowerCase();
  const isText = s.type.includes('text') || s.type.includes('xml') || s.name.endsWith('.txt') || s.name.endsWith('.fountain') || s.name.endsWith('.fdx') || textExts.includes(fileExt) || textExts.includes(s.origExt || '');

  let previewHtml = '';
  if (isPdf) {
    previewHtml = `<embed src="${s.dataUrl}" type="application/pdf" style="width:min(820px,90vw);height:80vh;border-radius:8px;border:none">`;
  } else if (isImg) {
    previewHtml = `<img src="${s.dataUrl}" alt="${s.altText || s.name}" style="max-width:min(820px,90vw);max-height:80vh;border-radius:8px;object-fit:contain">`;
  } else if (isText) {
    let text = '';
    try {
      text = decodeURIComponent(escape(atob(s.dataUrl.split(',')[1])));
    } catch(e) {
      try { text = atob(s.dataUrl.split(',')[1]); } catch(e2) { text = '(Cannot decode file)'; }
    }
    // Parse Final Draft XML to extract readable text
    const fname = s.name.toLowerCase();
    const ext = (s.origExt || fname.split('.').pop() || '').toLowerCase();
    if (fname.endsWith('.fdx') || ext === 'fdx') {
      try {
        const xml = new DOMParser().parseFromString(text, 'text/xml');
        const extracted = Array.from(xml.querySelectorAll('Paragraph'))
          .map(par => Array.from(par.querySelectorAll('Text')).map(t => t.textContent).join(''))
          .filter(s => s.trim()).join('\n');
        if (extracted.trim()) text = extracted;
      } catch(e) {}
    }
    previewHtml = `<pre style="background:var(--surface);color:var(--text);padding:20px;border-radius:8px;overflow:auto;width:min(820px,90vw);max-height:80vh;font-size:12px;line-height:1.7;white-space:pre-wrap;text-align:left">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
  } else {
    previewHtml = `<div style="background:var(--surface2);padding:40px;border-radius:12px;text-align:center;color:var(--text3)"><div style="font-size:48px;margin-bottom:12px">${scriptFileIcon(s.type)}</div><p style="margin:0 0 16px;font-size:14px">Preview not available for this file type</p><button class="btn btn-primary" onclick="downloadScriptFile('${s.id}')">Download to open</button></div>`;
  }

  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:min(820px,90vw);margin-bottom:10px">
      <span style="color:#fff;font-size:13px;font-weight:600">${s.name.replace(/</g,'&lt;')}</span>
      <button onclick="document.getElementById('${ovId}').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;font-size:18px;border-radius:6px;padding:2px 8px;line-height:1.4">✕</button>
    </div>
    ${previewHtml}`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

async function shareScriptFile(id) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  if (!s) return;

  // Try Web Share API with file first (native on mobile/modern desktop)
  if (navigator.canShare) {
    try {
      const res = await fetch(s.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], s.name, { type: s.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: s.name });
        return;
      }
    } catch(e) { /* fall through to manual share */ }
  }

  // Fallback share modal
  const ovId = '_share-' + id;
  const fname = s.name;
  const projTitle = p ? p.title : '';
  const emailSubject = encodeURIComponent(projTitle + ' - ' + fname);
  const emailBody = encodeURIComponent('Hi,\n\nI wanted to share ' + fname + ' with you from ' + projTitle + '.\n\nPlease find the document attached.\n\nBest regards');
  const textMsg   = encodeURIComponent(fname + (projTitle ? ' — ' + projTitle : ''));

  const overlay = document.createElement('div');
  overlay.id = ovId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:22px 18px 18px;width:290px;box-shadow:0 24px 64px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700">Share Document</span>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:0">✕</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:0 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fname.replace(/</g,'&lt;')}</p>
      <div style="display:flex;flex-direction:column;gap:5px">
        <div style="font-size:10px;color:var(--text3);padding:2px 2px 4px">Click Email, download file, then attach:</div>
        <a href="mailto:?subject=${emailSubject}&body=${emailBody}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">✉️ Email (pre-filled)</a>
        <a href="#" onclick="downloadScriptFile('${id}');return false" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">⬇ Download File</a>
        <a href="https://wa.me/?text=${textMsg}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💬 WhatsApp</a>
        <a href="https://t.me/share/url?text=${textMsg}" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">✈️ Telegram</a>
        <a href="sms:?body=${textMsg}" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💬 iMessage / SMS</a>
        <a href="https://www.messenger.com/t/" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">💙 Facebook Messenger</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fblackfountain.app" target="_blank" class="btn btn-sm" style="justify-content:flex-start;gap:10px;text-decoration:none">🔗 LinkedIn</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

function downloadScriptFile(id) {
  const p = currentProject();
  if (!p || !p.scripts) return;
  const s = p.scripts.find(x => x.id === id);
  if (!s) return;
  const a = document.createElement('a');
  a.href = s.dataUrl;
  a.download = s.name;
  a.click();
}

function removeScriptFile(id) {
  showConfirmDialog('Remove this script file?', 'Remove', () => {
    const p = currentProject();
    if (!p || !p.scripts) return;
    p.scripts = p.scripts.filter(x => x.id !== id);
    saveStore();
    renderScript(p);
  });
}

// ── SCRIPT FILE CONTEXT MENU ──────────────────────────────────────────────────
function showScriptCtxMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  _dismissCtxMenu();
  const p = currentProject();
  const s = (p?.scripts || []).find(x => x.id === id);
  if (!s) return;
  const ext = s.name.toLowerCase().split('.').pop();
  const canBreakdown = !['doc','docx'].includes(ext);

  const menu = document.createElement('div');
  menu.id = '_ctx-menu';
  menu.style.cssText = `position:fixed;z-index:9999;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:4px 0;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.4);font-size:13px`;
  const items = [
    { label: '📂 Create Script Breakdown', action: () => _ctxCreateBreakdown(id), disabled: !canBreakdown, title: canBreakdown ? '' : '.doc/.docx not supported' },
    { label: '👁 Preview',                 action: () => openScriptPreview(id) },
    { label: '⬇ Download',                action: () => downloadScriptFile(id) },
    { sep: true },
    { label: '🗑 Remove',                  action: () => removeScriptFile(id), danger: true },
  ];
  items.forEach(item => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0';
      menu.appendChild(sep);
      return;
    }
    const el = document.createElement('div');
    el.style.cssText = `padding:7px 14px;cursor:${item.disabled ? 'default' : 'pointer'};color:${item.danger ? '#e55' : item.disabled ? 'var(--text3)' : 'var(--text)'};white-space:nowrap`;
    el.textContent = item.label;
    if (item.disabled && item.title) el.title = item.title;
    if (!item.disabled) {
      el.addEventListener('mouseenter', () => el.style.background = 'var(--surface3)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('mousedown', e2 => { e2.stopPropagation(); _dismissCtxMenu(); item.action(); });
    }
    menu.appendChild(el);
  });

  // Position near cursor, keep on screen
  document.body.appendChild(menu);
  const mw = 210, mh = menu.offsetHeight || 160;
  let x = e.clientX, y = e.clientY;
  if (x + mw > window.innerWidth)  x = window.innerWidth - mw - 8;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';

  setTimeout(() => document.addEventListener('mousedown', _dismissCtxMenu, { once: true }), 0);
}


function _dismissCtxMenu() {
  document.getElementById('_ctx-menu')?.remove();
}

function _ctxCreateBreakdown(id) {
  importBreakdownFromScript(id);
}

// SCRIPT BREAKDOWN CATEGORIES (industry standard colour system)
const BREAKDOWN_CATEGORIES = [
  { id: 'cast',        label: 'Cast',          color: '#F5E642', textColor: '#1a1a1a' },
  { id: 'extras',      label: 'Extras',        color: '#52BE80', textColor: '#fff'    },
  { id: 'stunts',      label: 'Stunts',        color: '#FF8C42', textColor: '#fff'    },
  { id: 'props',       label: 'Props',         color: '#D4AC0D', textColor: '#fff'    },
  { id: 'vehicles',    label: 'Vehicles',      color: '#FF8FAB', textColor: '#1a1a1a' },
  { id: 'sfx',         label: 'SFX',           color: '#E74C3C', textColor: '#fff'    },
  { id: 'wardrobe',    label: 'Wardrobe',      color: '#9B59B6', textColor: '#fff'    },
  { id: 'makeup',      label: 'Makeup / Hair', color: '#C39BD3', textColor: '#1a1a1a' },
  { id: 'setdressing', label: 'Set Dressing',  color: '#2E86C1', textColor: '#fff'    },
  { id: 'vfx',         label: 'VFX',           color: '#1ABC9C', textColor: '#fff'    },
  { id: 'animals',     label: 'Animals',       color: '#E67E22', textColor: '#fff'    },
  { id: 'sound',       label: 'Sound / Music', color: '#EC407A', textColor: '#fff'    },
];

// Keyword hints per category for auto-suggest (longest phrases first within each array)
const BD_SUGGEST_KEYWORDS = {
  extras:      ['background artists','passersby','pedestrians','bystanders','spectators','onlookers','commuters','congregation','crowd','extras','audience','mob'],
  stunts:      ['car chase','gun fight','fist fight','hand to hand','shootout','gunfight','fistfight','brawl','combat','struggle','wrestle','tackle','stunt','chase','fight','punch','kick','leap','dive','roll'],
  props:       ['mobile phone','police badge','id card','gun holster','wedding ring','debit card','credit card','wine glass','shot glass','wine bottle','cigarette pack','briefcase','suitcase','backpack','flashlight','handcuffs','cigarette','newspaper','document','passport','crowbar','lockpick','syringe','camera','lighter','wallet','laptop','tablet','bottle','letter','radio','flask','badge','torch','money','chain','photo','knife','rope','book','cash','axe','gun','key','bag','bat','map','glass','wine'],
  vehicles:    ['pickup truck','police car','fire truck','limousine','motorcycle','motorbike','helicopter','submarine','aircraft','bicycle','chopper','forklift','tractor','convertible','ambulance','sports car','train','truck','plane','yacht','boat','ship','taxi','limo','jeep','bus','van','suv','cab','jet','car'],
  sfx:         ['explosion','explodes','detonation','gunfire','gunshot','lightning','thunder','collision','blast','smoke','crash','alarm','siren','storm','flood','fire'],
  wardrobe:    ['wedding dress','tuxedo','uniform','disguise','costume','armour','jacket','helmet','gloves','armor','dress','coat','robe','vest','mask','suit','hat','cap'],
  makeup:      ['face paint','black eye','greasepaint','aged makeup','prosthetic','prosthesis','bleeding','bruised','injured','wounded','blood','bruise','wound','scar','burn'],
  setdressing: ['bookshelf','whiteboard','chalkboard','curtains','painting','portrait','cabinet','trophy','mirror','table','couch','clock','sofa','desk','lamp','safe','bed'],
  vfx:         ['force field','laser beam','materializes','hologram','invisible','teleports','digital screen','morphs','transforms','glows','portal','cgi'],
  animals:     ['gorilla','elephant','parrot','chicken','rabbit','monkey','snake','horse','tiger','bear','wolf','bird','deer','duck','fish','lion','fox','dog','cat','rat','pig','cow'],
  sound:       ['phone rings','on the radio','voiceover','ringtone','doorbell','narration','singing','melody','music','song','v.o.','o.s.'],
};

// PROJECT BRIEF
const BRIEF_TEMPLATES = [
  {
    id: 1,
    name: 'Narrative / Feature',
    fields: [
      { key: 'intro',           label: 'Introduction and Vision' },
      { key: 'plotSummary',     label: 'Plot Summary' },
      { key: 'targetAudience',  label: 'Target Audience' },
      { key: 'budget',          label: 'Budget and Distribution Plans' },
      { key: 'timeline',        label: 'Timeline and Schedule' },
      { key: 'productionTeam',  label: 'Production Team' },
      { key: 'taskManagement',  label: 'Task Management' },
    ]
  },
  {
    id: 2,
    name: 'Commercial / Client',
    fields: [
      { key: 'clientProfile',  label: 'Client Profile' },
      { key: 'projectInfo',    label: 'Project Information' },
      { key: 'creativeReq',    label: 'Creative Requirements' },
      { key: 'logistics',      label: 'Logistics' },
      { key: 'timelineBudget', label: 'Timeline and Budget' },
    ]
  },
  {
    id: 3,
    name: 'Corporate / Branded',
    fields: [
      { key: 'purpose',        label: 'Project Purpose' },
      { key: 'deliverables',   label: 'Deliverables / Outputs' },
      { key: 'storyboard',     label: 'Storyboard & Script' },
      { key: 'shootLocations', label: 'Shoot Locations' },
      { key: 'timelineBudget', label: 'Timeline Budget' },
      { key: 'objectives',     label: 'Objectives & Target Audience' },
      { key: 'audio',          label: 'Audio & Branding' },
      { key: 'distribution',   label: 'Distribution Channels' },
      { key: 'reference',      label: 'Reference Videos' },
    ]
  },
];

function renderBrief(p) {
  const el = document.getElementById('brief-content');
  if (!el) return;
  if (!p.brief) p.brief = { template: null, fields: {} };
  if (!p.brief.removedKeys)   p.brief.removedKeys   = [];
  if (!p.brief.customFields)  p.brief.customFields  = [];
  const activeT = p.brief.template;

  const hasRemoved = p.brief.removedKeys.length > 0;
  let html = '';
  if (hasRemoved) {
    html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 14px;background:rgba(56,168,212,0.07);border:1px solid rgba(56,168,212,0.2);border-radius:8px">
      <span style="font-size:12px;color:var(--accent);flex:1">${p.brief.removedKeys.length} field${p.brief.removedKeys.length!==1?'s':''} hidden</span>
      <button class="btn btn-sm" onclick="restoreBriefFields()" style="color:var(--accent)">↺ Restore fields</button>
    </div>`;
  }
  html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
    ${BRIEF_TEMPLATES.map(t => `
      <div onclick="selectBriefTemplate(${t.id})" style="
        padding:14px 16px;border-radius:10px;cursor:pointer;
        border:2px solid ${activeT === t.id ? 'var(--accent)' : 'var(--border)'};
        background:${activeT === t.id ? 'rgba(56,168,212,0.07)' : 'var(--surface2)'};
        transition:border-color .15s,background .15s
      ">
        <div style="font-size:12px;font-weight:600;color:${activeT === t.id ? 'var(--accent)' : 'var(--text)'};margin-bottom:4px">${t.name}</div>
        <div style="font-size:10px;color:var(--text3)">${t.fields.length} fields</div>
      </div>
    `).join('')}
  </div>`;

  if (activeT) {
    const tmpl = BRIEF_TEMPLATES.find(t => t.id === activeT);
    if (tmpl) {
      const visibleFields = tmpl.fields.filter(f => !p.brief.removedKeys.includes(f.key));
      html += visibleFields.map(f => briefFieldHtml(f.key, f.label, p.brief.fields[f.key]||'', false)).join('');
    }
    // Custom fields
    html += p.brief.customFields.map(f => briefFieldHtml(f.key, f.label, p.brief.fields[f.key]||'', true)).join('');
    // Add field row
    html += `
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center" id="brief-add-row">
        <input class="form-input form-input-sm" id="brief-new-label" placeholder="New field label..." style="flex:1" onkeydown="if(event.key==='Enter')addBriefCustomField()">
        <button class="btn btn-sm btn-primary" onclick="addBriefCustomField()">+ Add Field</button>
      </div>`;
  } else {
    html += `<div class="empty-state" style="margin-top:12px"><div class="icon">🗒️</div><h4>Choose a template</h4><p>Select a template above to get started</p></div>`;
  }

  el.innerHTML = html;
}

function briefFieldHtml(key, label, value, isCustom) {
  return `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <label style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">${label.replace(/</g,'&lt;')}</label>
        <button onclick="removeBriefField('${key}',${isCustom})" title="Remove field" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;line-height:1;padding:0 2px">✕</button>
      </div>
      <textarea class="form-input" rows="4" style="width:100%;resize:vertical;font-size:13px;line-height:1.6"
        placeholder="Enter ${label.toLowerCase()}..."
        onblur="saveBriefField('${key}',this.value)">${value.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>`;
}

function removeBriefField(key, isCustom) {
  const p = currentProject();
  if (!p || !p.brief) return;
  if (!p.brief.removedKeys)  p.brief.removedKeys  = [];
  if (!p.brief.customFields) p.brief.customFields = [];
  // Find label for confirm message
  let label = key;
  if (isCustom) {
    label = (p.brief.customFields.find(f => f.key === key) || {}).label || key;
  } else {
    for (const t of BRIEF_TEMPLATES) {
      const f = t.fields.find(x => x.key === key);
      if (f) { label = f.label; break; }
    }
  }
  const msg = isCustom
    ? `Remove the "${label}" field? This cannot be undone.`
    : `Hide the "${label}" field? Your text will be saved — you can restore it later via Restore fields.`;
  showConfirmDialog(msg, isCustom ? 'Remove' : 'Hide', () => {
    if (isCustom) {
      p.brief.customFields = p.brief.customFields.filter(f => f.key !== key);
    } else {
      if (!p.brief.removedKeys.includes(key)) p.brief.removedKeys.push(key);
    }
    saveStore();
    renderBrief(p);
  });
}

function restoreBriefFields() {
  const p = currentProject();
  if (!p || !p.brief) return;
  p.brief.removedKeys = [];
  saveStore();
  renderBrief(p);
}

function addBriefCustomField() {
  const p = currentProject();
  if (!p || !p.brief) return;
  if (!p.brief.customFields) p.brief.customFields = [];
  const input = document.getElementById('brief-new-label');
  const label = input ? input.value.trim() : '';
  if (!label) return;
  const key = 'custom_' + makeId();
  p.brief.customFields.push({ key, label });
  saveStore();
  renderBrief(p);
}

function selectBriefTemplate(id) {
  const p = currentProject();
  if (!p) return;
  if (!p.brief) p.brief = { template: null, fields: {}, removedKeys: [], customFields: [] };
  p.brief.template = id;
  saveStore();
  renderBrief(p);
}

function saveBriefField(key, val) {
  const p = currentProject();
  if (!p) return;
  if (!p.brief) p.brief = { template: null, fields: {}, removedKeys: [], customFields: [] };
  p.brief.fields[key] = val;
  saveStore();
}

