# Task 2: Implement Hacienda Client Package

**Status:** Planned (Prerequisite: Task 1)  
**Estimated Effort:** High  
**Last Updated:** December 18, 2025

## Objective
Develop a modular, reusable `hacienda-client` package for integration with Costa Rica's Ministerio de Hacienda electronic invoicing system, targeting **version 4.4** (mandatory since September 1, 2025, featuring over 146 schema adjustments, including obligatory currency/exchange rate fields, new payment methods, enhanced CAByS, Recibo Electrónico de Pagos support, and CIIU 4 codes).

## Prerequisites
- Official schemas: https://atv.hacienda.go.cr/ATV/ComprobanteElectronico/docs/esquemas/2024/v4.4/
- Key v4.4 changes: New Recibo Electrónico de Pagos (REP), expanded payment methods (e.g., SINPE Móvil, PayPal), obligatory receptor economic activity code in certain cases, enhanced import purchase invoices.

## Package Structure

/packages/hacienda-client/
├─ src/
│  ├─ auth/          # JWT handling
│  ├─ crypto/        # .p12 signing (XAdES-EPES)
│  ├─ models/        # Types/Zod schemas for v4.4 (invoice.types.ts, cabys.ts)
│  ├─ transport/     # API client and polling
│  ├─ templates/v4.4/
│  └─ index.ts
├─ package.json
└─ tsconfig.json

## Implementation Details
(Insert your full details here: dependencies, core functionality, error handling, etc.)

## Integration and Testing
- Add dependency in `apps/backend/`.
- Prioritize FacturaElectronica; expand iteratively.
- Use staging environment for tests.