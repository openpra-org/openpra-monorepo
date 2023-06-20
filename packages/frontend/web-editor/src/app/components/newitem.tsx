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
    EuiSelectableOption
} from '@elastic/eui'
import {addItemDataToList} from './largecomponents/ModelItemsList'

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
  export interface NewItemProps {
    title: string
    page: string
    users?: string[]
  }
  

  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function NewItem(props: NewItemProps) {

    //use the theme
    const {euiTheme} = useEuiTheme();

    //grabbing the props
    const { title, page, users } = props;

    //this is what is in the newItem strucutre, will eventually be used to actually make things
    //this is also subject tyo change, propbably needs a type passed in from props eventually
    const newItem = {
        title: '',
        description: '',
        users: [] as string[]
    }

    //use states that change things, called by functions later
    const [itemInfo, setItemInfo] =useState(newItem)

    const [options, setOptions] = useState<EuiSelectableOption[]>([]);

    const [selectedOptions, setSelectedOptions] = useState<EuiSelectableOption[]>([]);

    //this shows which things have actually been selected
    useEffect(() => {
        if(users){
        const selectableOptions = users.map((user) => ({
        label: user,
        }));
        setOptions(selectableOptions);
        }
    }, [users]);

    useEffect(() => {
        const filterOptionsElement = document.querySelector(
          '.euiSelectableList__searchMessage'
        );
        if (filterOptionsElement) {
          filterOptionsElement.textContent = 'Search users';
        }
      }, []);

    //this does something if users exist, it will map the users in the new item to the selected users
    const handleOptionChange = (newOptions: EuiSelectableOption[]) => {
        const selectedUsers = newOptions.map((option) => option.label);
        setItemInfo({
          ...itemInfo,
          users: selectedUsers,
        });
      };

    // Event handler that handles the result
    const handleClick = () => {
        addItemDataToList(newItem);
        // Handle the newItemData or perform any other actions
    };

    return (
            //this styling is so its in a nice looking box, it scales if the users tab is there or not
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '500px', borderRadius: '5px'}}>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiTextColor style={{margin: '10px', fontSize: '2rem'}}><strong>{title}</strong></EuiTextColor>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiFieldText
                        fullWidth={true}
                        placeholder="Title"
                        value={itemInfo.title}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           title: e.target.value
                        })}
                    />
                </EuiFormRow>
                {/** this form row is for the description */}
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiTextArea
                        fullWidth={true}
                        placeholder="Description"
                        resize='none'
                        value={itemInfo.description}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           description: e.target.value
                        })}
                    />
                </EuiFormRow>
                {/** toggles if users exists and is passed, and it shows the selectable menu of users */}
                {users &&(
                    <>
                        <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                           <EuiSelectable
                                options={options}
                                onChange={(newOptions) => {
                                    console.log(setOptions(newOptions));
                                }}
                                searchable
                                singleSelection={false}
                                >
                                {(list, search) => (
                                    <div>
                                    {search}
                                    {list}
                                    </div>
                                )}
                            </EuiSelectable>
                        </EuiFormRow>
                    </>
                )}
                {/** the submit and also the go back buttons are right here*/}
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
    )
}