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
  

  //returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
export default function (){

    //use the theme
    const {euiTheme} = useEuiTheme();

    //this is what is in the newItem strucutre, will eventually be used to actually make things
    //this is also subject tyo change, propbably needs a type passed in from props eventually
    const newItem = {
        title:  '',
        description: '',
        users: [] as string[]
    }

    //use states that change things, called by functions later
    const [itemInfo, setItemInfo] =useState(newItem)

    const [options, setOptions] = useState<EuiSelectableOption[]>([]);

    const [selectedOptions, setSelectedOptions] = useState<EuiSelectableOption[]>([]);

    return (
            //This is similar to adding a new model, but instead updates it a bit
            // eventually the text in the fields will be autofilled with what is already in the model
            <EuiForm style={{backgroundColor: euiTheme.colors.lightestShade, padding: '10px', marginTop: '10px'}}>
                <EuiSpacer size='s'/>
                {/** this gives the text, and then importantly sets the title of the item */}
                <EuiTextColor style={{fontSize: '2rem'}}>Update model information</EuiTextColor>
                <EuiFormRow fullWidth={true} style={{marginTop: "20px"}}>
                    <EuiFieldText
                        fullWidth={true}
                        placeholder="Change Title"
                        value={itemInfo.title}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           title: e.target.value
                        })}
                    />
                </EuiFormRow>
                {/** this form row is for the description */}
                <EuiFormRow fullWidth={true}>
                    <>
                        <EuiTextArea
                            fullWidth={true}
                            placeholder="Change Description"
                            resize='none'
                            value={itemInfo.description}
                            onChange={(e) => setItemInfo({
                                ...itemInfo,
                            description: e.target.value
                            })}
                        />
                    </>
                </EuiFormRow>
                {/** toggles if users exists and is passed, and it shows the selectable menu of users */}
                    <>
                        <EuiFormRow fullWidth={true}>
                        <EuiSelectable
                            options={options}
                            onChange={(newOptions) => {
                                setOptions(newOptions);// call handleOptionChange with newOptions
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
                {/** the submit and also the go back buttons are right here*/}
                <EuiFormRow fullWidth={true} style={{alignItems: 'center'}}>
                    <EuiFlexGroup justifyContent='spaceBetween' gutterSize='xs' style={{margin: '5px', width: '200px'}}>
                        <EuiFlexItem grow={true}>
                            <EuiButton isDisabled={(itemInfo.users.length === 0 || itemInfo.title.length === 0)}
                            style={{backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade, borderRadius: '5px'}}
                            >Submit</EuiButton>
                        </EuiFlexItem>
                    </EuiFlexGroup>
                </EuiFormRow>
            </EuiForm>
    )
}