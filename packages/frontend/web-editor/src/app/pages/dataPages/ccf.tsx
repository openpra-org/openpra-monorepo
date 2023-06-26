//this is all placeholder so that I can test hrefs and stuff
import { EuiSpacer } from '@elastic/eui'
import PageLayout from '../../components/largecomponents/pageLayout'
import { ModelPageFilter } from '../../components/smallcomponents/headers'
import CcfTable from '../../components/largecomponents/ccfTable'

export default function Ccf() {
    return (
        <> 
            <PageLayout isModel={false} pageName='CCF' contentType={
                <>
                    <ModelPageFilter/>
                    <EuiSpacer size="m"/>
                    <CcfTable/>
                </>
            }/>
        </>
    )
}