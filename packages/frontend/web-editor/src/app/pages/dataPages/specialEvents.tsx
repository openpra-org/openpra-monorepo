//this is all placeholder so that I can test hrefs and stuff
import PageLayout from '../../components/largecomponents/pageLayout'
import {ModelPageFilter} from '../../components/smallcomponents/headers'
import {EuiSpacer} from "@elastic/eui";
import SpecialEventsTable from "../../components/largecomponents/specialEventsTable";

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