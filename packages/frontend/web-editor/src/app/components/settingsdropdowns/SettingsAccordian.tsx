import { useState } from "react";
import { EuiButton, EuiAccordion } from "@elastic/eui";

const SettingsAccordian = ({
  id,
  children,
  buttonContent,
  initial = false,
}: {
  id: string;
  children: JSX.Element[] | JSX.Element;
  buttonContent: JSX.Element;
  initial?: boolean;
}): JSX.Element => {
  const [isOpen, setIsOpen] = useState(initial);

  const onToggle = (): void => {
    setIsOpen(!isOpen);
  };

  const extraAction = (
    <EuiButton
      color="accent"
      aria-label="Expand"
      onClick={onToggle}
      fill={isOpen}
    >
      {isOpen ? "Collapse" : "Expand"}
    </EuiButton>
  );

  return (
    <EuiAccordion
      id={id}
      buttonContent={buttonContent}
      extraAction={extraAction}
      paddingSize="l"
      forceState={isOpen ? "open" : "closed"}
      onToggle={onToggle}
      data-testid="settingsAccordian"
    >
      {children}
    </EuiAccordion>
  );
};

export { SettingsAccordian };
