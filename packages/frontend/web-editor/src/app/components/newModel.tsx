import {useState} from 'react'
import {NewModelProps} from 'packages/shared-types/src/lib/props/collab/modelProps'
import {
    EuiForm,
    EuiFieldText,
    EuiIcon,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem
} from '@elastic/eui'

export default function NewModel() {
    const DefaultProps: NewModelProps<string> = {
        title: '',
        description: '',
        assigned: []
    }

    const [modelInfo, setModelInfo] = useState(DefaultProps);

    return (
        <EuiFlexGroup justifyContent='center'>
            <EuiForm>
                <EuiTextColor>Bruh</EuiTextColor>
                <EuiFieldText
                    placeholder="Title"
                    value={modelInfo.title}
                    onChange={(e) => setModelInfo({
                        ...modelInfo,
                        title: e.target.value
                    })}
                />
                <EuiFieldText
                    placeholder="Description"
                    value={modelInfo.description}
                    onChange={(e) => setModelInfo({
                        ...modelInfo,
                        description: e.target.value
                    })}
                />
                <EuiFlexItem>
                    {}
                </EuiFlexItem>
            </EuiForm>
        </EuiFlexGroup>
    )
}