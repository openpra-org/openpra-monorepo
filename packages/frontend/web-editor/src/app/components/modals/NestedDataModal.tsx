import {
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
} from "@elastic/eui";
import React, { useState } from "react";

// Basic operating state data shape (extend as needed)
interface OperatingStateData {
  definition: string;
  characteristics: string;
  processCriteriaIdentification?: string;
  // TODO: Add further domain fields when they become required in UI
}

type OperatingStateFormState = OperatingStateData;

// Define the props interface with nested properties
interface NestedDataModalProps {
  isVisible: boolean;
  onClose: () => void;
  rowData?: Partial<OperatingStateData> | null;
  onSave: (data: OperatingStateData) => void;
}

const NestedDataModal: React.FC<NestedDataModalProps> = ({ isVisible, onClose, rowData, onSave }) => {
  const initial: OperatingStateFormState = {
    definition: rowData?.definition ?? "",
    characteristics: rowData?.characteristics ?? "",
    processCriteriaIdentification: rowData?.processCriteriaIdentification ?? "",
  };
  const [formState, setFormState] = useState<OperatingStateFormState>(initial);

  // Handle form state changes
  const handleFormChange = <K extends keyof OperatingStateFormState>(
    field: K,
    value: OperatingStateFormState[K],
  ): void => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSave = (): void => {
    // Minimal trim normalization (optional future enhancement)
    const cleaned: OperatingStateData = {
      definition: formState.definition.trim(),
      characteristics: formState.characteristics.trim(),
      processCriteriaIdentification: formState.processCriteriaIdentification?.trim() || undefined,
    };
    onSave(cleaned);
    onClose();
  };

  if (!isVisible) return null;

  // Form layout with fields for the properties from your schema
  return (
    <EuiModal
      onClose={onClose}
      style={{ width: "800px" }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>{rowData ? "Edit" : "Add"} Operating State</EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        <EuiForm component="form">
          {/* Repeat this pattern for each field in your form */}
          <EuiFormRow label="Definition">
            <EuiFieldText
              value={formState.definition}
              onChange={(e) => {
                handleFormChange("definition", e.target.value);
              }}
            />
          </EuiFormRow>
          <EuiFormRow label="Characteristics">
            <EuiFieldText
              value={formState.characteristics}
              onChange={(e) => {
                handleFormChange("characteristics", e.target.value);
              }}
            />
          </EuiFormRow>
          {/* Add more fields from your schema here */}
          {/* ... */}
        </EuiForm>
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButton onClick={onClose}>Cancel</EuiButton>
        <EuiButton
          onClick={handleSave}
          fill
        >
          Save
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
};

export { NestedDataModal };
