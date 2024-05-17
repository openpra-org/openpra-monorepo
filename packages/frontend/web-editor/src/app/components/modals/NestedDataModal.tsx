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

// Define the props interface with nested properties
interface NestedDataModalProps {
  isVisible: boolean;
  onClose: () => void;
  rowData: any; // Use a specific type for your data schema
  onSave: (data: any) => void; // Define the structure for your onSave data
}

const NestedDataModal: React.FC<NestedDataModalProps> = ({ isVisible, onClose, rowData, onSave }) => {
  // Local state for the form, initialize with rowData or defaults
  const [formState, setFormState] = useState({
    definition: rowData?.definition || "",
    characteristics: rowData?.characteristics || "",
    processCriteriaIdentification: rowData?.processCriteriaIdentification || "",
    // Add other fields from your schema as needed
    // ...
  });

  // Handle form state changes
  const handleFormChange = (field: string, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSave = () => {
    onSave(formState);
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

export default NestedDataModal;
