import { EuiFieldText, EuiForm, EuiFormRow } from "@elastic/eui";
import React from "react";

interface CategoryFormProps {
  newCategory: string;
  setNewCategory: (value: string) => void;
}

const CategoryForm = ({ newCategory, setNewCategory }: CategoryFormProps): JSX.Element => {
  return (
    <EuiForm>
      <EuiFormRow label="Category Name">
        <EuiFieldText
          placeholder="Enter category name"
          value={newCategory}
          onChange={(e) => {
            setNewCategory(e.target.value);
          }}
        />
      </EuiFormRow>
    </EuiForm>
  );
};

export { CategoryForm };
