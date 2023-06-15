//This is a ListOption used for when a drop down list occurs
//Streamlined here and accounts for hrefs or on click actions
import { EuiContextMenuItem } from "@elastic/eui";

//List option takes in a key and a label garunteed
//then takes an action to be done on click or an href to do on click, or nothing
export interface ListOptionProps {
  key: string,
  label: string,
  action?: () => void;
  hrefName?: string;
}

/**
 *
 * @param props
 */
export default function ListOption(props: ListOptionProps) {
    const { key, label, action, hrefName } = props;

    //Returns a context menu item that does something, either an onclick function href depending on what is passed
    return (
      <EuiContextMenuItem key={key} onClick={action} href={hrefName}> 
        {label}
      </EuiContextMenuItem>
    );
  }
