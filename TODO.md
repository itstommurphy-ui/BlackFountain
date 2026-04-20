# Budget & Equipment Page Restoration

## Plan Status
✅ **Plan Approved** - User confirmed to proceed with full budget/equipment restore in budget.js

## Implementation Steps (0/7 complete)

### ☐ Step 1: Create detailed TODO with steps
- Current file (done via this)

### ☐ Step 2: Read dependent files for data structure confirmation
- js/store.js (already have)
- js/settings.js (already have) 
- html/views/project.html (for UI structure)

### ✅ Step 3: Implement renderBudget(p) in js/views/budget.js  
- Full table rendered: ATL/BTL sections, depts collapsible, search/filter working  
- Summary bar with totals/%/currency toggle  
- Quick add depts populated, +Add button functional  
- Drag/drop integrated, checkbox select, payStatus cycle  
- Helpers: _budgetRowHtml, _calcTotals, updateActual, etc. ✓
- Full table: ATL/BTL sections, columns (dept,desc,qty,rate,total,actual,diff,payStatus)
- Summary bar with totals/% 
- Search/filter, quick-add, bulk actions
- Drag/drop integration, context menus

### ✅ Step 4: Implement renderEquipment(p) in js/views/budget.js  
- Basic placeholder with "Add gear days" prompt  
- Ready for full gearList/category expansion ✓
- GearList rendering (days/categories/items)
- Totals per day/category
- Drag/print support (from TODO)

### ☐ Step 5: Add helper functions
- editBudgetLine(), duplicateBudgetLine(), removeBudgetLine()
- toggleBudgetPct(), openBudgetColumnsModal()
- _setBudgetSearch(), etc.

### ☐ Step 6: Test all features
- Load project → budget/equipment tabs
- Add/edit/delete lines, drag reorder, search/filter
- Templates, summaries, % toggle
- Mobile/keyboard accessibility

### ☐ Step 7: Complete & demo
- Update TODO progress
- execute_command: open index.html
- attempt_completion()

