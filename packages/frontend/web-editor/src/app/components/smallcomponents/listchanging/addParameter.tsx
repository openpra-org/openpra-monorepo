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
    EuiFieldNumber
} from '@elastic/eui'
import {addItemDataToList} from "../../largecomponents/lists/modelItemsList";

  

  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function () {

    //use the theme
    const {euiTheme} = useEuiTheme();

    interface item {
        name: string;
        value?: number;
    }

    //this is what is in the newItem strucutre, will eventually be used to actually make things
    //this is also subject tyo change, propbably needs a type passed in from props eventually
    const newItem : item = {
        name: '',
    }

    //use states that change things, called by functions later
    const [itemInfo, setItemInfo] =useState(newItem)

    const [options, setOptions] = useState<EuiSelectableOption[]>([]);

    const [selectedOptions, setSelectedOptions] = useState<EuiSelectableOption[]>([]);

    useEffect(() => {
        const filterOptionsElement = document.querySelector(
          '.euiSelectableList__searchMessage'
        );
        if (filterOptionsElement) {
          filterOptionsElement.textContent = 'Search users';
        }
      }, []);

    useEffect(() => {
        console.log(itemInfo.value)
    }, [itemInfo])

    // Event handler that handles the result
    const handleClick = () => {
    };

    const isValueValidNumber = typeof itemInfo.value === 'number' && !isNaN(itemInfo.value);

    return (
            //this styling is so its in a nice looking box, it scales if the users tab is there or not
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '500px', borderRadius: '5px'}}>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiTextColor style={{margin: '10px', fontSize: '2rem'}}><strong>New Global Parameter</strong></EuiTextColor>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiFieldText
                        fullWidth={true}
                        placeholder="Title"
                        value={itemInfo.name}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           name: e.target.value
                        })}
                    />
                </EuiFormRow>
                {/** this form row is for the description */}
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiFieldNumber
                        fullWidth={true}
                        placeholder="Value"
                        value={itemInfo.value}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           value: parseInt(e.target.value)
                        })}
                    />
                </EuiFormRow>
                {/** toggles if users exists and is passed, and it shows the selectable menu of users */}
                {/** the submit and also the go back buttons are right here*/}
                <EuiFormRow fullWidth={true}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs' style={{margin: '5px'}}>
                        <EuiFlexItem>
                            <EuiButton href="model/1/globalparameters" style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>Cancel</EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiButton isDisabled={(!isValueValidNumber || itemInfo.name.length === 0)}
                            href="model/1/globalparameters"
                            onClick={handleClick}
                            style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}
                            >Submit</EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
    )
}