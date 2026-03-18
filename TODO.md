# FilmForge - Fix Project Overview Visibility

## Plan Steps
1. [x] Read `html/views/project.html` to confirm content/structure
2. [x] Implement missing `showProjectView()` in `js/views/dashboard.js` or `js/init.js`
3. [ ] Add project card click handlers in `renderDashboard()` to call `showProjectView(project.id)`
4. [ ] Ensure `#view-project` gets `active` class + `display: block`
5. [ ] Populate project view sections (docs, breakdown, etc.) from `store.projects`
6. [ ] Test: Click project card → project.html content visible
7. [ ] Demo: `open index.html`

**Current Issue**: `project.html` view loads but stays invisible (`display: none`) because:
- Missing `showProjectView()` function
- No click handlers on dashboard project cards
- `store.currentProjectId` not set → sections empty

**Next**: User confirmation before edits.

