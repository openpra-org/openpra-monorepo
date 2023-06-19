import {useState} from 'react'
import {NewModelProps} from 'packages/shared-types/src/lib/props/collab/modelProps'
import {
    EuiForm,
    EuiFieldText,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem
} from '@elastic/eui'

  export interface ModelOptionProps {
    users: string[]
  }
  


export default function NewModel(props: ModelOptionProps) {
    
    const { users } = props;

    const [modelInfo, setModelInfo] = useState(props);

    return (
        <EuiFlexGroup justifyContent='center'>
            <EuiForm>
                <EuiTextColor>Bruh</EuiTextColor>
                <EuiFieldText
                    placeholder="Title"
                    //value={modelInfo.title}
                    onChange={(e) => setModelInfo({
                        ...modelInfo,
                       //title: e.target.value
                    })}
                />
                <EuiFieldText
                    placeholder="Description"
                    //value={modelInfo.description}
                    onChange={(e) => setModelInfo({
                        ...modelInfo,
                       //description: e.target.value
                    })}
                />
                <EuiFlexItem>
                    {}
                </EuiFlexItem>
            </EuiForm>
        </EuiFlexGroup>
    )
}