### **Implementation Plan**

#### **Phase 1: Core Types and Configuration Interface (1–2 hours)**

1. Create components/forms/types.ts  
   * Define FieldType enum: 'text' | 'number' | 'textarea' | 'range' | 'password' | 'choice' | 'custom'  
   * Define comprehensive FormFieldConfig interface with generics for choice options  
   * Define DynamicFormProps interface

#### **Phase 2: Field Mapping Utility (1 hour)**

2. Create components/forms/fieldMapper.ts  
   * Implement getFieldComponent(config: FormFieldConfig) that returns the appropriate wrapper:  
     * 'text' → TextField  
     * 'number' → NumberField  
     * 'textarea' → TextAreaField  
     * 'range' → RangeField (with min/max/step)  
     * 'password' → PasswordField  
     * 'choice' → ChoiceListField (with options and mode)  
     * 'custom' → direct use of provided customComponent as fieldInput

#### **Phase 3: DynamicForm Component (2–3 hours)**

3. Create components/forms/DynamicForm.tsx  
   * Accept form, config, onSubmit, optional submitText, className, etc.  
   * Use form.handleSubmit(onSubmit) on a \<form\> element  
   * Iterate over config and render each field using the Field wrapper from FieldBase  
   * For each config entry:  
     * Extract common props (label, placeholder, description, orientation, disabled, className)  
     * Compute fieldInput via the mapper utility  
     * Spread remaining config-specific props (e.g., min, max, options)  
     * Render \<Field key={name} name={config.name} form={form} fieldInput={...} {...commonProps} /\>  
   * Handle custom components correctly (pass as fieldInput directly)  
   * Optionally render a submit button at the bottom

#### **Phase 4: Type Safety and Edge Cases (1–2 hours)**

4. Ensure full TypeScript inference:  
   * Generics on ChoiceListField options  
   * Proper typing for custom components  
5. Add support for:  
   * Omitting fields from rendering while keeping them in schema (via hidden: true or separate omit array)  
   * Global form orientation/className  
   * Loading/submission states (disabled submit button via formState.isSubmitting)

#### **Phase 5: Testing and Polish (1–2 hours)**

6. Create example usage page with multiple form variations  
7. Verify accessibility, error display, and responsive behavior  
8. Add JSDoc comments and export barrel file

#### **Future Phases (Post-MVP)**

* Generator utilities: generateConfigFromZod(schema) and generateConfigFromDrizzle(table)  
* Support for field groups, sections, and conditional rendering  
* Layout grid configuration (e.g., colSpan)
