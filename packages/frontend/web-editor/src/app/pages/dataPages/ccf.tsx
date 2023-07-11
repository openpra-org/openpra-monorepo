//this is all placeholder so that I can test hrefs and stuff
import { EuiSpacer } from '@elastic/eui'
import CcfTable from '../../components/tables/ccfTable'
import PageLayout from '../../components/stylingaids/pageLayout'

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