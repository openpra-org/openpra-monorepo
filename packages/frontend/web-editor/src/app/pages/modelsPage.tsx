import { EuiFlexGroup, EuiSpacer } from '@elastic/eui'
import {PageHeader, ModelsBar, Filter} from '../components/headers'
import {Models} from '../components/models'

export default function ModelsPage() {
    return (
        <>
            <PageHeader />
            <Filter />
            <Models />
        </>
    )
}