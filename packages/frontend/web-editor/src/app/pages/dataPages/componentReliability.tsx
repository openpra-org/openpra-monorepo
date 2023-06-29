//this is all placeholder so that I can test hrefs and stuff

import PageLayout from "../../components/largecomponents/pageLayout";
import { ModelPageFilter } from "../../components/smallcomponents/headers";
import {EuiSpacer} from "@elastic/eui";
import ComponentReliabilityTable from "../../components/largecomponents/componentReliabilityTable";


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