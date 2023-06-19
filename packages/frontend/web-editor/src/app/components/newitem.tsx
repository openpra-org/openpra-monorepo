import {useState} from 'react'
import {
    EuiForm,
    EuiFormRow,
    EuiFieldText,
    EuiTextArea,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem,
    EuiSpacer,
    useEuiTheme
} from '@elastic/eui'

  export interface NewItemProps {
    title: string
    users?: string[]
  }
  


export default function NewItem(props: NewItemProps) {

    const {euiTheme} = useEuiTheme();

    const { title, users } = props;

    const [modelInfo, setModelInfo] = useState(props);

    return (
            <EuiForm style={{backgroundColor: euiTheme.colors.lightShade, alignSelf: 'center', width: '500px', borderRadius: '10px'}}>
                <EuiSpacer size='s'/>
                <EuiTextColor style={{margin: '10px', fontSize: '30px'}}><strong>{title}</strong></EuiTextColor>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiFieldText
                        fullWidth={true}
                        placeholder="Title"
                        //value={modelInfo.title}
                        onChange={(e) => setModelInfo({
                            ...modelInfo,
                           //title: e.target.value
                        })}
                    />
                </EuiFormRow>
                <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                    <EuiTextArea
                        fullWidth={true}
                        placeholder="Description"
                        resize='none'
                        //value={modelInfo.description}
                        onChange={(e) => setModelInfo({
                            ...modelInfo,
                           //description: e.target.value
                        })}
                    />
                </EuiFormRow>
                <EuiFlexItem>
                    {}
                </EuiFlexItem>
            </EuiForm>
    )
}