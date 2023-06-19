import {useEffect, useState} from 'react'
import {
    EuiForm,
    EuiFormRow,
    EuiFieldText,
    EuiTextArea,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem,
    EuiSpacer,
    useEuiTheme,
    EuiSelectable,
    EuiSelectableOption
} from '@elastic/eui'

  export interface NewItemProps {
    title: string
    users?: string[]
  }
  


export default function NewItem(props: NewItemProps) {

    const {euiTheme} = useEuiTheme();

    const { title, users } = props;

    const newItem = {
        itemTitle: '',
        itemDescription: '',
        itemUsers: ['']
    }
    const [itemInfo, setItemInfo] =useState(newItem)

    const [options, setOptions] = useState<EuiSelectableOption[]>([]);

    useEffect(() => {
        if(users){
        const selectableOptions = users.map((user) => ({
        label: user,
        }));
        setOptions(selectableOptions);
        }
    }, [users]);

    return (
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '500px', borderRadius: '5px'}}>
                <EuiSpacer size='s'/>
                <EuiTextColor style={{margin: '10px', fontSize: '30px'}}><strong>{title}</strong></EuiTextColor>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiFieldText
                        fullWidth={true}
                        placeholder="Title"
                        value={itemInfo.itemTitle}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           itemTitle: e.target.value
                        })}
                    />
                </EuiFormRow>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiTextArea
                        fullWidth={true}
                        placeholder="Description"
                        resize='none'
                        value={itemInfo.itemDescription}
                        onChange={(e) => setItemInfo({
                            ...itemInfo,
                           itemDescription: e.target.value
                        })}
                    />
                </EuiFormRow>
                {users &&( 
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
                )}
                <EuiFlexItem>
                    {}
                </EuiFlexItem>
            </EuiForm>
    )
}