// ══════════════════════════════════════════
// STORYBOARD
// ══════════════════════════════════════════

const SB_SHOT_TYPES   = ['Wide','Medium Wide','Medium','Medium Close-Up','Close-Up','Extreme Close-Up','Over-the-Shoulder','POV','Insert','Establishing','Two Shot','Aerial','B-Roll'];
const SB_MOVEMENTS    = ['Static','Handheld','Pan','Tilt','Dolly In','Dolly Out','Dolly Left','Dolly Right','Tracking','Crane Up','Crane Down','Gimbal','Zoom In','Zoom Out','Whip Pan'];
const SB_LENSES       = ['14mm','18mm','24mm','28mm','35mm','50mm','75mm','85mm','100mm','135mm','200mm','Zoom'];
const SB_TRANSITIONS  = ['Cut','Dissolve','Fade In','Fade Out','Smash Cut','Match Cut','Wipe','Iris','Jump Cut'];

let _sbSceneFilter = 'all';
let _sbDragFrame   = null;

// ── HELPERS ──────────────────────────────────────────────────────────────────

function _getStoryboard(p) {
  if (!p.storyboard) p.storyboard = { id: makeId(), frames: [] };
  if (!p.storyboard.frames) p.storyboard.frames = [];
  return p.storyboard;
}

function _sbScenes(p) {
  // Pull scenes from active breakdown
  try {
    _migrateBreakdowns(p);
    const bd = _getActiveBd(p);
    if (bd && bd.rawText) {
      return parseBreakdownScenes(bd.rawText).map(s => ({
        key: s.heading,
        heading: s.heading,
      }));
    }
  } catch(e) {}
  return [];
}

function _sbNextFrameNum(sb) {
  if (!sb.frames.length) return 1;
  const nums = sb.frames.map(f => parseInt(f.frameNumber) || 0).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : sb.frames.length + 1;
}

function _sbGroupByScene(frames, scenes) {
  const groups = [];
  // Unattached first
  const unattached = frames.filter(f => !f.sceneKey);
  if (unattached.length) groups.push({ key: '__unattached', heading: 'General / Unattached', frames: unattached });
  // Then by scene order
  scenes.forEach(sc => {
    const scFrames = frames.filter(f => f.sceneKey === sc.key);
    if (scFrames.length) groups.push({ key: sc.key, heading: sc.heading, frames: scFrames });
  });
  // Any frames with a sceneKey not in current scenes (breakdown changed etc)
  const knownKeys = new Set(scenes.map(s => s.key));
  const orphaned  = frames.filter(f => f.sceneKey && !knownKeys.has(f.sceneKey));
  // Group orphaned by their sceneKey
  const orphanGroups = {};
  orphaned.forEach(f => {
    if (!orphanGroups[f.sceneKey]) orphanGroups[f.sceneKey] = [];
    orphanGroups[f.sceneKey].push(f);
  });
  Object.entries(orphanGroups).forEach(([key, gFrames]) => {
    groups.push({ key, heading: gFrames[0].sceneHeading || key, frames: gFrames });
  });
  return groups;
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderStoryboard(p) {
  const el = document.getElementById('section-storyboard');
  if (!el) return;

  const sb     = _getStoryboard(p);
  const scenes = _sbScenes(p);
  const hasBreakdown = scenes.length > 0;

  // Filter
  let frames = sb.frames;
  if (_sbSceneFilter !== 'all') {
    if (_sbSceneFilter === '__unattached') {
      frames = frames.filter(f => !f.sceneKey);
    } else {
      frames = frames.filter(f => f.sceneKey === _sbSceneFilter);
    }
  }

  const groups = _sbGroupByScene(frames, scenes);
  const total  = sb.frames.length;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <h3 class="section-heading" style="margin:0">STORYBOARD</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="goto-hook"></span>
        ${hasBreakdown ? `
          <select onchange="_sbSetFilter(this.value)" style="padding:5px 10px;font-size:11px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text3);cursor:pointer">
            <option value="all" ${_sbSceneFilter==='all'?'selected':''}>All Scenes</option>
            <option value="__unattached" ${_sbSceneFilter==='__unattached'?'selected':''}>Unattached</option>
            ${scenes.map(s => `<option value="${s.key.replace(/"/g,'&quot;')}" ${_sbSceneFilter===s.key?'selected':''}>${s.heading.replace(/</g,'&lt;').substring(0,50)}</option>`).join('')}
          </select>
        ` : ''}
        <button class="btn btn-sm" onclick="_sbExportPDF()">⬇ Export PDF</button>
        <button class="btn btn-sm btn-primary" onclick="_sbNewFrame()">+ Add Frame</button>
      </div>
    </div>

    ${!total ? `
      <div class="empty-state" style="margin-top:40px">
        <div class="icon">🎬</div>
        <h4>No frames yet</h4>
        <p>${hasBreakdown ? 'Add your first frame — it can be attached to a scene or left general.' : 'Upload a script and create a breakdown first to attach frames to scenes, or just start adding frames.'}</p>
        <button class="btn btn-primary" onclick="_sbNewFrame()">+ Add First Frame</button>
      </div>
    ` : groups.map(group => _sbGroupHtml(group, scenes)).join('')}
  `;
}

function _sbGroupHtml(group, scenes) {
  const isUnattached = group.key === '__unattached';
  const frameHtml = group.frames.map(f => _sbFrameCardHtml(f)).join('');

  return `
    <div class="sb-group" data-scene-key="${group.key.replace(/"/g,'&quot;')}" style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border2)">
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--accent2);text-transform:uppercase;font-family:var(--font-mono)">${isUnattached ? '⬡ GENERAL' : '▸ SCENE'}</span>
        <span style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${group.heading.replace(/</g,'&lt;')}</span>
        <span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">${group.frames.length} frame${group.frames.length!==1?'s':''}</span>
        <button onclick="_sbAddFrameToScene('${group.key.replace(/'/g,"\\'")}','${group.heading.replace(/'/g,"\\'")}')" style="background:none;border:1px dashed var(--border2);color:var(--text3);cursor:pointer;font-size:10px;padding:2px 8px;border-radius:var(--radius)">+ Frame</button>
      </div>
      <div class="sb-frames-grid">
        ${frameHtml}
        <div class="sb-add-card" onclick="_sbAddFrameToScene('${group.key.replace(/'/g,"\\'")}','${group.heading.replace(/'/g,"\\'")}')">
          <span style="font-size:24px;color:var(--border2)">+</span>
          <span style="font-size:10px;color:var(--text3)">Add Frame</span>
        </div>
      </div>
    </div>
  `;
}

function _sbFrameCardHtml(f) {
  const hasImage = !!f.imageDataUrl;
  const shotLabel = f.shotType || '—';
  const moveLabel = f.movement || '—';

  return `
    <div class="sb-frame-card" id="sb-card-${f.id}"
      draggable="true"
      ondragstart="_sbDragStart(event,'${f.id}')"
      ondragover="_sbDragOver(event,'${f.id}')"
      ondrop="_sbDrop(event,'${f.id}')"
      ondragend="_sbDragEnd()"
      onclick="_sbOpenFrame('${f.id}')"
      title="Click to edit frame ${f.frameNumber}"
    >
      <div class="sb-frame-image-zone" onclick="event.stopPropagation();_sbUploadImage('${f.id}')">
        ${hasImage
          ? `<img src="${f.imageDataUrl}" alt="Frame ${f.frameNumber}" style="width:100%;height:100%;object-fit:cover;border-radius:4px 4px 0 0">`
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
        <div class="sb-frame-num">${f.frameNumber || '?'}</div>
      </div>
      <div class="sb-frame-meta">
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">
          ${f.shotType ? `<span class="sb-pill">${shotLabel}</span>` : ''}
          ${f.movement ? `<span class="sb-pill sb-pill-move">${moveLabel}</span>` : ''}
          ${f.lens     ? `<span class="sb-pill sb-pill-lens">${f.lens}</span>` : ''}
        </div>
        <div class="sb-frame-action">${(f.action||'No description').substring(0,80)}${(f.action||'').length>80?'…':''}</div>
        ${f.dialogue ? `<div class="sb-frame-dialogue">"${f.dialogue.substring(0,60)}${f.dialogue.length>60?'…':''}"</div>` : ''}
        ${f.transition ? `<div style="font-size:9px;color:var(--text3);margin-top:4px;font-family:var(--font-mono)">→ ${f.transition}</div>` : ''}
      </div>
    </div>
  `;
}

// ── FRAME MODAL ───────────────────────────────────────────────────────────────

function _sbOpenFrame(id) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = sb.frames.find(x => x.id === id); if (!f) return;
  const scenes = _sbScenes(p);
  const idx    = sb.frames.indexOf(f);

  const ovId = '_sb-frame-modal';
  document.getElementById(ovId)?.remove();

  const ov = document.createElement('div');
  ov.id = ovId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(820px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--accent2);font-family:var(--font-mono)">FRAME</span>
          <input id="_sbfNum" type="number" value="${f.frameNumber||''}" min="1"
            style="width:60px;padding:3px 6px;font-size:14px;font-weight:700;font-family:var(--font-mono);background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);text-align:center"
            onchange="_sbSaveField('${id}','frameNumber',this.value)">
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="_sbPrevFrame('${id}')" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);cursor:pointer;padding:4px 10px;font-size:12px" ${idx===0?'disabled':''}>← Prev</button>
          <button onclick="_sbNextFrame('${id}')" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);cursor:pointer;padding:4px 10px;font-size:12px" ${idx===sb.frames.length-1?'disabled':''}>Next →</button>
          <button onclick="document.getElementById('${ovId}').remove();renderStoryboard(currentProject())" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;line-height:1;padding:0 0 0 8px">✕</button>
        </div>
      </div>

      <!-- Body -->
      <div style="display:flex;flex:1;overflow:hidden">

        <!-- Image Panel -->
        <div style="width:340px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
          <div id="_sbfImgZone" class="sb-modal-image-zone" onclick="_sbUploadImage('${id}',true)" style="cursor:pointer;flex:1;display:flex;align-items:center;justify-content:center;background:var(--surface2);position:relative">
            ${f.imageDataUrl
              ? `<img src="${f.imageDataUrl}" style="max-width:100%;max-height:100%;object-fit:contain">`
              : `<div style="text-align:center;color:var(--text3)">
                  <div style="font-size:40px;margin-bottom:8px;opacity:0.3">🎨</div>
                  <div style="font-size:12px">Click to upload sketch</div>
                  <div style="font-size:10px;margin-top:4px;opacity:0.6">PNG · JPG · WEBP · GIF</div>
                </div>`
            }
            <input type="file" id="_sbfImgInput_${id}" accept="image/*" style="display:none" onchange="_sbHandleImageUpload('${id}',this)">
          </div>
          ${f.imageDataUrl ? `
            <div style="display:flex;gap:6px;padding:8px;border-top:1px solid var(--border);flex-shrink:0">
              <button class="btn btn-sm" style="flex:1" onclick="_sbUploadImage('${id}',true)">↺ Replace</button>
              <button class="btn btn-sm btn-danger" onclick="_sbRemoveImage('${id}')">✕ Remove</button>
            </div>
          ` : ''}
        </div>

        <!-- Fields Panel -->
        <div style="flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px">

          <!-- Scene -->
          <div>
            <label class="form-label" style="margin-bottom:4px">Scene</label>
            <select onchange="_sbSaveField('${id}','sceneKey',this.value);_sbSaveSceneHeading('${id}',this)"
              style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
              <option value="">— General / Unattached —</option>
              ${scenes.map(s => `<option value="${s.key.replace(/"/g,'&quot;')}" ${f.sceneKey===s.key?'selected':''}>${s.heading.replace(/</g,'&lt;').substring(0,60)}</option>`).join('')}
            </select>
          </div>

          <!-- Shot type + Movement -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="form-label" style="margin-bottom:4px">Shot Type</label>
              <select onchange="_sbSaveField('${id}','shotType',this.value)"
                style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_SHOT_TYPES.map(t => `<option ${f.shotType===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="margin-bottom:4px">Camera Movement</label>
              <select onchange="_sbSaveField('${id}','movement',this.value)"
                style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_MOVEMENTS.map(m => `<option ${f.movement===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Lens + Transition -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="form-label" style="margin-bottom:4px">Lens</label>
              <select onchange="_sbSaveField('${id}','lens',this.value)"
                style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_LENSES.map(l => `<option ${f.lens===l?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="margin-bottom:4px">Transition Out</label>
              <select onchange="_sbSaveField('${id}','transition',this.value)"
                style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)">
                <option value="">— None —</option>
                ${SB_TRANSITIONS.map(t => `<option ${f.transition===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Duration -->
          <div>
            <label class="form-label" style="margin-bottom:4px">Estimated Duration (seconds)</label>
            <input type="number" value="${f.duration||''}" min="1" placeholder="e.g. 5"
              style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text)"
              onchange="_sbSaveField('${id}','duration',this.value)">
          </div>

          <!-- Action -->
          <div>
            <label class="form-label" style="margin-bottom:4px">Action / Description</label>
            <textarea rows="3" placeholder="What happens in this frame…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5"
              onblur="_sbSaveField('${id}','action',this.value)">${(f.action||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

          <!-- Dialogue -->
          <div>
            <label class="form-label" style="margin-bottom:4px">Dialogue Beat <span style="opacity:0.5;font-weight:400">(optional)</span></label>
            <textarea rows="2" placeholder="Key dialogue line in this frame…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5;font-style:italic"
              onblur="_sbSaveField('${id}','dialogue',this.value)">${(f.dialogue||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

          <!-- Notes -->
          <div>
            <label class="form-label" style="margin-bottom:4px">Director / DoP Notes <span style="opacity:0.5;font-weight:400">(optional)</span></label>
            <textarea rows="2" placeholder="Lighting notes, mood, reference…"
              style="width:100%;padding:8px 10px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);resize:vertical;line-height:1.5"
              onblur="_sbSaveField('${id}','notes',this.value)">${(f.notes||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>

          <!-- Delete -->
          <div style="padding-top:8px;border-top:1px solid var(--border);margin-top:4px">
            <button class="btn btn-sm btn-danger" onclick="_sbDeleteFrame('${id}')">🗑 Delete Frame</button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); renderStoryboard(currentProject()); } });
}

// ── FRAME ACTIONS ─────────────────────────────────────────────────────────────

function _sbSetFilter(val) {
  _sbSceneFilter = val;
  renderStoryboard(currentProject());
}

function _sbNewFrame() {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const scenes = _sbScenes(p);
  const frame = {
    id: makeId(),
    frameNumber: _sbNextFrameNum(sb),
    sceneKey: null,
    sceneHeading: null,
    shotType: '',
    movement: '',
    lens: '',
    transition: '',
    imageDataUrl: null,
    action: '',
    dialogue: '',
    notes: '',
    duration: '',
  };
  sb.frames.push(frame);
  saveStore();
  renderStoryboard(p);
  _sbOpenFrame(frame.id);
}

function _sbAddFrameToScene(sceneKey, sceneHeading) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const isUnattached = sceneKey === '__unattached';
  const frame = {
    id: makeId(),
    frameNumber: _sbNextFrameNum(sb),
    sceneKey: isUnattached ? null : sceneKey,
    sceneHeading: isUnattached ? null : sceneHeading,
    shotType: '',
    movement: '',
    lens: '',
    transition: '',
    imageDataUrl: null,
    action: '',
    dialogue: '',
    notes: '',
    duration: '',
  };
  sb.frames.push(frame);
  saveStore();
  renderStoryboard(p);
  _sbOpenFrame(frame.id);
}

function _sbSaveField(id, field, value) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = sb.frames.find(x => x.id === id); if (!f) return;
  f[field] = value;
  saveStore();
  // Update card in DOM if visible
  const card = document.getElementById('sb-card-' + id);
  if (card) card.outerHTML = _sbFrameCardHtml(f);
}

function _sbSaveSceneHeading(id, selectEl) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const f  = sb.frames.find(x => x.id === id); if (!f) return;
  const opt = selectEl.options[selectEl.selectedIndex];
  f.sceneHeading = opt ? opt.textContent : null;
  saveStore();
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
  if (idx > 0) {
    document.getElementById('_sb-frame-modal')?.remove();
    _sbOpenFrame(sb.frames[idx - 1].id);
  }
}

function _sbNextFrame(id) {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const idx = sb.frames.findIndex(x => x.id === id);
  if (idx < sb.frames.length - 1) {
    document.getElementById('_sb-frame-modal')?.remove();
    _sbOpenFrame(sb.frames[idx + 1].id);
  }
}

// ── IMAGE HANDLING ────────────────────────────────────────────────────────────

function _sbUploadImage(id, fromModal) {
  const inputId = '_sbfImgInput_' + id;
  let input = document.getElementById(inputId);
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.id = inputId;
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
    // Refresh the modal image zone if open
    const zone = document.getElementById('_sbfImgZone');
    if (zone) {
      zone.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    }
    renderStoryboard(currentProject());
  };
  reader.readAsDataURL(file);
}

function _sbRemoveImage(id) {
  _sbSaveField(id, 'imageDataUrl', null);
  const zone = document.getElementById('_sbfImgZone');
  if (zone) {
    zone.innerHTML = `<div style="text-align:center;color:var(--text3)">
      <div style="font-size:40px;margin-bottom:8px;opacity:0.3">🎨</div>
      <div style="font-size:12px">Click to upload sketch</div>
      <div style="font-size:10px;margin-top:4px;opacity:0.6">PNG · JPG · WEBP · GIF</div>
    </div>`;
  }
  renderStoryboard(currentProject());
}

// ── DRAG / DROP REORDER ───────────────────────────────────────────────────────

function _sbDragStart(e, id) {
  _sbDragFrame = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => document.getElementById('sb-card-' + id)?.classList.add('sb-dragging'), 0);
}

function _sbDragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.sb-frame-card').forEach(c => c.classList.remove('sb-drag-over'));
  if (id !== _sbDragFrame) document.getElementById('sb-card-' + id)?.classList.add('sb-drag-over');
}

function _sbDrop(e, targetId) {
  e.preventDefault();
  document.querySelectorAll('.sb-frame-card').forEach(c => { c.classList.remove('sb-drag-over','sb-dragging'); });
  if (!_sbDragFrame || _sbDragFrame === targetId) return;
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  const from = sb.frames.findIndex(x => x.id === _sbDragFrame);
  const to   = sb.frames.findIndex(x => x.id === targetId);
  if (from === -1 || to === -1) return;
  const [item] = sb.frames.splice(from, 1);
  sb.frames.splice(to, 0, item);
  saveStore();
  renderStoryboard(p);
  _sbDragFrame = null;
}

function _sbDragEnd() {
  document.querySelectorAll('.sb-frame-card').forEach(c => { c.classList.remove('sb-drag-over','sb-dragging'); });
  _sbDragFrame = null;
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────

async function _sbExportPDF() {
  const p  = currentProject(); if (!p) return;
  const sb = _getStoryboard(p);
  if (!sb.frames.length) { showToast('No frames to export', 'info'); return; }

  showToast('Generating storyboard PDF…', 'info');

  // Build landscape A4 HTML with 3×2 grid per page
  const scenes = _sbScenes(p);
  const groups = _sbGroupByScene(sb.frames, scenes);
  const date   = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  let pagesHtml = '';
  let pageBuffer = []; // collect cells until we have 6 or hit a scene break

  const flushPage = (forceBreak) => {
    if (!pageBuffer.length && !forceBreak) return;
    // Pad to 6
    while (pageBuffer.length < 6 && pageBuffer.length > 0) pageBuffer.push({ empty: true });
    pagesHtml += `<div class="sb-pdf-page">
      <div class="sb-pdf-grid">
        ${pageBuffer.map(cell => cell.empty
          ? `<div class="sb-pdf-cell sb-pdf-empty"></div>`
          : `<div class="sb-pdf-cell">
              <div class="sb-pdf-image-box">
                ${cell.imageDataUrl
                  ? `<img src="${cell.imageDataUrl}" style="width:100%;height:100%;object-fit:contain">`
                  : `<div class="sb-pdf-placeholder">
                      <svg viewBox="0 0 100 75" fill="none" stroke="#ccc" stroke-width="1" style="width:60%">
                        <rect x="2" y="2" width="96" height="71" rx="2"/>
                        <line x1="2" y1="2" x2="98" y2="73"/>
                        <line x1="98" y1="2" x2="2" y2="73"/>
                        <circle cx="20" cy="20" r="8"/>
                      </svg>
                    </div>`
                }
              </div>
              <div class="sb-pdf-cell-footer">
                <div class="sb-pdf-frame-num">#${cell.frameNumber||'?'}</div>
                <div class="sb-pdf-tags">
                  ${cell.shotType ? `<span class="sb-pdf-tag">${cell.shotType}</span>` : ''}
                  ${cell.movement ? `<span class="sb-pdf-tag">${cell.movement}</span>` : ''}
                  ${cell.lens     ? `<span class="sb-pdf-tag">${cell.lens}</span>` : ''}
                </div>
                <div class="sb-pdf-action">${(cell.action||'').substring(0,100)}</div>
                ${cell.dialogue ? `<div class="sb-pdf-dialogue">"${cell.dialogue.substring(0,80)}"</div>` : ''}
                ${cell.notes    ? `<div class="sb-pdf-notes">${cell.notes.substring(0,80)}</div>` : ''}
              </div>
            </div>`
        ).join('')}
      </div>
    </div>`;
    pageBuffer = [];
  };

  groups.forEach((group, gi) => {
    if (gi > 0) {
      // Scene break — flush current page and start new one
      if (pageBuffer.length) flushPage(false);
    }
    // Scene heading banner
    if (pageBuffer.length === 0) {
      // Will add heading at top of next page via a special row
    }
    // Actually — simplest approach: add a full-width heading cell
    // We'll add heading as first cell of a new page row when group starts
    // For simplicity, flush before each scene and add heading div at top
    pagesHtml += `<div class="sb-pdf-scene-heading">${group.heading.replace(/</g,'&lt;')}</div>`;

    group.frames.forEach(f => {
      pageBuffer.push(f);
      if (pageBuffer.length === 6) flushPage(false);
    });
    if (pageBuffer.length) flushPage(false);
  });

  const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #111; }
    .sb-pdf-header { display:flex; justify-content:space-between; align-items:flex-end; padding:10mm 12mm 6mm; border-bottom:2px solid #111; }
    .sb-pdf-header-title { font-size:18pt; font-weight:700; letter-spacing:-0.5px; }
    .sb-pdf-header-sub { font-size:9pt; color:#666; margin-top:3px; }
    .sb-pdf-header-date { font-size:9pt; color:#888; }
    .sb-pdf-scene-heading { font-size:9pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#555; padding:5mm 12mm 3mm; border-bottom:1px solid #ddd; page-break-after:avoid; }
    .sb-pdf-page { padding:4mm 12mm 8mm; page-break-after:always; }
    .sb-pdf-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6mm; }
    .sb-pdf-cell { border:1px solid #ddd; border-radius:3px; overflow:hidden; }
    .sb-pdf-empty { border:1px dashed #eee; background:#fafafa; }
    .sb-pdf-image-box { height:48mm; background:#f5f5f5; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .sb-pdf-placeholder { display:flex; align-items:center; justify-content:center; width:100%; height:100%; }
    .sb-pdf-cell-footer { padding:2.5mm 3mm; }
    .sb-pdf-frame-num { font-size:7pt; font-weight:700; font-family:monospace; color:#888; margin-bottom:2px; }
    .sb-pdf-tags { display:flex; gap:3px; flex-wrap:wrap; margin-bottom:3px; }
    .sb-pdf-tag { font-size:6pt; padding:1px 5px; background:#f0f0f0; border-radius:2px; color:#555; }
    .sb-pdf-action { font-size:7.5pt; color:#222; line-height:1.4; margin-bottom:2px; }
    .sb-pdf-dialogue { font-size:7pt; color:#555; font-style:italic; line-height:1.3; margin-bottom:2px; }
    .sb-pdf-notes { font-size:6.5pt; color:#888; line-height:1.3; }
    .sb-pdf-footer { text-align:center; padding:5mm; font-size:7pt; color:#ccc; border-top:1px solid #eee; }
    @page { size:A4 landscape; margin:0; }
    @media print { body { -webkit-print-color-adjust:exact; } }
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Storyboard — ${p.title}</title>
    <style>${styles}</style></head><body>
    <div class="sb-pdf-header">
      <div>
        <div class="sb-pdf-header-title">${(p.title||'Untitled').replace(/</g,'&lt;')} — Storyboard</div>
        <div class="sb-pdf-header-sub">${sb.frames.length} frame${sb.frames.length!==1?'s':''} · ${groups.length} scene${groups.length!==1?'s':''}</div>
      </div>
      <div class="sb-pdf-date">${date}</div>
    </div>
    ${pagesHtml}
    <div class="sb-pdf-footer">Generated by Black Fountain · blackfountain.io</div>
    </body></html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  } else {
    // Fallback: download HTML
    const a = document.createElement('a');
    a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    a.download = `storyboard-${(p.title||'project').replace(/\s+/g,'-').toLowerCase()}.html`;
    a.click();
    showToast('Downloaded as HTML — open in browser and print to PDF', 'info');
  }
}

// ── CSS INJECTION ─────────────────────────────────────────────────────────────

(function _sbInjectStyles() {
  if (document.getElementById('_sb-styles')) return;
  const style = document.createElement('style');
  style.id = '_sb-styles';
  style.textContent = `
    .sb-frames-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }
    .sb-frame-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s, transform .1s;
      position: relative;
    }
    .sb-frame-card:hover {
      border-color: var(--accent2);
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      transform: translateY(-1px);
    }
    .sb-frame-card.sb-dragging { opacity: 0.4; }
    .sb-frame-card.sb-drag-over { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
    .sb-frame-image-zone {
      height: 120px;
      background: var(--surface3);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .sb-frame-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--text3);
    }
    .sb-frame-num {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 2px 6px;
      border-radius: 3px;
      line-height: 1.4;
    }
    .sb-frame-meta {
      padding: 8px 10px;
    }
    .sb-pill {
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 3px;
      background: rgba(91,192,235,0.15);
      color: var(--accent2);
      font-weight: 600;
      white-space: nowrap;
    }
    .sb-pill-move {
      background: rgba(96,208,144,0.12);
      color: var(--green, #60d090);
    }
    .sb-pill-lens {
      background: rgba(230,188,60,0.12);
      color: var(--accent, #e6bc3c);
    }
    .sb-frame-action {
      font-size: 10px;
      color: var(--text2);
      line-height: 1.4;
      margin-top: 4px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .sb-frame-dialogue {
      font-size: 9px;
      color: var(--text3);
      font-style: italic;
      margin-top: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sb-add-card {
      border: 2px dashed var(--border2);
      border-radius: 8px;
      min-height: 160px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color .15s, background .15s;
      gap: 6px;
    }
    .sb-add-card:hover {
      border-color: var(--accent2);
      background: rgba(91,192,235,0.04);
    }
    .sb-modal-image-zone {
      min-height: 280px;
      transition: background .15s;
    }
    .sb-modal-image-zone:hover {
      background: var(--surface3) !important;
    }
  `;
  document.head.appendChild(style);
})();