import { EuiButtonPropsForButton } from "@elastic/eui/src/components/button/button";
import React, { ReactElement, useEffect, useState } from "react";
import {
  EuiButton,
  EuiButtonIcon,
  EuiConfirmModal,
  EuiPopover,
} from "@elastic/eui";
import { EuiPopoverProps } from "@elastic/eui/src/components/popover/popover";

//props for button with popover
type ButtonWithPopoverPropsPartials = {
  popoverProps?: Partial<
    Omit<
      EuiPopoverProps,
      "button" | "focusTrapProps" | "closePopover" | "isOpen"
    >
  >;
  buttonText?: JSX.Element | string;
  confirmDiscard?: boolean;
  isIcon?: boolean;
  iconType?: string;
  onRequestClose?: boolean;
};

export type ButtonWithPopoverProps = EuiButtonPropsForButton &
  ButtonWithPopoverPropsPartials;

/**
 *
 * @param onClick, an onClick function if desired
 * @param popoverContent optionally able to pass over an element to be in the popover
 * @param popoverProps optionally able to pass all the props for the popover
 * @param confirmDiscard optionally boolean to allow for confirming discarding changes
 * @returns a button with a popover that displays
 */
export default function ButtonWithPopover({
  iconType,
  children,
  buttonText,
  onRequestClose,
  isIcon,
  onClick,
  popoverProps,
  confirmDiscard,
  ...rest
}: ButtonWithPopoverProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const togglePopover = () => {
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  };
  const onButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    togglePopover();
    if (onClick) {
      onClick(event);
    }
  };

  //color changed by setting fill
  const button = isIcon ? (
    <EuiButtonIcon
      {...rest}
      children={buttonText}
      iconType={iconType || "none"}
      data-testid="button-icon"
      onClick={onButtonClick}
    />
  ) : (
    <EuiButton
      {...rest}
      children={buttonText}
      iconType={iconType}
      fill={true}
      data-testid="button-text"
      onClick={onButtonClick}
    />
  );

  let modal: JSX.Element | null = null;
  const [isModalVisible, setIsModalVisible] = useState(false);
  let showModal = () => {
    setIsPopoverOpen(false);
  };

  //TODO: Make this look better, it seems to confirm modal in EUI can't make the cofirm and discard buttons look good
  if (confirmDiscard) {
    /** Discard Confirmation Modal **/
    const closeModal = () => {
      setIsModalVisible(false);
    };
    showModal = () => {
      setIsModalVisible(true);
    };
    modal = isModalVisible ? (
      <EuiConfirmModal
        title="Discard changes?"
        data-testid="modal"
        onCancel={closeModal}
        onConfirm={() => {
          closeModal();
          setIsPopoverOpen(false);
        }}
        cancelButtonText="Keep editing"
        confirmButtonText="Discard changes"
        defaultFocusedButton="cancel"
        buttonColor="primary"
      >
        <p>Unsaved changes will be lost.</p>
      </EuiConfirmModal>
    ) : null;
  }

  if (onRequestClose && isPopoverOpen) {
    setIsPopoverOpen(false);
  }
  const popoverStatus = onRequestClose ? false : isPopoverOpen;
  return (
    <>
      <EuiPopover
        panelPaddingSize="m"
        {...popoverProps}
        button={button}
        isOpen={popoverStatus}
        closePopover={() => {
          setIsPopoverOpen(false);
        }}
        focusTrapProps={{
          clickOutsideDisables: false,
          onClickOutside: showModal,
        }}
      >
        {children}
      </EuiPopover>
      {confirmDiscard && modal}
    </>
  );
}

export type ButtonWithClosablePopoverProps = {
  closeProp: string;
  popoverExtra?: (child: JSX.Element) => JSX.Element;
} & ButtonWithPopoverProps;
export function ButtonWithClosablePopover(
  props: ButtonWithClosablePopoverProps,
) {
  const [forceClose, setForceClose] = useState(false);

  const { children, closeProp, popoverExtra, ...rest } = props;
  useEffect(() => {
    if (forceClose) {
      setForceClose(false);
    }
  }, [forceClose]);

  const modifiedPopoverContent = () => (
    <>
      {React.Children.map(children, (child) => {
        if (!child) {
          return undefined;
        }
        return React.cloneElement(child as ReactElement, {
          [closeProp]: () => {
            setForceClose(true);
          },
        });
      })}
    </>
  );

  const content = popoverExtra
    ? popoverExtra(modifiedPopoverContent())
    : modifiedPopoverContent();

  return (
    <ButtonWithPopover {...rest} onRequestClose={forceClose}>
      {content}
    </ButtonWithPopover>
  );
}
