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
    EuiTitle,
    EuiButtonEmpty,
} from '@elastic/eui'
import { useNavigate } from 'react-router-dom';
import TypedModelApiManager from 'packages/shared-types/src/lib/api/TypedModelApiManager';

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
  export interface DeleteItemProps {
    id: number
    itemName: string
    typeOfModel: string
    deleteTypedEndpoint?: (id: number) => {};
    deleteNestedEndpoint?: (id: number) => {};
  }
  

/**
 * 
 * @param title takes in an optional title string
 * @param id takes in an optional id which later be used to interacti with the database
 * @param toggleBox this needs to be there to toggle the deltebox on and off accross components, a state to set the delete box being visible
 * @returns 
 */
export default function DeleteItemBox(props: DeleteItemProps) {

    //State used to hold value within text box. User types 'yes' to unlock the submit button
    const [confirmDelete, setConfirmDelete] = useState('');

    //grabbing the props
    const {id, itemName, typeOfModel, deleteNestedEndpoint, deleteTypedEndpoint} = props;

    const navigate = useNavigate()

    //sets the data, then closes overlay
    const deleteData = () => {
        if(deleteTypedEndpoint){
            deleteTypedEndpoint(id)
        } else if (deleteNestedEndpoint) {
            deleteNestedEndpoint(id)
        }
        if(window.location.pathname.endsWith('settings')){
            navigate('')
        }
        location.reload()
    }

    return (
        <>
            {/** this styling is so its in a nice looking box, it scales if the users tab is there or not */}            
            <EuiForm>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiFormRow fullWidth={true}>
                    <EuiTitle size='m'><strong>Delete {itemName}</strong></EuiTitle>
                </EuiFormRow>
                 {/** the submit and also the go back buttons are right here*/}
                <EuiFormRow>
                    <EuiTextColor>
                        Are you sure you want to delete this model? This action is permanent
                    </EuiTextColor>
                </EuiFormRow>
                {/** confirmation text */}
                <EuiFormRow fullWidth ={true}>
                    {/** User will enable the submit button by typing yes in this text box */}
                    <EuiFieldText
                        placeholder='Please type yes to proceed'
                        value={confirmDelete}
                        onChange={(e) => setConfirmDelete(e.target.value)}
                    />
                </EuiFormRow>

            {/** button to submit is equipped with the ability to  */}
                <EuiFormRow fullWidth={true}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs'>
                        <EuiFlexItem>
                            {/** This button will only be clickable when user types yes/Yes/YES/etc */}
                            <EuiButton fill={true} color="danger" isDisabled={!(confirmDelete.toLowerCase() === 'yes')} onClick={deleteData}>
                                Delete
                            </EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
        </>
    )
}