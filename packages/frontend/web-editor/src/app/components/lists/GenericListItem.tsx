import {
  EuiAvatar,
  EuiText,
  EuiListGroupItem,
  logicalStyle,
  useEuiTheme,
  useEuiPaddingSize,
  EuiOverlayMask, EuiFlexGroup, EuiFlexItem, EuiButtonIcon
} from "@elastic/eui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import DeleteItemBox from "../listchanging/deleteItemBox";
import LastActionText from "../listitems/LastActionText";
import { ListItemContextMenuButton, ListItemEditAction } from "../listitems/ListItemAction";


//title is required, description isnt required but is typically present
export type GenericListItemProps = {
  id: number,
  label?: LabelJSON,
  endpoint: string,
  path: string,
  itemName: string;
};

/**
 *
 * @param props
 */
export default function GenericListItem(props: GenericListItemProps) {

  const {euiTheme} = useEuiTheme();

  //grabs the props
  const { itemName, label, id, path} = props;

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
          <EuiAvatar name={label?.name ? label.name : ""} size="l" type="space" />
        </Link>
      }
      label={
        <EuiFlexGroup direction="row" alignItems="center" responsive={false}>
          <EuiFlexItem grow={3}>
            <Link to={path}>
              <EuiText size="m" color="default" grow={false}>
                <strong>{label?.name}</strong>
              </EuiText>
            </Link>
          <EuiText size="s" color="subdued" grow={false}>
            {label?.description}
          </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={1}>
            <EuiFlexGroup direction="row" gutterSize="s">
              <ListItemEditAction action="edit" itemName={itemName} endpoint={path}/>
              <ListItemContextMenuButton {...props} />
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={1}>
            <EuiText color="subdued" textAlign="right">
              <small>
                <LastActionText action="viewed" timestamp={Date.now()}/>
              </small>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
      key={id}
      size="l"
      // extraAction={{
      //   color: "danger",
      //   onClick: onDeleteClick,
      //   iconType: "trash",
      //   iconSize: "m",
      //   alwaysShow: true,
      //   "aria-label": "Favorite link4"
      // }}
      wrapText={false}
      // onClick={handleCardClick}
    >
    </EuiListGroupItem>
      {/** toggles the delete overlay, is outside of the list group */}
      {deleteVisible && (
        <EuiOverlayMask>
          {/*TODO*/}
          {/*<DeleteItemBox title={label?.name} page='models' id={id} toggleBox={setDeleteVisible}></DeleteItemBox>*/}
        </EuiOverlayMask>
      )}
    </>
  );
}
