import React from "react";
import {
  TextFieldInput,
  FileField,
  PasswordField,
  RangeField,
  TextAreaField,
  NumberField,
  TextField
} from "@/components/Fields";
import { ChoiceListField, ChoiceListFieldInput } from "@/components/Fields/ChoiceListField";
import { Field, FieldProps, InputProps } from "@/components/Fields/FieldBase";
import { ChoiceFieldConfig, FileFieldConfig, FormFieldConfig } from "./types";

/**
 * Maps a FormFieldConfig to the corresponding fieldInput function expected by the Field component.
 * This enables DynamicForm to render the correct specialized field based on configuration.
 */
export function getFieldInput(config: FormFieldConfig, form: any): React.ReactNode {
  switch (config.type) {
    case "text":
      return <TextField form={form} {...config} />;

    case "number":
      return <NumberField form={form} {...config} />;

    case "textarea":
      return <TextAreaField form={form} {...config} />

    case "range":
      return <RangeField form={form} {...config} />

    case "password":
      return <PasswordField form={form} {...config} />

    case "choice": {
      // Type narrowing ensures options and optionComponent are present
      const choiceConfig = config as ChoiceFieldConfig & { options: any[]; optionComponent: React.FC<any> };

      if (!choiceConfig.options || !choiceConfig.optionComponent) {
        console.warn(`Choice field "${config.name}" is missing options or optionComponent. Falling back to TextField.`);
        return <p>Missing options or optionComponent</p>
      }

      return <ChoiceListField form={form} {...choiceConfig} />
      //TODO: define correctly the input type props

    }

    case "custom": {
      const customConfig = config as FormFieldConfig & { customComponent: React.FC<InputProps> };

      if (!customConfig.customComponent) {
        console.warn(`Custom field "${config.name}" is missing customComponent. Falling back to TextField.`);
        return <TextField form={form} {...config} />;
      }

      return <Field form={form} {...config} fieldInput={customConfig.customComponent} />;
    }

    case "file":
      return <FileField form={form} {...config as FileFieldConfig} />;


    default:
      // Exhaustiveness check – TypeScript will warn if a new type is added without handling
      const _exhaustiveCheck: never = config;
    // return <TextField form={form} {...config as } />;
  }
}