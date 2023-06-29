//this is all placeholder so that I can test hrefs and stuff
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout'
import {ModelPageFilter, PageHeader} from '../../components/largecomponents/headers/headers'
import {EuiSpacer} from "@elastic/eui";
import InitiatingEventsTable from "../../components/largecomponents/tables/initiatingEventsTable";

export default function DataInitiatingEvents() {
    return (
        <> 
            <PageLayout isModel={false} pageName='Data Initiating Events' contentType={
                <>
                    <EuiSpacer size="m"/>
                    <InitiatingEventsTable/>
                    <div/>
                </>
            }/>
        </>
    )
}