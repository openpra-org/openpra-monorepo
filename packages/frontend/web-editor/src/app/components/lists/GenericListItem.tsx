import {
  EuiAvatar,
  EuiText,
  EuiListGroupItem,
  logicalStyle,
  useEuiTheme,
  useEuiPaddingSize,
  EuiOverlayMask
} from "@elastic/eui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import DeleteItemBox from "../listchanging/deleteItemBox";


//title is required, description isnt required but is typically present
export interface GenericListItemProps {
  id: number,
  label?: LabelJSON,
  path: string,
}

/**
 *
 * @param id takes in the id number of the objecty
 * @param path the path that the list item will send the user to after clicked
 * @param label this is an optional prop that passes a labelJSON
 */
export default function GenericListItem(props: GenericListItemProps) {

  const {euiTheme} = useEuiTheme();

  //grabs the props
  const { label, id, path} = props;

  //hook state thing for the deletebox
  const [deleteVisible, setDeleteVisible] = useState(false);

  //sets the delete button visible on click
  const onDeleteClick = () =>{
    setDeleteVisible(!deleteVisible)
  }
  // TODO
  //setting themeing constants to be used later
  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle("border-bottom", `${border.width.thin} solid ${border.color}`);
  const paddingLine = logicalStyle("padding-vertical", `${useEuiPaddingSize("s")}`);
  const customStyles = {...borderLine, ...paddingLine};
  return (
    <>
    <EuiListGroupItem
      style={customStyles}
      icon={
        <Link to={path}>
          {/** avatar with the abbreviation for the item, it is in a  link as is the other part so that clicks are seamless */}
          <EuiAvatar name={label?.name ? label.name : ""} size="l" type="space" />
        </Link>
      }
      label={
        <div>
          <Link to={path}>
            {/** this is the title for the item */}
            <EuiText size="m" color="default" grow={false}>
              <strong>{label?.name}</strong>
            </EuiText>
            {/** this is the description for the item */}
            <EuiText size="s" color="subdued" grow={false}>
              {label?.description}
            </EuiText>
          </Link>
        </div>
      }
      key={id}
      size="l"
      extraAction={{
        color: "danger",
        onClick: onDeleteClick,
        iconType: "trash",
        iconSize: "m",
        alwaysShow: true,
        "aria-label": "Favorite link4"
      }}
      wrapText
      // onClick={handleCardClick}
    />
      {/** toggles the delete overlay, is outside of the list group */}
      {deleteVisible && (
        <EuiOverlayMask>
          {/*TODO*/}
          <DeleteItemBox title={label?.name} id={id} toggleBox={setDeleteVisible}></DeleteItemBox>
        </EuiOverlayMask>
      )}
    </>
  );
}
