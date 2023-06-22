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
                <EuiFlexItem grow={10}>
                    <ModelPageFilter/>
                </EuiFlexItem>
            </EuiFlexGroup>
        </>
    )
}