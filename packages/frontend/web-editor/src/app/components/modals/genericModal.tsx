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
                .then(() => {
                  setIsLoading(false);
                })
                .catch((_: unknown) => {
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
