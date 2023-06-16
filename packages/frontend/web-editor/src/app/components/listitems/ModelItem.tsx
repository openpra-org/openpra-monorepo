import { EuiCard, EuiSpacer, EuiFlexItem, EuiFlexGroup, EuiAvatar, EuiIcon, EuiButton, EuiText} from "@elastic/eui";

//title is required, description isnt required but is typically present
export interface ModelItemProps {
  title: string,
  description?: string;
}

/**
 *
 * @param props
 */
export default function(props: ModelItemProps) {
  const { title, description } = props;
  return (
    <>
      {/** Is all set up as flex items so that spacing and such works correctly */}
      <EuiFlexItem grow={false}>
        <EuiCard
          layout="horizontal"
          icon={
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                {/** avatar is there to give the circle with the title, does all initials, but I believe can be changed if needed */}
                <EuiAvatar name={title} size="l" />
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
         */}
        <EuiFlexGroup justifyContent="flexEnd" style={{marginTop: "-25px", position: 'relative', top:'-35px', right:'20px'}}>
            {/** This is where the text for last modified goes, eventually this should be updated accordingly */}
            <EuiFlexItem grow={false}>
              <EuiText>Last Modified:</EuiText>
            </EuiFlexItem>
            {/** This is the settings/gear icon, moved 4 pixels as to line up a bit better */}
            <EuiFlexItem style={{ position: 'relative', top:'4px' }} grow={false} >
              <EuiIcon type={'gear'}/>
            </EuiFlexItem>
            {/** This is the delete icon, moved 4 pixels as to line up a bit better, eventually this will lead to a pop up menu */}
            <EuiFlexItem style={{ position: 'relative', top:'4px' }} grow={false}>
              <EuiIcon type={'trash'}/>
            </EuiFlexItem>
          </EuiFlexGroup>
    </>
  );
}
