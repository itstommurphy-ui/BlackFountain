// ══════════════════════════════════════════
// STORYBOARD
// ══════════════════════════════════════════

const SB_SHOT_TYPES  = ['Wide','Medium Wide','Medium','Medium Close-Up','Close-Up','Extreme Close-Up','Over-the-Shoulder','POV','Insert','Establishing','Two Shot','Aerial','B-Roll'];
const SB_MOVEMENTS   = ['Static','Handheld','Pan','Tilt','Dolly In','Dolly Out','Dolly Left','Dolly Right','Tracking','Crane Up','Crane Down','Gimbal','Zoom In','Zoom Out','Whip Pan'];
const SB_LENSES      = ['14mm','18mm','24mm','28mm','35mm','50mm','75mm','85mm','100mm','135mm','200mm','Zoom'];
const SB_TRANSITIONS = ['Cut','Dissolve','Fade In','Fade Out','Smash Cut','Match Cut','Wipe','Iris','Jump Cut'];

let _sbSceneFilter    = 'all';
let _sbDragFrame      = null;
let _sbDragTargetKey  = null;
let _sbSelected       = new Set(); // ids of selected frames
let _sbDraftFrame     = null;      // unsaved draft frame (not yet in sb.frames)

// ── HELPERS ───────────────────────────────────────────────────────────────────

function _getStoryboard(p) {
  if (!p.storyboard) p.storyboard = { id: makeId(), frames: [] };
  if (!p.storyboard.frames) p.storyboard.frames = [];
  return p.storyboard;
}

function _sbScenes(p) {
  try {
    _migrateBreakdowns(p);
    const bd = _getActiveBd(p);
    if (bd && bd.rawText) {
      return parseBreakdownScenes(bd.rawText).map(s => ({ key: s.heading, heading: s.heading }));
    }
  } catch(e) {}
  return [];
}

function _sbNextFrameNum(sb) {
  if (!sb.frames.length) return 1;
  const nums = sb.frames.map(f => parseInt(f.frameNumber) || 0);
  return Math.max(...nums) + 1;
}

function _sbMakeFrame(sb, sceneKey, sceneHeading) {
  return {
    id: makeId(),
    frameNumber: _sbNextFrameNum(sb),
    sceneKey: sceneKey || null,
    sceneHeading: sceneHeading || null,
    shotType: '', movement: '', lens: '', transition: '',
    imageDataUrl: null, bgColor: '#1a1a1a', action: '', dialogue: '', notes: '', duration: '',
  };
}

function _sbGroupByScene(frames, scenes) {
  const groups = [];
  const unattached = frames.filter(f => !f.sceneKey);
  if (unattached.length) groups.push({ key: '__unattached', heading: 'General / Unattached', frames: unattached });
  scenes.forEach(sc => {
    const scFrames = frames.filter(f => f.sceneKey === sc.key);
    if (scFrames.length) groups.push({ key: sc.key, heading: sc.heading, frames: scFrames });
  });
  // Orphaned frames (breakdown changed)
  const knownKeys = new Set(scenes.map(s => s.key));
  const orphaned  = frames.filter(f => f.sceneKey && !knownKeys.has(f.sceneKey));
  const og = {};
  orphaned.forEach(f => { if (!og[f.sceneKey]) og[f.sceneKey] = []; og[f.sceneKey].push(f); });
  Object.entries(og).forEach(([key, gf]) => groups.push({ key, heading: gf[0].sceneHeading || key, frames: gf }));
  return groups;
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderStoryboard(p) {
  const el = document.getElementById('section-storyboard');
  if (!el) return;
  _sbInjectStyles();

  const sb     = _getStoryboard(p);
  const scenes = _sbScenes(p);
  const hasBreakdown = scenes.length > 0;

  let frames = sb.frames;
  if (_sbSceneFilter !== 'all') {
    frames = _sbSceneFilter === '__unattached'
      ? frames.filter(f => !f.sceneKey)
      : frames.filter(f => f.sceneKey === _sbSceneFilter);
  }

  const groups    = _sbGroupByScene(frames, scenes);
  const total     = sb.frames.length;
  const totalSecs = sb.frames.reduce((a, f) => a + (parseInt(f.duration) || 0), 0);
  const durStr    = totalSecs > 0 ? ` · ~${Math.floor(totalSecs/60)}m ${totalSecs%60}s` : '';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h3 class="section-heading" style="margin:0">STORYBOARD</h3>
        ${total ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;font-family:var(--font-mono)">${total} frame${total!==1?'s':''}${durStr}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="goto-hook"></span>
        ${hasBreakdown ? `
          <select onchange="_sbSetFilter(this.value)" style="padding:5px 10px;font-size:11px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text3);cursor:pointer">
            <option value="all" ${_sbSceneFilter==='all'?'selected':''}>All Scenes</option>
            <option value="__unattached" ${_sbSceneFilter==='__unattached'?'selected':''}>Unattached</option>
            ${scenes.map(s => `<option value="${s.key.replace(/"/g,'&quot;')}" ${_sbSceneFilter===s.key?'selected':''}>${s.heading.replace(/</g,'&lt;').substring(0,50)}</option>`).join('')}
          </select>
        ` : ''}
        ${hasBreakdown ? `<button class="btn btn-sm" onclick="_sbSyncScenes()" title="Add placeholder frames for scenes that have none yet">⟳ Sync Scenes</button>` : ''}
        <button class="btn btn-sm" onclick="_sbBatchAdd()">⚡ Batch Add</button>
        <button class="btn btn-sm" onclick="_sbAddCustomScene()">+ Scene</button>
        <button class="btn btn-sm" onclick="_sbExportPDF()">⬇ Export PDF</button>
        <button class="btn btn-sm btn-primary" onclick="_sbNewFrame()">+ Add Frame</button>
      </div>
    </div>

    <!-- Bulk action bar — visible when frames are selected -->
    <div id="sb-bulk-bar" style="display:${_sbSelected.size?'flex':'none'};align-items:center;gap:10px;padding:8px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--text2);font-weight:600">${_sbSelected.size} frame${_sbSelected.size!==1?'s':''} selected</span>
      <button class="btn btn-sm" onclick="_sbMoveSelectedToScene()">↗ Move to Scene…</button>
      <button class="btn btn-sm btn-danger" onclick="_sbDeleteSelected()">🗑 Delete</button>
      <button class="btn btn-sm" style="opacity:0.7" onclick="_sbDeselectAll()">✕ Clear</button>
    </div>

    ${!total ? `
      <div class="empty-state" style="margin-top:40px">
        <div class="icon">🎬</div>
        <h4>No frames yet</h4>
        <p>${hasBreakdown ? 'Add your first frame — attach to a scene or leave unattached.' : 'Upload a script and create a breakdown to attach frames to scenes, or just start adding frames freely.'}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="btn btn-sm" onclick="_sbBatchAdd()">⚡ Batch Add</button>
          <button class="btn btn-primary" onclick="_sbNewFrame()">+ Add First Frame</button>
        </div>
      </div>
    ` : `<div id="sb-canvas" style="position:relative;user-select:none">${groups.map(group => _sbGroupHtml(group, scenes)).join('')}</div>`}
  `;
  // Wire rubber-band selection on the canvas
  setTimeout(() => _sbInitRubberBand(), 0);
  // Inject Go To dropdown
  el.querySelectorAll('.goto-hook').forEach(h => { h.innerHTML = _gotoHtml('storyboard'); });
}

function _sbGroupHtml(group, scenes) {
  const isUnattached = group.key === '__unattached';
  const safeKey  = group.key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const safeHead = group.heading.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const escKey   = group.key.replace(/"/g,'&quot;');

  return `
    <div class="sb-group" data-scene-key="${escKey}" style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border2)">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--accent2);text-transform:uppercase;font-family:var(--font-mono)">${isUnattached?'⬡ GENERAL':'▸ SCENE'}</span>
        <span style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${group.heading.replace(/</g,'&lt;')}</span>
        <span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${group.frames.length} frame${group.frames.length!==1?'s':''}</span>
        <button onclick="_sbAddFrameToScene('${safeKey}','${safeHead}')" style="background:none;border:1px dashed var(--border2);color:var(--text3);cursor:pointer;font-size:10px;padding:2px 8px;border-radius:var(--radius)">+ Frame</button>
        ${group.frames.length ? `<button onclick="event.stopPropagation();_sbDeleteScene('${safeKey}')" title="Delete all frames in this scene" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:2px 4px;opacity:0.5;line-height:1" onmouseenter="this.style.opacity=1;this.style.color='var(--danger,#e55)'" onmouseleave="this.style.opacity=0.5;this.style.color='var(--text3)'">🗑</button>` : ''}
      </div>
      <div class="sb-frames-grid sb-drop-target" data-scene-key="${escKey}"
        ondrop="_sbGridDrop(event,'${safeKey}','${safeHead}')">
        ${group.frames.map(f => _sbFrameCardHtml(f)).join('')}
        <div class="sb-add-card" onclick="_sbAddFrameToScene('${safeKey}','${safeHead}')">
          <span style="font-size:24px;color:var(--border2)">+</span>
          <span style="font-size:10px;color:var(--text3)">Add Frame</span>
        </div>
      </div>
    </div>`;
}

function _sbFrameCardHtml(f) {
  const hasImage = !!f.imageDataUrl;
  const sel = _sbSelected.has(f.id);
  return `
    <div class="sb-slot" id="sb-slot-${f.id}">
      <div class="sb-frame-card${sel?' sb-selected':''}" id="sb-card-${f.id}"
        draggable="true"
        ondragstart="_sbDragStart(event,'${f.id}')"
        ondragend="_sbDragEnd()"
        ondragover="_sbCardDragOver(event,'${f.id}')"
        ondragleave="_sbCardDragLeave('${f.id}')"
        ondrop="_sbCardDrop(event,'${f.id}')"
        onclick="_sbCardClick(event,'${f.id}')"
        title="Click to edit · Shift-click to select"
      >
        ${sel ? `<div class="sb-sel-check">✓</div>` : ''}
        <label class="sb-checkbox-wrap" onclick="event.stopPropagation()">
          <input type="checkbox" class="sb-cb" data-id="${f.id}" ${sel?'checked':''} onchange="_sbToggleSelect('${f.id}',this.checked)">
        </label>
        <div class="sb-frame-image-zone" onclick="event.stopPropagation();_sbUploadImage('${f.id}')">
          ${hasImage
            ? `<img src="${f.imageDataUrl}" alt="Frame ${f.frameNumber}" style="width:100%;height:100%;object-fit:cover">`
            : `<div class="sb-frame-placeholder">
                <svg viewBox="0 0 100 75" style="width:60%;opacity:0.12" fill="none" stroke="currentColor" stroke-width="1">
                  <rect x="2" y="2" width="96" height="71" rx="2"/>
                  <line x1="2" y1="2" x2="98" y2="73"/>
                  <line x1="98" y1="2" x2="2" y2="73"/>
                  <circle cx="20" cy="20" r="8"/>
                </svg>
                <span style="font-size:9px;color:var(--text3);margin-top:4px">Click to upload sketch</span>
              </div>`
          }
          <div class="sb-frame-num">${f.frameNumber||'?'}</div>
        </div>
        <div class="sb-frame-meta">
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">
            ${f.shotType ? `<span class="sb-pill">${f.shotType}</span>` : ''}
            ${f.movement ? `<span class="sb-pill sb-pill-move">${f.movement}</span>` : ''}
            ${f.lens     ? `<span class="sb-pill sb-pill-lens">${f.lens}</span>`     : ''}
          </div>
          <div class="sb-frame-action">${(f.action||'No description').substring(0,80)}${(f.action||'').length>80?'…':''}</div>
          ${f.dialogue   ? `<div class="sb-frame-dialogue">"${f.dialogue.substring(0,60)}${f.dialogue.length>60?'…':''}"</div>` : ''}
          ${f.transition ? `<div style="font-size:9px;color:var(--text3);margin-top:4px;font-family:var(--font-mono)">→ ${f.transition}</div>` : ''}
          <div class="sb-card-actions">
            ${f.imageDataUrl ? `<button class="sb-card-act" onclick="event.stopPropagation();_sbClearFrameImage('${f.id}')" title="Clear sketch/image">◻ Clear</button>` : ''}
            <button class="sb-card-act sb-card-act-del" onclick="event.stopPropagation();_sbDeleteFrameInline('${f.id}',this)" title="Delete frame">🗑</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ── FRAME MODAL ───────────────────────────────────────────────────────────────

function _sbOpenFrame(id, isDraft) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  // Draft frames haven't been committed to sb.frames yet — check there first
  const f  = (_sbDraftFrame?.frame?.id === id ? _sbDraftFrame.frame : null)
          || sb.frames.find(x => x.id === id);
  if (!f) return;
  const scenes  = _sbScenes(p);
  const idx     = isDraft ? -1 : sb.frames.indexOf(f);
  const isFirst = idx === 0;
  const isLast  = idx === sb.frames.length - 1;

  const ovId = '_sb-frame-modal';
  document.getElementById(ovId)?.remove();

  const ov = document.createElement('div');
  ov.id  = ovId;
  ov.setAttribute('tabindex','-1');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px;outline:none';

  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(820px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--accent2);font-family:var(--font-mono)">FRAME</span>
          <input id="_sbfNum" type="number" value="${f.frameNumber||''}" min="1"
            style="width:58px;padding:3px 6px;font-size:14px;font-weight:700;font-family:var(--font-mono);background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center"
            onchange="_sbSaveField('${id}','frameNumber',this.value)">
          <span style="font-size:11px;color:var(--text3)">${idx+1} of ${sb.frames.length}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="_sbPrevFrame('${id}')" class="btn btn-sm" ${isFirst?'disabled':''} style="${isFirst?'opacity:0.3;cursor:not-allowed':''}">← Prev</button>
          <button onclick="_sbNextFrame('${id}')" class="btn btn-sm" ${isLast?'disabled':''} style="${isLast?'opacity:0.3;cursor:not-allowed':''}">Next →</button>
          <button id="_sbTrayBtn_${id}" onclick="_sbToggleTray('${id}')" class="btn btn-sm" title="Toggle script view" style="font-size:10px;letter-spacing:0.5px">📄 SCRIPT</button>
          <button onclick="document.getElementById('${ovId}').remove();renderStoryboard(currentProject())" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1;padding:0 0 0 8px">✕</button>
        </div>
      </div>

      <!-- Body: landscape layout — canvas top, fields below -->
      <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0">

        <!-- Sketch / Image Panel — landscape, fixed height -->
        <div id="_sbPanel_${id}" style="flex-shrink:0;border-bottom:1px solid var(--border);display:flex;flex-direction:column;background:${f.bgColor || '#1a1a1a'};height:400px">
          <!-- Canvas toolbar -->
          <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#111;border-bottom:1px solid #333;flex-wrap:wrap;flex-shrink:0">
            <!-- Tools -->
            <button id="_sbToolPen_${id}"   onclick="_sbSetTool('${id}','pen')"   title="Pen (P)"    class="sb-tool-btn sb-tool-active">✏️</button>
            <button id="_sbToolErase_${id}" onclick="_sbSetTool('${id}','erase')" title="Eraser (E)" class="sb-tool-btn">◻</button>
            <button id="_sbToolFill_${id}"  onclick="_sbSetTool('${id}','fill')"  title="Fill (F)"   class="sb-tool-btn">🪣</button>
            <div class="sb-tdiv"></div>
            <!-- Stroke sizes -->
            <button onclick="_sbSetSize('${id}',2)"  title="Thin"   class="sb-tool-btn sb-sz">─</button>
            <button onclick="_sbSetSize('${id}',6)"  title="Medium" class="sb-tool-btn sb-sz">━</button>
            <button onclick="_sbSetSize('${id}',16)" title="Thick"  class="sb-tool-btn sb-sz">▬</button>
            <div class="sb-tdiv"></div>
            <!-- Ink colour picker + favourites -->
            <label title="Ink colour" style="position:relative;cursor:pointer;flex-shrink:0">
              <div id="_sbColorSwatch_${id}" style="width:20px;height:20px;border-radius:4px;border:2px solid #666;background:#ffffff;cursor:pointer"></div>
              <input type="color" id="_sbColorPicker_${id}" value="#ffffff"
                style="position:absolute;opacity:0;width:100%;height:100%;top:0;left:0;cursor:pointer"
                onchange="_sbSetColor('${id}',this.value)">
            </label>
            <div id="_sbFavs_${id}" style="display:flex;gap:3px;align-items:center"></div>
            <div class="sb-tdiv"></div>
            <!-- BG colour -->
            <label id="_sbBgLabel_${id}" title="Background colour" style="position:relative;cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:3px">
              <span style="font-size:9px;color:#888">BG</span>
              <div id="_sbBgSwatch_${id}" style="width:16px;height:16px;border-radius:3px;border:2px solid #555;background:${f.bgColor || '#1a1a1a'};cursor:pointer" onclick="_sbToggleBgPicker('${id}')"></div>
              <input type="color" id="_sbBgPicker_${id}" value="${f.bgColor || '#1a1a1a'}"
                style="position:absolute;opacity:0;width:100%;height:100%;top:0;left:0;cursor:pointer"
                oninput="_sbSetBgLive('${id}',this.value)" onchange="_sbSetBg('${id}',this.value)">
            </label>
            <div class="sb-tdiv"></div>
            <!-- Undo / Clear -->
            <button onclick="_sbUndo('${id}')"        title="Undo (Ctrl+Z)"  class="sb-tool-btn" style="font-size:11px">↩</button>
            <button onclick="_sbClearCanvas('${id}')" title="Clear canvas"   class="sb-tool-btn" style="font-size:10px">🗑</button>
            <!-- Upload / Download — pushed right -->
            <div style="flex:1"></div>
            <button class="sb-tool-btn" style="font-size:9px" onclick="_sbUploadImage('${id}')" title="Upload image">⬆</button>
            <button class="sb-tool-btn" style="font-size:9px" onclick="_sbDownloadSketch('${id}')" title="Download as PNG">⬇</button>
            ${f.imageDataUrl ? `<button class="sb-tool-btn" style="font-size:9px;color:#e55" onclick="_sbRemoveImage('${id}')" title="Remove image">✕</button>` : ''}
          </div>
          <!-- Canvas area -->
          <div id="_sbCanvasWrap_${id}" style="flex:1;position:relative;overflow:hidden">
            <canvas id="_sbCanvas_${id}" style="display:block;cursor:crosshair;touch-action:none;position:absolute;inset:0"></canvas>
          </div>
          <input type="file" id="_sbfImgInput_${id}" accept="image/*" style="display:none" onchange="_sbHandleImageUpload('${id}',this)">
        </div>

        <!-- Fields — scrollable below canvas -->
        <div style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px">

          <div>
            <label class="form-label" style="margin-bottom:4px">Scene</label>
            <select id="_sbfScene_${id}" onchange="_sbSaveField('${id}','sceneKey',this.value);_sbSaveSceneHeading('${id}',this)"
              style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
              <option value="">— General / Unattached —</option>
              ${scenes.map(s=>`<option value="${s.key.replace(/"/g,'&quot;')}" ${f.sceneKey===s.key?'selected':''}>${s.heading.replace(/</g,'&lt;').substring(0,60)}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="form-label" style="margin-bottom:4px">Shot Type</label>
              <select onchange="_sbSaveField('${id}','shotType',this.value)" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_SHOT_TYPES.map(t=>`<option ${f.shotType===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="margin-bottom:4px">Camera Movement</label>
              <select onchange="_sbSaveField('${id}','movement',this.value)" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_MOVEMENTS.map(m=>`<option ${f.movement===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="form-label" style="margin-bottom:4px">Lens</label>
              <select onchange="_sbSaveField('${id}','lens',this.value)" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_LENSES.map(l=>`<option ${f.lens===l?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="margin-bottom:4px">Transition Out</label>
              <select onchange="_sbSaveField('${id}','transition',this.value)" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_TRANSITIONS.map(t=>`<option ${f.transition===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="form-label" style="margin-bottom:4px">Est. Duration (seconds)</label>
            <input type="number" value="${f.duration||''}" min="1" placeholder="e.g. 5"
              style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)"
              onchange="_sbSaveField('${id}','duration',this.value)">
          </div>

          <div>
            <label class="form-label" style="margin-bottom:4px">Action / Description</label>
            <textarea rows="3" placeholder="What happens in this frame…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5"
              onblur="_sbSaveField('${id}','action',this.value)">${(f.action||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

          <div>
            <label class="form-label" style="margin-bottom:4px">Dialogue Beat <span style="opacity:0.5;font-weight:400">(optional)</span></label>
            <textarea rows="2" placeholder="Key dialogue in this frame…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5;font-style:italic"
              onblur="_sbSaveField('${id}','dialogue',this.value)">${(f.dialogue||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

          <div>
            <label class="form-label" style="margin-bottom:4px">Director / DoP Notes <span style="opacity:0.5;font-weight:400">(optional)</span></label>
            <textarea rows="2" placeholder="Lighting, mood, reference…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5"
              onblur="_sbSaveField('${id}','notes',this.value)">${(f.notes||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

        </div><!-- /fields -->
      </div><!-- /body -->

      <!-- Script Tray — slides up from bottom -->
      <div id="_sbTray_${id}" style="position:relative;flex-shrink:0;max-height:0;transition:max-height 0.3s cubic-bezier(0.4,0,0.2,1);border-top:0px solid var(--border);overflow:hidden">
        <div style="background:var(--surface2);font-family:var(--font-mono,monospace);font-size:11px;line-height:1.7;color:var(--text2)" id="_sbTrayContent_${id}"></div>
      </div>

      <!-- Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 18px;border-top:1px solid var(--border);flex-shrink:0">
        ${isDraft
          ? `<button class="btn btn-sm" onclick="_sbDiscardDraft();document.getElementById('${ovId}').remove();" style="opacity:0.7">Cancel</button>`
          : `<button class="btn btn-sm btn-danger" onclick="_sbDeleteFrame('${id}')">🗑 Delete</button>`
        }
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="_sbSaveSketch('${id}');_sbCommitDraft();_sbAddNextFrame('${id}')">Save &amp; Add Next</button>
          <button class="btn btn-sm btn-primary" onclick="_sbSaveSketch('${id}');_sbCommitDraft();document.getElementById('${ovId}').remove();renderStoryboard(currentProject())">Save &amp; Close</button>
        </div>
      </div>

    </div>`;

  document.body.appendChild(ov);
  ov.focus();

  // Initialise the sketch canvas now that the DOM is ready
  setTimeout(() => _sbInitCanvas(id), 0);

  const _sbCleanupKb = () => {
    const st = _sbSketchState[id];
    if (st?._kbHandler) { document.removeEventListener('keydown', st._kbHandler); st._kbHandler = null; }
  };
  // Backdrop / Escape — discard draft if new, save if existing
  const _sbCloseModal = (save) => {
    if (save && !isDraft) _sbSaveSketch(id);
    if (!save || isDraft) _sbDiscardDraft();
    _sbCleanupKb();
    ov.remove();
    renderStoryboard(currentProject());
  };
  
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); _sbCloseModal(false); }
    if (e.key === 'ArrowLeft'  && !isFirst && !isDraft) { e.preventDefault(); _sbSaveSketch(id); _sbCleanupKb(); _sbPrevFrame(id); }
    if (e.key === 'ArrowRight' && !isLast  && !isDraft) { e.preventDefault(); _sbSaveSketch(id); _sbCleanupKb(); _sbNextFrame(id); }
  });
}

// ── SCRIPT TRAY ──────────────────────────────────────────────────────────────

function _sbGetScriptForFrame(f) {
  // Returns { text, scenes, isFullScript } or null
  const p = currentProject(); if (!p) return null;
  try {
    const bd = _getActiveBd(p);
    if (!bd?.rawText) return null;
    const rawText = bd.rawText;
    const allScenes = parseBreakdownScenes(rawText);
    if (f.sceneKey) {
      const scene = allScenes.find(s => s.heading === f.sceneKey);
      if (scene) return { text: rawText.substring(scene.start, scene.end).trim(), scenes: [], isFullScript: false };
    }
    // No scene attached — return full script with scene nav
    return { text: rawText.trim(), scenes: allScenes, isFullScript: true };
  } catch(e) { return null; }
}

function _sbToggleTray(id) {
  const tray    = document.getElementById('_sbTray_' + id);
  const content = document.getElementById('_sbTrayContent_' + id);
  const btn     = document.getElementById('_sbTrayBtn_' + id);
  if (!tray) return;

  const isOpen = tray.style.maxHeight !== '0px' && tray.style.maxHeight !== '';

  if (isOpen) {
    tray.style.maxHeight = '0px';
    tray.style.borderTopWidth = '0px';
    if (btn) { btn.style.background = ''; btn.style.color = ''; btn.classList.remove('sb-tool-active'); }
  } else {
    // Populate content lazily
    if (!content.dataset.loaded) {
      const p  = currentProject();
      const sb = p ? _getStoryboard(p) : null;
      const f  = (_sbDraftFrame?.frame?.id === id ? _sbDraftFrame.frame : null)
              || sb?.frames.find(x => x.id === id);
      const result = f ? _sbGetScriptForFrame(f) : null;
      if (result) {
        if (result.isFullScript && result.scenes.length) {
          // Full script: fixed-height container, scrollable body, nav at bottom
          // Heights: tray=340px, nav~36px, body gets the rest
          const NAV_H = 36;
          const BODY_H = 340 - NAV_H;

          // Script body — fixed height, scrollable
          const body = document.createElement('div');
          body.id = '_sbTrayBody_' + id;
          body.style.cssText = `height:${BODY_H}px;overflow-y:auto;padding:10px 12px 6px;white-space:pre-wrap;word-break:break-word`;
          body.innerHTML = _sbFormatScriptText(result.text, result.scenes, id);

          // Nav bar — fixed height at bottom
          const nav = document.createElement('div');
          nav.style.cssText = `height:${NAV_H}px;border-top:1px solid var(--border);padding:0 10px;display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;align-items:center;flex-shrink:0`;
          const label = document.createElement('span');
          label.style.cssText = 'font-size:9px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap;margin-right:4px;flex-shrink:0';
          label.textContent = 'JUMP TO:';
          nav.appendChild(label);
          result.scenes.forEach((sc, i) => {
            const pill = document.createElement('button');
            pill.style.cssText = 'background:rgba(91,192,235,0.08);border:1px solid rgba(91,192,235,0.25);color:var(--accent2);border-radius:4px;cursor:pointer;font-size:9px;padding:2px 7px;white-space:nowrap;font-family:var(--font-mono);flex-shrink:0';
            pill.title = sc.heading;
            pill.textContent = sc.heading.substring(0,35) + (sc.heading.length > 35 ? '…' : '');
            pill.onclick = () => {
              const anchor = document.getElementById('_sbTrayAnchor_' + id + '_' + i);
              const bodyEl = document.getElementById('_sbTrayBody_' + id);
              if (anchor && bodyEl) bodyEl.scrollTop = anchor.offsetTop - 8;
            };
            nav.appendChild(pill);
          });

          content.innerHTML = '';
          content.appendChild(body);
          content.appendChild(nav);
        } else {
          content.style.cssText += ';max-height:300px;overflow-y:auto;padding:10px 12px;white-space:pre-wrap;word-break:break-word';
          content.innerHTML = _sbFormatScriptText(result.text, [], id);
        }
      } else {
        content.innerHTML = '<span style="color:var(--text3);font-style:italic">No script text available — upload a script and create a breakdown to see it here.</span>';
      }
      content.dataset.loaded = '1';
    }
    tray.style.maxHeight = '340px';
    tray.style.borderTopWidth = '1px';
    if (btn) { btn.style.background = 'rgba(91,192,235,0.15)'; btn.style.color = 'var(--accent2)'; }
  }
}

function _sbFormatScriptText(text, scenes, frameId) {
  // Build ordered list of anchors keyed by scene index
  // Walk scenes in order — for each scene, record which line number its heading is on
  // This handles duplicate headings correctly since we match by position not text
  const lineAnchors = {}; // lineIndex → scene array index
  if (scenes && scenes.length && frameId) {
    let offset = 0;
    const lines = text.split('\n');
    let sceneIdx = 0;
    for (let li = 0; li < lines.length && sceneIdx < scenes.length; li++) {
      if (offset === scenes[sceneIdx].start) {
        lineAnchors[li] = sceneIdx;
        sceneIdx++;
      }
      offset += lines[li].length + 1;
    }
  }
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const t = line.trim();
    if (!t) return '<br>';
    // Scene heading — add anchor if we have one for this line
    if (/^(?:INT|EXT|I\/E)[\.\s]/i.test(t)) {
      const anchorIdx = lineAnchors[li];
      const anchorAttr = (anchorIdx !== undefined)
        ? `id="_sbTrayAnchor_${frameId}_${anchorIdx}"`
        : '';
      return `<div ${anchorAttr} style="color:var(--accent2);font-weight:700;margin-top:10px;padding-top:4px;letter-spacing:0.5px">${_sbEscHtml(t)}</div>`;
    }
    // Character name (ALL CAPS, indented)
    if (t === t.toUpperCase() && t.length < 40 && /[A-Z]/.test(t) && !/^[^A-Za-z]*$/.test(t) && line.startsWith('    ')) {
      return `<div style="color:var(--accent);text-align:center;margin-top:4px">${_sbEscHtml(t)}</div>`;
    }
    // Dialogue (indented)
    if (line.startsWith('    ') || line.startsWith('\t')) {
      return `<div style="color:var(--text);padding-left:1em;font-style:italic">${_sbEscHtml(t)}</div>`;
    }
    // Action
    return `<div style="color:var(--text2)">${_sbEscHtml(t)}</div>`;
  }).join('');
}

function _sbEscHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── FRAME ACTIONS ─────────────────────────────────────────────────────────────

function _sbSetFilter(val) {
  _sbSceneFilter = val;
  renderStoryboard(currentProject());
}

function _sbNewFrame() {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  _sbDraftFrame = { frame: _sbMakeFrame(sb, null, null), insertAfter: null };
  _sbOpenFrame(_sbDraftFrame.frame.id, true);
}

function _sbAddFrameToScene(sceneKey, sceneHeading) {
  console.log('[SB] _sbAddFrameToScene fired, key=', sceneKey, new Error().stack.split('\n')[1]);
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const isUnattached = !sceneKey || sceneKey === '__unattached';
  const f  = _sbMakeFrame(sb, isUnattached ? null : sceneKey, isUnattached ? null : sceneHeading);
  _sbDraftFrame = { frame: f, insertAfter: null };
  _sbOpenFrame(f.id, true);
}

function _sbAddNextFrame(currentId) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const cur = sb.frames.find(x => x.id === currentId);
  const f   = _sbMakeFrame(sb, cur?.sceneKey || null, cur?.sceneHeading || null);
  _sbDraftFrame = { frame: f, insertAfter: currentId };
  document.getElementById('_sb-frame-modal')?.remove();
  _sbOpenFrame(f.id, true);
}

// Commit a draft frame into the store
function _sbCommitDraft() {
  if (!_sbDraftFrame) return;
  console.log('[SB] _sbCommitDraft fired, id=', _sbDraftFrame.frame.id, new Error().stack.split('\n')[1]);
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const { frame, insertAfter } = _sbDraftFrame;
  _sbDraftFrame = null;
  if (insertAfter) {
    const idx = sb.frames.findIndex(x => x.id === insertAfter);
    sb.frames.splice(idx + 1, 0, frame);
  } else {
    sb.frames.push(frame);
  }
  saveStore();
}

// Discard a draft — just clear it, nothing was saved
function _sbDiscardDraft() {
  if (_sbDraftFrame) {
    delete _sbSketchState[_sbDraftFrame.frame.id];
    _sbDraftFrame = null;
  }
}

// ── ADD CUSTOM SCENE ─────────────────────────────────────────────────────────

function _sbAddCustomScene() {
  const ovId = '_sb-custom-scene-modal';
  document.getElementById(ovId)?.remove();
  const p = currentProject();
  const scenes = p ? _sbScenes(p) : [];
  const hasBreakdown = scenes.length > 0;

  const ov = document.createElement('div');
  ov.id = ovId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(400px,94vw);padding:22px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:14px;font-weight:700">+ Add Scene</h3>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1">✕</button>
      </div>
      ${hasBreakdown ? `
        <div>
          <label class="form-label" style="margin-bottom:4px">Select scene from breakdown</label>
          <select id="_sbSceneSelect" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
            <option value="">— Choose a scene —</option>
            ${scenes.map(s => `<option value="${s.key.replace(/"/g,'&quot;')}">${s.heading.replace(/</g,'&lt;').substring(0,80)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:-8px">
          <input type="checkbox" id="_sbNewScene" style="width:16px;height:16px;accent-color:var(--accent)">
          <label for="_sbNewScene" style="font-size:12px;color:var(--text2)">Or create custom scene</label>
        </div>
      ` : ''}
      <div id="_sbCustomSceneInput" style="display:${hasBreakdown ? 'none' : 'flex'};flex-direction:column;gap:10px">
        <div>
          <label class="form-label" style="margin-bottom:4px">Scene heading</label>
          <input type="text" id="_sbCustomSceneName" placeholder="e.g. INT. BARRY'S OFFICE - DAY"
            style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)"
            onkeydown="if(event.key==='Enter')_sbAddCustomSceneConfirm('${ovId}')">
        </div>
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">Frames to add <span style="opacity:0.5;font-weight:400">(optional)</span></label>
        <input type="number" id="_sbCustomSceneCount" value="1" min="0" max="20"
          style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_sbAddCustomSceneConfirm('${ovId}')">Add Scene</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  if (hasBreakdown) {
    const sel = document.getElementById('_sbSceneSelect');
    const chk = document.getElementById('_sbNewScene');
    const cust = document.getElementById('_sbCustomSceneInput');
    sel?.addEventListener('change', () => {
      if (sel.value) cust.style.display = 'none';
    });
    chk?.addEventListener('change', () => {
      cust.style.display = chk.checked ? 'flex' : 'none';
      if (chk.checked) { sel.value = ''; }
    });
  }
  setTimeout(() => document.getElementById('_sbCustomSceneName')?.focus(), 50);
}

function _sbAddCustomSceneConfirm(ovId) {
  const ov = document.getElementById(ovId); if (!ov) return;
  if (ov._confirming) return;
  ov._confirming = true;
  const p = currentProject(); if (!p) return;
  const scenes = _sbScenes(p);
  const hasBreakdown = scenes.length > 0;

  let name = '';
  if (hasBreakdown) {
    const sel = document.getElementById('_sbSceneSelect');
    const chk = document.getElementById('_sbNewScene');
    const customInput = document.getElementById('_sbCustomSceneName');
    if (chk?.checked || !sel?.value) {
      name = customInput?.value.trim();
    } else {
      name = sel?.value;
    }
  } else {
    name = document.getElementById('_sbCustomSceneName')?.value.trim();
  }

  if (!name) { showToast('Please select or enter a scene heading', 'info'); ov._confirming = false; return; }
  const count = Math.max(1, Math.min(20, parseInt(document.getElementById('_sbCustomSceneCount')?.value) || 1));
  const sb = _getStoryboard(p);
  for (let i = 0; i < count; i++) {
    sb.frames.push(_sbMakeFrame(sb, name, name));
  }
  saveStore();
  ov.remove();
  renderStoryboard(p);
  showToast(`Scene "${name}" added`, 'success');
}

// ── SYNC SCENES FROM BREAKDOWN ───────────────────────────────────────────────

function _sbSyncScenes() {
  const p = currentProject(); if (!p) return;
  const scenes = _sbScenes(p);
  if (!scenes.length) { showToast('No scenes found in breakdown', 'info'); return; }

  const sb = _getStoryboard(p);

  // Count how many frames exist per heading, in order — so duplicate headings
  // are tracked separately by their occurrence index
  const headingCounts = {}; // heading → count of frames seen so far
  sb.frames.forEach(f => {
    if (f.sceneKey) headingCounts[f.sceneKey] = (headingCounts[f.sceneKey] || 0) + 1;
  });

  // For each scene (in order), check if its occurrence slot already has frames.
  // e.g. two "EXT. BUS STOP - DAY" scenes: first needs ≥1 frame, second needs ≥1 frame separately.
  const headingSeen = {};
  const newScenes = scenes.filter(s => {
    const occurrence = headingSeen[s.key] || 0;
    headingSeen[s.key] = occurrence + 1;
    // This occurrence slot has frames if total frames for this heading exceed occurrence
    // i.e. first slot uses 1st frame, second slot uses 2nd, etc.
    return (headingCounts[s.key] || 0) <= occurrence;
  });

  const skippedCount = scenes.length - newScenes.length;

  if (!newScenes.length) {
    showToast('All scenes already have frames', 'info');
    return;
  }

  const ovId = '_sb-sync-modal';
  document.getElementById(ovId)?.remove();
  const ov = document.createElement('div');
  ov.id = ovId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(420px,94vw);padding:22px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:14px;font-weight:700">⟳ Sync Scenes from Script</h3>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1">✕</button>
      </div>
      <div style="font-size:12px;color:var(--text2);background:var(--surface2);border-radius:8px;padding:10px 12px;line-height:1.6">
        <strong>${newScenes.length}</strong> scene${newScenes.length!==1?'s':''} have no frames yet.
        ${skippedCount ? `<span style="color:var(--text3)"> (${skippedCount} already have frames and will be skipped.)</span>` : ''}
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">Blank frames to create per scene</label>
        <input type="number" id="_sbSyncCount" value="1" min="1" max="20"
          style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
      </div>
      <div style="font-size:11px;color:var(--text3)">
        Scenes to be synced:
        <div style="margin-top:6px;max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:3px">
          ${newScenes.map(s => `<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${s.heading.replace(/</g,'&lt;').substring(0,60)}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_sbSyncScenesConfirm('${ovId}')">Sync</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  setTimeout(() => document.getElementById('_sbSyncCount')?.select(), 50);
}

function _sbSyncScenesConfirm(ovId) {
  const ov = document.getElementById(ovId); if (!ov) return;
  if (ov._confirming) return;
  ov._confirming = true;
  const p = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const scenes = _sbScenes(p);
  const count = Math.min(20, Math.max(1, parseInt(document.getElementById('_sbSyncCount')?.value) || 1));

  // Same duplicate-aware logic as _sbSyncScenes
  const headingCounts = {};
  sb.frames.forEach(f => {
    if (f.sceneKey) headingCounts[f.sceneKey] = (headingCounts[f.sceneKey] || 0) + 1;
  });
  const headingSeen = {};
  const newScenes = scenes.filter(s => {
    const occurrence = headingSeen[s.key] || 0;
    headingSeen[s.key] = occurrence + 1;
    return (headingCounts[s.key] || 0) <= occurrence;
  });

  let added = 0;
  newScenes.forEach(scene => {
    for (let i = 0; i < count; i++) {
      sb.frames.push(_sbMakeFrame(sb, scene.key, scene.heading));
      added++;
    }
  });
  saveStore();
  document.getElementById(ovId)?.remove();
  renderStoryboard(p);
  showToast(`${added} frame${added!==1?'s':''} created across ${newScenes.length} scene${newScenes.length!==1?'s':''}`, 'success');
}

// ── BATCH ADD ─────────────────────────────────────────────────────────────────

function _sbBatchAdd() {
  const p      = currentProject(); if (!p) return;
  const scenes = _sbScenes(p);
  const ovId   = '_sb-batch-modal';
  document.getElementById(ovId)?.remove();

  const ov = document.createElement('div');
  ov.id = ovId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(440px,94vw);padding:22px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:14px;font-weight:700">⚡ Batch Add Frames</h3>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1">✕</button>
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">How many frames?</label>
        <input type="number" id="_sbBatchCount" value="6" min="1" max="100"
          style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">Attach to scene <span style="opacity:0.5;font-weight:400">(optional)</span></label>
        <select id="_sbBatchScene" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
          <option value="">— General / Unattached —</option>
          ${scenes.map(s=>`<option value="${s.key.replace(/"/g,'&quot;')}">${s.heading.replace(/</g,'&lt;').substring(0,60)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">Default shot type <span style="opacity:0.5;font-weight:400">(optional)</span></label>
        <select id="_sbBatchShot" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
          <option value="">— None —</option>
          ${SB_SHOT_TYPES.map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_sbBatchConfirm('${ovId}')">Add Frames</button>
      </div>
    </div>`;

  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  setTimeout(() => document.getElementById('_sbBatchCount')?.select(), 50);
}

function _sbBatchConfirm(ovId) {
  const ov = document.getElementById(ovId); if (!ov) return;
  if (ov._confirming) return;
  ov._confirming = true;
  const p = currentProject(); if (!p) return;
  const sb    = _getStoryboard(p);
  const count = Math.min(100, Math.max(1, parseInt(document.getElementById('_sbBatchCount')?.value) || 6));
  const sceneEl = document.getElementById('_sbBatchScene');
  const shotEl  = document.getElementById('_sbBatchShot');
  const sceneKey = sceneEl?.value || null;
  const sceneOpt = sceneEl?.options[sceneEl.selectedIndex];
  const sceneHeading = sceneKey ? (sceneOpt?.textContent || null) : null;
  const shotType = shotEl?.value || '';

  for (let i = 0; i < count; i++) {
    const f = _sbMakeFrame(sb, sceneKey, sceneHeading);
    f.shotType = shotType;
    sb.frames.push(f);
  }
  saveStore();
  document.getElementById(ovId)?.remove();
  renderStoryboard(p);
  showToast(`${count} frame${count!==1?'s':''} added`, 'success');
}

// ── SAVE HELPERS ──────────────────────────────────────────────────────────────

function _sbSaveField(id, field, value) {
  console.log('[DEBUG] _sbSaveField called, id=', id, 'field=', field, 'value=', value);
  // Check draft first — draft frames aren't in sb.frames yet
  const draft = _sbDraftFrame?.frame?.id === id ? _sbDraftFrame.frame : null;
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = draft || sb.frames.find(x => x.id === id); if (!f) { console.log('[DEBUG] no frame found!'); return; }
  console.log('[DEBUG] frame found, f.id=', f.id, 'f.bgColor before=', f.bgColor);
  f[field] = value;
  console.log('[DEBUG] f.bgColor after=', f.bgColor);
  if (!draft) saveStore(); // only persist if already committed
  const card = document.getElementById('sb-card-' + id);
  if (card) card.outerHTML = _sbFrameCardHtml(f);
}

function _sbSaveSceneHeading(id, selectEl) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = sb.frames.find(x => x.id === id); if (!f) return;
  const opt = selectEl.options[selectEl.selectedIndex];
  f.sceneHeading = (opt && opt.value) ? opt.textContent : null;
  if (!opt || !opt.value) f.sceneKey = null;
  saveStore();
}

// ── INLINE DELETE / CLEAR ────────────────────────────────────────────────────

function _sbDeleteScene(sceneKey) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const isUnattached = !sceneKey || sceneKey === '__unattached';
  const frames = isUnattached
    ? sb.frames.filter(f => !f.sceneKey)
    : sb.frames.filter(f => f.sceneKey === sceneKey);
  if (!frames.length) return;
  const label = isUnattached ? 'General / Unattached' : sceneKey;
  showConfirmDialog(
    `Delete all ${frames.length} frame${frames.length!==1?'s':''} in scene "${label}"? The scene heading will also disappear from the storyboard.`,
    'Delete',
    () => {
      const ids = new Set(frames.map(f => f.id));
      sb.frames = sb.frames.filter(f => !ids.has(f.id));
      saveStore();
      renderStoryboard(p);
      showToast(`${frames.length} frame${frames.length!==1?'s':''} deleted`, 'success');
    }
  );
}

function _sbDeleteFrameInline(id, btn) {
  // Show a tiny inline confirm popover next to the button
  const existing = document.getElementById('_sb-mini-confirm');
  if (existing) { existing.remove(); if (existing.dataset.for === id) return; }
  const anchor = btn || document.querySelector(`#sb-card-${id} .sb-card-act-del`);
  if (!anchor) return;

  // Check if this is the last frame in its scene
  const p  = currentProject();
  const sb = p ? _getStoryboard(p) : null;
  const f  = sb?.frames.find(x => x.id === id);
  const isLastInScene = f && sb.frames.filter(x => x.sceneKey === f.sceneKey).length === 1;
  const sceneLabel = f?.sceneHeading || f?.sceneKey || null;

  const pop = document.createElement('div');
  pop.id = '_sb-mini-confirm';
  pop.dataset.for = id;
  pop.style.cssText = 'position:fixed;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:5px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-size:11px;max-width:220px';

  const warning = isLastInScene && sceneLabel
    ? `<div style="color:var(--text3);font-size:10px;line-height:1.4">Last frame in scene — the scene group will also disappear.</div>`
    : '';

  pop.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px">
      <span style="color:var(--text2)">Delete frame?</span>
      <button onclick="_sbConfirmDeleteFrame('${id}')" style="background:#E74C3C;border:none;color:#fff;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px">Delete</button>
      <button onclick="document.getElementById('_sb-mini-confirm')?.remove()" style="background:none;border:1px solid var(--border);color:var(--text3);border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px">Cancel</button>
    </div>
    ${warning}`;

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = 220;
  let left = r.left - pw / 2 + r.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  const topBelow = r.bottom + 6;
  pop.style.left = left + 'px';
  pop.style.top  = (topBelow + pop.offsetHeight > window.innerHeight - 8 ? r.top - pop.offsetHeight - 6 : topBelow) + 'px';
  setTimeout(() => {
    const dismiss = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', dismiss); } };
    document.addEventListener('click', dismiss);
  }, 0);
}

function _sbConfirmDeleteFrame(id) {
  document.getElementById('_sb-mini-confirm')?.remove();
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  sb.frames = sb.frames.filter(f => f.id !== id);
  _sbSelected.delete(id);
  saveStore();
  const slot = document.getElementById('sb-slot-' + id);
  if (slot) slot.remove();
  _sbUpdateBulkBar();
}

function _sbClearFrameImage(id) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = sb.frames.find(x => x.id === id); if (!f) return;
  f.imageDataUrl = null;
  // Also clear canvas state if modal is open
  delete _sbSketchState[id];
  saveStore();
  const card = document.getElementById('sb-card-' + id);
  if (card) card.closest('.sb-slot').outerHTML = _sbFrameCardHtml(f);
}

function _sbDeleteFrame(id) {
  showConfirmDialog('Delete this frame? This cannot be undone.', 'Delete', () => {
    const p  = currentProject(); if (!p) return;
    const sb = _getStoryboard(p);
    sb.frames = sb.frames.filter(x => x.id !== id);
    saveStore();
    document.getElementById('_sb-frame-modal')?.remove();
    renderStoryboard(p);
  });
}

function _sbPrevFrame(id) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const idx = sb.frames.findIndex(x => x.id === id);
  if (idx > 0) { document.getElementById('_sb-frame-modal')?.remove(); _sbOpenFrame(sb.frames[idx-1].id); }
}

function _sbNextFrame(id) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const idx = sb.frames.findIndex(x => x.id === id);
  if (idx < sb.frames.length-1) { document.getElementById('_sb-frame-modal')?.remove(); _sbOpenFrame(sb.frames[idx+1].id); }
}


// ── SKETCH CANVAS ─────────────────────────────────────────────────────────────

const _sbSketchState = {};
const _sbDefaultFavs = ['#ffffff','#111111','#888888','#e06060','#5bc0eb','#60d090','#e6bc3c','#b88af0'];

function _sbInitCanvas(id) {
  requestAnimationFrame(() => {
    const wrap = document.getElementById('_sbCanvasWrap_' + id);
    if (!wrap) return;

    // Use wrap dimensions for the pixel buffer
    const W = wrap.clientWidth  || 600;
    const H = wrap.clientHeight || 220;

    // Get frame data first (needed for bgColor)
    const p  = currentProject();
    const sb = p ? _getStoryboard(p) : null;
    const f  = sb?.frames.find(x => x.id === id);
    console.log('[DEBUG] _sbInitCanvas, id=', id, ', f.bgColor=', f?.bgColor);

    // Persist state across prev/next navigation
    if (!_sbSketchState[id]) {
      // Get saved bgColor from frame, default to #1a1a1a if not set
      const savedBg = f?.bgColor || '#1a1a1a';
      console.log('[DEBUG] creating new state, savedBg=', savedBg);
      _sbSketchState[id] = {
        tool: 'pen', color: '#ffffff', size: 3,
        bg: savedBg, drawing: false, lastX: 0, lastY: 0,
        history: [], // undo stack of dataUrls
        favs: [..._sbDefaultFavs],
      };
    } else {
      // State already exists - sync bg from saved frame to ensure consistency
      const savedBg = f?.bgColor || '#1a1a1a';
      console.log('[DEBUG] state exists, syncing bg to savedBg=', savedBg);
      _sbSketchState[id].bg = savedBg;
    }
    const state = _sbSketchState[id];

    // Create/replace canvas element
    const existing = document.getElementById('_sbCanvas_' + id);
    const canvas   = document.createElement('canvas');
    canvas.id      = '_sbCanvas_' + id;
    canvas.width   = W;
    canvas.height  = H;
    canvas.style.cssText = 'display:block;cursor:crosshair;touch-action:none;position:absolute;inset:0;width:100%;height:100%';
    if (existing) existing.replaceWith(canvas);
    else wrap.appendChild(canvas);

    state._canvas = canvas;
    const ctx = canvas.getContext('2d');
    state._ctx = ctx;

    // Set wrapper + panel background colour (CSS) — canvas itself stays transparent
    wrap.style.background = state.bg;
    const panel = document.getElementById('_sbPanel_' + id);
    if (panel) panel.style.background = state.bg;

    if (f?.imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        // Draw saved image directly — it already has bg baked in from previous saves
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        if (!state.history.length) _sbPushHistory(id);
      };
      img.src = f.imageDataUrl;
    } else {
      _sbPushHistory(id); // empty canvas as baseline
    }

    // Sync toolbar UI to current state
    _sbSyncToolbar(id);
    _sbRenderFavs(id);

    // Coordinate scaling: CSS px → canvas px
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - r.left) * (canvas.width  / r.width),
        y: (src.clientY - r.top)  * (canvas.height / r.height),
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      const { x, y } = getPos(e);
      if (state.tool === 'fill') {
        _sbFloodFill(ctx, Math.round(x), Math.round(y), state.color, canvas.width, canvas.height);
        _sbPushHistory(id);
        clearTimeout(state._saveTimer);
        state._saveTimer = setTimeout(() => _sbSaveSketch(id), 600);
        return;
      }
      state.drawing = true;
      state.lastX = x; state.lastY = y;
      ctx.globalCompositeOperation = state.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.arc(x, y, state.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = state.tool === 'erase' ? 'rgba(0,0,0,1)' : state.color;
      ctx.fill();
    };

    const draw = (e) => {
      if (!state.drawing) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.globalCompositeOperation = state.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.lineWidth = state.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = state.tool === 'erase' ? 'rgba(0,0,0,1)' : state.color;
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      state.lastX = x; state.lastY = y;
    };

    const stopDraw = () => {
      if (!state.drawing) return;
      state.drawing = false;
      ctx.globalCompositeOperation = 'source-over';
      _sbPushHistory(id);
      clearTimeout(state._saveTimer);
      state._saveTimer = setTimeout(() => _sbSaveSketch(id), 600);
    };

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw);

    // Keyboard shortcuts — wire on document, scoped to when modal is open
    // Use a named handler so we can remove it when the modal closes
    if (!state._kbHandler) {
      state._kbHandler = (e) => {
        if (!document.getElementById('_sb-frame-modal')) return; // modal closed
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); _sbUndo(id); }
        if (e.key === 'p' || e.key === 'P') _sbSetTool(id, 'pen');
        if (e.key === 'e' || e.key === 'E') _sbSetTool(id, 'erase');
        if (e.key === 'f' || e.key === 'F') _sbSetTool(id, 'fill');
      };
      document.addEventListener('keydown', state._kbHandler);
    }
  });
}

function _sbPushHistory(id) {
  const state = _sbSketchState[id]; if (!state?._canvas) return;
  const url = state._canvas.toDataURL('image/png');
  state.history.push(url);
  if (state.history.length > 40) state.history.shift(); // cap at 40 steps
}

function _sbUndo(id) {
  const state = _sbSketchState[id]; if (!state?._canvas) return;
  if (state.history.length <= 1) return; // nothing to undo
  state.history.pop(); // discard current
  const prev = state.history[state.history.length - 1];
  const ctx  = state._ctx;
  const img  = new Image();
  img.onload = () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, state._canvas.width, state._canvas.height);
    ctx.drawImage(img, 0, 0);
    clearTimeout(state._saveTimer);
    state._saveTimer = setTimeout(() => _sbSaveSketch(id), 400);
  };
  img.src = prev;
}

// Simple scanline flood fill
function _sbFloodFill(ctx, startX, startY, fillColor, W, H) {
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  const idx = (x, y) => (y * W + x) * 4;
  const target = data.slice(idx(startX, startY), idx(startX, startY) + 4);

  // Parse fill colour
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const tc = tmp.getContext('2d');
  tc.fillStyle = fillColor;
  tc.fillRect(0,0,1,1);
  const fill = tc.getImageData(0,0,1,1).data;

  // Same colour already — bail
  if (target[0]===fill[0] && target[1]===fill[1] && target[2]===fill[2] && target[3]===fill[3]) return;

  const match = (i) =>
    Math.abs(data[i]-target[0]) < 16 &&
    Math.abs(data[i+1]-target[1]) < 16 &&
    Math.abs(data[i+2]-target[2]) < 16 &&
    Math.abs(data[i+3]-target[3]) < 16;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(W * H);

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = idx(x, y);
    const vi = y * W + x;
    if (visited[vi] || !match(i)) continue;
    visited[vi] = 1;
    data[i]   = fill[0];
    data[i+1] = fill[1];
    data[i+2] = fill[2];
    data[i+3] = fill[3];
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

function _sbSyncToolbar(id) {
  const state = _sbSketchState[id]; if (!state) return;
  ['pen','erase','fill'].forEach(t => {
    document.getElementById('_sbTool' + t.charAt(0).toUpperCase() + t.slice(1) + '_' + id)
      ?.classList.toggle('sb-tool-active', state.tool === t);
  });
  const swatch = document.getElementById('_sbColorSwatch_' + id);
  if (swatch) swatch.style.background = state.color;
  const picker = document.getElementById('_sbColorPicker_' + id);
  if (picker) picker.value = state.color;
  const bgSwatch = document.getElementById('_sbBgSwatch_' + id);
  if (bgSwatch) bgSwatch.style.background = state.bg;
  const bgPicker = document.getElementById('_sbBgPicker_' + id);
  if (bgPicker) bgPicker.value = state.bg;
  const wrap  = document.getElementById('_sbCanvasWrap_' + id);
  const panel = document.getElementById('_sbPanel_' + id);
  if (wrap)  wrap.style.background  = state.bg;
  if (panel) panel.style.background = state.bg;
}

function _sbRenderFavs(id) {
  const state = _sbSketchState[id]; if (!state) return;
  const el = document.getElementById('_sbFavs_' + id); if (!el) return;
  el.innerHTML = state.favs.map(c =>
    `<button onclick="_sbSetColor('${id}','${c}')"
      style="width:16px;height:16px;border-radius:3px;border:2px solid ${state.color===c?'#fff':'#555'};background:${c};cursor:pointer;flex-shrink:0"
      title="${c}"></button>`
  ).join('');
}

function _sbSetTool(id, tool) {
  const state = _sbSketchState[id]; if (!state) return;
  state.tool = tool;
  // Update cursor
  const canvas = state._canvas;
  if (canvas) canvas.style.cursor = tool === 'fill' ? 'cell' : tool === 'erase' ? 'crosshair' : 'crosshair';
  _sbSyncToolbar(id);
}

function _sbSetSize(id, size) {
  const state = _sbSketchState[id]; if (!state) return;
  state.size = size;
}

function _sbSetColor(id, color) {
  const state = _sbSketchState[id]; if (!state) return;
  state.color = color;
  if (state.tool === 'erase') _sbSetTool(id, 'pen');
  // Add to favourites if not already there
  if (!state.favs.includes(color)) {
    state.favs.unshift(color);
    state.favs = state.favs.slice(0, 8);
  }
  _sbSyncToolbar(id);
  _sbRenderFavs(id);
}

// Live preview while picker is open — just CSS, no save
function _sbSetBgLive(id, color) {
  const state = _sbSketchState[id]; if (!state) return;
  const wrap  = document.getElementById('_sbCanvasWrap_' + id);
  const panel = document.getElementById('_sbPanel_' + id);
  if (wrap)  wrap.style.background  = color;
  if (panel) panel.style.background = color;
  const bgSwatch = document.getElementById('_sbBgSwatch_' + id);
  if (bgSwatch) bgSwatch.style.background = color;
}

function _sbToggleBgPicker(id) {
  const picker = document.getElementById('_sbBgPicker_' + id);
  if (!picker) return;
  if (_sbBgPickerOpen === id) {
    picker.blur();
    _sbBgPickerOpen = null;
  } else {
    _sbBgPickerOpen = id;
  }
}

let _sbBgPickerOpen = null;

function _sbSetBg(id, color) {
  console.log('[DEBUG] _sbSetBg called, id=', id, 'color=', color);
  const state = _sbSketchState[id]; if (!state) { console.log('[DEBUG] no state!'); return; }
  state.bg = color;
  // Update both the canvas wrap and the outer panel div
  const wrap  = document.getElementById('_sbCanvasWrap_' + id);
  const panel = document.getElementById('_sbPanel_' + id);
  if (wrap)  wrap.style.background  = color;
  if (panel) panel.style.background = color;
  _sbSyncToolbar(id);
  // Save bgColor to the frame for persistence
  console.log('[DEBUG] calling _sbSaveField for bgColor');
  _sbSaveField(id, 'bgColor', color);
  clearTimeout(state._saveTimer);
  state._saveTimer = setTimeout(() => _sbSaveSketch(id), 300);
}

// _sbToggleBg kept for backward compat but now just calls _sbSetBg with toggle
function _sbToggleBg(id) {
  const state = _sbSketchState[id]; if (!state) return;
  _sbSetBg(id, state.bg === '#1a1a1a' ? '#ffffff' : '#1a1a1a');
}

function _sbClearCanvas(id) {
  const state  = _sbSketchState[id]; if (!state)  return;
  const canvas = state._canvas;      if (!canvas) return;
  const ctx    = state._ctx;         if (!ctx)    return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height); // clear to transparent — bg is CSS
  _sbPushHistory(id);
  _sbSaveSketch(id);
}

function _sbSaveSketch(id) {
  const state = _sbSketchState[id]; if (!state?._canvas) return;
  // Composite: draw bg colour first, then strokes canvas on top
  const W = state._canvas.width, H = state._canvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const tc = tmp.getContext('2d');
  tc.fillStyle = state.bg || '#1a1a1a';
  tc.fillRect(0, 0, W, H);
  tc.drawImage(state._canvas, 0, 0);
  const dataUrl = tmp.toDataURL('image/png');
  _sbSaveField(id, 'imageDataUrl', dataUrl);
  const cardImg = document.querySelector('#sb-card-' + id + ' .sb-frame-image-zone img');
  if (cardImg) cardImg.src = dataUrl;
}

function _sbDownloadSketch(id) {
  const state = _sbSketchState[id];
  if (state?._canvas) {
    const a = document.createElement('a');
    a.href = state._canvas.toDataURL('image/png');
    a.download = 'frame-' + id + '.png';
    a.click();
    return;
  }
  const p = currentProject(); const sb = _getStoryboard(p);
  const f = sb?.frames.find(x => x.id === id);
  if (f?.imageDataUrl) {
    const a = document.createElement('a');
    a.href = f.imageDataUrl; a.download = 'frame-' + id + '.png'; a.click();
  }
}

// ── IMAGE HANDLING ────────────────────────────────────────────────────────────

function _sbUploadImage(id) {
  const inputId = '_sbfImgInput_' + id;
  let input = document.getElementById(inputId);
  if (!input) {
    input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.style.display = 'none'; input.id = inputId;
    input.onchange = () => _sbHandleImageUpload(id, input);
    document.body.appendChild(input);
  }
  input.click();
}

function _sbHandleImageUpload(id, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _sbSaveField(id, 'imageDataUrl', e.target.result);
    const zone = document.getElementById('_sbfImgZone');
    if (zone) zone.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    renderStoryboard(currentProject());
  };
  reader.readAsDataURL(file);
}

function _sbRemoveImage(id) {
  _sbSaveField(id, 'imageDataUrl', null);
  const zone = document.getElementById('_sbfImgZone');
  if (zone) zone.innerHTML = `<div style="text-align:center;color:var(--text3);pointer-events:none;padding:20px">
    <div style="font-size:38px;margin-bottom:8px;opacity:0.25">🎨</div>
    <div style="font-size:12px">Click to upload sketch</div>
    <div style="font-size:10px;margin-top:4px;opacity:0.6">PNG · JPG · WEBP · GIF</div>
  </div>`;
  renderStoryboard(currentProject());
}

// ── MULTI-SELECT ─────────────────────────────────────────────────────────────

function _sbCardClick(e, id) {
  // Shift-click or any click when selection is active = toggle select
  if (e.shiftKey || _sbSelected.size > 0) {
    e.preventDefault();
    _sbToggleSelect(id, !_sbSelected.has(id));
  } else {
    _sbOpenFrame(id);
  }
}

function _sbToggleSelect(id, checked) {
  if (checked) _sbSelected.add(id);
  else         _sbSelected.delete(id);
  // Update card appearance without full re-render
  const card = document.getElementById('sb-card-' + id);
  if (card) {
    card.classList.toggle('sb-selected', checked);
    const cb = card.querySelector('.sb-cb');
    if (cb) cb.checked = checked;
    const chk = card.querySelector('.sb-sel-check');
    if (checked && !chk) {
      const div = document.createElement('div');
      div.className = 'sb-sel-check'; div.textContent = '✓';
      card.insertBefore(div, card.firstChild);
    } else if (!checked && chk) chk.remove();
  }
  _sbUpdateBulkBar();
}

function _sbUpdateBulkBar() {
  const bar = document.getElementById('sb-bulk-bar');
  if (!bar) return;
  if (_sbSelected.size) {
    bar.style.display = 'flex';
    bar.querySelector('span').textContent = _sbSelected.size + ' frame' + (_sbSelected.size!==1?'s':'') + ' selected';
  } else {
    bar.style.display = 'none';
  }
}

function _sbDeselectAll() {
  _sbSelected.forEach(id => {
    const card = document.getElementById('sb-card-' + id);
    if (card) {
      card.classList.remove('sb-selected');
      const cb = card.querySelector('.sb-cb'); if (cb) cb.checked = false;
      const chk = card.querySelector('.sb-sel-check'); if (chk) chk.remove();
    }
  });
  _sbSelected.clear();
  _sbUpdateBulkBar();
}

function _sbDeleteSelected() {
  const count = _sbSelected.size;
  if (!count) return;
  showConfirmDialog(
    `Delete ${count} selected frame${count!==1?'s':''}? This cannot be undone.`,
    'Delete',
    () => {
      const p  = currentProject(); if (!p) return;
      const sb = _getStoryboard(p);
      sb.frames = sb.frames.filter(f => !_sbSelected.has(f.id));
      _sbSelected.clear();
      saveStore();
      renderStoryboard(p);
      showToast(`${count} frame${count!==1?'s':''} deleted`, 'success');
    }
  );
}

function _sbMoveSelectedToScene() {
  const p = currentProject(); if (!p) return;
  const scenes = _sbScenes(p);
  const count  = _sbSelected.size;
  if (!count) return;

  const ovId = '_sb-move-modal';
  document.getElementById(ovId)?.remove();
  const ov = document.createElement('div');
  ov.id = ovId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(400px,94vw);padding:22px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:14px;font-weight:700">Move ${count} Frame${count!==1?'s':''} to Scene</h3>
        <button onclick="document.getElementById('${ovId}').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1">✕</button>
      </div>
      <div>
        <label class="form-label" style="margin-bottom:4px">Destination scene</label>
        <select id="_sbMoveTarget" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
          <option value="">— General / Unattached —</option>
          ${scenes.map(s => `<option value="${s.key.replace(/"/g,'&quot;')}">${s.heading.replace(/</g,'&lt;').substring(0,60)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px;border-top:1px solid var(--border)">
        <button class="btn btn-sm" onclick="document.getElementById('${ovId}').remove()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="_sbMoveSelectedConfirm('${ovId}')">Move Frames</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

function _sbMoveSelectedConfirm(ovId) {
  const p = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const sceneEl = document.getElementById('_sbMoveTarget');
  const sceneKey = sceneEl?.value || null;
  const sceneOpt = sceneEl?.options[sceneEl.selectedIndex];
  const sceneHeading = sceneKey ? (sceneOpt?.textContent || null) : null;
  const count = _sbSelected.size;

  // Just reassign sceneKey — frames appear in the new group, array order unchanged
  sb.frames.forEach(f => {
    if (!_sbSelected.has(f.id)) return;
    f.sceneKey     = sceneKey || null;
    f.sceneHeading = sceneHeading || null;
  });

  _sbSelected.clear();
  saveStore();
  document.getElementById(ovId)?.remove();
  renderStoryboard(p);
  showToast(`${count} frame${count!==1?'s':''} moved`, 'success');
}

// ── DRAG / DROP ───────────────────────────────────────────────────────────────
// Single handler per card. Cursor X position relative to card determines action:
//   Left 30%  → insert BEFORE (vertical gap indicator on left edge of slot)
//   Middle 40% → SWAP (gold card highlight)  
//   Right 30% → insert AFTER (vertical gap indicator on right edge of slot)
// On drop, execute whichever action cursor is over.
// Cross-scene drops also reassign+reorder the frame.

let _sbDragMode = null; // 'before' | 'swap' | 'after'

function _sbDragStart(e, id) {
  _sbDragFrame = id;
  // If dragging a selected card, all selected cards come along
  // If dragging an unselected card while others are selected, drag just this one
  if (!_sbSelected.has(id)) _sbSelected.clear();
  _sbSelected.add(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
  setTimeout(() => {
    _sbSelected.forEach(sid => document.getElementById('sb-card-' + sid)?.classList.add('sb-dragging'));
  }, 0);
}

function _sbDragEnd() {
  document.querySelectorAll('.sb-frame-card').forEach(c =>
    c.classList.remove('sb-dragging', 'sb-swap-over')
  );
  document.querySelectorAll('.sb-slot').forEach(s =>
    s.classList.remove('sb-ins-left', 'sb-ins-right')
  );
  document.querySelectorAll('.sb-drop-target').forEach(g =>
    g.classList.remove('sb-grid-over')
  );
  _sbDragFrame     = null;
  _sbDragMode      = null;
  _sbDragTargetKey = null;
  // Note: don't clear _sbSelected here — multi-drag preserves selection
}

function _sbGetDragMode(e, id) {
  const card = document.getElementById('sb-card-' + id);
  if (!card) return 'swap';
  const rect = card.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;
  if (relX < 0.30) return 'before';
  if (relX > 0.70) return 'after';
  return 'swap';
}

function _sbClearDragVisuals() {
  document.querySelectorAll('.sb-frame-card').forEach(c => c.classList.remove('sb-swap-over'));
  document.querySelectorAll('.sb-slot').forEach(s => s.classList.remove('sb-ins-left','sb-ins-right'));
}

function _sbCardDragOver(e, id) {
  if (_sbDragFrame === id) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';

  const mode = _sbGetDragMode(e, id);
  _sbDragMode = mode;
  _sbClearDragVisuals();

  const slot = document.getElementById('sb-slot-' + id);
  const card = document.getElementById('sb-card-' + id);

  if (mode === 'swap')   card?.classList.add('sb-swap-over');
  if (mode === 'before') slot?.classList.add('sb-ins-left');
  if (mode === 'after')  slot?.classList.add('sb-ins-right');

  // Highlight target group
  const grid = slot?.closest('.sb-drop-target');
  if (grid && _sbDragTargetKey !== grid.dataset.sceneKey) {
    document.querySelectorAll('.sb-drop-target').forEach(g => g.classList.remove('sb-grid-over'));
    grid.classList.add('sb-grid-over');
    _sbDragTargetKey = grid.dataset.sceneKey;
  }
}

function _sbCardDragLeave(id) {
  document.getElementById('sb-card-' + id)?.classList.remove('sb-swap-over');
  document.getElementById('sb-slot-' + id)?.classList.remove('sb-ins-left','sb-ins-right');
}

function _sbCardDrop(e, targetId) {
  e.preventDefault();
  e.stopPropagation();
  const dragId    = _sbDragFrame;
  const mode      = _sbDragMode || _sbGetDragMode(e, targetId);
  const dragIds   = new Set(_sbSelected); // snapshot — may include multiple
  _sbDragEnd();
  if (!dragId || dragIds.has(targetId)) return; // dropping on self or a dragged card

  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const target = sb.frames.find(x => x.id === targetId);
  if (!target) return;

  // All frames being dragged (preserve their relative order)
  const dragging = sb.frames.filter(f => dragIds.has(f.id));
  if (!dragging.length) return;

  const crossScene = dragging.some(f => f.sceneKey !== target.sceneKey);

  if (mode === 'swap' && dragging.length === 1) {
    // Single-frame swap: exchange positions, swap scene keys too
    const dragged = dragging[0];
    const fromIdx = sb.frames.indexOf(dragged);
    const toIdx   = sb.frames.indexOf(target);
    // Swap scene assignments
    const tmpKey  = dragged.sceneKey;
    const tmpHead = dragged.sceneHeading;
    dragged.sceneKey     = target.sceneKey;
    dragged.sceneHeading = target.sceneHeading;
    target.sceneKey      = tmpKey;
    target.sceneHeading  = tmpHead;
    // Swap positions in array
    sb.frames[fromIdx] = target;
    sb.frames[toIdx]   = dragged;
  } else {
    // Insert (before/after) or multi-frame drag:
    // Reassign all dragged frames to target's scene, then splice as a block
    const newKey     = target.sceneKey;
    const newHeading = target.sceneHeading;
    dragging.forEach(f => { f.sceneKey = newKey; f.sceneHeading = newHeading; });

    // Remove all dragged frames from array
    const remaining = sb.frames.filter(f => !dragIds.has(f.id));
    // Find target's position in the remaining array
    const toIdx = remaining.indexOf(target);
    const insertAt = mode === 'before' ? toIdx : toIdx + 1;
    remaining.splice(insertAt, 0, ...dragging);
    sb.frames = remaining;
  }

  _sbSelected.clear();
  saveStore();
  renderStoryboard(p);
  if (crossScene) showToast(dragging.length > 1 ? `${dragging.length} frames moved to scene` : 'Frame moved to scene', 'success');
}

// Drop onto empty grid background — append dragged frame(s) to end of that scene
function _sbGridDrop(e, sceneKey, sceneHeading) {
  if (e.defaultPrevented) return;
  e.preventDefault();
  document.querySelectorAll('.sb-drop-target').forEach(g => g.classList.remove('sb-grid-over'));
  const dragId  = _sbDragFrame;
  const dragIds = new Set(_sbSelected);
  _sbDragFrame = null; _sbDragTargetKey = null; _sbDragMode = null;
  if (!dragId) return;
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const isUnattached = !sceneKey || sceneKey === '__unattached';
  const newKey     = isUnattached ? null : sceneKey;
  const newHeading = isUnattached ? null : sceneHeading;

  const toMove = sb.frames.filter(f => dragIds.has(f.id) && f.sceneKey !== newKey);
  if (!toMove.length) { _sbSelected.clear(); return; }

  const remaining = sb.frames.filter(f => !dragIds.has(f.id));
  // Find insertion point: after last frame already in target scene
  let insertAt = remaining.length;
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i].sceneKey === newKey) { insertAt = i + 1; break; }
  }
  toMove.forEach(f => { f.sceneKey = newKey; f.sceneHeading = newHeading; });
  remaining.splice(insertAt, 0, ...toMove);
  sb.frames = remaining;

  _sbSelected.clear();
  saveStore();
  renderStoryboard(p);
  const msg = toMove.length > 1 ? `${toMove.length} frames moved` : (isUnattached ? 'Frame moved to General' : 'Frame moved to scene');
  showToast(msg, 'success');
}

// ── INTEGRATION HELPERS ───────────────────────────────────────────────────────

// Open storyboard filtered to a specific scene (called from Shot List / Breakdown)
function _sbOpenForScene(sceneKey) {
  _sbSceneFilter = sceneKey || 'all';
  showSection('storyboard');
}

// Frame count badge for use in other sections
function _sbFrameCountForScene(p, sceneKey) {
  const sb = _getStoryboard(p);
  return sb.frames.filter(f => f.sceneKey === sceneKey).length;
}

function _sbSceneBadge(p, sceneKey) {
  const count = _sbFrameCountForScene(p, sceneKey);
  if (!count) return '';
  const safe = (sceneKey||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button onclick="event.stopPropagation();_sbOpenForScene('${safe}')"
    style="background:rgba(91,192,235,0.12);border:1px solid rgba(91,192,235,0.3);color:var(--accent2);border-radius:4px;cursor:pointer;font-size:10px;padding:2px 7px;font-family:var(--font-mono);white-space:nowrap"
    title="${count} storyboard frame${count!==1?'s':''}">🎬 ${count}</button>`;
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────

async function _sbExportPDF() {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  if (!sb.frames.length) { showToast('No frames to export', 'info'); return; }
  showToast('Building storyboard PDF…', 'info');

  const scenes = _sbScenes(p);
  const groups = _sbGroupByScene(sb.frames, scenes);

  let pagesHtml = '';
  let buf = [];

  const flushBuf = () => {
    if (!buf.length) return;
    while (buf.length < 6) buf.push({ _empty: true });
    pagesHtml += `<div class="sbp-page"><div class="sbp-grid">${buf.map(cell => {
      if (cell._empty) return `<div class="sbp-cell sbp-empty"></div>`;
      return `<div class="sbp-cell">
        <div class="sbp-img">${cell.imageDataUrl
          ? `<img src="${cell.imageDataUrl}" style="width:100%;height:100%;object-fit:contain">`
          : `<div class="sbp-ph"><svg viewBox="0 0 100 75" fill="none" stroke="#ccc" stroke-width="1" style="width:55%"><rect x="2" y="2" width="96" height="71" rx="2"/><line x1="2" y1="2" x2="98" y2="73"/><line x1="98" y1="2" x2="2" y2="73"/><circle cx="20" cy="20" r="8"/></svg></div>`
        }</div>
        <div class="sbp-foot">
          <div class="sbp-fnum">#${cell.frameNumber||'?'}</div>
          <div class="sbp-tags">${[cell.shotType,cell.movement,cell.lens].filter(Boolean).map(t=>`<span class="sbp-tag">${t}</span>`).join('')}</div>
          ${cell.action    ? `<div class="sbp-action">${_bfEscHtml(cell.action.substring(0,120))}</div>` : ''}
          ${cell.dialogue  ? `<div class="sbp-dial">"${_bfEscHtml(cell.dialogue.substring(0,80))}"</div>` : ''}
          ${cell.notes     ? `<div class="sbp-notes">${_bfEscHtml(cell.notes.substring(0,80))}</div>` : ''}
          ${cell.transition? `<div class="sbp-trans">→ ${_bfEscHtml(cell.transition)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}</div></div>`;
    buf = [];
  };

  groups.forEach((group, gi) => {
    if (gi > 0 && buf.length) flushBuf();
    pagesHtml += `<div class="sbp-scene-head">${_bfEscHtml(group.heading)}</div>`;
    group.frames.forEach(f => { buf.push(f); if (buf.length === 6) flushBuf(); });
  });
  flushBuf();

  const totalSecs = sb.frames.reduce((a,f)=>a+(parseInt(f.duration)||0),0);
  const durStr = totalSecs>0 ? ` · ~${Math.floor(totalSecs/60)}m ${totalSecs%60}s` : '';

  const sbCss = `
    .sbp-scene-head{font-size:8pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#444;padding:4mm 12mm 2mm;border-bottom:1px solid #ddd;page-break-after:avoid}
    .sbp-page{padding:3mm 10mm 6mm;page-break-after:always}
    .sbp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
    .sbp-cell{border:1px solid #ddd;border-radius:3px;overflow:hidden}
    .sbp-empty{border:1px dashed #eee;background:#fafafa}
    .sbp-img{height:46mm;background:#f0f0f0;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .sbp-ph{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
    .sbp-foot{padding:2mm 2.5mm}
    .sbp-fnum{font-size:6.5pt;font-weight:700;font-family:monospace;color:#999;margin-bottom:1.5mm}
    .sbp-tags{display:flex;gap:2px;flex-wrap:wrap;margin-bottom:1.5mm}
    .sbp-tag{font-size:5.5pt;padding:1px 4px;background:#f0f0f0;border-radius:2px;color:#555}
    .sbp-action{font-size:7pt;color:#222;line-height:1.4;margin-bottom:1mm}
    .sbp-dial{font-size:6.5pt;color:#555;font-style:italic;line-height:1.3;margin-bottom:1mm}
    .sbp-notes{font-size:6pt;color:#888;line-height:1.3;margin-bottom:1mm}
    .sbp-trans{font-size:6pt;color:#aaa;font-family:monospace}
    @page{size:A4 landscape;margin:12mm 15mm}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;

  const bodyHtml = `
    <style>${sbCss}</style>
    ${pagesHtml}`;

  _bfPrint({
    title:    p.title,
    section:  'Storyboard',
    subtitle: `${sb.frames.length} frame${sb.frames.length!==1?'s':''}${durStr} · ${groups.length} scene${groups.length!==1?'s':''}`,
    body:     bodyHtml,
  });
}


// ── RUBBER BAND SELECTION ─────────────────────────────────────────────────────
// Click-drag on the canvas background to draw a selection rectangle.
// Any cards whose bounding boxes overlap the rect get selected.

let _sbRbActive = false;
let _sbRbOrigin = { x: 0, y: 0 };
let _sbRbEl     = null;

function _sbInitRubberBand() {
  const canvas = document.getElementById('sb-canvas');
  if (!canvas) return;
  // Remove previous listeners by cloning
  const fresh = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(fresh, canvas);

  fresh.addEventListener('mousedown', e => {
    // Only start on background — not on a card, slot, button, or add-card
    const tgt = e.target;
    if (tgt.closest('.sb-frame-card') ||
        tgt.closest('.sb-add-card')   ||
        tgt.closest('button')         ||
        tgt.closest('input')          ||
        tgt.closest('label')) return;
    if (e.button !== 0) return;

    e.preventDefault();
    _sbRbActive = true;
    const rect = fresh.getBoundingClientRect();
    _sbRbOrigin = { x: e.clientX - rect.left + fresh.scrollLeft,
                    y: e.clientY - rect.top  + fresh.scrollTop };

    // Create the rubber band rect element
    _sbRbEl = document.createElement('div');
    _sbRbEl.id = '_sb-rubberband';
    _sbRbEl.style.cssText = `
      position:absolute;border:1.5px solid var(--accent2);
      background:rgba(91,192,235,0.08);border-radius:3px;
      pointer-events:none;z-index:50;
      left:${_sbRbOrigin.x}px;top:${_sbRbOrigin.y}px;width:0;height:0`;
    fresh.appendChild(_sbRbEl);

    const onMove = e2 => {
      if (!_sbRbActive) return;
      const r = fresh.getBoundingClientRect();
      const cx = e2.clientX - r.left + fresh.scrollLeft;
      const cy = e2.clientY - r.top  + fresh.scrollTop;
      const x  = Math.min(cx, _sbRbOrigin.x);
      const y  = Math.min(cy, _sbRbOrigin.y);
      const w  = Math.abs(cx - _sbRbOrigin.x);
      const h  = Math.abs(cy - _sbRbOrigin.y);
      _sbRbEl.style.left   = x + 'px';
      _sbRbEl.style.top    = y + 'px';
      _sbRbEl.style.width  = w + 'px';
      _sbRbEl.style.height = h + 'px';
    };

    const onUp = () => {
      if (!_sbRbActive) return;
      _sbRbActive = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      if (_sbRbEl) {
        const rbRect = _sbRbEl.getBoundingClientRect();
        _sbRbEl.remove();
        _sbRbEl = null;

        // Only act if the rect has meaningful size (not just a click)
        if (rbRect.width < 6 && rbRect.height < 6) return;

        // Hit-test all cards
        let changed = false;
        document.querySelectorAll('.sb-frame-card[id^="sb-card-"]').forEach(card => {
          const cr = card.getBoundingClientRect();
          const overlaps = !(cr.right  < rbRect.left  ||
                              cr.left   > rbRect.right ||
                              cr.bottom < rbRect.top   ||
                              cr.top    > rbRect.bottom);
          if (overlaps) {
            const id = card.id.replace('sb-card-', '');
            _sbToggleSelect(id, true);
            changed = true;
          }
        });
        if (changed) _sbUpdateBulkBar();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function _sbInjectStyles() {
  if (document.getElementById('_sb-styles')) return;
  const s = document.createElement('style');
  s.id = '_sb-styles';
  s.textContent = `
    .sb-frames-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;min-height:60px;border-radius:8px;padding:8px;transition:background .15s,box-shadow .15s}
    .sb-frames-grid.sb-grid-over{background:rgba(91,192,235,0.07);box-shadow:inset 0 0 0 2px rgba(91,192,235,0.45)}
    .sb-frame-card{background:var(--surface2);border:1px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s;position:relative;user-select:none}
    .sb-frame-card:hover{border-color:var(--accent2);box-shadow:0 4px 16px rgba(0,0,0,0.2);transform:translateY(-1px)}
    .sb-frame-card.sb-dragging{opacity:0.3;transform:scale(0.96)}
    .sb-frame-card.sb-drag-over{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
    .sb-frame-image-zone{height:120px;background:var(--surface3);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
    .sb-frame-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:var(--text3)}
    .sb-frame-num{position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;font-weight:700;font-family:var(--font-mono);padding:2px 6px;border-radius:3px;line-height:1.4;pointer-events:none}
    .sb-frame-meta{padding:8px 10px}
    .sb-pill{font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(91,192,235,0.15);color:var(--accent2);font-weight:600;white-space:nowrap}
    .sb-pill-move{background:rgba(96,208,144,0.12);color:#60d090}
    .sb-pill-lens{background:rgba(230,188,60,0.12);color:var(--accent)}
    .sb-frame-action{font-size:10px;color:var(--text2);line-height:1.4;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .sb-frame-dialogue{font-size:9px;color:var(--text3);font-style:italic;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sb-add-card{border:2px dashed var(--border2);border-radius:8px;min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s,background .15s;gap:6px}
    .sb-add-card:hover{border-color:var(--accent2);background:rgba(91,192,235,0.04)}
    /* Slot — wrapper for each card, carries the insert-gap indicators */
    .sb-slot{position:relative;display:flex;flex-direction:column}
    /* Vertical gap indicator — shown on left or right edge of the slot */
    .sb-slot::before,.sb-slot::after{
      content:'';position:absolute;top:8px;bottom:8px;width:3px;
      background:var(--accent2);border-radius:3px;opacity:0;
      pointer-events:none;z-index:20;
      box-shadow:0 0 8px rgba(91,192,235,0.8);
      transition:opacity .08s;
    }
    .sb-slot::before{left:-4px}   /* insert-before: gap to the LEFT of this card */
    .sb-slot::after{right:-4px}   /* insert-after:  gap to the RIGHT of this card */
    .sb-slot.sb-ins-left::before{opacity:1}
    .sb-slot.sb-ins-right::after{opacity:1}
    /* Swap highlight — gold border on the card itself */
    .sb-frame-card.sb-swap-over{border-color:var(--accent)!important;box-shadow:0 0 0 2px var(--accent)!important;background:rgba(230,188,60,0.06)}
    /* Selection */
    .sb-frame-card.sb-selected{border-color:var(--accent2);box-shadow:0 0 0 2px rgba(91,192,235,0.45)}
    .sb-sel-check{position:absolute;top:6px;right:6px;background:var(--accent2);color:#000;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none}
    .sb-checkbox-wrap{position:absolute;top:6px;left:32px;z-index:5;opacity:0;transition:opacity .1s;cursor:pointer}
    .sb-frame-card:hover .sb-checkbox-wrap,.sb-frame-card.sb-selected .sb-checkbox-wrap{opacity:1}
    .sb-cb{width:14px;height:14px;cursor:pointer;accent-color:var(--accent2)}
    #sb-canvas{cursor:default}
    .sb-card-actions{display:flex;gap:4px;margin-top:5px;opacity:0;transition:opacity .15s}
    .sb-frame-card:hover .sb-card-actions{opacity:1}
    .sb-card-act{background:none;border:1px solid var(--border2);border-radius:3px;color:var(--text3);cursor:pointer;font-size:9px;padding:2px 6px;line-height:1.4;transition:background .1s,color .1s}
    .sb-card-act:hover{background:var(--surface3);color:var(--text)}
    .sb-card-act-del:hover{background:rgba(231,76,60,0.12);border-color:rgba(231,76,60,0.4);color:#E74C3C}
    .sb-tool-btn{background:none;border:1px solid #444;border-radius:4px;color:#aaa;cursor:pointer;padding:3px 7px;font-size:13px;line-height:1.3;transition:background .1s,border-color .1s;flex-shrink:0}
    .sb-tool-btn:hover{background:#333;border-color:#666;color:#fff}
    .sb-tool-btn.sb-tool-active{background:rgba(91,192,235,0.2);border-color:rgba(91,192,235,0.6);color:#5bc0eb}
    .sb-sz{font-size:10px;padding:3px 5px}
    .sb-tdiv{width:1px;height:18px;background:#333;margin:0 2px;flex-shrink:0}
  `;
  document.head.appendChild(s);
}