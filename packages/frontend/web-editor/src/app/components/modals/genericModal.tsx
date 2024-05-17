import {
  EuiButton,
  EuiButtonEmpty,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
} from "@elastic/eui";
import { useState } from "react";

/**
 * This component will return a generic modal
 * @param title - The title of the modal
 * @param body - The body of the modal could be anything for example a form component
 * @param onClose - What should happen on close of the modal
 * @param onSubmit - Async function that should be trigger when submit is clicked in the modal
 * @param modalFormId - A unique identifier for the modal could be generated
 * @param showButtons - If true will show the modal buttons
 */
const GenericModal = ({
  title,
  body,
  onClose,
  onSubmit,
  modalFormId,
  showButtons,
}: {
  title: string;
  body: JSX.Element;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  modalFormId: string;
  showButtons: boolean;
}): JSX.Element => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  return (
    <EuiModal
      onClose={onClose}
      initialFocus="[name=popswitch]"
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>{title}</EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>{body}</EuiModalBody>

      {showButtons && (
        <EuiModalFooter>
          <EuiButtonEmpty onClick={onClose}>Cancel</EuiButtonEmpty>

          <EuiButton
            type="button"
            form={modalFormId}
            isLoading={isLoading}
            onClick={(): void => {
              setIsLoading(true);
              onSubmit()
                .then((_) => {
                  setIsLoading(false);
                })
                .catch((_) => {
                  setIsLoading(false);
                });
            }}
            fill
          >
            Save
          </EuiButton>
        </EuiModalFooter>
      )}
    </EuiModal>
  );
};

export { GenericModal };
