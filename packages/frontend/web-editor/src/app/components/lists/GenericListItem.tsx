import {
  EuiCard,
  EuiTitle,
  EuiFlexItem,
  EuiFlexGroup,
  EuiAvatar,
  EuiText,
  EuiButtonIcon,
  EuiListGroupItem,
  logicalStyle,
  useEuiTheme,
  useEuiPaddingSize,
  EuiButton,
  EuiPopover,
  EuiOverlayMask
} from "@elastic/eui";
import { Fragment, useState } from "react";
import { Link, PathRouteProps, useNavigate } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import DeleteItemBox from "../listchanging/deleteItemBox";


//title is required, description isnt required but is typically present
export interface GenericListItemProps {
  key: number,
  label?: LabelJSON,
  path: string,
}

/**
 *
 * @param props
 */
export default function GenericListItem(props: GenericListItemProps) {

  //grabs the props
  const { label, key, path} = props;

  //hook state thing for the deletebox
  const [deleteVisible, setDeleteVisible] = useState(false);

  //sets the delete button visible on click
  const onDeleteClick = () =>{
    setDeleteVisible(!deleteVisible)
  }

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
        <Link to={path}>
          {/*<EuiTitle size="xs">*/}
            <Link to={path}>
              <EuiText size="m" color="default" grow={false}>
                <strong>{label?.name}</strong>
              </EuiText>
            </Link>
            {/*</EuiTitle>*/}
          <EuiText size="s" color="subdued" grow={false}>
            {label?.description}
          </EuiText>
        </Link>
      }
      key={key}
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
    >
      
    </EuiListGroupItem>
      {/** toggles the delete overlay, is out side of the list group */}
      {deleteVisible && (
        <EuiOverlayMask>
          <DeleteItemBox title={label?.name} page='models' toggleBox={setDeleteVisible}></DeleteItemBox>
        </EuiOverlayMask>
      )}
    </>
  );
}
