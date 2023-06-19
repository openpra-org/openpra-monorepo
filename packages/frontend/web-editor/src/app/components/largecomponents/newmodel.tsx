import {useState} from 'react'
import {
    EuiForm,
    EuiFieldText,
    EuiTextColor,
    EuiFlexGroup,
    EuiFlexItem
} from '@elastic/eui'
import NewItem from '../newitem';

  export interface ModelOptionProps {
    users: string[]
  }
  


export default function NewModel(props: ModelOptionProps) {
    
    const { users } = props;

    const [modelInfo, setModelInfo] = useState(props);

    return (
        <NewItem title={'New Model'}/>
    )
}