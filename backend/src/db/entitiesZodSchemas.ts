import * as schema from "./schema/index"
import { createSelectSchema, createUpdateSchema, createInsertSchema } from "drizzle-zod"

let exportSchema = {}

Object.keys(schema).forEach(key => {
    exportSchema[`${key}SelectSchema`] = createSelectSchema(schema[key])
    exportSchema[`${key}InsertSchema`] = createInsertSchema(schema[key])
    exportSchema[`${key}UpdateSchema`] = createUpdateSchema(schema[key])
})

export default exportSchema;


