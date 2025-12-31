# **CRUD Utilities for Drizzle ORM and Hono**

This repository provides two reusable utility functions designed to streamline the development of type-safe CRUD APIs using **Drizzle ORM**, **drizzle-zod**, and **Hono**.

## **Files**

* crud-validation-schemas.ts – Generates Zod validation schemas tailored for common CRUD operations.  
* crud-router-factory.ts – Creates a fully configured Hono router with standard CRUD endpoints, validation, authentication, ownership checks, and extensibility.

## **Overview**

These utilities enable rapid, consistent, and secure implementation of RESTful resource endpoints. They handle:

* Automatic generation of Zod schemas from Drizzle table definitions.  
* Omission of server-managed fields (e.g., id, createdAt).  
* Support for composite primary keys.  
* Optional ownership-based access control.  
* Custom hooks (beforeCreate, beforeUpdate).  
* Operation overrides and custom endpoints.  
* Built-in authentication middleware integration.

## **drizzle-crud-schemas.ts**

### **Purpose**

Generates a set of Zod schemas optimised for typical CRUD API patterns.

### **Exported Function**

TypeScript  
generateValidationCrudSchemas\<T extends Table\>(table: T, options?)

### **Returned Schemas**

* create – Strict schema for insertion, omitting auto-generated fields.  
* update – Partial version of create, with a refinement requiring at least one field.  
* select – Full schema for response/serialisation.  
* id – Default schema for primary key path parameters (defaults to positive integer; overridable).  
* \_insertBase / \_selectBase – Raw base schemas for advanced customisation.

### **Options**

* refine – Apply common refinements (e.g., string trimming, date parsing) to all schemas.  
* omitFromCreateUpdate – Fields to exclude from create/update payloads (e.g., \['id', 'createdAt'\]).  
* omitFromSelect – Fields to exclude from response schemas (rare).  
* idSchema – Custom Zod schema for the primary key parameter.

### **Example**

TypeScript  
import { users } from '../db/schema.js';  
import { generateValidationCrudSchemas } from '../db/crud-validation-schemas.js';

const userSchemas \= generateValidationCrudSchemas(users, {  
  omitFromCreateUpdate: \['id', 'createdAt', 'updatedAt'\],  
  refine: (schema) \=\> schema.refine(...), // optional  
});

## **crud-router-factory.ts**

### **Purpose**

Generates a pre-configured Hono router implementing standard CRUD operations with validation, authentication, and security checks.

### **Exported Function**

TypeScript  
generateCrudRouter\<T extends AnyPgTable\>({ table, schemas, primaryKeyFields, ...options })

### **Key Options**

* table – The Drizzle table definition.  
* schemas – Output from generateValidationCrudSchemas.  
* primaryKeyFields – Array of column names forming the primary key (defaults to \['id'\] when present).  
* ownershipCheck – Async function to verify user ownership of a record.  
* beforeCreate / beforeUpdate – Hooks to modify data before persistence.  
* overrides – Replace default handlers for specific operations.  
* ommitOperations – Disable selected standard operations (e.g., \['delete'\]).  
* customEndpoints – Add arbitrary additional routes.  
* isPublic – Skip authentication middleware when true.

### **Generated Routes**

Assuming primary key id:

* GET / → List records (filtered by ownership if applicable)  
* GET /:id → Retrieve one record  
* POST / → Create new record  
* PATCH /:id → Partial update  
* DELETE /:id → Delete record

For composite keys (e.g., \['userId', 'projectId'\]), routes become /:userId/:projectId.

### **Example**

TypeScript  
import { projects } from '../db/schema.js';  
import { generateValidationCrudSchemas } from '../db/crud-validation-schemas.js';  
import { generateCrudRouter } from '../routes/utils/crud-router-factory.js';

const schemas \= generateValidationCrudSchemas(projects, {  
  omitFromCreateUpdate: \['id', 'createdAt'\],  
});

const projectsRouter \= generateCrudRouter({  
  table: projects,  
  schemas,  
  primaryKeyFields: \['id'\],  
  ownershipCheck: async (user, record) \=\> record.userId \=== user.id,  
  beforeCreate: async (c, data) \=\> ({ ...data, userId: c.get('user').id }),  
});

app.route('/projects', projectsRouter);

## **Benefits**

* Strong type safety throughout the stack (Drizzle → Zod → Hono).  
* Consistent validation and error formatting.  
* Reduced boilerplate for standard resource APIs.  
* Flexible enough for custom behaviour via hooks and overrides.  
* Supports both simple integer IDs and composite primary keys.

These utilities are particularly valuable in mid-to-large applications with many similar resources, promoting maintainability and consistency across the codebase.
