### **Task 1: Refactor Project Structure to Monorepo Layout**

**Objective:** Restructure the existing project into a standardized pnpm monorepo format with dedicated directories for applications (apps/) and shared packages (packages/), enhancing modularity, code sharing, and maintainability.

**Steps:**

1. **Create New Root Directories:**  
   * Create apps/ and packages/ directories at the project root.  
   * Move the current frontend/ directory contents to apps/frontend/.  
   * Move the current backend/ directory contents to apps/backend/.  
2. **Handle Shared Packages:**  
   * Create packages/types/ and move the existing /types directory contents there.  
   * Expand packages/types/ with additional shared interfaces (e.g., Habit, API response contracts) as needed during subsequent development.  
   * Create packages/ui/ and extract reusable frontend UI components (e.g., BigButton.tsx, Field.tsx, IconSelector.tsx, and related Shadcn/UI components) from apps/frontend/src/components/ into this package.  
   * Update import paths in apps/frontend/ to reference @trackbit/ui (or similar workspace alias).  
3. **Create Hacienda Client Package:**  
   * Create packages/hacienda-client/ as a placeholder (initially empty or with a basic package.json and index.ts).  
   * This will serve as the target for the Hacienda integration in Task 2.  
4. **Update Workspace Configuration:**

   Modify `pnpm-workspace.yaml` to include:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```
   * Ensure root `package.json` includes workspace scripts if necessary (e.g., for linting or building all packages).  
5. **TypeScript Configuration:**  
   * Retain tsconfig.base.json at root.  
   * Update individual tsconfig.json files in apps/ and packages/ to extend the base and enable project references for cross-package type checking.  
   * Use workspace:\* dependencies in package.json files (e.g., "@trackbit/types": "workspace:\*").  
6. **Retain Unchanged Directories:**  
   * Keep docs/, scripts/, pnpm-lock.yaml, and any root configuration files (e.g., vercel.json) in place.  
7. **Testing and Verification:**  
   * Run pnpm install to regenerate the lockfile and link workspaces.  
   * Verify builds: `pnpm --filter @trackbit/frontend build` and `pnpm --filter @trackbit/backend build` (adjust filters based on package names).  
   * Add optional turbo.json for pipeline orchestration if task caching is desired in future.

**Estimated Effort:** Medium (primarily file movement and path updates). Perform incrementally to minimize disruptions.

### **Task 2: Implement Hacienda Client Package**

**Objective:** Develop a modular, reusable hacienda-client package in packages/hacienda-client/ to handle integration with Costa Rica's Ministerio de Hacienda electronic invoicing system, targeting **version 4.4** (mandatory since September 1, 2025, with over 146 schema adjustments including new fields for currency/exchange rates, payment methods, CAByS enhancements, and support for Recibo Electrónico de Pagos).

**Prerequisites:**

* Reference official documentation: XSD schemas and annexes available at https://atv.hacienda.go.cr/ATV/ComprobanteElectronico/docs/esquemas/2024/v4.4/.  
* Key changes from v4.3: Obligatory currency/exchange fields, new reference codes, combo product detailing, optional co-signatures, and CIIU 4 economic activity codes.

**Package Structure:**

```text
/packages/hacienda-client/  
├─ src/  
│  ├─ auth/  
│  │  ├─ auth-manager.ts     # JWT token acquisition and refresh  
│  │  └─ token-store.ts      # In-memory or persistent token caching  
│  ├─ crypto/  
│  │  ├─ key-loader.ts       # Load .p12 certificate (using node-forge or pkcs12)  
│  │  └─ signer.ts           # XAdES-EPES signing per Anexo 2  
│  ├─ models/  
│  │  ├─ invoice.types.ts    # TypeScript interfaces/Zod schemas for v4.4 documents (FacturaElectronica, etc.)  
│  │  ├─ cabys.ts            # CAByS code loader (fetch/embed catalog)  
│  │  └─ utils.ts            # Clave/Consecutivo generators  
│  ├─ transport/  
│  │  ├─ api-client.ts       # Axios instance with auth interceptor; methods for token, send, status  
│  │  └─ poller.ts           # Status polling with exponential backoff  
│  ├─ templates/  
│  │  └─ v4.4/               # Example XML templates or generation helpers  
│  └─ index.ts               # Barrel exports  
├─ package.json  
└─ tsconfig.json
```

**Implementation Details:**

1. **Dependencies:** Add axios, node-forge, xml-crypto, zod (or similar) via pnpm.  
2. **Core Functionality:**  
   * **Authentication:** POST to /recepcion/v1/token with credentials; handle short-lived JWT.  
   * **XML Generation:** Use templates or libraries to build compliant XML; validate against v4.4 XSD.  
   * **Signing:** Implement canonicalization, digest computation, and embedding of \<Signature\> element.  
   * **Submission:** Base64-encode signed XML; POST to /recepcion/v1/recepcion.  
   * **Status Check:** GET /recepcion/v1/estado/{clave}; implement poller for "procesando" states.  
   * **CAByS Integration:** Load official catalog; provide search/validation utilities.  
3. **Error Handling and Compliance:**  
   * Robust retry logic, contingency modes, and detailed error mapping from Hacienda responses.  
   * Support staging (api-stag...) and production endpoints.  
4. **Integration with Backend:**  
   * Add dependency @trackbit/hacienda-client in apps/backend/package.json.  
   * Expose services/routes in backend for invoice creation/submission.  
5. **Testing:**  
   * Unit tests for key generation, signing, and API mocks.  
   * Integration tests using Hacienda's staging environment.

**Estimated Effort:** High (regulatory compliance requires thorough validation). Prioritize core invoice types (FacturaElectronica) initially, expanding to others iteratively.

These tasks establish a scalable foundation while ensuring regulatory adherence. Proceed with Task 1 first to enable seamless package development in Task 2.
