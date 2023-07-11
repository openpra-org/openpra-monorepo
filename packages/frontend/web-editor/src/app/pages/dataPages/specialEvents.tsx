//this is all placeholder so that I can test hrefs and stuff
import {EuiSpacer} from "@elastic/eui";
import SpecialEventsTable from "../../components/tables/specialEventsTable";
import PageLayout from "../../components/stylingaids/pageLayout";

export default function SpecialEvents() {
    return (
        <> 
            <PageLayout isModel={false} pageName='Special Events' contentType={
                <>
                    <EuiSpacer size="m"/>
                    <SpecialEventsTable/>
                    <div/>
                </>
            }/>
        </>
    )
}