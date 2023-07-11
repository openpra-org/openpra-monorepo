import {useState} from 'react'
import {
    EuiForm,
    EuiFormRow,
    EuiFieldText,
    EuiButton,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem,
    EuiSpacer,
    useEuiTheme,
    EuiOverlayMask
} from '@elastic/eui'

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
  export interface NewItemProps {
    title: string, 
    page: string
  }
  

  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function DeleteItemBox(props: NewItemProps) {

    //use the theme
    const {euiTheme} = useEuiTheme();

    //State used to hold value within text box. User types 'yes' to unlock the submit button
    const [confirmDelete, setConfirmDelete] = useState('');

    //grabbing the props
    const { title, page } = props;

    function handleClick(): void {
        throw new Error('Function not implemented.');
    }


    return (
        <EuiOverlayMask>
            {/** this styling is so its in a nice looking box, it scales if the users tab is there or not */}            
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '400px', borderRadius: '5px'}}>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiTextColor style={{margin: '10px', fontSize: '2rem'}}><strong>Delete {title}</strong></EuiTextColor>
            {/** the submit and also the go back buttons are right here*/}
                <EuiFormRow style={{margin: '10px'}}>
                    <EuiTextColor>
                        Are you sure you want to delete this model? This action is permanent
                    </EuiTextColor>
                </EuiFormRow>
            {/** confirmation text */}
            <EuiFormRow fullWidth ={true} style={{margin: '10px'}}>
                {/** User will enable the submit button by typing yes in this text box */}
                <EuiFieldText
                    placeholder='Please type Yes to proceed'
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                />
            </EuiFormRow>

            {/** button to submit is equipped with the ability to  */}
            <EuiFormRow fullWidth={true}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs' style={{margin: '5px'}}>
                        <EuiFlexItem>
                            <EuiButton href={page} style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>Cancel</EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem>
                            {/** This button will only be clickable when user types yes/Yes/YES/etc */}
                            <EuiButton isDisabled={!(confirmDelete.toLowerCase() === 'yes')} href={page} onClick={handleClick}
                                       style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}
                            >
                                Submit
                            </EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
        </EuiOverlayMask>
    )
}