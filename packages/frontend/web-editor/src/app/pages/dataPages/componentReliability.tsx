//this is all placeholder so that I can test hrefs and stuff

import PageLayout from "../../components/largecomponents/stylingaids/pageLayout";
import { ModelPageFilter } from "../../components/largecomponents/headers/headers";
import {EuiSpacer} from "@elastic/eui";
import ComponentReliabilityTable from "../../components/largecomponents/tables/componentReliabilityTable";


export default function Ccf() {
    return (
        <> 
            <PageLayout isModel={false} pageName='Component Reliability' contentType={
                <>
                    <EuiSpacer size="m"/>
                    <ComponentReliabilityTable/>
                    <div/>
                </>
            }/>
        </>
    )
}