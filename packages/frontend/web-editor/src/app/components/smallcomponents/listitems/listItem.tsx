import { EuiCard, EuiFlexItem, EuiFlexGroup, EuiAvatar, EuiText, EuiButtonIcon} from "@elastic/eui";
import { useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import DeleteItemBox from "../listchanging/deleteItemBox";

//title is required, description isnt required but is typically present
export interface ItemProps {
  title: string,
  typeString: string,
  description?: string,
}

/**
 *
 * @param props
 */
export default function ListItem(props: ItemProps) {
  const { title, description, typeString } = props;

  const [deleteVisible, setDeleteVisible] = useState(false);

  function onDeleteClick(){
    setDeleteVisible(!deleteVisible)
  }

  const getPageType = (type: string) => {
    // Logic to determine the href based on the typeString
    // Example logic:
    if (type === "Model") {
      return "/model/1/overview";
    } else if (type === "Event Tree") {
      return "1";
    } else if (type === "Initiating Event"){
      return "1";
    } else if (type === "Fault Tree"){
      return "1";
    } else if (type === "Bayesian Network"){
      return "1";
    } else {
      return "1";
    }
  };

  const page = getPageType(typeString);

  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(page);
  };

  return (
    <>
      {/** Is all set up as flex items so that spacing and such works correctly */}
      <EuiFlexItem grow={false}>
        <EuiCard
          layout="horizontal"
          icon={
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                {/** avatar is there to give the circle with the title, does all initials, but I believe can be changed if needed 
                 * Added a margin to just line everything up much better
                */}
                <EuiAvatar color="#2C041D" name={title} size="l" style={{marginTop: '5px'}} />
              </EuiFlexItem>
              <EuiFlexItem>
                <span>Card Title</span>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          //has a key that sets to the title, the rest is passed in as expected as props
          title={title}
          description={description}
          key={title}
          onClick={handleCardClick}
          //On click function that will eventually navigate to the proper page
          //onClick={}
        > 
        </EuiCard>
      </EuiFlexItem>
        {/** Rational for styling: These couldn't be in the card object themselves because they cannot support than many compenents
         * in addition the card really likes to align vertically instead of horizontally
         * the negative top margin is to make it so there isnt a ton of space between the cards
         * the position is to move it from underneath the card to on in in the middle on the right
         * flex end puts it to the right of the page/flex group
         * MarginLeft is so that it doesnt interfere with the href on the card itself
         * Made to be iconbuttons so they can have hover over text
         */}
        <EuiFlexGroup justifyContent="flexEnd" style={{marginTop: "-25px", position: 'relative', top:'-35px', right:'20px'}}>
            {/** This is where the text for last modified goes, eventually this should be updated accordingly */}
            <EuiFlexItem grow={false}>
              <EuiText style={{ whiteSpace: 'nowrap'}}>Last Modified: 24124124124123</EuiText>
            </EuiFlexItem>
            {/** This is the settings/gear icon, moved 3 pixels as to line up a bit better */}
            <EuiFlexItem grow={false} >
              <EuiButtonIcon href='model/1/settings' color='text' iconType='gear' title='settings'/>
            </EuiFlexItem>
            {/** This is the more info chart icon, moved 3 pixels as to line up a bit better */}
            <EuiFlexItem grow={false} >
              <EuiButtonIcon href='model/1/quantificationHistory' color='text' iconType='visArea' title='results'/>
            </EuiFlexItem>
            {/** This is the Copy icon, moved 3 pixels as to line up a bit better */}
            <EuiFlexItem grow={false} >
                <EuiButtonIcon color='text' iconType='copy' title='clone'/>
            </EuiFlexItem>
            {/** This is the delete icon, moved 3 pixels as to line up a bit better, eventually this will lead to a pop up menu */}
            <EuiFlexItem grow={false}>
              <EuiButtonIcon color='text' onClick={onDeleteClick} iconType='trash' title='delete'/>
            </EuiFlexItem>
          </EuiFlexGroup>
        {/** this is where the delete overlay mask will go for confiring a delete */}
        {deleteVisible && (
          <DeleteItemBox title='Model(s)' page='models'></DeleteItemBox>
        )}
    </>
  );
}
