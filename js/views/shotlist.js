// ══════════════════════════════════════════
// VIRTUAL SCROLLING UTILITY
// ══════════════════════════════════════════

const VirtualScroll = (function() {
  const instances = new Map();
  
  function create(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const config = {
      itemHeight: options.itemHeight || 40,
      buffer: options.buffer || 5,
      renderItem: options.renderItem || (() => ''),
      onScroll: options.onScroll || null,
      totalItems: 0
    };
    
    let scrollTop = 0;
    let containerHeight = 0;
    
    function updateDimensions() {
      containerHeight = container.clientHeight;
    }
    
    function render() {
      updateDimensions();
      const totalHeight = config.totalItems * config.itemHeight;
      const startIdx = Math.max(0, Math.floor(scrollTop / config.itemHeight) - config.buffer);
      const endIdx = Math.min(config.totalItems, Math.ceil((scrollTop + containerHeight) / config.itemHeight) + config.buffer);
      
      // Create spacer elements
      const html = [];
      
      // Top spacer
      if (startIdx > 0) {
        html.push(`<div style="height: ${startIdx * config.itemHeight}px;"></div>`);
      }
      
      // Render visible items
      for (let i = startIdx; i < endIdx; i++) {
        html.push(config.renderItem(i));
      }
      
      // Bottom spacer
      if (endIdx < config.totalItems) {
        html.push(`<div style="height: ${(config.totalItems - endIdx) * config.itemHeight}px;"></div>`);
      }
      
      container.innerHTML = html.join('');
    }
    
    function handleScroll(e) {
      scrollTop = e.target.scrollTop;
      render();
      if (config.onScroll) {
        config.onScroll(scrollTop);
      }
    }
    
    function setTotalItems(count) {
      config.totalItems = count;
      render();
    }
    
    function scrollToIndex(index) {
      container.scrollTop = index * config.itemHeight;
      scrollTop = container.scrollTop;
      render();
    }
    
    function destroy() {
      container.removeEventListener('scroll', handleScroll);
      instances.delete(containerId);
    }
    
    // Attach scroll listener
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    const instance = {
      setTotalItems,
      scrollToIndex,
      render,
      destroy,
      get config() { return config; }
    };
    
    instances.set(containerId, instance);
    return instance;
  }
  
  function get(containerId) {
    return instances.get(containerId);
  }
  
  function destroy(containerId) {
    const inst = instances.get(containerId);
    if (inst) inst.destroy();
  }
  
  return { create, get, destroy };
})();

// Export to global
window.VirtualScroll = VirtualScroll;

// ══════════════════════════════════════════
// SHOT LIST
// ══════════════════════════════════════════

// Smart time estimation based on shot complexity
function _calcSmartTime(shot) {
  let setupTime = 15;
  let shootTime = 20;
  
  // Movement complexity
  const movementComplex = {
    'Stationary': 1,
    'Pan': 1.1,
    'Tilt': 1.1,
    'Handheld': 1.3,
    'Dolly': 1.5,
    'Crane': 1.8,
    'Gimbal': 1.4,
    'Tracking': 1.6
  };
  const moveMult = movementComplex[shot.movement] || 1;
  setupTime = Math.round(setupTime * moveMult);
  
  // Shot type complexity
  const typeComplex = {
    'Wide': 0.8,
    'Establishing': 0.7,
    'Mid/Medium': 1,
    'Close-Up': 0.9,
    'Extreme Close-Up': 0.8,
    'Over-the-Shoulder': 1.1,
    'POV/Point of View': 1.2,
    'Insert': 0.6,
    'Aerial': 2.0,
    'B-Roll': 0.7
  };
  const typeMult = typeComplex[shot.type] || 1;
  shootTime = Math.round(shootTime * typeMult);
  
  // Sound considerations
  if (shot.sound === 'MOS') {
    shootTime = Math.round(shootTime * 0.8); // Faster without sync sound
  } else if (shot.sound === 'Yes') {
    setupTime += 10; // Extra time for sound setup
  }
  
  // Cast count impact
  const castCount = (shot.cast || '').split(',').filter(Boolean).length;
  if (castCount > 3) {
    setupTime += (castCount - 3) * 5; // Extra 5 min per additional cast
  }
  
  return { setuptime: setupTime, shoottime: shootTime };
}

// Recalculate time estimates for all shots
function recalcAllShotTimes() {
  const p = currentProject();
  if (!p || !p.shots || !p.shots.length) {
    showToast('No shots to recalculate', 'info');
    return;
  }
  
  let updated = 0;
  p.shots.forEach(shot => {
    const times = _calcSmartTime(shot);
    shot.setuptime = String(times.setuptime);
    shot.shoottime = String(times.shoottime);
    updated++;
  });
  
  saveStore();
  renderShotList(p);
  showToast(`Recalculated times for ${updated} shots`, 'success');
}

// Optimize shot order - group by location, then INT/EXT+TOD, then movement
function optimizeShotOrder() {
  const p = currentProject();
  if (!p || !p.shots || !p.shots.length) {
    showToast('No shots to optimize', 'info');
    return;
  }
  
  // Priority: location > extint > movement > scene > setup > shot
  const priority = (shot) => {
    const loc = (shot.location || '').toLowerCase();
    const extint = shot.extint || 'INT DAY';
    const move = shot.movement || 'Stationary';
    const scene = parseInt(shot.scene) || 0;
    const setup = parseInt(shot.setup) || 1;
    const num = parseInt(shot.num) || 1;
    return `${loc}|${extint}|${move}|${String(scene).padStart(3,'0')}|${String(setup).padStart(2,'0')}|${String(num).padStart(2,'0')}`;
  };
  
  const sorted = [...p.shots].sort((a, b) => priority(a).localeCompare(priority(b)));
  p.shots = sorted;
  
  saveStore();
  renderShotList(p);
  showToast('Shots optimized: grouped by location → lighting → movement', 'success');
}

// Select all shots
function _shotSelectAll() {
  document.querySelectorAll('.shot-cb').forEach(cb => cb.checked = true);
}

// Remove selected shots
function _shotRemoveSelected() {
  const checked = document.querySelectorAll('.shot-cb:checked');
  if (!checked.length) {
    showToast('No shots selected', 'info');
    return;
  }
  showConfirmDialog(`Remove ${checked.length} selected shot${checked.length > 1 ? 's' : ''}?`, 'Remove', () => {
    const p = currentProject();
    const indices = [...checked].map(cb => parseInt(cb.dataset.idx)).sort((a, b) => b - a);
    indices.forEach(i => p.shots.splice(i, 1));
    saveStore();
    renderShotList(p);
    showToast(`Removed ${indices.length} shot${indices.length > 1 ? 's' : ''}`, 'success');
  });
}

// Generate shots from script breakdown
function generateShotsFromBreakdown() {
  const p = currentProject();
  if (!p) return;
  
  const bd = _getActiveBd(p);
  if (!bd?.rawText) {
    showToast('No script breakdown found. Import a script first.', 'info');
    return;
  }
  
  const scenes = parseBreakdownScenes(bd.rawText);
  if (!scenes.length) {
    showToast('No scenes found in breakdown.', 'info');
    return;
  }
  
  if (!p.shots) p.shots = [];
  
  const sceneData = _sbBuildSceneData(p);
  let added = 0;
  
  scenes.forEach((scene, idx) => {
    const existingShots = p.shots.filter(s => s.sceneKey === scene.heading);
    if (existingShots.length > 0) return;
    
    const dataEntry = sceneData[scene.heading];
    const castList = dataEntry?.cast?.join(', ') || '';
    const location = scene.location || '';
    const intExt = scene.intExt || 'INT';
    const tod = scene.tod || 'DAY';
    const extint = `${intExt} ${tod}`.trim();
    
    const suggestedShots = [
      { type: 'Wide', movement: 'Stationary', desc: `Establish scene ${scene.sceneNumber || idx + 1}` },
      { type: 'Mid/Medium', movement: 'Stationary', desc: 'Master shot - cover dialogue' },
      { type: 'Close-Up', movement: 'Stationary', desc: 'Reaction shot' },
    ];
    
    suggestedShots.forEach((shot, shotIdx) => {
      const tempShot = {
        type: shot.type,
        movement: shot.movement,
        sound: 'Yes',
        cast: castList
      };
      const times = _calcSmartTime(tempShot);
      
      p.shots.push({
        scene: scene.sceneNumber || scene.heading,
        sceneKey: scene.heading,
        setup: '1',
        num: String(shotIdx + 1),
        type: shot.type,
        movement: shot.movement,
        extint: extint,
        location: location,
        sound: 'Yes',
        desc: shot.desc,
        cast: castList,
        pages: '',
        length: '',
        setuptime: String(times.setuptime),
        shoottime: String(times.shoottime),
      });
      added++;
    });
  });
  
  saveStore();
  renderShotList(p);
  showToast(`Added ${added} suggested shots from ${scenes.length} scenes`, 'success');
}

function renderShotList(p) {
  const tbody = document.getElementById('shotlist-body');
  const VIRTUAL_SCROLL_THRESHOLD = 100; // Use virtual scroll for 100+ items
  let totalMins = 0;
  
  if (!p.shots || !p.shots.length) {
    tbody.innerHTML = `<tr><td colspan="17"><div class="empty-state" style="padding:30px"><div class="icon">🎬</div><h4>No shots yet</h4></div></td></tr>`;
    document.getElementById('shotlist-total').textContent = '0 mins';
    VirtualScroll.destroy('shotlist-body');
    return;
  }
  
  // Pre-calculate totals
  p.shots.forEach(s => {
    totalMins += (parseInt(s.setuptime)||0) + (parseInt(s.shoottime)||0);
  });
  
  // Use virtual scrolling for large lists
  if (p.shots.length > VIRTUAL_SCROLL_THRESHOLD) {
    // Create or update virtual scroll instance
    let vs = VirtualScroll.get('shotlist-body');
    if (!vs) {
      vs = VirtualScroll.create('shotlist-body', {
        itemHeight: 42, // Approximate row height
        buffer: 10,
        totalItems: p.shots.length,
        renderItem: (i) => {
          const s = p.shots[i];
          const t = (parseInt(s.setuptime)||0) + (parseInt(s.shoottime)||0);
          return `<tr data-ctx="shot:${i}" onclick="editShot(${i})" style="cursor:pointer;height:42px">
            <td style="width:28px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" class="shot-cb" data-idx="${i}"></td>
            <td>${s.scene||'—'}</td><td>${s.setup||'—'}</td><td>${s.num||'—'}</td>
            <td><span class="tag">${s.type||'—'}</span></td>
            <td>${s.movement||'—'}</td><td>${s.location||'—'}</td>
            <td><span class="chip" style="font-size:10px">${s.extint||'—'}</span></td>
            <td>${s.sound||'—'}</td>
            <td style="max-width:200px">${s.desc||'—'}</td>
            <td>${s.cast||'—'}</td><td>${s.pages||'—'}</td><td>${s.length||'—'}</td>
            <td>${s.setuptime||'—'}</td><td>${s.shoottime||'—'}</td>
            <td><strong style="color:var(--accent)">${t||'—'}</strong></td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-sm btn-ghost btn-danger" onclick="removeShot(${i})">✕</button>
            </td>
          </tr>`;
        }
      });
    } else {
      vs.setTotalItems(p.shots.length);
    }
    // Show count indicator
    tbody.setAttribute('data-virtual', 'true');
  } else {
    // Regular rendering for smaller lists
    VirtualScroll.destroy('shotlist-body');
    tbody.removeAttribute('data-virtual');
    tbody.innerHTML = p.shots.map((s,i) => {
      const t = (parseInt(s.setuptime)||0) + (parseInt(s.shoottime)||0);
      return `<tr data-ctx="shot:${i}" onclick="editShot(${i})" style="cursor:pointer">
        <td style="width:28px;padding:6px 4px" onclick="event.stopPropagation()"><input type="checkbox" class="shot-cb" data-idx="${i}"></td>
        <td>${s.scene||'—'}</td><td>${s.setup||'—'}</td><td>${s.num||'—'}</td>
        <td><span class="tag">${s.type||'—'}</span></td>
        <td>${s.movement||'—'}</td><td>${s.location||'—'}</td>
        <td><span class="chip" style="font-size:10px">${s.extint||'—'}</span></td>
        <td>${s.sound||'—'}</td>
        <td style="max-width:200px">${s.desc||'—'}</td>
        <td>${s.cast||'—'}</td><td>${s.pages||'—'}</td><td>${s.length||'—'}</td>
        <td>${s.setuptime||'—'}</td><td>${s.shoottime||'—'}</td>
        <td><strong style="color:var(--accent)">${t||'—'}</strong></td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost btn-danger" onclick="removeShot(${i})">✕</button>
        </td>
      </tr>`;
    }).join('');
  }
  
  const h = Math.floor(totalMins/60), m = totalMins%60;
  document.getElementById('shotlist-total').textContent = h ? `${h} hr ${m} mins` : `${totalMins} mins`;
}
function addShot() {
  document.getElementById('shot-edit-idx').value='';
  ['scene','scene-key','setup','num','location','cast','pages','length','setuptime','shoottime'].forEach(f=>document.getElementById('shot-'+f).value='');
  document.getElementById('shot-total').value='';
  document.getElementById('shot-desc').value='';
  _shotPopulateScenes('');
  openModal('modal-shot');
}
function editShot(i) {
  const s=currentProject().shots[i];
  document.getElementById('shot-edit-idx').value=i;
  document.getElementById('shot-scene').value=s.scene||'';
  document.getElementById('shot-scene-key').value=s.sceneKey||'';
  _shotPopulateScenes(s.sceneKey||'');
  document.getElementById('shot-setup').value=s.setup||'';
  document.getElementById('shot-num').value=s.num||'';
  document.getElementById('shot-type').value=s.type||'CU';
  document.getElementById('shot-movement').value=s.movement||'Stationary';
  document.getElementById('shot-extint').value=s.extint||'INT DAY';
  document.getElementById('shot-location').value=s.location||'';
  document.getElementById('shot-sound').value=s.sound||'Yes';
  document.getElementById('shot-desc').value=s.desc||'';
  document.getElementById('shot-cast').value=s.cast||'';
  document.getElementById('shot-pages').value=s.pages||'';
  document.getElementById('shot-length').value=s.length||'';
  document.getElementById('shot-setuptime').value=s.setuptime||'';
  document.getElementById('shot-shoottime').value=s.shoottime||'';
  calcShotTotal();
  openModal('modal-shot');
}
function calcShotTotal() {
  const a=parseInt(document.getElementById('shot-setuptime').value)||0;
  const b=parseInt(document.getElementById('shot-shoottime').value)||0;
  document.getElementById('shot-total').value = a+b ? (a+b)+' mins' : '';
}
function saveShot() {
  const p=currentProject();
  if (!p.shots) p.shots=[];
  const s={
    scene:document.getElementById('shot-scene').value,
    sceneKey:document.getElementById('shot-scene-key').value,
    setup:document.getElementById('shot-setup').value,
    num:document.getElementById('shot-num').value,
    type:document.getElementById('shot-type').value,
    movement:document.getElementById('shot-movement').value,
    extint:document.getElementById('shot-extint').value,
    location:document.getElementById('shot-location').value,
    sound:document.getElementById('shot-sound').value,
    desc:document.getElementById('shot-desc').value,
    cast:document.getElementById('shot-cast').value,
    pages:document.getElementById('shot-pages').value,
    length:document.getElementById('shot-length').value,
    setuptime:document.getElementById('shot-setuptime').value,
    shoottime:document.getElementById('shot-shoottime').value,
  };
  const idx=document.getElementById('shot-edit-idx').value;
  if(idx!=='') p.shots[parseInt(idx)]=s; else p.shots.push(s);
  saveStore(); closeModal('modal-shot'); renderShotList(p); showToast('Shot saved','success');
}
function _shotPopulateScenes(selectedKey) {
  const sel = document.getElementById('shot-scene-sel');
  if (!sel) return;
  const p  = currentProject();
  const bd = _getActiveBd(p);
  sel.innerHTML = '<option value="">— select scene —</option>';
  if (bd?.rawText) {
    parseBreakdownScenes(bd.rawText).forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.heading;
      opt.textContent = (sc.sceneNumber ? sc.sceneNumber + ' – ' : '') + (sc.location || sc.heading) + (sc.tod ? ' / ' + sc.tod : '');
      opt.dataset.scenenum = sc.sceneNumber || '';
      opt.dataset.loc      = sc.location    || '';
      opt.dataset.ie       = sc.intExt      || '';
      opt.dataset.tod      = sc.tod         || '';
      if (sc.heading === selectedKey) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function _shotSceneChange() {
  const sel = document.getElementById('shot-scene-sel');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('shot-scene-key').value = opt.value;
  document.getElementById('shot-scene').value     = opt.dataset?.scenenum || opt.value;
  if (!opt.value) return;
  if (opt.dataset.loc) document.getElementById('shot-location').value = opt.dataset.loc;
  // Auto-set ext/int
  const ie = opt.dataset.ie, tod = opt.dataset.tod;
  if (ie) {
    const night  = /NIGHT|DUSK|DAWN/.test(tod||'');
    const prefix = ie.includes('EXT') && ie.includes('INT') ? 'INT' : ie.split('/')[0];
    const target = prefix + (night ? ' NIGHT' : ' DAY');
    const eiSel  = document.getElementById('shot-extint');
    for (const o of eiSel.options) { if (o.value === target) { eiSel.value = target; break; } }
  }
  // Auto-fill cast from breakdown
  const p = currentProject();
  const bd = _getActiveBd(p);
  if (bd) {
    const data = _sbBuildSceneData(p);
    const entry = data[opt.value];
    if (entry?.cast.length) document.getElementById('shot-cast').value = entry.cast.join(', ');
  }
}

// Generic autocomplete — used by shot-location and shot-cast
function _acShow(input, options) {
  _acRemove();
  const val = input.value.trim().toLowerCase();
  if (!val) return;
  const opts = options.filter(o => o && o.toLowerCase().includes(val));
  if (!opts.length) return;
  const rect = input.getBoundingClientRect();
  const list = document.createElement('div');
  list.id = '_ac-list';
  list.className = 'sb-loc-list';
  list.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;width:${rect.width}px`;
  list._target = input;
  list.innerHTML = opts.map(o => `<div class="sb-loc-item" onmousedown="_acPick(event,this)">${o.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`).join('');
  document.body.appendChild(list);
}
function _acPick(e, el) {
  e.preventDefault();
  const list = document.getElementById('_ac-list');
  if (list?._target) list._target.value = el.textContent;
  _acRemove();
}
function _acRemove() { document.getElementById('_ac-list')?.remove(); }

function removeShot(i) { showConfirmDialog('Remove this shot?', 'Remove', () => { const p=currentProject(); p.shots.splice(i,1); saveStore(); renderShotList(p); }); }
function removeAllShots() { showConfirmDialog('Remove ALL shots? This cannot be undone.', 'Remove All', () => { const p=currentProject(); p.shots=[]; saveStore(); renderShotList(p); showToast('All shots removed', 'success'); }); }

// Export functions for shotlist
function exportShotList() {
  const p = currentProject();
  if (!p.shots || !p.shots.length) { showToast('No shots to export', 'info'); return; }
  const formats = ['HTML', 'Text', 'CSV'];
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.style.cssText = 'position:absolute;right:0;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:4px 0;min-width:150px;z-index:1000';
  formats.forEach(fmt => {
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.style.cssText = 'display:block;width:100%;padding:8px 12px;text-align:left;background:none;border:none;cursor:pointer';
    btn.textContent = '📄 ' + fmt;
    btn.onclick = () => { document.body.removeChild(menu); exportShotListAs(fmt); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  const rect = event.target.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  setTimeout(() => document.addEventListener('click', () => menu.remove()), 100);
}
function exportShotListAs(fmt) {
  const p = currentProject();
  let content = '', filename = 'shotlist', type = 'text/plain';
  if (fmt === 'HTML') {
    content = '<html><head><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#333;color:#fff}</style></head><body><h1>Shot List</h1><table><tr><th>Scene</th><th>Setup</th><th>Shot</th><th>Type</th><th>Movement</th><th>Location</th><th>Ext/Int</th><th>Description</th><th>Cast</th><th>Est (mins)</th></tr>' + p.shots.map(s => `<tr><td>${s.scene||''}</td><td>${s.setup||''}</td><td>${s.num||''}</td><td>${s.type||''}</td><td>${s.movement||''}</td><td>${s.location||''}</td><td>${s.extint||''}</td><td>${s.desc||''}</td><td>${s.cast||''}</td><td>${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)}</td></tr>`).join('') + '</table></body></html>';
    filename += '.html'; type = 'text/html';
  } else if (fmt === 'CSV') {
    content = 'Scene,Setup,Shot,Type,Movement,Location,Ext/Int,Description,Cast,Est (mins)\n' + p.shots.map(s => `"${s.scene||''}","${s.setup||''}","${s.num||''}","${s.type||''}","${s.movement||''}","${s.location||''}","${s.extint||''}","${(s.desc||'').replace(/"/g,'\"')}","${s.cast||''}","${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)}"`).join('\n');
    filename += '.csv'; type = 'text/csv';
  } else {
    content = 'SHOT LIST\n' + '=' .repeat(50) + '\n\n' + p.shots.map((s,i) => `${i+1}. SC ${s.scene||''} / SETUP ${s.setup||''} / SHOT ${s.num||''} (${s.type||''})\n   Movement: ${s.movement||''} | Location: ${s.location||''} | ${s.extint||''}\n   Description: ${s.desc||''}\n   Cast: ${s.cast||''} | Est: ${(parseInt(s.setuptime)||0)+(parseInt(s.shoottime)||0)} mins\n`).join('\n');
    filename += '.txt';
  }
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast('Exported as ' + fmt, 'success');
}

// ══════════════════════════════════════════
// PROPS / WARDROBE
// ══════════════════════════════════════════
function renderPropTable(type, tbodyId, p) {
  const list = p[type] || [];
  const tbody = document.getElementById(tbodyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No items yet</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((item,i) => `
    <tr data-ctx="prop:${type}:${i}" onclick="editPropItem('${type}',${i})" style="cursor:pointer">
      <td><strong>${item.name}</strong></td>
      <td>${item.qty||1}</td>
      <td>${item.chars||'—'}</td>
      <td>${item.scenes||'—'}</td>
      <td>${item.locs||'—'}</td>
      <td>${item.pgs||'—'}</td>
      <td>${item.notes||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editPropItem('${type}',${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removePropItem('${type}',${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addPropItem(type) { document.getElementById('prop-type').value=type; document.getElementById('prop-edit-idx').value=''; document.getElementById('modal-prop-title').textContent='ADD '+(type==='props'?'PROP':'WARDROBE ITEM'); ['name','chars','scenes','locs','pgs','notes'].forEach(f=>document.getElementById('prop-'+f).value=''); document.getElementById('prop-qty').value='1'; openModal('modal-prop'); }
function editPropItem(type,i) {
  const item=currentProject()[type][i];
  document.getElementById('prop-type').value=type;
  document.getElementById('prop-edit-idx').value=i;
  document.getElementById('modal-prop-title').textContent='EDIT '+(type==='props'?'PROP':'WARDROBE ITEM');
  document.getElementById('prop-name').value=item.name||'';
  document.getElementById('prop-qty').value=item.qty||1;
  document.getElementById('prop-chars').value=item.chars||'';
  document.getElementById('prop-scenes').value=item.scenes||'';
  document.getElementById('prop-locs').value=item.locs||'';
  document.getElementById('prop-pgs').value=item.pgs||'';
  document.getElementById('prop-notes').value=item.notes||'';
  openModal('modal-prop');
}
function savePropItem() {
  const p=currentProject();
  const type=document.getElementById('prop-type').value;
  const name=document.getElementById('prop-name').value.trim();
  if(!name){showToast('Name required','info');return;}
  if(!p[type]) p[type]=[];
  const item={name,qty:document.getElementById('prop-qty').value||1,chars:document.getElementById('prop-chars').value,scenes:document.getElementById('prop-scenes').value,locs:document.getElementById('prop-locs').value,pgs:document.getElementById('prop-pgs').value,notes:document.getElementById('prop-notes').value};
  const idx=document.getElementById('prop-edit-idx').value;
  if(idx!=='') p[type][parseInt(idx)]=item; else p[type].push(item);
  saveStore(); closeModal('modal-prop');
  if(type==='props') renderPropTable('props','props-body',p);
  else renderPropTable('wardrobe','wardrobe-body',p);
  showToast('Saved','success');
}
function removePropItem(type,i) {
  showConfirmDialog('Remove this item?', 'Remove', () => {
    const p=currentProject(); p[type].splice(i,1); saveStore();
    if(type==='props') renderPropTable('props','props-body',p);
    else renderPropTable('wardrobe','wardrobe-body',p);
  });
}

// WARDROBE FUNCTIONS
function renderWardrobeTable(p) {
  const list = p.wardrobe || [];
  const tbody = document.getElementById('wardrobe-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><h4>No items yet</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((item,i) => `
    <tr data-ctx="wardrobe:${i}">
      <td><strong>${item.name}</strong></td>
      <td>${item.chars||'—'}</td>
      <td>${item.scenes||'—'}</td>
      <td>${item.size||'—'}</td>
      <td>${item.condition||'—'}</td>
      <td>${item.loc||'—'}</td>
      <td>${item.notes||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editWardrobeItem(${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removeWardrobeItem(${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addWardrobeItem() {
  document.getElementById('wardrobe-edit-idx').value='';
  document.getElementById('modal-wardrobe-title').textContent='ADD WARDROBE ITEM';
  ['name','chars','scenes','size','condition','loc','notes'].forEach(f=>document.getElementById('wardrobe-'+f).value='');
  openModal('modal-wardrobe');
}
function editWardrobeItem(i) {
  const item=currentProject().wardrobe[i];
  document.getElementById('wardrobe-edit-idx').value=i;
  document.getElementById('modal-wardrobe-title').textContent='EDIT WARDROBE ITEM';
  document.getElementById('wardrobe-name').value=item.name||'';
  document.getElementById('wardrobe-chars').value=item.chars||'';
  document.getElementById('wardrobe-scenes').value=item.scenes||'';
  document.getElementById('wardrobe-size').value=item.size||'';
  document.getElementById('wardrobe-condition').value=item.condition||'';
  document.getElementById('wardrobe-loc').value=item.loc||'';
  document.getElementById('wardrobe-notes').value=item.notes||'';
  openModal('modal-wardrobe');
}
function saveWardrobeItem() {
  const p=currentProject();
  const name=document.getElementById('wardrobe-name').value.trim();
  if(!name){showToast('Name required','info');return;}
  if(!p.wardrobe) p.wardrobe=[];
  const item={
    name,
    chars: document.getElementById('wardrobe-chars').value,
    scenes: document.getElementById('wardrobe-scenes').value,
    size: document.getElementById('wardrobe-size').value,
    condition: document.getElementById('wardrobe-condition').value,
    loc: document.getElementById('wardrobe-loc').value,
    notes: document.getElementById('wardrobe-notes').value
  };
  const idx=document.getElementById('wardrobe-edit-idx').value;
  if(idx!=='') p.wardrobe[parseInt(idx)]=item; else p.wardrobe.push(item);
  saveStore(); closeModal('modal-wardrobe');
  renderWardrobeTable(p);
  showToast('Saved','success');
}
function removeWardrobeItem(i) {
  showConfirmDialog('Remove this wardrobe item?', 'Remove', () => {
    const p=currentProject(); p.wardrobe.splice(i,1); saveStore();
    renderWardrobeTable(p);
  });
}

// ══════════════════════════════════════════
// SOUND LOG
// ══════════════════════════════════════════
function renderSoundLog(p) {
  const tbody=document.getElementById('soundlog-body');
  if(!p.soundlog||!p.soundlog.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state" style="padding:20px"><div class="icon">🎙️</div><h4>No entries yet</h4></div></td></tr>`;return;}
  tbody.innerHTML=p.soundlog.map((s,i)=>`
    <tr data-ctx="sound:${i}">
      <td>${s.scene||'—'}</td><td>${s.shot||'—'}</td><td>${s.take||'—'}</td>
      <td>${s.comments||'—'}</td><td>${s.track1||'—'}</td>
      <td>${s.lav||'—'}</td><td>${s.additional||'—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editSoundEntry(${i})">✎</button>
        <button class="btn btn-sm btn-ghost btn-danger" onclick="removeSoundEntry(${i})">✕</button>
      </td>
    </tr>
  `).join('');
}
function addSoundEntry(){document.getElementById('sound-edit-idx').value='';['scene','shot','take','comments','track1','lav','additional'].forEach(f=>document.getElementById('sound-'+f).value='');openModal('modal-sound');}
function editSoundEntry(i){const s=currentProject().soundlog[i];document.getElementById('sound-edit-idx').value=i;document.getElementById('sound-scene').value=s.scene||'';document.getElementById('sound-shot').value=s.shot||'';document.getElementById('sound-take').value=s.take||'';document.getElementById('sound-comments').value=s.comments||'';document.getElementById('sound-track1').value=s.track1||'';document.getElementById('sound-lav').value=s.lav||'';document.getElementById('sound-additional').value=s.additional||'';openModal('modal-sound');}
function saveSoundEntry(){
  const p=currentProject();if(!p.soundlog)p.soundlog=[];
  const s={scene:document.getElementById('sound-scene').value,shot:document.getElementById('sound-shot').value,take:document.getElementById('sound-take').value,comments:document.getElementById('sound-comments').value,track1:document.getElementById('sound-track1').value,lav:document.getElementById('sound-lav').value,additional:document.getElementById('sound-additional').value};
  const idx=document.getElementById('sound-edit-idx').value;
  if(idx!=='')p.soundlog[parseInt(idx)]=s;else p.soundlog.push(s);
  saveStore();closeModal('modal-sound');renderSoundLog(p);showToast('Saved','success');
}
function removeSoundEntry(i){showConfirmDialog('Remove this sound log entry?','Remove',()=>{const p=currentProject();p.soundlog.splice(i,1);saveStore();renderSoundLog(p);});}

// ══════════════════════════════════════════
