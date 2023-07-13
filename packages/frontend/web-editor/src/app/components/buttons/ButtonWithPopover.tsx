import { EuiButtonPropsForButton } from "@elastic/eui/src/components/button/button";
import { useState } from "react";
import { EuiButton, EuiConfirmModal, EuiPopover } from "@elastic/eui";
import { EuiPopoverProps } from "@elastic/eui/src/components/popover/popover";

type ButtonWithPopoverPropsPartials = {
  popoverProps?: Partial<Omit<EuiPopoverProps, "button" | "focusTrapProps" | "closePopover" | "isOpen">>;
  popoverContent?: JSX.Element;
  confirmDiscard?: boolean
}

export type ButtonWithPopoverProps = EuiButtonPropsForButton & ButtonWithPopoverPropsPartials;
export default function({ onClick, popoverProps, popoverContent, confirmDiscard, ...rest }: ButtonWithPopoverProps) {

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const togglePopover = () => setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  const onButtonClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    togglePopover();
    if (onClick) {
      onClick(event)
    }
  }
  const button = <EuiButton {...rest} onClick={onButtonClick} />

  let modal: JSX.Element | null = null;
  let showModal = () => (setIsPopoverOpen(false));
  if(confirmDiscard) {
    /** Discard Confirmation Modal **/
    const [isModalVisible, setIsModalVisible] = useState(false);
    const closeModal = () => setIsModalVisible(false);
    showModal = () => setIsModalVisible(true);
    modal = isModalVisible ? (
      <EuiConfirmModal
        title="Discard changes?"
        onCancel={closeModal}
        onConfirm={() => {
          closeModal();
          setIsPopoverOpen(false);
        }}
        cancelButtonText="Keep editing"
        confirmButtonText="Discard changes"
        defaultFocusedButton="cancel"
        buttonColor="danger"
      >
        <p>Unsaved changes will be lost.</p>
      </EuiConfirmModal>
    ) : null;
  }

  return (
    <>
      <EuiPopover
        {...popoverProps}
        button={button}
        isOpen={isPopoverOpen}
        closePopover={() => setIsPopoverOpen(false)}
        focusTrapProps={{
          clickOutsideDisables: false,
          onClickOutside: showModal,
        }}
      >
        {popoverContent}
      </EuiPopover>
      {confirmDiscard && modal}
    </>
  );
}
