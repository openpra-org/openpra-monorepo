//this is all placeholder so that I can test hrefs and stuff
import {EuiSpacer} from "@elastic/eui";
import ComponentReliabilityTable from "../../components/tables/componentReliabilityTable";
import PageLayout from "../../components/stylingaids/pageLayout";


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