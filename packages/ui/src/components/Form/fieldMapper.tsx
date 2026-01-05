import React from "react";
import {
  TextField,
  NumberField,
  TextAreaField,
  RangeField,
  PasswordField,
  TextAreaFieldProps,
  TextFieldInput,
  NumberFieldInput,
  TextAreaFieldInput,
  PasswordFieldInput,
  RangeFieldInput,
} from "@/components/Fields";
import { ChoiceListField, ChoiceListFieldInput, ChoiceListFieldProps } from "@/components/Fields/ChoiceListField";
import { InputProps } from "@/components/Fields/FieldBase";
import { FormFieldConfig } from "./types";

/**
 * Maps a FormFieldConfig to the corresponding fieldInput function expected by the Field component.
 * This enables DynamicForm to render the correct specialized field based on configuration.
 */
export function getFieldInput(config: FormFieldConfig): React.FC<InputProps | any> {
  switch (config.type) {
    case "text":
      return TextFieldInput;

    case "number":
      return NumberFieldInput;

    case "textarea":
      return TextAreaFieldInput

    case "range":
      return RangeFieldInput

    case "password":
      return PasswordFieldInput

    case "choice": {
      // Type narrowing ensures options and optionComponent are present
      const choiceConfig = config as FormFieldConfig & { options: any[]; optionComponent: React.FC<any> };

      if (!choiceConfig.options || !choiceConfig.optionComponent) {
        console.warn(`Choice field "${config.name}" is missing options or optionComponent. Falling back to TextField.`);
        return TextFieldInput
      }

      return ChoiceListFieldInput //TODO: define correctly the input type props

    }

    case "custom": {
      const customConfig = config as FormFieldConfig & { customComponent: React.FC<InputProps> };

      if (!customConfig.customComponent) {
        console.warn(`Custom field "${config.name}" is missing customComponent. Falling back to TextField.`);
        return TextFieldInput;
      }

      return customConfig.customComponent;
    }

    default:
      // Exhaustiveness check – TypeScript will warn if a new type is added without handling
      const _exhaustiveCheck: never = config;
      return TextFieldInput;
  }
}