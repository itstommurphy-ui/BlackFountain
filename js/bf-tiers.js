// ══════════════════════════════════════════
// BLACK FOUNTAIN — SUBSCRIPTION TIERS
// Single source of truth for all tier logic.
// Change BF_TIER here to switch tiers globally.
// Eventually: set BF_TIER from Supabase user row at app init.
// ══════════════════════════════════════════

const BF_TIER = 'free'; // 'free' | 'pro' | 'studio' | 'education'

const BF_TIERS = {

  free: {
    label:            'Free',
    price:            null,

    // Projects
    maxProjects:      1,        // 1 active project at a time (others archived, never deleted)
    canArchive:       true,     // archived projects preserved, just not editable

    // Storage (local/IndexedDB only)
    storage: {
      image:          5,        // MB
      audio:          5,
      video:          5,
      document:       5,
      totalGB:        0.5,      // 500 MB total cap (enforced at upload time)
    },

    // Cloud sync
    cloudSync:        false,    // metadata only — no cloud sync on free
    cloudFiles:       false,    // files never go to cloud (any tier, for now)

    // Collaboration
    maxCollaborators: 0,        // solo only
    permissions:      false,    // no role-based permissions

    // Messaging (when implemented)
    inAppMessaging:   false,
    bulkSend:         false,

    // Exports — never gated
    exports:          true,     // all exports always unlocked

    // Education
    isEducation:      false,
  },

  pro: {
    label:            'Pro',
    price:            { monthly: 10, annual: 96 }, // £/year = 20% off

    // Projects
    maxProjects:      null,     // unlimited
    canArchive:       true,

    // Storage
    storage: {
      image:          20,
      audio:          20,
      video:          50,
      document:       20,
      totalGB:        5,
    },

    // Cloud sync
    cloudSync:        true,     // project metadata synced to Supabase
    cloudFiles:       false,    // files still local for now

    // Collaboration
    maxCollaborators: 2,        // you + 2 (3 people total per project)
    permissions:      false,    // basic access only, no role permissions yet

    // Messaging
    inAppMessaging:   true,     // direct messages to collaborators
    bulkSend:         false,    // no department bulk send on pro

    // Exports
    exports:          true,

    isEducation:      false,
  },

  studio: {
    label:            'Studio',
    price:            { monthly: 30, annual: 288 }, // £/year

    // Projects
    maxProjects:      null,     // unlimited
    canArchive:       true,

    // Storage
    storage: {
      image:          50,
      audio:          50,
      video:          200,
      document:       50,
      totalGB:        25,
    },

    // Cloud sync
    cloudSync:        true,
    cloudFiles:       false,    // revisit when cloud file storage is implemented

    // Collaboration
    maxCollaborators: null,     // unlimited
    permissions:      true,     // role-based (director, producer, DoP, etc.)

    // Messaging
    inAppMessaging:   true,
    bulkSend:         true,     // send to departments, attach files from project

    // Exports
    exports:          true,

    isEducation:      false,
  },

  education: {
    // B2B institutional deal — not a self-serve subscription.
    // Priced per institution annually. Students/teachers get studio-level
    // features within their institution's workspace.
    label:            'Education',
    price:            null,     // negotiated per institution

    maxProjects:      null,
    canArchive:       true,

    storage: {
      image:          20,
      audio:          20,
      video:          50,
      document:       20,
      totalGB:        5,        // per student account — institution has overall quota
    },

    cloudSync:        true,
    cloudFiles:       false,

    maxCollaborators: null,     // class-level collaboration
    permissions:      true,     // teacher/student roles

    inAppMessaging:   true,
    bulkSend:         true,     // teacher → class broadcasts

    exports:          true,

    isEducation:      true,
  },

};

// ── Helper: get current tier config ──────────────────────────────────────────
function _bfTier() {
  return BF_TIERS[BF_TIER] || BF_TIERS.free;
}

// ── File size check (replaces bf-file-limits.js — consolidate into this) ─────
function _bfMaxBytes(type) {
  const limits = _bfTier().storage;
  const mb = limits[type] || limits.document || 5;
  return mb * 1024 * 1024;
}

function _bfCheckFileSize(file, type) {
  const max = _bfMaxBytes(type);
  if (file.size <= max) return true;
  const tier    = _bfTier();
  const limitMb = (max / 1024 / 1024).toFixed(0);
  const fileMb  = (file.size / 1024 / 1024).toFixed(1);
  showToast(
    `"${file.name}" is ${fileMb} MB — ${tier.label} plan limit is ${limitMb} MB for this file type.`,
    'error',
    6000
  );
  return false;
}

// ── Project limit check ───────────────────────────────────────────────────────
function _bfCanAddProject() {
  const max = _bfTier().maxProjects;
  if (max === null) return true; // unlimited
  const active = (store.projects || []).filter(p => !p.archived).length;
  if (active >= max) {
    showToast(
      `${_bfTier().label} plan allows ${max} active project${max !== 1 ? 's' : ''}. Archive your current project to start a new one, or upgrade to Pro.`,
      'error',
      7000
    );
    return false;
  }
  return true;
}

// ── Collaborator limit check ──────────────────────────────────────────────────
function _bfCanAddCollaborator(project) {
  const max = _bfTier().maxCollaborators;
  if (max === null) return true; // unlimited
  if (max === 0) {
    showToast(`Collaboration is available on Pro and Studio plans.`, 'error', 6000);
    return false;
  }
  const current = (project?.collaborators || []).length;
  if (current >= max) {
    showToast(
      `${_bfTier().label} plan allows ${max} collaborator${max !== 1 ? 's' : ''} per project. Upgrade to Studio for unlimited.`,
      'error',
      7000
    );
    return false;
  }
  return true;
}

// ── Feature gate check (generic) ─────────────────────────────────────────────
function _bfCanUse(feature) {
  const tier = _bfTier();
  if (tier[feature] === true) return true;
  if (tier[feature] === false) {
    const messages = {
      cloudSync:       `Cloud sync is available on Pro and Studio plans.`,
      inAppMessaging:  `In-app messaging is available on Pro and Studio plans.`,
      bulkSend:        `Bulk department messaging is available on the Studio plan.`,
      permissions:     `Role-based permissions are available on the Studio plan.`,
    };
    showToast(messages[feature] || `This feature requires an upgrade.`, 'error', 6000);
    return false;
  }
  return !!tier[feature];
}

// ══════════════════════════════════════════
// FILE TYPE DETECTION
// ══════════════════════════════════════════

function _bfGetFileType(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  const mime = file.type || '';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4','mov','avi','mkv','webm','m4v'].includes(ext))  return 'video';
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a','aac','flac'].includes(ext))  return 'audio';
  return 'document';
}

// Export to global scope
window.BF_TIER       = BF_TIER;
window.BF_TIERS      = BF_TIERS;
window._bfTier       = _bfTier;
window._bfGetFileType = _bfGetFileType;
window._bfMaxBytes    = _bfMaxBytes;
window._bfCheckFileSize    = _bfCheckFileSize;
window._bfCanAddProject    = _bfCanAddProject;
window._bfCanAddCollaborator = _bfCanAddCollaborator;
window._bfCanUse           = _bfCanUse;

// ══════════════════════════════════════════