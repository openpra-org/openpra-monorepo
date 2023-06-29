import { EuiFlexGrid, EuiFlexItem} from '@elastic/eui'
import {PageHeader, Filter} from '../components/largecomponents/headers/headers'
import {Models} from '../components/largecomponents/stylingaids/models'

export default function ModelsPage() {
    //this page is used to display all of our big components on a main page.
    return (
        <>
            <PageHeader />
            <EuiFlexGrid gutterSize="none">
                {/** padding is here so it looks correct and lined up with the other elements */}
                <EuiFlexItem grow={true} style={{ padding: '0 8px' }}>
                    <Filter/>
                </EuiFlexItem>
                <EuiFlexItem grow={true}>
                    <Models/>
                </EuiFlexItem>
            </EuiFlexGrid>
        </>
    )
}