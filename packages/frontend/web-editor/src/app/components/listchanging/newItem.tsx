import {useEffect, useState} from 'react'
import {
    EuiForm,
    EuiFormRow,
    EuiFieldText,
    EuiTextArea,
    EuiButton,
    EuiFlexGroup,
    EuiFlexItem,
    EuiSpacer,
    EuiSelectable,
    EuiSelectableOption,
    EuiTitle,
    EuiButtonEmpty
} from '@elastic/eui'

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
  export interface NewItemProps {
    title: string
    page?: string
    itemTitle?: string
    itemDescription?: string
    users?: string[]
    toggleBox: (isVisible: boolean) => void;
  }


  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function NewItem(props: NewItemProps) {

    //grabbing the props
    const { title, users, toggleBox } = props;

    //this is what is in the newItem strucutre, will eventually be used to actually make things
    //this is also subject tyo change, propbably needs a type passed in from props eventually
    const newItem = {
        title: props.itemTitle || '',
        description: props.itemDescription || '',
        users: [] as string[]
    }

    //use states that change things, called by functions later
    const [itemInfo, setItemInfo] =useState(newItem)
    const [options, setOptions] = useState<EuiSelectableOption[]>([]);

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
        const selectedUsers = newOptions
          .filter((option) => option.checked)
          .map((option) => option.label);
        setItemInfo({
          ...itemInfo,
          users: selectedUsers,
        });
      };

    //sets the data, then closes overlay
    const setData = () => {
        closeOverlay();
    }

    //just closes the overlay for adding items
    const closeOverlay = () => {
        toggleBox(false);
    }

    return (
            //Setting form width seems to be the only real way to make this look a little bigger
            <EuiForm style={{width: '300px'}}>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiFormRow fullWidth={true}>
                    <EuiTitle size='m'><strong>New {title}</strong></EuiTitle>
                </EuiFormRow>
                <EuiSpacer size="s"></EuiSpacer>
                <EuiFormRow fullWidth={true}>
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
                <EuiFormRow fullWidth={true}>
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
                    <EuiFormRow fullWidth={true}>
                        <EuiSelectable
                            options={options}
                            onChange={(newOptions) => {
                                setOptions(newOptions);
                                handleOptionChange(newOptions); // call handleOptionChange with newOptions
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
                )}
                {/** the submit and also the go back buttons are right here*/}
                <EuiFormRow fullWidth={true}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs'>
                        <EuiFlexItem>
                            <EuiButtonEmpty onClick={closeOverlay}>Cancel</EuiButtonEmpty>
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiButton fill={true} isDisabled={(users && (itemInfo.users.length === 0 )|| itemInfo.title.length === 0)}
                            onClick={setData}
                            >Submit</EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
    )
}
