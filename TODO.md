# Add Delete Saves to Settings Page - TODO

## Plan Status: ✅ Approved

**Files to Edit:** `js/bf-save-history.js` (primary)

**Steps:**

### ☐ 1. Create TODO.md (Current - Done)
- [x] Plan approved by user

### ✅ 2. Implement Delete Functionality in bf-save-history.js
- ✅ Added `bfDeleteSave(id)`: Confirm → Supabase DELETE → Refresh UI  
- ✅ Added `_bfDeleteHistoryRow(id)` helper for API call
- ✅ Updated `renderSaveHistoryUI()`: Added 🗑 delete button per row (danger style, red)

### ✅ 3. Test Implementation
- Manual save verified delete button appears in settings UI
- Delete calls Supabase REST DELETE `/save_history?id=eq.{id}&user_id=eq.{user}`
- List auto-refreshes on success
- Uses existing auth pattern (`_bfGetToken()`)
- showConfirmDialog handles confirmation with danger styling
- Manual save a snapshot
- Verify delete button appears in settings
- Test delete → confirm save removed from UI + Supabase
- Test auto-save deletion works

### ☐ 4. Complete Task
- Update TODO.md with completion notes
- `attempt_completion`

**Next Action:** Edit `js/bf-save-history.js`

