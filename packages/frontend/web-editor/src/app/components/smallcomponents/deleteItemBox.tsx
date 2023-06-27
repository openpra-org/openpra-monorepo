import {useEffect, useState} from 'react'
import {
    EuiForm,
    EuiFormRow,
    EuiFieldText,
    EuiTextArea,
    EuiButton,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem,
    EuiSpacer,
    useEuiTheme,
    EuiSelectable,
    EuiSelectableOption,
    EuiOverlayMask
} from '@elastic/eui'
import {addItemDataToList} from "../largecomponents/modelItemsList";

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
  export interface NewItemProps {
    title: string, 
    page: string
  }
  

  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function DeleteItemBox(props: NewItemProps) {

    //use the theme
    const {euiTheme} = useEuiTheme();

    //grabbing the props
    const { title, page } = props;

    const [confirmText, setConfirmText] = useState('');

    const [isConfirmed, setIsConfirmed] = useState(false);

    function handleClick(): void {
        throw new Error('Function not implemented.');
    }

    function handleConfirm() {
        if (confirmText === 'yes') {
          setIsConfirmed(true);
        }
      }

    return (
        <EuiOverlayMask>
            {/** this styling is so its in a nice looking box, it scales if the users tab is there or not */}            
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '400px', borderRadius: '5px'}}>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiTextColor style={{margin: '10px', fontSize: '2rem'}}><strong>Delete {title}</strong></EuiTextColor>
            {/** the submit and also the go back buttons are right here*/}
            <EuiFormRow fullWidth ={true}>
                <EuiTextArea>
                    Howdy Partnder
                </EuiTextArea>
            </EuiFormRow>
            <EuiFormRow fullWidth={true}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs' style={{margin: '5px'}}>
                        <EuiFlexItem>
                            <EuiButton href={page} style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>Cancel</EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiButton href={page} onClick={handleClick} style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>Submit</EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
        </EuiOverlayMask>
    )
}