//this is all placeholder so that I can test hrefs and stuff
import { EuiSpacer } from '@elastic/eui'
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout'
import { ModelPageFilter } from '../../components/largecomponents/headers/headers'
import CcfTable from '../../components/largecomponents/tables/ccfTable'

export default function Ccf() {
    return (
        <> 
            <PageLayout isModel={false} pageName='CCF' contentType={
                <>
                    <EuiSpacer size="m"/>
                    <CcfTable/>
                </>
            }/>
        </>
    )
}