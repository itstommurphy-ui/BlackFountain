// ══════════════════════════════════════════
// BF-FILE-UPLOAD-PATCH
// Fixed: File uploads now respect current folder context
// Files uploaded in a folder are placed in that folder instead of root
// ══════════════════════════════════════════

// Fixed in confirmFileUpload() - folderId now set to currentFolderId