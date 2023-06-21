//This is a ListOption used for when a drop down list occurs
//Streamlined here and accounts for hrefs or on click actions
import { EuiContextMenuItem, useEuiTheme } from "@elastic/eui";

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

    const {euiTheme} = useEuiTheme();
    //Returns a context menu item that does something, either an onclick function href depending on what is passed
    return (
      //has to use the css to change the color, if I find another fix I will implement, but I wanted the context menus to look nice and clean
      <EuiContextMenuItem key={key} onClick={action} css={{color: euiTheme.colors.darkShade}} href={hrefName}> 
        {label}
      </EuiContextMenuItem>
    );
  }
