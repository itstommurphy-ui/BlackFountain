# Repository Guidelines

## Project Structure & Module Organization

Black Fountain (formerly FilmForge) is a frontend-heavy web application. The architecture relies on a global shared state and dynamic view rendering.

- **Main Entry**: `index.html` is the primary entry point.
- **JS Logic**: Located in `js/`. Central logic like `store.js` manages persistence, while `view-loader.js` handles dynamic template loading.
- **Views**: UI components are split between `html/views/` (templates), `js/views/` (view-specific logic), and `css/views.css`.
- **Persistence**: Managed via a global `store` object with helpers like `saveStore` and `loadStore`.
- **Sub-projects**: `free-claude-code/` is a self-contained Python-based utility with its own `AGENTS.md` and build system.

## Build, Test, and Development Commands

Commands are managed via `package.json` in the root.

- **Start dev server (Node)**: `npm run dev` (uses `serve` on port 3000)
- **Start dev server (Python)**: `npm run dev:python` (uses `http.server` on port 3000)
- **Lint code**: `npm run lint` (uses ESLint)

## Coding Style & Naming Conventions

The project uses **ESLint v10** with a flat configuration in `eslint.config.js`.

- **Global Scope**: The application relies heavily on global variables for store management, UI helpers, and cross-module functions. These are explicitly defined in the lint configuration.
- **Event Handlers**: Functions prefixed with `_` (e.g., `_getActiveBd`) are typically called from HTML `onclick` or `onsubmit` handlers. The `no-unused-vars` rule is configured to ignore these.
- **Accessibility**: WCAG 2.2 AA compliance is a core project requirement.
- **Naming**: Ensure all new files and references use the "Black Fountain" branding rather than the legacy "FilmForge".

## Commit & Pull Request Guidelines

Commit messages follow an **"Action: Description"** pattern.

- **Fix**: `Fix: Resolved issue with project overview not rendering...`
- **Feature/Change**: `Add: ...`, `Remove: ...`, `Consolidate: ...`
- **Refactor**: `Rename FilmForge to Black Fountain in all source files`
