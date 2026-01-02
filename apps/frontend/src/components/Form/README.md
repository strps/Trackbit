### **README: Dynamic Form Component for ShadCN \+ React Hook Form**

#### **Project Overview**

This module introduces DynamicForm, a flexible, configuration-driven form component designed to streamline form creation in React applications using ShadCN UI components and React Hook Form.

The primary goal is to eliminate repetitive manual field composition while maintaining full control over rendering, validation, accessibility, and customization. By providing an explicit array of field configurations, DynamicForm renders consistent, validated forms using the existing specialized field components (TextField, NumberField, TextAreaField, RangeField, ChoiceListField, PasswordField, etc.).

Future extensions will include generator functions to scaffold configurations from Zod or Drizzle schemas, but the initial implementation focuses solely on the robust, type-safe DynamicForm component itself.

#### **Key Features**

* Declarative field configuration with strong TypeScript support  
* Automatic mapping of configuration to existing specialized field components  
* Support for overrides (labels, placeholders, orientation, disabled state, etc.)  
* Full integration with React Hook Form and Zod validation  
* Ability to include additional (non-validated) fields or fully custom components  
* Consistent error handling, accessibility, and styling via the shared Field wrapper  
* Extensible design for future schema-to-config generators

#### **Installation**

No additional dependencies beyond existing project setup (React Hook Form, Zod, ShadCN UI).

#### **Usage Example**

```tsx  
import { z } from "zod";  
import { useForm } from "react-hook-form";  
import { zodResolver } from "@hookform/resolvers/zod";  
import { DynamicForm } from "@/components/forms/DynamicForm";

const schema \= z.object({  
  name: z.string().min(1, "Name is required"),  
  age: z.number().min(18).max(120),  
  bio: z.string().optional(),  
  role: z.enum(\["admin", "user", "guest"\]),  
  password: z.string().min(8),  
});

const formConfig \= \[  
  { name: "name", type: "text", label: "Full Name", placeholder: "John Doe" },  
  { name: "age", type: "range", label: "Age", min: 18, max: 120, step: 1 },  
  { name: "bio", type: "textarea", label: "Biography", placeholder: "Tell us about yourself..." },  
  {  
    name: "role",  
    type: "choice",  
    label: "Role",  
    mode: "single",  
    options: \[  
      { value: "admin", label: "Administrator" },  
      { value: "user", label: "Standard User" },  
      { value: "guest", label: "Guest" },  
    \],  
  },  
  { name: "password", type: "password", label: "Password" },  
  // Example of additional/custom field (not part of schema)  
  {  
    name: "terms",  
    type: "custom",  
    label: "Terms & Conditions",  
    customComponent: ({ field }) \=\> (  
      \<label className\="flex items-center gap-2"\>  
        \<input type\="checkbox" {...field} value\="true" /\>  
        \<span\>I accept the terms and conditions\</span\>  
      \</label\>  
    ),  
  },  
\];

export function UserForm() {  
  const form \= useForm({  
    resolver: zodResolver(schema),  
    defaultValues: { role: "user" },  
  });

  const onSubmit \= (data: any) \=\> {  
    console.log("Submitted:", data);  
  };

  return (  
    \<DynamicForm  
      form\={form}  
      config\={formConfig}  
      onSubmit\={form.handleSubmit(onSubmit)}  
      submitText\="Create Account"  
    /\>  
  );  
}
```

