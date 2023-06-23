//this is all placeholder so that I can test hrefs and stuff
import PageLayout from '../../components/largecomponents/pageLayout'
import {ModelPageFilter, PageHeader} from '../../components/smallcomponents/headers'

export default function DataInitiatingEvents() {
    return (
        <> 
            <PageLayout isModel={false} pageName='Data Initiating Events' contentType={
                <>
                    <ModelPageFilter/>
                    <div/>
                </>
            }/>
        </>
    )
}