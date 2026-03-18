// MOODBOARDS
// ══════════════════════════════════════════════════════════════════════════════
let _currentMoodboardId = null;
let _mbViewState = {};   // boardId -> { panX, panY, zoom }
let _mbDrag = null;      // active drag/pan/resize state
let _mbRafPending = false;
let _mbLastMoveE = null;
let _mbFullscreen = false;
let _mbHide = { captions: false, frames: false, navbar: false, header: false };
let _mbBgReposition = false;
let _mbFsHideTimer = null;

function renderMoodboards() {
  const el = document.getElementById('moodboards-container');
  if (!el) return;
  const view    = document.getElementById('view-moodboards');
  const content = document.getElementById('content');
  if (_currentMoodboardId) {
    view    && view.classList.add('mb-canvas-mode');
    content && content.classList.add('mb-content-canvas');
    _renderMoodboardDetail(el);
  } else {
    view    && view.classList.remove('mb-canvas-mode');
    content && content.classList.remove('mb-content-canvas');
    _renderMoodboardList(el);
  }
}

function _renderMoodboardList(el) {
  const boards = store.moodboards || [];

  // Filter state
  const filterPid = el._mbFilterPid || 'all';
  const search = el._mbSearch || '';

  let filtered = boards;
  if (filterPid !== 'all') filtered = filtered.filter(b => (filterPid === '_none' ? !b.projectId : b.projectId === filterPid));
  if (search.trim()) filtered = filtered.filter(b => b.title.toLowerCase().includes(search.trim().toLowerCase()));

  const projOptions = store.projects.map(p =>
    `<option value="${p.id}" ${filterPid === p.id ? 'selected':''}>${p.title}</option>`
  ).join('');

  el.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div>
        <h2>MOODBOARDS</h2>
        <p>Visual inspiration boards for your projects</p>
      </div>
      <button class="btn btn-primary" onclick="openNewMoodboardModal()" style="margin-top:6px">+ New Board</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:20px">
      <input class="form-input" placeholder="Search boards…" value="${search.replace(/"/g,'&quot;')}"
        oninput="document.getElementById('moodboards-container')._mbSearch=this.value;renderMoodboards()" style="max-width:200px;font-size:12px">
      <select class="form-select" style="max-width:220px;font-size:12px"
        onchange="document.getElementById('moodboards-container')._mbFilterPid=this.value;renderMoodboards()">
        <option value="all" ${filterPid==='all'?'selected':''}>All Projects</option>
        <option value="_none" ${filterPid==='_none'?'selected':''}>No Project</option>
        ${projOptions}
      </select>
      <span style="font-size:11px;color:var(--text3);font-family:var(--font-mono)">${filtered.length} board${filtered.length!==1?'s':''}</span>
    </div>`;

  if (!filtered.length) {
    el.innerHTML += `<div class="empty-state" style="padding:64px;text-align:center">
      <div style="font-size:52px;margin-bottom:16px">🎨</div>
      <h3>No moodboards yet</h3>
      <p style="color:var(--text2);margin-top:8px">Create a board to start collecting visual inspiration</p>
      <button class="btn btn-primary" onclick="openNewMoodboardModal()" style="margin-top:16px">+ New Board</button>
    </div>`;
    return;
  }

  const cards = filtered.map(b => {
    const proj = b.projectId ? store.projects.find(p => p.id === b.projectId) : null;
    const imgs = (b.items||[]).filter(it => it.type === 'image');
    const thumb = b.thumbnail
      ? `<img src="${b.thumbnail}" alt="">`
      : imgs.length
        ? `<img src="${imgs[0].data}" alt="">`
        : `<div class="mb-board-thumb-placeholder">🎨</div>`;
    const colorItems = (b.items||[]).filter(it => it.type === 'color');
    const colorStrip = colorItems.length
      ? `<div style="display:flex;height:4px;position:absolute;bottom:0;left:0;right:0">${colorItems.slice(0,8).map(c=>`<div style="flex:1;background:${c.color}"></div>`).join('')}</div>`
      : '';
    return `<div class="mb-board-card" data-boardid="${b.id}" onclick="openMoodboard('${b.id}')">
      <div class="mb-board-thumb">${thumb}${colorStrip}</div>
      <div class="mb-board-info">
        <div class="mb-board-title">${b.title.replace(/</g,'&lt;')}</div>
        <div class="mb-board-meta">${proj ? proj.title : 'No project'} · ${(b.items||[]).length} item${(b.items||[]).length!==1?'s':''}</div>
        <div class="mb-board-actions">
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openMoodboard('${b.id}');setTimeout(()=>{const i=document.getElementById('mb-title-input');if(i){i.focus();i.select();}},50)" title="Rename">✎</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteMoodboard('${b.id}')" title="Delete board">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML += `<div class="mb-boards-grid">${cards}</div>`;

  // Generate missing thumbnails in the background
  filtered.filter(b => !b.thumbnail && (b.items||[]).length).forEach(b => {
    setTimeout(() => _mbCaptureThumbnail(b.id), 0);
  });
}

function _renderMoodboardDetail(el) {
  const b = (store.moodboards||[]).find(x => x.id === _currentMoodboardId);
  if (!b) { _currentMoodboardId = null; renderMoodboards(); return; }
  const proj = b.projectId ? store.projects.find(p => p.id === b.projectId) : null;
  const bg = b.bg || null;

  // Init view state once per board
  if (!_mbViewState[b.id]) {
    _mbViewState[b.id] = { panX: 60, panY: 60, zoom: 1 };
  }
  const vs = _mbViewState[b.id];

  // Auto-place items that don't have coordinates yet (scattered naturally)
  let autoIdx = 0;
  (b.items||[]).forEach(it => {
    if (it.x == null) {
      it.x = 60 + (autoIdx % 4) * 310 + (autoIdx % 3) * 12;
      it.y = 60 + Math.floor(autoIdx / 4) * 340 + (autoIdx % 2) * 18;
      autoIdx++;
    }
  });

  const itemsHTML = (b.items||[]).map(it => _mbItemHTML(b.id, it)).join('');

  el.innerHTML = `
    <div class="mb-canvas-toolbar">
      <button class="btn btn-sm btn-ghost" onclick="_mbGoBack()" style="font-size:13px;flex-shrink:0">← Back</button>
      <input id="mb-title-input" class="form-input" value="${b.title.replace(/"/g,'&quot;')}"
        style="font-size:14px;font-weight:600;max-width:220px;padding:4px 8px;background:transparent;border-color:transparent"
        onfocus="this.style.borderColor=''" onblur="_mbSaveTitle('${b.id}',this.value)"
        onkeydown="if(event.key==='Enter')this.blur()">
      ${proj ? `<span class="tag" style="font-size:11px;flex-shrink:0">${proj.title}</span>` : ''}
      <div style="width:1px;height:22px;background:var(--border2);flex-shrink:0"></div>
      <span style="font-size:11px;color:var(--text3);flex-shrink:0">Add:</span>
      <button class="btn btn-sm" onclick="document.getElementById('mb-img-input').click()">🖼 Image</button>
      <button class="btn btn-sm" onclick="document.getElementById('mb-audio-input').click()">🎵 Audio</button>
      <button class="btn btn-sm" onclick="openMbVideoModal()">▶ URL</button>
      <button class="btn btn-sm" onclick="document.getElementById('mb-video-input').click()">📹 Video</button>
      <button class="btn btn-sm" onclick="openModal('modal-mb-color')">🎨 Colour</button>
      <button class="btn btn-sm" onclick="openMbNoteModal()">📝 Note</button>
      <div style="width:1px;height:22px;background:var(--border2);flex-shrink:0;margin-left:2px"></div>
      <label style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:5px;flex-shrink:0;cursor:pointer" title="Canvas background colour">
        <span>Bg</span>
        <input type="color" value="${bg&&bg.startsWith('#')?bg:'#2a2a3d'}" oninput="_mbSetBg('${b.id}',this.value)" style="width:28px;height:22px;border:1px solid var(--border2);border-radius:4px;padding:0 2px;cursor:pointer;background:transparent">
      </label>
      <button class="btn btn-sm btn-ghost" onclick="document.getElementById('mb-bg-input').click()" title="Canvas background image" style="flex-shrink:0">🖼 Bg</button>
      <input type="file" id="mb-bg-input" accept="image/*" style="display:none" onchange="_mbSetBgImage('${b.id}',this.files[0]);this.value=''">
      ${bg&&bg.startsWith('url(') ? `<button class="btn btn-sm btn-ghost${_mbBgReposition?' mb-view-toggle-on':''}" onclick="_mbToggleBgReposition()" title="Drag to reposition background image" style="flex-shrink:0">⤢ Position</button>` : ''}
      ${bg&&!bg.startsWith('#') ? `<button class="btn btn-sm btn-ghost" onclick="_mbClearBg('${b.id}')" title="Remove background image" style="flex-shrink:0;opacity:0.6">✕ Bg</button>` : ''}
      <div style="width:1px;height:22px;background:var(--border2);flex-shrink:0"></div>
      <div class="mb-view-menu" style="position:relative;flex-shrink:0">
        <button class="btn btn-sm btn-ghost${Object.values(_mbHide).some(Boolean)?' mb-view-toggle-on':''}" onclick="_mbToggleViewMenu()" title="Show/hide elements">View ▾</button>
        <div class="mb-view-dropdown" id="mb-view-dropdown" style="display:none">
          ${[['captions','Captions'],['frames','Frames'],['navbar','Navbar'],['header','Header']].map(([flag,label])=>`
          <label class="mb-view-row" onclick="_mbToggleHide('${flag}');event.preventDefault()">
            <span class="mb-view-check">${_mbHide[flag]?'✕':''}</span>${label}
          </label>`).join('')}
          <div style="height:1px;background:var(--border2);margin:4px 0"></div>
          <label class="mb-view-row" onclick="_mbToggleHide('all');event.preventDefault()">
            <span class="mb-view-check">${(_mbHide.captions&&_mbHide.frames&&_mbHide.navbar&&_mbHide.header)?'✕':''}</span>Hide all
          </label>
        </div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteMoodboard('${b.id}')" style="flex-shrink:0">Delete</button>
      <button class="btn btn-sm btn-ghost" onclick="_mbToggleFullscreen()" title="Fullscreen (F)" style="margin-left:auto;flex-shrink:0;font-size:15px;padding:3px 9px">⛶</button>
    </div>
    <input type="file" id="mb-img-input" accept="image/*" multiple style="display:none" onclick="this.value=''" onchange="handleMbImageUpload(this.files, window._mbCtxDropPos); window._mbCtxDropPos=null;">
    <input type="file" id="mb-audio-input" accept="audio/*" multiple style="display:none" onclick="this.value=''" onchange="handleMbAudioUpload(this.files, window._mbCtxDropPos); window._mbCtxDropPos=null;">
    <input type="file" id="mb-video-input" accept="video/*" multiple style="display:none" onclick="this.value=''" onchange="handleMbVideoUpload(this.files, window._mbCtxDropPos); window._mbCtxDropPos=null;">
    <div class="mb-canvas-wrap" id="mb-canvas-wrap"
      onmousedown="_mbWrapMouseDown(event)"
      onwheel="_mbWheel(event)"
      ondragover="_mbDragOver(event)"
      ondragleave="_mbDragLeave(event)"
      ondrop="_mbDrop(event)"
      oncontextmenu="_mbCanvasContextMenu(event)">
      <div class="mb-canvas" id="mb-canvas"
        style="transform:translate(${vs.panX}px,${vs.panY}px) scale(${vs.zoom})">
        ${itemsHTML}
      </div>
      <div class="mb-zoom-controls">
        <button class="btn btn-sm btn-ghost" onclick="_mbZoomBy(-0.15)" style="padding:2px 7px;font-size:14px">−</button>
        <span id="mb-zoom-pct" style="min-width:38px;text-align:center;font-family:var(--font-mono);color:var(--text2)">${Math.round(vs.zoom*100)}%</span>
        <button class="btn btn-sm btn-ghost" onclick="_mbZoomBy(0.15)" style="padding:2px 7px;font-size:14px">+</button>
        <button class="btn btn-sm btn-ghost" onclick="_mbResetView('${b.id}')" style="padding:2px 7px;font-size:11px;color:var(--text3)" data-tip="Fit all items in view">Fit all</button>
      </div>
    </div>`;

  const wrap = document.getElementById('mb-canvas-wrap');
  if (wrap) {
    if (bg) {
      wrap.style.background = bg;
      wrap.style.backgroundSize = bg.startsWith('url(') ? 'cover' : '';
      const off = b.bgOffset || { x: 0, y: 0 };
      wrap.style.backgroundPosition = bg.startsWith('url(') ? `calc(50% + ${off.x}px) calc(50% + ${off.y}px)` : '';
      wrap.classList.remove('mb-canvas-default');
    } else {
      wrap.style.background = '';
      wrap.style.backgroundSize = '';
      wrap.style.backgroundPosition = '';
      wrap.classList.add('mb-canvas-default');
    }
  }

  _mbEnsureListeners();
}

function _mbItemHTML(boardId, it) {
  const esc = s => (s||'').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const w = it.w || { image:280, audio:270, video:340, color:190, note:250 }[it.type] || 260;
  const style = `left:${it.x||0}px;top:${it.y||0}px;width:${w}px`;
  const controls = `<div class="mb-item-controls"><button class="btn btn-sm btn-danger" onclick="deleteMbItem('${boardId}','${it.id}')" title="Remove" style="padding:2px 6px;font-size:11px">✕</button></div>`;
  const resize = `<div class="mb-item-resize" onmousedown="_mbResizeStart(event,'${boardId}','${it.id}')">⌟</div>`;
  const caption = `<textarea class="mb-item-caption" placeholder="Caption…" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onchange="updateMbCaption('${boardId}','${it.id}',this.value)" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'" rows="1">${esc(it.caption)}</textarea>`;
  const flagClass = `${it.hideCaption?' mb-no-caption':''}${it.hideFrame?' mb-no-frame':''}${it.hideName?' mb-no-name':''}`;
  const wrap = (inner) => `<div id="mb-item-${it.id}" class="mb-item${flagClass}" data-itemid="${it.id}" style="${style}" onmousedown="_mbItemMouseDown(event,'${boardId}','${it.id}')">${controls}<div class="mb-item-inner">${inner}</div>${resize}</div>`;

  if (it.type === 'image') {
    return wrap(`<img src="${it.data}" alt="${esc(it.name)}" loading="lazy"><div class="mb-item-body">${caption}</div>`);
  }
  if (it.type === 'audio') {
    const dragTab = `<div class="mb-drag-tab" onmousedown="_mbItemMouseDown(event,'${boardId}','${it.id}')">⠿</div>`;
    return wrap(`${dragTab}<div class="mb-item-body"><div class="mb-item-name" style="font-size:11px;color:var(--text3);margin-bottom:6px">🎵 ${esc(it.name)}</div><audio controls src="${it.data}" onmousedown="event.stopPropagation()" style="width:100%"></audio>${caption}</div>`);
  }
  if (it.type === 'video') {
    const dragTab = `<div class="mb-drag-tab" onmousedown="_mbItemMouseDown(event,'${boardId}','${it.id}')">⠿</div>`;
    if (it.data) {
      return wrap(`${dragTab}<div class="mb-video-wrap"><video controls src="${it.data}" onmousedown="event.stopPropagation()" style="width:100%;display:block;border-radius:4px"></video></div><div class="mb-item-body">${caption}</div>`);
    }
    const src = _mbVideoEmbed(it.url);
    return wrap(src
      ? `${dragTab}<div class="mb-video-wrap"><iframe src="${src}" allow="autoplay;encrypted-media" allowfullscreen></iframe></div><div class="mb-item-body">${caption}</div>`
      : `<div class="mb-item-body" style="color:var(--text3);font-size:12px">⚠ Could not embed URL<br><small style="opacity:0.6">${esc(it.url)}</small>${caption}</div>`);
  }
  if (it.type === 'color') {
    return wrap(`<div class="mb-item-color-block" style="height:${Math.round(w*0.65)}px;background:${it.color}"></div><div class="mb-item-body"><div class="mb-item-color-hex">${it.color}</div>${caption}</div>`);
  }
  if (it.type === 'note') {
    return wrap(`<div class="mb-item-body"><div class="mb-item-note-text">${esc(it.text)}</div>${caption}</div>`);
  }
  return '';
}

function _mbVideoEmbed(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function _mbGoBack() {
  const id = _currentMoodboardId;
  _currentMoodboardId = null;
  _mbBgReposition = false;
  showView('moodboards');
  if (id) _mbCaptureThumbnail(id); // async, updates card after render
}

async function _mbCaptureThumbnail(boardId) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;

  const W = 600, H = 338;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Background
  if (b.bg && b.bg.startsWith('#')) {
    ctx.fillStyle = b.bg;
    ctx.fillRect(0, 0, W, H);
  } else if (b.bg && b.bg.startsWith('url(')) {
    const src = b.bg.slice(4, -1);
    await _mbDrawImgCover(ctx, src, 0, 0, W, H, b.bgOffset || {x:0,y:0}).catch(()=>{});
  } else {
    ctx.fillStyle = '#2a2a3d';
    ctx.fillRect(0, 0, W, H);
  }

  // Find bounding box of all placed items
  const placed = (b.items||[]).filter(it => it.x != null);
  if (placed.length) {
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    placed.forEach(it => {
      const iw = it.w || 280, ih = iw * 0.75;
      minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + iw); maxY = Math.max(maxY, it.y + ih);
    });
    const pad = 40;
    const scale = Math.min(W / (maxX-minX+pad*2), H / (maxY-minY+pad*2));
    const ox = (W - (maxX-minX+pad*2)*scale)/2 - (minX-pad)*scale;
    const oy = (H - (maxY-minY+pad*2)*scale)/2 - (minY-pad)*scale;

    // Draw colour blocks first, then images on top, audio/video as placeholders
    placed.filter(it=>it.type==='color').forEach(it => {
      const iw = (it.w||190)*scale;
      ctx.fillStyle = it.color || '#888';
      ctx.fillRect(it.x*scale+ox, it.y*scale+oy, iw, iw*0.65);
    });
    placed.filter(it=>it.type==='audio').forEach(it => {
      const iw = (it.w||270)*scale, ih = 52*scale;
      const rx = it.x*scale+ox, ry = it.y*scale+oy;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(rx, ry, iw, ih);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `${Math.max(11, Math.round(13*scale))}px sans-serif`;
      ctx.fillText('🎵  ' + (it.name||'Audio'), rx + 8*scale, ry + ih/2 + 5*scale);
    });
    placed.filter(it=>it.type==='video').forEach(it => {
      const iw = (it.w||340)*scale, ih = iw*(9/16);
      const rx = it.x*scale+ox, ry = it.y*scale+oy;
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(rx, ry, iw, ih);
      const sz = Math.max(14, Math.round(28*scale));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${sz}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▶', rx + iw/2, ry + ih/2 + sz*0.35);
      ctx.textAlign = 'left';
    });
    for (const it of placed.filter(it=>it.type==='image')) {
      const iw = (it.w||280)*scale;
      await _mbDrawImg(ctx, it.data, it.x*scale+ox, it.y*scale+oy, iw).catch(()=>{});
    }
  }

  b.thumbnail = cv.toDataURL('image/jpeg', 0.82);
  // Update card thumb in place without full re-render
  const cardThumb = document.querySelector(`[data-boardid="${boardId}"] .mb-board-thumb`);
  if (cardThumb) cardThumb.innerHTML = `<img src="${b.thumbnail}" alt="">`;
  saveStore();
}

function _mbDrawImg(ctx, src, x, y, w) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, x, y, w, img.naturalHeight/img.naturalWidth*w); resolve(); };
    img.onerror = reject;
    img.src = src;
  });
}

function _mbDrawImgCover(ctx, src, x, y, w, h, offset) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(w/img.naturalWidth, h/img.naturalHeight);
      const dw = img.naturalWidth*scale, dh = img.naturalHeight*scale;
      const dx = (w-dw)/2 + (offset?.x||0);
      const dy = (h-dh)/2 + (offset?.y||0);
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

function openMoodboard(id) {
  _currentMoodboardId = id;
  showView('moodboards');
}

function openNewMoodboardModal() {
  document.getElementById('mb-new-title').value = '';
  const sel = document.getElementById('mb-new-project');
  sel.innerHTML = `<option value="">— No project —</option>` +
    store.projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  openModal('modal-new-moodboard');
}

function saveNewMoodboard() {
  const title = document.getElementById('mb-new-title').value.trim();
  if (!title) { showToast('Please enter a board title', 'info'); return; }
  const projectId = document.getElementById('mb-new-project').value || null;
  const board = { id: makeId(), title, projectId, createdAt: Date.now(), items: [] };
  store.moodboards = store.moodboards || [];
  store.moodboards.push(board);
  saveStore();
  closeModal('modal-new-moodboard');
  openMoodboard(board.id);
  showToast('Board created', 'success');
}

function deleteMoodboard(id) {
  const b = (store.moodboards||[]).find(x => x.id === id);
  if (!b) return;
  showConfirmDialog(`Delete "${b.title}"?`, 'This will permanently delete the board and all its items.', () => {
    store.moodboards = (store.moodboards||[]).filter(x => x.id !== id);
    if (_currentMoodboardId === id) _currentMoodboardId = null;
    saveStore();
    showView('moodboards');
    showToast('Board deleted', 'success');
  });
}

function renameMoodboard(id) {
  // Title is now always an input in the toolbar — just focus it
  const inp = document.getElementById('mb-title-input');
  if (inp) { inp.focus(); inp.select(); }
}

function _mbAddItem(boardId, item, dropPos) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  b.items = b.items || [];
  const vs = _mbViewState[boardId] || { panX:60, panY:60, zoom:1 };
  const wrap = document.getElementById('mb-canvas-wrap');
  const defaultW = { image:280, audio:270, video:340, color:190, note:250 }[item.type] || 260;
  let cx = 200, cy = 200;
  if (dropPos && wrap) {
    // Convert client coords to canvas coords
    const r = wrap.getBoundingClientRect();
    cx = (dropPos.x - r.left - vs.panX) / vs.zoom - defaultW / 2;
    cy = (dropPos.y - r.top  - vs.panY) / vs.zoom - 40;
  } else if (wrap) {
    // Place at viewport centre with a little random scatter so multiples don't stack
    const r = wrap.getBoundingClientRect();
    cx = (r.width  / 2 - vs.panX) / vs.zoom - defaultW / 2 + (Math.random() - 0.5) * 40;
    cy = (r.height / 2 - vs.panY) / vs.zoom - 80        + (Math.random() - 0.5) * 40;
  }
  b.items.push({ id: makeId(), caption: '', x: Math.round(cx), y: Math.round(cy), ...item });
  saveStore();
  renderMoodboards();
}

function handleMbImageUpload(files, dropPos) {
  if (!_currentMoodboardId || !files.length) return;
  const boardId = _currentMoodboardId;
  Array.from(files).forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const pos = dropPos ? { x: dropPos.x + i * 20, y: dropPos.y + i * 20 } : null;
      _mbAddItem(boardId, { type: 'image', data: e.target.result, name: file.name }, pos);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('mb-img-input').value = '';
}

function handleMbAudioUpload(files, dropPos) {
  if (!_currentMoodboardId || !files.length) return;
  const boardId = _currentMoodboardId;
  Array.from(files).forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const pos = dropPos ? { x: dropPos.x + i * 20, y: dropPos.y + i * 20 } : null;
      _mbAddItem(boardId, { type: 'audio', data: e.target.result, name: file.name }, pos);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('mb-audio-input').value = '';
}

function _mbDragOver(e) {
  if (!_currentMoodboardId) return;
  if ([...e.dataTransfer.types].includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.getElementById('mb-canvas-wrap')?.classList.add('mb-drop-over');
  }
}

function _mbDragLeave(e) {
  // Only remove if leaving the wrap entirely (not entering a child)
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.getElementById('mb-canvas-wrap')?.classList.remove('mb-drop-over');
  }
}

function handleMbVideoUpload(files, dropPos) {
  if (!_currentMoodboardId || !files.length) return;
  const boardId = _currentMoodboardId;
  Array.from(files).forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const pos = dropPos ? { x: dropPos.x + i * 20, y: dropPos.y + i * 20 } : null;
      _mbAddItem(boardId, { type: 'video', data: e.target.result, name: file.name }, pos);
    };
    reader.readAsDataURL(file);
  });
  const inp = document.getElementById('mb-video-input');
  if (inp) inp.value = '';
}

function _mbDrop(e) {
  e.preventDefault();
  document.getElementById('mb-canvas-wrap')?.classList.remove('mb-drop-over');
  if (!_currentMoodboardId) return;
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  const dropPos = { x: e.clientX, y: e.clientY };
  const images = files.filter(f => f.type.startsWith('image/'));
  const audios = files.filter(f => f.type.startsWith('audio/'));
  const videos = files.filter(f => f.type.startsWith('video/'));
  const unsupported = files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('audio/') && !f.type.startsWith('video/'));
  if (images.length) handleMbImageUpload(images, dropPos);
  if (audios.length) handleMbAudioUpload(audios, dropPos);
  if (videos.length) handleMbVideoUpload(videos, dropPos);
  if (unsupported.length) showToast(`${unsupported.length} file(s) not supported`);
}

function openMbVideoModal() {
  document.getElementById('mb-video-url').value = '';
  document.getElementById('mb-video-caption').value = '';
  openModal('modal-mb-video');
}

function saveMbVideo() {
  const url = document.getElementById('mb-video-url').value.trim();
  if (!url) { showToast('Please enter a URL', 'info'); return; }
  if (!_mbVideoEmbed(url)) { showToast('Please enter a YouTube or Vimeo URL', 'info'); return; }
  const caption = document.getElementById('mb-video-caption').value.trim();
  closeModal('modal-mb-video');
  _mbAddItem(_currentMoodboardId, { type: 'video', url, caption });
}

function openMbNoteModal() {
  document.getElementById('mb-note-text').value = '';
  document.getElementById('mb-note-caption').value = '';
  openModal('modal-mb-note');
}

function saveMbNote() {
  const text = document.getElementById('mb-note-text').value.trim();
  if (!text) { showToast('Please enter some text', 'info'); return; }
  const caption = document.getElementById('mb-note-caption').value.trim();
  closeModal('modal-mb-note');
  _mbAddItem(_currentMoodboardId, { type: 'note', text, caption });
}

function saveMbColor() {
  const color = document.getElementById('mb-color-picker').value;
  const caption = document.getElementById('mb-color-caption').value.trim();
  closeModal('modal-mb-color');
  _mbAddItem(_currentMoodboardId, { type: 'color', color, caption });
}

// ── Canvas context menu ───────────────────────────────────────────────────────

function _mbCanvasContextMenu(e) {
  if (e.target.closest('.mb-item')) return; // let item handle its own right-click
  e.preventDefault();
  e.stopPropagation();
  const boardId = _currentMoodboardId;
  // Store drop position so uploads land where you right-clicked
  window._mbCtxDropPos = { x: e.clientX, y: e.clientY };
  showContextMenu(e, [
    { icon: _mbFullscreen ? '⛶' : '⛶', label: _mbFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen', fn: () => _mbToggleFullscreen() },
    null,
    { icon: '🖼', label: 'Upload Image',  fn: () => document.getElementById('mb-img-input').click() },
    { icon: '🎵', label: 'Upload Audio',  fn: () => document.getElementById('mb-audio-input').click() },
    { icon: '📹', label: 'Upload Video',  fn: () => document.getElementById('mb-video-input').click() },
    { icon: '▶',  label: 'Embed Video URL', fn: () => openMbVideoModal() },
    { icon: '🎨', label: 'Add Colour',    fn: () => openModal('modal-mb-color') },
    { icon: '📝', label: 'Add Note',      fn: () => openMbNoteModal() },
  ]);
}

// ── View toggles ─────────────────────────────────────────────────────────────

function _mbToggleViewMenu() {
  const dd = document.getElementById('mb-view-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function _mbToggleHide(flag) {
  if (flag === 'all') {
    const allOn = _mbHide.captions && _mbHide.frames && _mbHide.navbar && _mbHide.header;
    ['captions','frames','navbar','header'].forEach(k => _mbHide[k] = !allOn);
  } else {
    _mbHide[flag] = !_mbHide[flag];
  }
  document.body.classList.toggle('mb-hide-captions', _mbHide.captions);
  document.body.classList.toggle('mb-hide-frames',   _mbHide.frames);
  document.body.classList.toggle('mb-hide-navbar',   _mbHide.navbar);
  document.body.classList.toggle('mb-hide-header',   _mbHide.header);
  // Refresh dropdown checkmarks
  const dd = document.getElementById('mb-view-dropdown');
  if (dd) {
    const rows = dd.querySelectorAll('.mb-view-row');
    const flags = ['captions','frames','navbar','header','all'];
    rows.forEach((row, i) => {
      const f = flags[i];
      const on = f === 'all'
        ? (_mbHide.captions && _mbHide.frames && _mbHide.navbar && _mbHide.header)
        : _mbHide[f];
      row.querySelector('.mb-view-check').textContent = on ? '✕' : '';
    });
    // Update the View button highlight
    const btn = dd.closest('.mb-view-menu')?.querySelector('.btn');
    if (btn) btn.classList.toggle('mb-view-toggle-on', Object.values(_mbHide).some(Boolean));
  }
}

// ── Fullscreen ────────────────────────────────────────────────────────────────

function _mbToggleFullscreen() {
  _mbFullscreen ? _mbExitFullscreen() : _mbEnterFullscreen();
}

function _mbEnterFullscreen() {
  _mbFullscreen = true;
  document.body.classList.add('mb-fullscreen');
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function _mbExitFullscreen() {
  _mbFullscreen = false;
  document.body.classList.remove('mb-fullscreen');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

function _mbShowFsBtn() {} // no-op, button is always visible in fullscreen via CSS

function _mbFsMouseMove() {} // no-op

function _mbFsKeyDown(e) {
  if (e.key === 'Escape' && _mbFullscreen) _mbExitFullscreen();
  if (e.key === 'f' && _mbFullscreen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') _mbExitFullscreen();
  if (e.key === 'f' && !_mbFullscreen && _currentMoodboardId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') _mbEnterFullscreen();
}

// ── Canvas interaction ────────────────────────────────────────────────────────

let _mbListenersAdded = false;
function _mbEnsureListeners() {
  if (_mbListenersAdded) return;
  _mbListenersAdded = true;
  document.addEventListener('mousemove', _mbMouseMove);
  document.addEventListener('mouseup',   _mbMouseUp);
  document.addEventListener('keydown',   _mbFsKeyDown);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && _mbFullscreen) {
      _mbFullscreen = false;
      document.body.classList.remove('mb-fullscreen');
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.mb-view-menu')) {
      const dd = document.getElementById('mb-view-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
  // Inject the floating fullscreen exit button once
  if (!document.getElementById('mb-fs-btn')) {
    const btn = document.createElement('button');
    btn.id = 'mb-fs-btn';
    btn.className = 'btn btn-sm mb-fs-btn';
    btn.setAttribute('aria-label', 'Exit fullscreen');
    btn.innerHTML = '⛶ <span class="mb-fs-label">Exit Fullscreen</span>';
    btn.onclick = _mbExitFullscreen;
    document.body.appendChild(btn);
  }
}

function _mbItemMouseDown(e, boardId, itemId) {
  if (e.button !== 0) return; // ignore right-click
  // Let buttons, inputs, audio, video, iframe handle their own events
  const tag = e.target.tagName;
  if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT' ||
      tag === 'AUDIO' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'A') return;
  // Let resize handle fire
  if (e.target.classList.contains('mb-item-resize')) return;
  e.preventDefault();
  e.stopPropagation();
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  const it = (b?.items||[]).find(x => x.id === itemId);
  if (!it) return;
  const vs = _mbViewState[boardId] || { panX:0, panY:0, zoom:1 };
  _mbDrag = { mode:'item', boardId, itemId, startCX:e.clientX, startCY:e.clientY, origX:it.x||0, origY:it.y||0, zoom:vs.zoom };
  const el = document.querySelector(`.mb-item[data-itemid="${itemId}"]`);
  if (el) el.classList.add('mb-active');
  // Disable pointer events on iframes and videos so they don't swallow mouseup during drag
  document.querySelectorAll('.mb-item iframe, .mb-item video').forEach(f => { f.style.pointerEvents = 'none'; });
}

function _mbResizeStart(e, boardId, itemId) {
  e.preventDefault();
  e.stopPropagation();
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  const it = (b?.items||[]).find(x => x.id === itemId);
  if (!it) return;
  const el = document.querySelector(`.mb-item[data-itemid="${itemId}"]`);
  const vs = _mbViewState[boardId] || { panX:0, panY:0, zoom:1 };
  _mbDrag = { mode:'resize', boardId, itemId, startCX:e.clientX, origW:it.w || el?.offsetWidth || 260, zoom:vs.zoom };
}

function _mbToggleBgReposition() {
  _mbBgReposition = !_mbBgReposition;
  const wrap = document.getElementById('mb-canvas-wrap');
  if (wrap) wrap.classList.toggle('mb-bg-reposition-mode', _mbBgReposition);
  // Update button highlight without full re-render
  document.querySelectorAll('.mb-canvas-toolbar .btn').forEach(btn => {
    if (btn.textContent.includes('Position')) btn.classList.toggle('mb-view-toggle-on', _mbBgReposition);
  });
}

function _mbWrapMouseDown(e) {
  if (e.target.closest('.mb-item') || e.target.closest('.mb-zoom-controls') || e.target.closest('.mb-canvas-toolbar')) return;
  e.preventDefault();
  const boardId = _currentMoodboardId;
  if (!boardId) return;

  if (_mbBgReposition) {
    const b = (store.moodboards||[]).find(x => x.id === boardId);
    if (!b) return;
    const pos = b.bgOffset || { x: 0, y: 0 };
    _mbDrag = { mode:'bgpos', boardId, startCX:e.clientX, startCY:e.clientY, origX:pos.x, origY:pos.y };
    return;
  }

  const vs = _mbViewState[boardId] || { panX:0, panY:0, zoom:1 };
  _mbDrag = { mode:'pan', boardId, startCX:e.clientX, startCY:e.clientY, origPX:vs.panX, origPY:vs.panY };
  const wrap = document.getElementById('mb-canvas-wrap');
  if (wrap) wrap.classList.add('panning');
}

function _mbMouseMove(e) {
  if (!_mbDrag) return;
  _mbLastMoveE = e;
  if (!_mbRafPending) {
    _mbRafPending = true;
    requestAnimationFrame(_mbApplyMove);
  }
}
function _mbApplyMove() {
  _mbRafPending = false;
  const e = _mbLastMoveE;
  if (!e || !_mbDrag) return;
  const dx = e.clientX - _mbDrag.startCX;
  const dy = e.clientY - _mbDrag.startCY;
  const vs = _mbViewState[_mbDrag.boardId];
  if (!vs) return;

  if (_mbDrag.mode === 'item') {
    const scale = _mbDrag.zoom;
    const newX = _mbDrag.origX + dx / scale;
    const newY = _mbDrag.origY + dy / scale;
    const el = document.querySelector(`.mb-item[data-itemid="${_mbDrag.itemId}"]`);
    if (el) { el.style.left = newX + 'px'; el.style.top = newY + 'px'; }

  } else if (_mbDrag.mode === 'pan') {
    vs.panX = _mbDrag.origPX + dx;
    vs.panY = _mbDrag.origPY + dy;
    const canvas = document.getElementById('mb-canvas');
    if (canvas) canvas.style.transform = `translate(${vs.panX}px,${vs.panY}px) scale(${vs.zoom})`;

  } else if (_mbDrag.mode === 'resize') {
    const newW = Math.max(160, _mbDrag.origW + dx / (_mbDrag.zoom));
    const el = document.querySelector(`.mb-item[data-itemid="${_mbDrag.itemId}"]`);
    if (el) el.style.width = newW + 'px';

  } else if (_mbDrag.mode === 'bgpos') {
    const offsetX = _mbDrag.origX + dx;
    const offsetY = _mbDrag.origY + dy;
    const wrap = document.getElementById('mb-canvas-wrap');
    if (wrap) wrap.style.backgroundPosition = `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`;
  }
}

function _mbMouseUp(e) {
  if (!_mbDrag) return;
  const { mode, boardId, itemId } = _mbDrag;

  if (mode === 'item' || mode === 'resize') {
    const b = (store.moodboards||[]).find(x => x.id === boardId);
    const it = (b?.items||[]).find(x => x.id === itemId);
    const el = document.querySelector(`.mb-item[data-itemid="${itemId}"]`);
    if (it && el) {
      if (mode === 'item') { it.x = parseFloat(el.style.left)||0; it.y = parseFloat(el.style.top)||0; }
      if (mode === 'resize') { it.w = parseFloat(el.style.width)||260; }
      saveStore();
    }
    if (el) el.classList.remove('mb-active');

  } else if (mode === 'bgpos') {
    const b = (store.moodboards||[]).find(x => x.id === boardId);
    if (b) {
      b.bgOffset = { x: _mbDrag.origX + (e.clientX - _mbDrag.startCX), y: _mbDrag.origY + (e.clientY - _mbDrag.startCY) };
      clearTimeout(window._mbBgSaveTimer);
      window._mbBgSaveTimer = setTimeout(() => saveStore(), 400);
    }

  } else if (mode === 'pan') {
    const wrap = document.getElementById('mb-canvas-wrap');
    if (wrap) wrap.classList.remove('panning');
  }
  _mbDrag = null;
  _mbLastMoveE = null;
  // Restore iframe/video pointer events after any drag ends
  document.querySelectorAll('.mb-item iframe, .mb-item video').forEach(f => { f.style.pointerEvents = ''; });
}

function _mbWheel(e) {
  e.preventDefault();
  const boardId = _currentMoodboardId;
  if (!boardId) return;
  const vs = _mbViewState[boardId];
  if (!vs) return;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.max(0.08, Math.min(4, vs.zoom * factor));
  const wrap = document.getElementById('mb-canvas-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  vs.panX = mx - (mx - vs.panX) * (newZoom / vs.zoom);
  vs.panY = my - (my - vs.panY) * (newZoom / vs.zoom);
  vs.zoom = newZoom;
  const canvas = document.getElementById('mb-canvas');
  if (canvas) canvas.style.transform = `translate(${vs.panX}px,${vs.panY}px) scale(${vs.zoom})`;
  const pct = document.getElementById('mb-zoom-pct');
  if (pct) pct.textContent = Math.round(vs.zoom * 100) + '%';
}

function _mbZoomBy(delta) {
  const boardId = _currentMoodboardId;
  if (!boardId) return;
  const vs = _mbViewState[boardId];
  if (!vs) return;
  const wrap = document.getElementById('mb-canvas-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const newZoom = Math.max(0.08, Math.min(4, vs.zoom + delta));
  vs.panX = cx - (cx - vs.panX) * (newZoom / vs.zoom);
  vs.panY = cy - (cy - vs.panY) * (newZoom / vs.zoom);
  vs.zoom = newZoom;
  const canvas = document.getElementById('mb-canvas');
  if (canvas) canvas.style.transform = `translate(${vs.panX}px,${vs.panY}px) scale(${vs.zoom})`;
  const pct = document.getElementById('mb-zoom-pct');
  if (pct) pct.textContent = Math.round(vs.zoom * 100) + '%';
}

function _mbResetView(boardId) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  const items = b?.items?.filter(it => it.x != null) || [];

  if (!items.length) {
    // Nothing placed yet — just go to origin
    _mbViewState[boardId] = { panX: 60, panY: 60, zoom: 1 };
    const canvas = document.getElementById('mb-canvas');
    if (canvas) canvas.style.transform = `translate(60px,60px) scale(1)`;
    const pct = document.getElementById('mb-zoom-pct');
    if (pct) pct.textContent = '100%';
    return;
  }

  const wrap = document.getElementById('mb-canvas-wrap');
  if (!wrap) return;

  // Bounding box from item positions + DOM sizes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  items.forEach(it => {
    const el = document.getElementById('mb-item-' + it.id);
    const x = it.x || 0;
    const y = it.y || 0;
    const w = (el ? el.offsetWidth : null) || it.w || 260;
    const h = (el ? el.offsetHeight : null) || 220;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  const pad = 60;
  const contentW = maxX - minX + pad * 2;
  const contentH = maxY - minY + pad * 2;
  const viewW = wrap.offsetWidth;
  const viewH = wrap.offsetHeight;
  const zoom = Math.min(1, viewW / contentW, viewH / contentH);
  const panX = (viewW - contentW * zoom) / 2 - (minX - pad) * zoom;
  const panY = (viewH - contentH * zoom) / 2 - (minY - pad) * zoom;

  _mbViewState[boardId] = { panX, panY, zoom };
  const canvas = document.getElementById('mb-canvas');
  if (canvas) canvas.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
  const pct = document.getElementById('mb-zoom-pct');
  if (pct) pct.textContent = Math.round(zoom * 100) + '%';
}

function _mbToggleItemFlag(boardId, itemId, flag) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  const it = (b.items||[]).find(x => x.id === itemId);
  if (!it) return;
  it[flag] = !it[flag];
  const el = document.getElementById('mb-item-' + itemId);
  if (el) el.outerHTML = _mbItemHTML(boardId, it);
  saveStore();
}

function _mbSetBg(boardId, color) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  b.bg = color;
  const wrap = document.getElementById('mb-canvas-wrap');
  if (wrap) {
    wrap.style.background = color;
    wrap.classList.remove('mb-canvas-default');
  }
  clearTimeout(window._mbBgSaveTimer);
  window._mbBgSaveTimer = setTimeout(() => saveStore(), 400);
}

function _mbSetBgImage(boardId, file) {
  if (!file) return;
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  const reader = new FileReader();
  reader.onload = e => {
    b.bg = `url(${e.target.result})`;
    const wrap = document.getElementById('mb-canvas-wrap');
    if (wrap) { wrap.style.background = b.bg; wrap.style.backgroundSize = 'cover'; wrap.classList.remove('mb-canvas-default'); }
    saveStore();
    // Re-render toolbar to show ✕ Bg button
    if (_currentMoodboardId) showView('moodboards');
  };
  reader.readAsDataURL(file);
}

function _mbClearBg(boardId) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  b.bg = null;
  b.bgOffset = { x: 0, y: 0 };
  _mbBgReposition = false;
  const wrap = document.getElementById('mb-canvas-wrap');
  if (wrap) { wrap.style.background = ''; wrap.style.backgroundSize = ''; wrap.style.backgroundPosition = ''; wrap.classList.remove('mb-bg-reposition-mode'); wrap.classList.add('mb-canvas-default'); }
  saveStore();
  if (_currentMoodboardId) showView('moodboards');
}

function _mbSaveTitle(boardId, value) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  const v = value.trim();
  if (v) { b.title = v; saveStore(); }
}

function deleteMbItem(boardId, itemId) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  b.items = (b.items||[]).filter(it => it.id !== itemId);
  saveStore();
  renderMoodboards();
}

function updateMbCaption(boardId, itemId, caption) {
  const b = (store.moodboards||[]).find(x => x.id === boardId);
  if (!b) return;
  const it = (b.items||[]).find(x => x.id === itemId);
  if (it) it.caption = caption;
  saveStore();
}

// ── File attachment helpers ───────────────────────────────────────────────────
function getFilesForPerson(name) {
  if (!name) return [];
  const key = name.toLowerCase();
  return (store.files || []).filter(f => (f.people || []).some(p => p.toLowerCase() === key));
}

function getFilesForLocation(locationName) {
  if (!locationName) return [];
  const key = locationName.toLowerCase();
  return (store.files || []).filter(f =>
    fileCategories(f).includes('location') && (f.location || '').toLowerCase() === key
  );
}

function expandThumbHTML(f) {
  const preview = f.data && f.data.startsWith('data:image')
    ? `<img src="${f.data}" alt="${f.altText || f.name}">`
    : `<span>${FILE_CATEGORIES[fileCategories(f)[0]]?.icon || '📁'}</span>`;
  return `<div class="expand-photo-thumb" title="${f.name}" onclick="viewFile('${f.id}')">
    ${preview}
    <div class="expand-photo-actions">
      <span class="expand-photo-action-btn" onclick="event.stopPropagation();openManageFile('${f.id}')" title="Edit">✏️</span>
      <span class="expand-photo-action-btn" onclick="event.stopPropagation();openMoveFile(['${f.id}'],null)" title="Move">🔀</span>
      <span class="expand-photo-action-btn" onclick="event.stopPropagation();downloadFile('${f.id}')" title="Download">⬇️</span>
      <span class="expand-photo-action-btn danger" onclick="event.stopPropagation();openRemoveFiles(['${f.id}'],null)" title="Delete">🗑</span>
    </div>
  </div>`;
}

function photoStripHTML(files, colspan) {
  if (!files.length) {
    return `<tr class="expand-row"><td colspan="${colspan}"><div class="expand-photo-strip" style="color:var(--text3);font-size:12px;padding:14px;">No photos tagged yet.</div></td></tr>`;
  }
  const thumbs = files.map(expandThumbHTML).join('');
  return `<tr class="expand-row"><td colspan="${colspan}"><div class="expand-photo-strip">${thumbs}</div></td></tr>`;
}

// ── Contact project-role helpers ─────────────────────────────────────────────
function addContactProjectField(projectId, role) {
  const container = document.getElementById('edit-contact-projects-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'contact-project-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center';

  const sel = document.createElement('select');
  sel.className = 'form-select contact-project-select';
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = '— Select Project —';
  sel.appendChild(blankOpt);
  store.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.title;
    if (p.id === projectId) opt.selected = true;
    sel.appendChild(opt);
  });

  const input = document.createElement('input');
  input.className = 'form-input contact-role-input';
  input.placeholder = 'Role (e.g. Director, Gaffer)';
  input.value = role || '';
  const isCast = document.getElementById('edit-contact-type-cast')?.checked;
  const isCrew = document.getElementById('edit-contact-type-crew')?.checked;
  const listId = (isCast && !isCrew) ? 'cast-roles-datalist'
               : (!isCast && isCrew) ? 'roles-datalist'
               : 'all-roles-datalist';
  input.setAttribute('list', listId);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-sm btn-danger';
  btn.style.flexShrink = '0';
  btn.textContent = '✕';
  btn.addEventListener('click', () => {
    const contactName = document.getElementById('edit-contact-name-display')?.value?.trim();
    const pid = sel.value;
    const proj = pid ? store.projects.find(p => p.id === pid) : null;
    const doRemove = () => {
      if (contactName && pid) _pendingFullRemovals.push({ name: contactName, projectId: pid });
      row.remove();
    };
    if (contactName && proj && contactAppearsElsewhere(contactName, pid)) {
      showConfirmDialog(
        `This will remove <strong>${contactName}</strong> from <strong>${proj.title}</strong> completely, including any callsheet, cast, or crew entries. Continue?`,
        'Remove',
        doRemove
      );
    } else {
      doRemove();
    }
  });

  row.appendChild(sel);
  row.appendChild(input);
  row.appendChild(btn);
  container.appendChild(row);
}

function collectProjectRoles() {
  const rows = document.querySelectorAll('#edit-contact-projects-container .contact-project-row');
  const result = [];
  rows.forEach(row => {
    const projectId = row.querySelector('.contact-project-select')?.value;
    const role = row.querySelector('.contact-role-input')?.value?.trim();
    if (projectId) result.push({ projectId, role: role || 'Contact' });
  });
  return result;
}

// Contact photo strip — grouped by project with clear headers
function photoStripContactHTML(files, contactName, colspan) {
  if (!files.length) {
    return `<tr class="expand-row"><td colspan="${colspan}"><div style="padding:12px 16px;color:var(--text3);font-size:12px;font-family:var(--font-mono)">No photos tagged yet.</div></td></tr>`;
  }
  // Group photos by project (files store projectIds as array)
  const byProject = {};
  files.forEach(f => {
    const pid = (f.projectIds && f.projectIds.length) ? f.projectIds[0] : f.projectId;
    const proj = store.projects.find(p => p.id === pid);
    const key = proj ? proj.title : 'No Project';
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(f);
  });
  const groups = Object.entries(byProject);
  let inner = '';
  groups.forEach(([projTitle, projFiles]) => {
    const thumbs = projFiles.map(expandThumbHTML).join('');
    inner += `<div style="margin-bottom:12px">
      <div style="font-size:10.5px;color:var(--accent2);font-family:var(--font-mono);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border2)">${projTitle} <span style="color:var(--text3)">(${projFiles.length})</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${thumbs}</div>
    </div>`;
  });
  return `<tr class="expand-row"><td colspan="${colspan}"><div style="padding:12px 16px">${inner}</div></td></tr>`;
}

// Track which rows are expanded
const expandedContacts = new Set();
const expandedLocations = new Set();
let _highlightContact = null; // for global search highlight
let _highlightLocation = null;

function toggleContactExpand(name) {
  const key = name.toLowerCase();
  if (expandedContacts.has(key)) expandedContacts.delete(key);
  else expandedContacts.add(key);
  renderContacts();
}

function toggleLocationExpand(locationName, projectId) {
  const key = locationName + '|' + projectId;
  if (expandedLocations.has(key)) expandedLocations.delete(key);
  else expandedLocations.add(key);
  renderLocations();
}


function removeContact(name) {
  // Show confirmation modal instead of browser confirm
  document.getElementById('remove-contact-name').textContent = name;
  document.getElementById('remove-contact-name-hidden').value = name;
  openModal('modal-remove-contact');
}

function confirmRemoveContact() {
  const name = document.getElementById('remove-contact-name-hidden').value;
  closeModal('modal-remove-contact');

  // Fully remove from every project (cast, unit, extras, callsheet rows, contacts)
  store.projects.forEach(p => {
    fullyRemoveFromProject(name, p.id);
  });

  // Remove from global contacts store
  if (store.contacts) {
    store.contacts = store.contacts.filter(c => !c.name || c.name.toLowerCase() !== name.toLowerCase());
  }

  saveStore();
  renderContacts();
  showToast('Contact removed', 'success');
}

// ── Contact custom columns ────────────────────────────────────────────────────
let _pendingContactColumns = [];

function openContactColumnsModal() {
  _pendingContactColumns = JSON.parse(JSON.stringify(store.contactColumns || []));
  renderContactColumnsList();
  renderBuiltinColsVisibility();
  openModal('modal-contact-columns');
}

function renderBuiltinColsVisibility() {
  const el = document.getElementById('contact-builtin-cols');
  if (!el) return;
  const hidden = store.contactHiddenCols || [];
  el.innerHTML = CONTACT_BUILTIN_COLS.map(col => `
    <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;padding:3px 0">
      <input type="checkbox" ${!hidden.includes(col.id) ? 'checked' : ''} onchange="toggleContactColVisibility('${col.id}')">
      ${col.label}
    </label>`).join('');
}

function colHideBtn(colId) {
  return `<span class="col-hide-btn" onclick="event.stopPropagation();toggleContactColVisibility('${colId}')" title="Hide column"><svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 4C2.5 1.5 4 .5 6 .5S9.5 1.5 11 4C9.5 6.5 8 7.5 6 7.5S2.5 6.5 1 4z"/><circle cx="6" cy="4" r="1.8"/></svg></span>`;
}

function locColHideBtn(colId) {
  return `<span class="col-hide-btn" onclick="event.stopPropagation();toggleLocationColVisibility('${colId}')" title="Hide column"><svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 4C2.5 1.5 4 .5 6 .5S9.5 1.5 11 4C9.5 6.5 8 7.5 6 7.5S2.5 6.5 1 4z"/><circle cx="6" cy="4" r="1.8"/></svg></span>`;
}

function toggleContactColVisibility(colId) {
  if (!store.contactHiddenCols) store.contactHiddenCols = [];
  const idx = store.contactHiddenCols.indexOf(colId);
  if (idx >= 0) store.contactHiddenCols.splice(idx, 1);
  else store.contactHiddenCols.push(colId);
  saveStore();
  renderContacts();
}

function renderContactColumnsList() {
  const el = document.getElementById('contact-columns-list');
  if (!_pendingContactColumns.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">No columns yet — add one below</div>';
    return;
  }
  el.innerHTML = _pendingContactColumns.map((col, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:8px 10px;">
      <input class="form-input" value="${col.label.replace(/"/g,'&quot;')}" oninput="_pendingContactColumns[${i}].label=this.value" style="flex:1;font-size:12px;">
      <select class="form-select" onchange="_pendingContactColumns[${i}].type=this.value" style="width:100px;font-size:12px;">
        <option value="stars" ${col.type==='stars'?'selected':''}>★ Stars</option>
        <option value="text" ${col.type==='text'?'selected':''}>✏ Text</option>
      </select>
      <button class="btn btn-sm btn-ghost btn-danger" onclick="removeContactColumnRow(${i})">✕</button>
    </div>`).join('');
}

function addContactColumnRow() {
  _pendingContactColumns.push({ id: makeId(), label: 'New Column', type: 'text' });
  renderContactColumnsList();
}

function removeContactColumnRow(i) {
  _pendingContactColumns.splice(i, 1);
  renderContactColumnsList();
}

function saveContactColumns() {
  store.contactColumns = _pendingContactColumns.filter(c => c.label.trim());
  saveStore();
  closeModal('modal-contact-columns');
  renderContacts();
}

// ── Location columns ──────────────────────────────────────────────────────────
// ── Move/copy location data ───────────────────────────────────────────────────
let _mmlSource = null; // { projectId, locIdx }

function _getLocationObj(projectId, locIdx) {
  if (projectId === '_global') return (store.locations || [])[locIdx];
  return ((store.projects.find(p => p.id === projectId) || {}).locations || [])[locIdx];
}

function _allLocationTargets(excludeProjectId, excludeLocIdx) {
  const targets = [];
  store.projects.forEach(p => {
    (p.locations || []).forEach((l, i) => {
      if (l.name && !(p.id === excludeProjectId && i === excludeLocIdx))
        targets.push({ label: `${l.name} (${p.title})`, projectId: p.id, locIdx: i });
    });
  });
  (store.locations || []).forEach((l, i) => {
    if (l.name && !('_global' === excludeProjectId && i === excludeLocIdx))
      targets.push({ label: `${l.name} (Unlinked)`, projectId: '_global', locIdx: i });
  });
  return targets;
}

function openMoveLocation(projectId, locIdx) {
  const src = _getLocationObj(projectId, locIdx);
  if (!src) return;
  _mmlSource = { projectId, locIdx };
  document.getElementById('mml-source-name').textContent = src.name || 'Unnamed';
  const targets = _allLocationTargets(projectId, locIdx);
  if (!targets.length) { showToast('No other locations to transfer to', 'info'); return; }
  document.getElementById('mml-target').innerHTML = targets.map((t, i) =>
    `<option value="${i}">${t.label}</option>`).join('');
  document.getElementById('mml-target').dataset.targets = JSON.stringify(targets);
  openModal('modal-move-location');
}

const LOC_DATA_FIELDS = ['date','suit','cost','costPeriod','access','decision','notes','rules','contactName','contactPhone','contactEmail','suitability','info'];

function doLocationTransfer(andClear) {
  if (!_mmlSource) return;
  const src = _getLocationObj(_mmlSource.projectId, _mmlSource.locIdx);
  if (!src) return;
  const targets = JSON.parse(document.getElementById('mml-target').dataset.targets || '[]');
  const tidx = parseInt(document.getElementById('mml-target').value);
  const t = targets[tidx];
  if (!t) return;
  const dst = _getLocationObj(t.projectId, t.locIdx);
  if (!dst) return;
  LOC_DATA_FIELDS.forEach(f => { if (src[f] !== undefined) dst[f] = src[f]; });
  if (andClear) LOC_DATA_FIELDS.forEach(f => { delete src[f]; });
  saveStore();
  closeModal('modal-move-location');
  renderLocations();
  showToast(andClear ? 'Location data moved ✓' : 'Location data copied ✓', 'success');
}

let _pendingLocationColumns = [];

function openLocationColumnsModal() {
  _pendingLocationColumns = JSON.parse(JSON.stringify(store.locationColumns || []));
  renderLocationColumnsList();
  renderBuiltinLocColsVisibility();
  openModal('modal-location-columns');
}

function renderBuiltinLocColsVisibility() {
  const el = document.getElementById('location-builtin-cols');
  if (!el) return;
  const hidden = store.locationHiddenCols || [];
  el.innerHTML = LOCATION_BUILTIN_COLS.map(col => `
    <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;padding:3px 0">
      <input type="checkbox" ${!hidden.includes(col.id) ? 'checked' : ''} onchange="toggleLocationColVisibility('${col.id}')">
      ${col.label}
    </label>`).join('');
}

function toggleLocationColVisibility(colId) {
  if (!store.locationHiddenCols) store.locationHiddenCols = [];
  const idx = store.locationHiddenCols.indexOf(colId);
  if (idx >= 0) store.locationHiddenCols.splice(idx, 1);
  else store.locationHiddenCols.push(colId);
  saveStore();
  renderLocations();
}

function renderLocationColumnsList() {
  const el = document.getElementById('location-columns-list');
  if (!_pendingLocationColumns.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px 0">No columns yet — add one below</div>';
    return;
  }
  el.innerHTML = _pendingLocationColumns.map((col, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:8px 10px;">
      <input class="form-input" value="${col.label.replace(/"/g,'&quot;')}" oninput="_pendingLocationColumns[${i}].label=this.value" style="flex:1;font-size:12px;">
      <select class="form-select" onchange="_pendingLocationColumns[${i}].type=this.value" style="width:100px;font-size:12px;">
        <option value="stars" ${col.type==='stars'?'selected':''}>★ Stars</option>
        <option value="text" ${col.type==='text'?'selected':''}>✏ Text</option>
      </select>
      <button class="btn btn-sm btn-ghost btn-danger" onclick="removeLocationColumnRow(${i})">✕</button>
    </div>`).join('');
}

function addLocationColumnRow() {
  _pendingLocationColumns.push({ id: makeId(), label: 'New Column', type: 'text' });
  renderLocationColumnsList();
}

function removeLocationColumnRow(i) {
  _pendingLocationColumns.splice(i, 1);
  renderLocationColumnsList();
}

function saveLocationColumns() {
  store.locationColumns = _pendingLocationColumns.filter(c => c.label.trim());
  saveStore();
  closeModal('modal-location-columns');
  renderLocations();
}

function setLocationRating(name, colId, value) {
  if (!store.locationCustomData) store.locationCustomData = {};
  const key = name.toLowerCase();
  if (!store.locationCustomData[key]) store.locationCustomData[key] = {};
  store.locationCustomData[key][colId] = value;
  saveStore();
  renderLocations();
}

function openLocationTextEdit(cell, name, colId) {
  const current = (store.locationCustomData?.[name.toLowerCase()] || {})[colId] || '';
  const textarea = document.createElement('textarea');
  textarea.className = 'form-textarea';
  textarea.value = current;
  textarea.style.cssText = 'width:100%;min-height:60px;font-size:12px;resize:vertical;';
  cell.innerHTML = '';
  cell.appendChild(textarea);
  textarea.focus();
  const save = () => {
    if (!store.locationCustomData) store.locationCustomData = {};
    const key = name.toLowerCase();
    if (!store.locationCustomData[key]) store.locationCustomData[key] = {};
    store.locationCustomData[key][colId] = textarea.value.trim();
    saveStore();
    renderLocations();
  };
  textarea.addEventListener('blur', save);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { cell.textContent = current; }
  });
}

function setContactRating(name, colId, value) {
  if (!store.contactCustomData) store.contactCustomData = {};
  const key = name.toLowerCase();
  if (!store.contactCustomData[key]) store.contactCustomData[key] = {};
  store.contactCustomData[key][colId] = value;
  saveStore();
  renderContacts();
}

function openContactTextEdit(cell, name, colId) {
  const current = (store.contactCustomData?.[name.toLowerCase()] || {})[colId] || '';
  const textarea = document.createElement('textarea');
  textarea.value = current;
  textarea.style.cssText = 'width:160px;min-width:120px;font-size:11px;background:var(--surface);border:1px solid var(--accent);border-radius:3px;padding:4px 6px;color:var(--text);resize:none;height:56px;outline:none;';
  textarea.onclick = e => e.stopPropagation();
  const save = () => {
    if (!store.contactCustomData) store.contactCustomData = {};
    const key = name.toLowerCase();
    if (!store.contactCustomData[key]) store.contactCustomData[key] = {};
    store.contactCustomData[key][colId] = textarea.value.trim();
    saveStore();
    renderContacts();
  };
  textarea.onblur = save;
  textarea.onkeydown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); renderContacts(); }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textarea.blur(); }
  };
  cell.innerHTML = '';
  cell.style.padding = '4px';
  cell.appendChild(textarea);
  textarea.focus();
  textarea.select();
}

function addNewContact() {
  if (contactSubView === 'locations') { addNewLocationContact(); return; }
  _pendingFullRemovals = [];
  refreshRolesDatalist();
  // Clear all fields and open the edit modal for a brand-new contact
  document.getElementById('edit-contact-name').value = '';
  document.getElementById('edit-contact-name-display').value = '';
  document.getElementById('edit-contact-phone').value = '';
  document.getElementById('edit-contact-email').value = '';
  document.getElementById('edit-contact-type-cast').checked = false;
  document.getElementById('edit-contact-type-crew').checked = false;
  ecClearRoles();
  ecToggleRoleSections();
  const socialsContainer = document.getElementById('edit-contact-socials-container');
  socialsContainer.innerHTML = '';
  addSocialField('edit-contact-socials-container', 'instagram', '');
  document.getElementById('edit-contact-projects-container').innerHTML = '';
  openModal('modal-edit-contact');
}

function editContact(name) {
  _pendingFullRemovals = [];
  refreshRolesDatalist();
  // Use the cached contact data built by renderContacts (same aggregation as what's displayed)
  const cached = _cachedContacts.find(c => c.name.toLowerCase() === name.toLowerCase());
  let phone       = cached ? cached.phone       || '' : '';
  let email       = cached ? cached.email       || '' : '';
  let socials     = cached ? cached.socials     || '' : '';
  let type        = cached ? cached.type        || '' : '';
  let defaultRole = cached ? cached.defaultRole || '' : '';

  // Populate the socials container
  const socialsContainer = document.getElementById('edit-contact-socials-container');
  socialsContainer.innerHTML = '';

  if (socials) {
    // Socials stored as "platform||handle,platform||handle"
    const socialParts = socials.split(',').map(s => s.trim()).filter(Boolean);
    socialParts.forEach(s => {
      const sepIdx = s.indexOf('||');
      const platform = sepIdx >= 0 ? s.slice(0, sepIdx) : 'instagram';
      const handle   = sepIdx >= 0 ? s.slice(sepIdx + 2) : s;
      addSocialField('edit-contact-socials-container', platform || 'instagram', handle || '');
    });
  } else {
    addSocialField('edit-contact-socials-container', 'instagram', '');
  }

  // Populate project-role associations — all projects (manual + auto-detected)
  const projectsContainer = document.getElementById('edit-contact-projects-container');
  projectsContainer.innerHTML = '';
  const shownProjects = new Set();
  const projectIds = cached ? cached.projectIds || [] : [];
  projectIds.forEach(pid => {
    if (shownProjects.has(pid)) return;
    shownProjects.add(pid);
    const p = store.projects.find(pr => pr.id === pid);
    if (!p) return;
    const nameLc = name.toLowerCase();
    const contact = (p.contacts || []).find(c => c.name && c.name.toLowerCase() === nameLc);
    if (contact && contact.manual) {
      // One row per explicitly-assigned role
      const roles = contact.roles && contact.roles.length ? contact.roles : ['Contact'];
      roles.forEach(r => addContactProjectField(p.id, r));
    } else {
      // Auto-detected: derive best role from unit/cast/callsheet
      let role = '';
      if (contact && contact.roles && contact.roles.length) {
        role = contact.roles.find(r => r && r !== 'Contact') || contact.roles[0];
      }
      if (!role) {
        const ur = (p.unit || []).find(r => r.name && r.name.toLowerCase() === nameLc);
        if (ur) role = ur.role || 'Crew';
      }
      if (!role && (p.cast || []).some(r => r.name && r.name.toLowerCase() === nameLc)) role = 'Cast';
      if (!role && (p.extras || []).some(r => r.name && r.name.toLowerCase() === nameLc)) role = 'Extra';
      if (!role) {
        for (const cs of (p.callsheets || [])) {
          if ((cs.castRows || []).some(r => r.actor && r.actor.toLowerCase() === nameLc)) { role = 'Cast'; break; }
          const cf = (cs.customFields || []).find(f => f.value && f.value.toLowerCase() === nameLc);
          if (cf) { role = cf.label || 'Crew'; break; }
        }
      }
      addContactProjectField(p.id, role || 'Crew');
    }
  });

  document.getElementById('edit-contact-name').value = name;
  document.getElementById('edit-contact-name-display').value = name;
  document.getElementById('edit-contact-phone').value = phone;
  document.getElementById('edit-contact-email').value = email;
  const typeArr = (type || '').split(',').map(t => t.trim());
  document.getElementById('edit-contact-type-cast').checked = typeArr.includes('cast');
  document.getElementById('edit-contact-type-crew').checked = typeArr.includes('crew');

  // Populate cast/crew role chips
  ecClearRoles();
  let storedCastRoles = cached?.castRoles || [];
  let storedCrewRoles = cached?.crewRoles || [];
  // Backward compat: if no new arrays but has defaultRole, assign to appropriate type
  if (!storedCastRoles.length && !storedCrewRoles.length && defaultRole) {
    if (typeArr.includes('cast') && !typeArr.includes('crew')) {
      storedCastRoles = defaultRole.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      storedCrewRoles = defaultRole.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  storedCastRoles.forEach(r => {
    document.getElementById('ec-cast-role-input').value = r;
    ecAddRole('cast');
  });
  storedCrewRoles.forEach(r => {
    document.getElementById('ec-crew-role-input').value = r;
    ecAddRole('crew');
  });
  ecToggleRoleSections();
  openModal('modal-edit-contact');
}

function saveEditedContact() {
  // Use display name — the hidden field is the old lookup key (empty for new contacts)
  const oldName = document.getElementById('edit-contact-name').value;
  const name = document.getElementById('edit-contact-name-display').value.trim();
  const phone = document.getElementById('edit-contact-phone').value.trim();
  const email = document.getElementById('edit-contact-email').value.trim();
  const socials = collectSocials('edit-contact-socials-container');
  const typeArr = [];
  if (document.getElementById('edit-contact-type-cast').checked) typeArr.push('cast');
  if (document.getElementById('edit-contact-type-crew').checked) typeArr.push('crew');
  const castRoles = ecGetRoles('cast');
  const crewRoles = ecGetRoles('crew');
  const defaultRole = [...castRoles, ...crewRoles].join(', ');
  if (!typeArr.length && castRoles.length) typeArr.push('cast');
  else if (!typeArr.length && crewRoles.length) typeArr.push('crew');
  const type = typeArr.join(',');
  const projectRoles = collectProjectRoles();

  if (!name) {
    showToast('Name required', 'error');
    return;
  }

  // Collect all roles per project from the UI rows (supports multiple rows per project)
  const rolesByProject = {};
  projectRoles.forEach(pr => {
    if (!rolesByProject[pr.projectId]) rolesByProject[pr.projectId] = [];
    const r = pr.role.trim();
    if (r && !rolesByProject[pr.projectId].includes(r)) rolesByProject[pr.projectId].push(r);
  });

  // Update persistent contacts across all projects
  store.projects.forEach(p => {
    // Support name changes: find by old name if changed, else by new name
    const lookupName = oldName || name;
    const contactIdx = (p.contacts || []).findIndex(c => c.name && c.name.toLowerCase() === lookupName.toLowerCase());
    const rolesForProject = rolesByProject[p.id];

    if (rolesForProject) {
      // Explicitly assigned roles for this project
      if (contactIdx >= 0) {
        p.contacts[contactIdx] = { ...p.contacts[contactIdx], name, phone, email, socials, type, defaultRole, castRoles, crewRoles, roles: rolesForProject, manual: true };
      } else {
        // Only add a new p.contacts entry if the contact is NOT already auto-detected
        // from p.cast/p.unit/p.extras — renaming those is handled in the loop below
        const lkLower = lookupName.toLowerCase();
        const isAutoDetected =
          (p.cast||[]).some(r => r.name && r.name.toLowerCase() === lkLower) ||
          (p.unit||[]).some(r => r.name && r.name.toLowerCase() === lkLower) ||
          (p.extras||[]).some(r => r.name && r.name.toLowerCase() === lkLower);
        if (!isAutoDetected) {
          if (!p.contacts) p.contacts = [];
          p.contacts.push({ name, roles: rolesForProject, phone, email, socials, type, defaultRole, castRoles, crewRoles, manual: true });
        }
      }
    } else if (contactIdx >= 0) {
      if (p.contacts[contactIdx].manual) {
        // Was manually linked to this project — no rows remain for it, so unlink them
        p.contacts.splice(contactIdx, 1);
      } else {
        // Auto-detected from cast/unit/callsheet — update info but don't unlink
        p.contacts[contactIdx].name = name;
        p.contacts[contactIdx].phone = phone;
        p.contacts[contactIdx].email = email;
        p.contacts[contactIdx].socials = socials;
        p.contacts[contactIdx].type = type;
        p.contacts[contactIdx].castRoles = castRoles;
        p.contacts[contactIdx].crewRoles = crewRoles;
      }
    }
  });

  // If contact has no project links, save to global store.contacts as fallback
  if (!store.contacts) store.contacts = [];
  const globalIdx = store.contacts.findIndex(c => c.name && c.name.toLowerCase() === (oldName || name).toLowerCase());
  if (Object.keys(rolesByProject).length === 0) {
    // No project assignments — persist in global contacts
    if (globalIdx >= 0) {
      store.contacts[globalIdx] = { ...store.contacts[globalIdx], name, phone, email, socials, type, defaultRole, castRoles, crewRoles };
    } else {
      store.contacts.push({ name, phone, email, socials, type, defaultRole, castRoles, crewRoles });
    }
  } else if (globalIdx >= 0) {
    // Was global, now has project links — update info and keep in global too (for info sync)
    store.contacts[globalIdx] = { ...store.contacts[globalIdx], name, phone, email, socials, type, defaultRole, castRoles, crewRoles };
  }

  // Also update callsheet and personnel data (match on old name to handle renames)
  const lookupKey = (oldName || name).toLowerCase();
  store.projects.forEach(p => {
    (p.callsheets || []).forEach(cs => {
      (cs.castRows || []).forEach(r => {
        if (r.actor && r.actor.toLowerCase() === lookupKey) {
          r.contact = phone || '';
        }
      });
      (cs.customFields || []).forEach(cf => {
        if (cf.value && cf.value.toLowerCase() === lookupKey) {
          cf.phone = phone;
          cf.email = email;
        }
      });
    });
    (p.cast || []).forEach(r => {
      if (r.name && r.name.toLowerCase() === lookupKey) {
        r.name = name;
        r.number = phone;
        r.email = email;
      }
    });
    (p.extras || []).forEach(r => {
      if (r.name && r.name.toLowerCase() === lookupKey) {
        r.name = name;
        r.number = phone;
        r.email = email;
      }
    });
    (p.unit || []).forEach(r => {
      if (r.name && r.name.toLowerCase() === lookupKey) {
        r.name = name;
        r.number = phone;
        r.email = email;
      }
    });
  });

  // Process any confirmed full project removals
  _pendingFullRemovals.forEach(({ name: rName, projectId }) => {
    fullyRemoveFromProject(rName || name, projectId);
  });
  _pendingFullRemovals = [];

  saveStore();

  // If we came from the file-tagging modal, add the person tag and return to that modal
  if (_mfNewPersonCallback !== null) {
    const savedName = document.getElementById('edit-contact-name-display').value.trim() || _mfNewPersonCallback;
    const cbName = _mfNewPersonCallback;
    _mfNewPersonCallback = null;
    closeModal('modal-edit-contact');
    // Restore modal title
    const h3 = document.getElementById('edit-contact-modal-title');
    if (h3) h3.textContent = 'Edit Contact';
    // Add the person tag (with role from the saved contact)
    const allRoles = [...castRoles, ...crewRoles];
    mfAddPersonTagDirect(savedName || cbName, allRoles[0] || '');
    showToast('Contact created', 'success');
    return;
  }

  closeModal('modal-edit-contact');
  renderContacts();
  showToast('Contact updated', 'success');
}

function contactAppearsElsewhere(name, projectId) {
  const p = store.projects.find(proj => proj.id === projectId);
  if (!p) return false;
  return isPersonStillInProject(p, name);
}

function fullyRemoveFromProject(name, projectId) {
  const p = store.projects.find(proj => proj.id === projectId);
  if (!p) return;
  const key = name.toLowerCase();
  p.contacts = (p.contacts || []).filter(c => (c.name || '').toLowerCase() !== key);
  p.cast     = (p.cast     || []).filter(c => (c.name || '').toLowerCase() !== key);
  p.extras   = (p.extras   || []).filter(c => (c.name || '').toLowerCase() !== key);
  p.unit     = (p.unit     || []).filter(c => (c.name || '').toLowerCase() !== key);
  (p.callsheets || []).forEach(cs => {
    cs.castRows    = (cs.castRows    || []).filter(r => (r.actor || '').toLowerCase() !== key);
    cs.customFields = (cs.customFields || []).filter(cf => (cf.value || '').toLowerCase() !== key);
  });
}

function showConfirmDialog(message, confirmLabel, onConfirm, opts = {}) {
  const triggerEl = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  if (opts.zIndex) overlay.style.zIndex = opts.zIndex;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="_cdTitle" style="max-width:400px">
      <div class="modal-header">
        <h3 id="_cdTitle">${opts.title || confirmLabel}</h3>
        <button class="modal-close" aria-label="Close" id="_cdClose">✕</button>
      </div>
      <p style="color:var(--text2);font-size:13px;line-height:1.65;margin:4px 0 0">${message}</p>
      <div class="form-actions">
        <button class="btn btn-sm" id="_cdCancel">Cancel</button>
        ${(opts.extraButtons||[]).map((b,i) => `<button class="btn btn-sm ${b.btnClass||''}" id="_cdExtra${i}">${b.label}</button>`).join('')}
        <button class="btn btn-sm ${opts.btnClass||'btn-danger'}" id="_cdConfirm">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); if (triggerEl) triggerEl.focus(); };
  overlay.querySelector('#_cdClose').onclick  = close;
  overlay.querySelector('#_cdCancel').onclick = close;
  overlay.querySelector('#_cdConfirm').onclick = () => { close(); onConfirm(); };
  (opts.extraButtons||[]).forEach((b,i) => {
    overlay.querySelector(`#_cdExtra${i}`).onclick = () => { close(); b.onClick(); };
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const els = [...overlay.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
      const first = els[0], last = els[els.length-1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      }
    }
  });
  setTimeout(() => { const c = overlay.querySelector('#_cdCancel'); if (c) c.focus(); }, 50);
}

function showPromptDialog(message, confirmLabel, onConfirm, opts = {}) {
  const triggerEl = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  if (opts.zIndex) overlay.style.zIndex = opts.zIndex;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="_pdTitle" style="max-width:400px">
      <div class="modal-header">
        <h3 id="_pdTitle">${opts.title || 'Input Required'}</h3>
        <button class="modal-close" aria-label="Close" id="_pdClose">✕</button>
      </div>
      <p style="color:var(--text2);font-size:13px;line-height:1.65;margin:4px 0 12px">${message}</p>
      <div class="form-group" id="_pdFormWrap">
        <!-- inputs injected here -->
      </div>
      <div class="form-actions">
        <button class="btn btn-sm" id="_pdCancel">Cancel</button>
        <button class="btn btn-sm ${opts.btnClass || 'btn-primary'}" id="_pdConfirm">${confirmLabel}</button>
      </div>
    </div>`;
  
  const formWrap = overlay.querySelector('#_pdFormWrap');
  const fields = opts.fields || [{ id: '_pdVal', label: '', placeholder: '', value: opts.defaultValue || '' }];
  
  fields.forEach(f => {
    const group = document.createElement('div');
    group.className = 'form-group';
    if (f.label) group.innerHTML = `<label class="form-label">${f.label}</label>`;
    
    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'form-textarea';
      input.style.minHeight = '100px';
    } else {
      input = document.createElement('input');
      input.className = 'form-input';
    }
    
    input.id = f.id;
    input.placeholder = f.placeholder || '';
    input.value = f.value || '';
    input.autocomplete = 'off';
    group.appendChild(input);
    formWrap.appendChild(group);
  });

  document.body.appendChild(overlay);
  
  const close = () => { overlay.remove(); if (triggerEl) triggerEl.focus(); };
  const submit = () => {
    const vals = {};
    fields.forEach(f => { vals[f.id] = overlay.querySelector('#' + f.id).value.trim(); });
    close();
    onConfirm(fields.length === 1 ? vals[fields[0].id] : vals);
  };

  overlay.querySelector('#_pdClose').onclick = close;
  overlay.querySelector('#_pdCancel').onclick = close;
  overlay.querySelector('#_pdConfirm').onclick = submit;
  
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Enter') {
      // Don't submit on Enter if we are in a textarea
      if (e.target.tagName === 'TEXTAREA') return;
      e.preventDefault(); submit(); return;
    }
    if (e.key === 'Tab') {
      const els = [...overlay.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
      const first = els[0], last = els[els.length-1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      }
    }
  });
  
  setTimeout(() => { 
    const firstInp = overlay.querySelector('input');
    if (firstInp) { firstInp.focus(); firstInp.select(); }
  }, 50);
}

// ══════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════
