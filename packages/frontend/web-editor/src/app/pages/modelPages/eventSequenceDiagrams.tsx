//this is all placeholder so that I can test hrefs and stuff

import { ModelSubHeader } from '../../components/largecomponents/modelSubHeader'
import {PageHeader, ModelPageFilter} from '../../components/smallcomponents/headers'
import {EuiFlexGroup, EuiFlexItem} from '@elastic/eui'

export default function EventSequenceDiagrams() {
    return (
        <> 
            <PageHeader />

            <EuiFlexGroup direction='column'>
                <EuiFlexItem>
                    <ModelSubHeader pageName='Event Sequence Diagrams'/>
                </EuiFlexItem>
                {/**  the negative 56 is to move it up enough to have the same height as its other bar, while still looking good*/}
                <EuiFlexItem grow={10} >
                    <ModelPageFilter/>
                </EuiFlexItem>
            </EuiFlexGroup>
        </>
    )
}