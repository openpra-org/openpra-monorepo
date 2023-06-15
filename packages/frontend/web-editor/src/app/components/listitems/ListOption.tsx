import { EuiContextMenuItem } from "@elastic/eui";

export interface ListOptionProps {
  key: string,
  label: string,
  action?: () => void;
  href?: string;
}

/**
 *
 * @param props
 */
export default function ListOption(props: ListOptionProps) {
    const { key, label, action, href } = props;
  
    return (
      <EuiContextMenuItem key={key} onClick={action}>
        {label}
      </EuiContextMenuItem>
    );
  }
