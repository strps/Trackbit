## Subtask 1A: Complete Core Monorepo Structure Refactoring (Excluding UI Package)

**Objective:** Finalize the foundational restructuring of the project into a pnpm monorepo layout, focusing on moving applications, shared types, and preparing the Hacienda client package. This excludes extraction of reusable UI components, which will be addressed in a future task.

### Steps

#### Verify Existing Moves
- Confirm that the contents of the original `frontend/` directory have been successfully relocated to `apps/frontend/`.
- Confirm that the contents of the original `backend/` directory (including `src/hacienda/`) have been successfully relocated to `apps/backend/`.

#### Implement Shared Types Package
- Create the directory `packages/types/`.
- Move all contents from the existing root-level `/types` directory (or equivalent shared type definitions) into `packages/types/`.
- Create or update `packages/types/package.json` with appropriate metadata (e.g., `"name": "@trackbit/types"`, `private: true`).
- Add a basic `index.ts` for barrel exports if needed.

#### Prepare Hacienda Client Package Placeholder
- Create the directory `packages/hacienda-client/`.
- Initialize with a minimal structure: `package.json` (e.g., `"name": "@trackbit/hacienda-client"`), `tsconfig.json` extending the root base, and an empty `src/index.ts`.
- This serves as a foundation for subsequent Hacienda implementation without adding functionality yet.

#### Update Workspace and Configuration Files
- Edit `pnpm-workspace.yaml` at the root to specify:
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- Ensure root `package.json` supports workspace protocols (e.g., via scripts for filtering).
- Update `tsconfig.json` files in `apps/` and newly created `packages/` to extend `tsconfig.base.json` and incorporate project references for improved type checking across workspaces.

#### Dependency and Import Adjustments
- Where shared types are imported in `apps/frontend/` or `apps/backend/`, update paths to use workspace protocol (e.g., `"@trackbit/types": "workspace:*"` in relevant `package.json` files).
- Run `pnpm install` to relink workspaces and regenerate the lockfile.

#### Verification
- Execute builds and development servers: e.g., `pnpm --filter @trackbit/frontend dev` and `pnpm --filter @trackbit/backend dev`.
- Confirm no broken imports or type errors related to the relocated types.

**Estimated Effort:** Low to medium (focuses on file organization and configuration updates).

---

## Subtask 1B: Update TypeScript Configurations and Enable Full Workspace Integration

**Objective:** Refine TypeScript project references, path aliases, and tooling to ensure seamless cross-package development, type safety, and preparation for future expansions (including UI and Hacienda packages).

### Steps

#### Enhance Root and Package tsconfig Files
- In root `tsconfig.base.json`, ensure compiler options support module resolution suitable for monorepos (e.g., `"composite": true`, `"declaration": true` where appropriate).
- For each package in `packages/` and app in `apps/`, configure `tsconfig.json` with:
  ```json
  "extends": "../../tsconfig.base.json",
  "references": [{ "path": "../types" }, ...]
  ```
  (as applicable for dependencies).
- Add path aliases if used (e.g., in `compilerOptions.paths` for `@trackbit/*` mappings).

#### Dependency Management
- In `apps/frontend/package.json` and `apps/backend/package.json`, add dependencies to shared packages using workspace protocol (e.g., `"@trackbit/types": "workspace:*"`).
- For the placeholder `packages/hacienda-client/`, add it as a dependency in `apps/backend/package.json` once ready.

#### Optional Tooling Additions
- Create a `turbo.json` at the root with basic pipelines (e.g., for lint, build, dev tasks) to enable cached orchestration if project scale increases.
- Update root scripts in `package.json` for workspace-wide commands (e.g., `"dev:all": "pnpm -r dev"`).

#### Comprehensive Testing
- Run full type checking: `pnpm -r typecheck` or equivalent.
- Start both frontend and backend in parallel to verify runtime compatibility.
- Address any resolution errors from the restructuring.

**Estimated Effort:** Medium (involves configuration tuning and cross-verification).