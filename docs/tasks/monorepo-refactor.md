# Task 1: Refactor Project Structure to Monorepo Layout

**Status:** Planned  
**Estimated Effort:** Medium  
**Last Updated:** December 18, 2025

## Objective
Restructure the existing project into a standardized pnpm monorepo format with dedicated directories for applications (apps/) and shared packages (packages/), enhancing modularity, code sharing, and maintainability.

## Steps
1. Create New Root Directories:  
   - Create `apps/` and `packages/` directories at the project root.  
   - Move the current `frontend/` directory contents to `apps/frontend/`.  
   - Move the current `backend/` directory contents to `apps/backend/`.

2. Handle Shared Packages:  
   - Create `packages/types/` and move the existing `/types` directory contents there.  
   - Expand `packages/types/` with additional shared interfaces as needed.  
   - Create `packages/ui/` and extract reusable frontend UI components (e.g., BigButton.tsx, Field.tsx, IconSelector.tsx, and related Shadcn/UI components) from `apps/frontend/src/components/`.  
   - Update import paths in `apps/frontend/` to reference workspace aliases (e.g., `@trackbit/ui`).

3. Create Hacienda Client Package:  
   - Create `packages/hacienda-client/` as a placeholder (initial package.json and index.ts).

4. Update Workspace Configuration:  
   - Modify `pnpm-workspace.yaml` to include `apps/*` and `packages/*`.  
   - Add workspace scripts in root `package.json` if necessary.

5. TypeScript Configuration:  
   - Ensure individual tsconfig.json files extend root `tsconfig.base.json` and use project references.  
   - Use `workspace:*` dependencies in package.json files.

6. Retain Unchanged Directories:  
   - Keep `docs/`, `scripts/`, root configs unchanged.

7. Testing and Verification:  
   - Run `pnpm install`.  
   - Verify builds with filtered commands (e.g., `pnpm --filter @trackbit/frontend build`).

## Risks and Notes
- Perform incrementally to avoid build breaks.
- Optional: Add turbo.json for future caching.