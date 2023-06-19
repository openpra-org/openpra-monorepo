import {useState} from 'react'
import {
    EuiForm,
    EuiFieldText,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem
} from '@elastic/eui'

  export interface NewItemProps {
    title: string
  }
  


export default function NewItem(props: NewItemProps) {
    
    const { title } = props;

    const [modelInfo, setModelInfo] = useState(props);

    return (
        <EuiFlexGroup justifyContent='center'>
            <EuiForm>
                <EuiTextColor>{title}</EuiTextColor>
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