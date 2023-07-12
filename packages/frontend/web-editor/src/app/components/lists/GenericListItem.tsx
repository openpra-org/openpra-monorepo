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

  //for popover
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onButtonClick = () =>
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  const closePopover = () => setIsPopoverOpen(false);

  //sets the delete button visible on click
  const onDeleteClick = () =>{
    setDeleteVisible(!deleteVisible)
  }

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
      {deleteVisible && (
        <EuiOverlayMask>
          <DeleteItemBox title={label?.name} page='models' toggleBox={setDeleteVisible}></DeleteItemBox>
        </EuiOverlayMask>
      )}
    </>
    
    //   {/** Is all set up as flex items so that spacing and such works correctly */}
    //   <EuiFlexItem grow={false}>
    //     <EuiCard
    //       layout="horizontal"
    //       icon={
    //         <EuiFlexGroup alignItems="center" gutterSize="s">
    //           <EuiFlexItem grow={false}>
    //             {/** avatar is there to give the circle with the title, does all initials, but I believe can be changed if needed
    //              * Added a margin to just line everything up much better
    //             */}
    //             <EuiAvatar color="#2C041D" name={title} size="l" style={{marginTop: '5px'}} />
    //           </EuiFlexItem>
    //           <EuiFlexItem>
    //             <span>Card Title</span>
    //           </EuiFlexItem>
    //         </EuiFlexGroup>
    //       }
    //       //has a key that sets to the title, the rest is passed in as expected as props
    //       title={title}
    //       description={description}
    //       key={title}
    //       onClick={handleCardClick}
    //       //On click function that will eventually navigate to the proper page
    //       //onClick={}
    //     >
    //     </EuiCard>
    //   </EuiFlexItem>
    //     {/** Rational for styling: These couldn't be in the card object themselves because they cannot support than many compenents
    //      * in addition the card really likes to align vertically instead of horizontally
    //      * the negative top margin is to make it so there isnt a ton of space between the cards
    //      * the position is to move it from underneath the card to on in in the middle on the right
    //      * flex end puts it to the right of the page/flex group
    //      * MarginLeft is so that it doesnt interfere with the href on the card itself
    //      * Made to be iconbuttons so they can have hover over text
    //      */}
    //     <EuiFlexGroup justifyContent="flexEnd" style={{ marginTop: "-25px", position: 'relative', top:'-35px', right:'20px'}}>
    //         {/** This is where the text for last modified goes, eventually this should be updated accordingly */}
    //         <EuiFlexItem grow={false}>
    //           <EuiText style={{ whiteSpace: 'nowrap'}}>Last Modified: 24124124124123</EuiText>
    //         </EuiFlexItem>
    //         {/** This is the settings/gear icon, moved 3 pixels as to line up a bit better */}
    //         <EuiFlexItem grow={false} >
    //           <EuiButtonIcon href='model/1/settings' color='text' iconType='gear' title='settings'/>
    //         </EuiFlexItem>
    //         {/** This is the more info chart icon, moved 3 pixels as to line up a bit better */}
    //         <EuiFlexItem grow={false} >
    //           <EuiButtonIcon href='model/1/quantificationHistory' color='text' iconType='visArea' title='results'/>
    //         </EuiFlexItem>
    //         {/** This is the Copy icon, moved 3 pixels as to line up a bit better */}
    //         <EuiFlexItem grow={false} >
    //             <EuiButtonIcon color='text' iconType='copy' title='clone'/>
    //         </EuiFlexItem>
    //         {/** This is the delete icon, moved 3 pixels as to line up a bit better, eventually this will lead to a pop up menu */}
    //         <EuiFlexItem grow={false}>
    //           <EuiButtonIcon color='text' onClick={onDeleteClick} iconType='trash' title='delete'/>
    //         </EuiFlexItem>
    //       </EuiFlexGroup>
    //     {/** this is where the delete overlay mask will go for confiring a delete */}
        
  );
}
