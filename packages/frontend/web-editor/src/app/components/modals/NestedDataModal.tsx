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
interface OperatingStateData {
  definition: string;
  characteristics: string;
  processCriteriaIdentification?: string;
}
type OperatingStateFormState = OperatingStateData;
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
  const handleFormChange = <K extends keyof OperatingStateFormState>(
    field: K,
    value: OperatingStateFormState[K],
  ): void => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };
  const handleSave = (): void => {
    const cleaned: OperatingStateData = {
      definition: formState.definition.trim(),
      characteristics: formState.characteristics.trim(),
      processCriteriaIdentification: formState.processCriteriaIdentification?.trim() || undefined,
    };
    onSave(cleaned);
    onClose();
  };
  if (!isVisible) return null;
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
