# Black Fountain — Callsheet Patch Instructions

Apply these two changes to your `index.html` (or whatever your main file is called).

---

## CHANGE 1 — Replace ALL Callsheet CSS

Find the block that starts with:
```
  /* ── CALLSHEET ── */
  .cs-page {
```

And delete everything from there through to (and including) the end of the closing `}` of this block:
```
  @media (max-width: 768px) {
    ...
    .cs-call-times {
      grid-template-columns: 1fr 1fr !important;
    }
  }
```

ALSO find this second block of callsheet CSS that appears lower down in the stylesheet (after `/* ── MISC ── */`) and delete it entirely. It starts with:
```
  .cs-wrap {
    background: var(--surface);
```
And ends just before:
```
  /* scrollbar */
```

Replace BOTH deleted blocks with the contents of `cs_css_replacement.txt` (pasted below).

---

## CHANGE 2 — Replace renderCallsheet JS

Find the function block that starts with:
```
// CALLSHEET
function renderCallsheet(p) {
```

Delete everything from there through to the closing `}` of `renderSingleCallsheet`. It ends just before:
```
// SCHEDULE
function renderSchedule(p) {
```

Replace with the contents of `cs_js_replacement.txt` (pasted below).

---

## CHANGE 3 — Remove dead buildCallsheetHTML function

Near the bottom of the file, find and delete this entire dead function (it's never called):
```
// CALLSHEET HTML BUILDING
// ══════════════════════════════════════════

function buildCallsheetHTML(p, csIdx) {
  ...
}
```
It ends just before `function exportData()`.

---

That's it. Three changes, no other parts of the file need touching.
