// ══════════════════════════════════════════
// IMPORTANT: All new features should be WCAG 2.2 AA compliant
// - Ensure color contrast ratios are at least 4.5:1 for normal text
// - Ensure all interactive elements have accessible names
// - Ensure keyboard navigation works for all features
// - Ensure form inputs have labels
// - Ensure error messages are announced to screen readers
// ══════════════════════════════════════════

// DATA STORE
// ══════════════════════════════════════════
let store = {
  projects: [],
  teamMembers: [],
  currentProjectId: null,
  files: [],
  folders: [],
  contacts: [],
  locations: [],
  contactColumns: [],
  contactCustomData: {},
  contactHiddenCols: [],
  locationHiddenCols: [],
  locationColumns: [],
  locationCustomData: {},
  moodboards: []
};

function ensureSampleData() {
  if (store.projects.length > 0) return;
  
  // Sample projects for demo
  store.projects = [
    {
      id: 'demo_short',
      title: 'The Quick Flick',
      num: '001',
      status: 'pre',
      director: 'Jane Doe',
      producer: 'John Smith',
      company: 'Demo Films',
      genre: 'Short Film',
      notes: 'Sample project - delete anytime',
      shootDays: 3,
      createdAt: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
      files: [],
      unit: [],
      locations: []
    },
    {
      id: 'demo_feature',
      title: 'Midnight Shadows',
      num: '002',
      status: 'prod',
      director: 'Alex Rivera',
      producer: 'FilmCo',
      company: 'Shadow Pictures',
      genre: 'Thriller',
      notes: 'Feature film in production',
      shootDays: 25,
      createdAt: new Date(Date.now() - 14*24*60*60*1000).toISOString(),
      files: [],
      unit: [],
      locations: []
    }
  ];
}

const FILE_CATEGORIES = {
  location:   { label: 'Location Photos',  icon: '📍', extensions: ['jpg','jpeg','png','gif','webp'] },
  bts:        { label: 'BTS',             icon: '🎬', extensions: ['jpg','jpeg','png','gif','webp'] },
  stills:     { label: 'Stills',          icon: '📸', extensions: ['jpg','jpeg','png','gif','webp'] },
  people:     { label: 'People',           icon: '👥', extensions: ['jpg','jpeg','png','gif','webp'] },
  moodboard:  { label: 'Moodboards',       icon: '🎨', extensions: ['jpg','jpeg','png','gif','webp'] },
  storyboard: { label: 'Storyboards',      icon: '🖼️', extensions: ['jpg','jpeg','png','gif','webp','pdf'] },
  contract:   { label: 'Contracts',        icon: '📋', extensions: ['pdf','doc','docx'] },
  other:      { label: 'Other',            icon: '📁', extensions: [] },
};

// Normalise file → always read categories as array (migrates old single category string)
function fileCategories(file) {
  if (Array.isArray(file.categories)) return file.categories;
  if (file.category && file.category !== '') return [file.category];
  return ['other'];
}

function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [cat, info] of Object.entries(FILE_CATEGORIES)) {
    if (info.extensions.includes(ext)) return cat;
  }
  return 'other';
}

function getFileIcon(file) {
  if (file.data && file.data.startsWith('data:image')) {
    return `<img src="${file.data}" alt="${file.altText || file.name}">`;
  }
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (ext === 'txt') return '📃';
  if (['fdx'].includes(ext)) return '🎞️';
  return FILE_CATEGORIES[file.category]?.icon || '📁';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

let currentFileCategory = 'all';
let currentFolderId = null;
let _mfNewPersonCallback = null; // set when opening contact modal from file-tagging flow
const selectedFileIds = new Set();

// Normalise file → always read projectIds as array (migrates old single projectId)
function fileProjectIds(file) {
  if (Array.isArray(file.projectIds)) return file.projectIds;
  if (file.projectId !== undefined && file.projectId !== null) return [file.projectId];
  return [];
}

// Folder helper functions
function getFolderById(id) {
  return store.folders?.find(f => f.id === id);
}

function getFolderFiles(folderId) {
  return (store.files || []).filter(f => f.folderId === folderId);
}

function getRootFiles() {
  return (store.files || []).filter(f => !f.folderId);
}

function createFolder(name, parentId = null, projectId = null) {
  const folder = {
    id: 'folder_' + Date.now(),
    name: name,
    parentId: parentId,
    projectId: projectId,
    createdAt: new Date().toISOString()
  };
  if (!store.folders) store.folders = [];
  store.folders.push(folder);
  save();
  return folder;
}

function deleteFolder(folderId) {
  // Move files in this folder to root
  store.files.forEach(f => {
    if (f.folderId === folderId) f.folderId = null;
  });
  // Delete subfolder references
  store.folders.forEach(f => {
    if (f.parentId === folderId) f.parentId = null;
  });
  // Remove the folder
  store.folders = store.folders.filter(f => f.id !== folderId);
  save();
}

function renameFolder(folderId, newName) {
  const folder = getFolderById(folderId);
  if (folder) {
    folder.name = newName;
    save();
  }
}

function moveFileToFolder(fileId, folderId) {
  const file = store.files.find(f => f.id === fileId);
  if (file) {
    file.folderId = folderId;
    save();
  }
}

// ══════════════════════════════════════════
