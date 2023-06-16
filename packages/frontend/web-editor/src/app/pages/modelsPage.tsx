import { EuiFlexGroup, EuiSpacer } from '@elastic/eui'
import {PageHeader, ModelsBar, Filter} from '../components/headers'
import {Models} from '../components/models'

export default function ModelsPage() {
    //this page is used to display all of our big components on a main page.
    return (
        <>
            <PageHeader />
            <Filter />
            <Models />
        </>
    )
}