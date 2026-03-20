# Hacienda Client Guidelines

## Overview

Costa Rican e-invoicing client for Hacienda API v4.4 compliance. Handles digital signing, XML generation, and API communication with the tax authority. **Status: Work in progress — skeleton structure in place.**

## Key Directories

```
├── index.ts                  # Package entry (WIP)
├── auth/
│   ├── auth-manager.ts       # OAuth token management with Hacienda (WIP)
│   └── token-store.ts        # Token persistence
├── crypto/
│   ├── key-loader.ts         # P12/PFX certificate loading
│   └── signer.ts             # XML digital signing (XAdES)
├── models/
│   ├── invoice.schema.ts     # Zod invoice validation schema
│   └── cabys.ts              # CABYS product codes (CR tax classification)
├── templates/
│   └── v4.3/                 # XML templates for invoice generation
└── transport/
    ├── api-client.ts         # Hacienda API HTTP client (WIP)
    └── poller.ts             # Status polling for async invoice processing
```

## Key Concepts

- **Hacienda:** Costa Rica's tax authority API for electronic invoicing.
- **CABYS:** National product/service classification codes.
- **XAdES:** XML digital signature format required by Hacienda.
- **P12 certificates:** Cryptographic keys issued by Costa Rican CA for signing.
- Uses `node-forge` for crypto, `xml-crypto` for XML signing, `axios` for HTTP.
- Zod schemas validate invoice data before XML generation.

## Reference

See `docs/tasks/hacienda-client-package.md` for detailed implementation plan.
