//this is all placeholder so that I can test hrefs and stuff
import {EuiSpacer} from "@elastic/eui";
import InitiatingEventsTable from "../../components/tables/initiatingEventsTable";
import PageLayout from "../../components/stylingaids/pageLayout";

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