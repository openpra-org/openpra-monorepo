//this is all placeholder so that I can test hrefs and stuff
import ComponentReliabilityTable from "../../components/tables/componentReliabilityTable";
import TemplatedPageBody from "../../components/headers/TemplatedPageBody";


export default function Ccf() {
    return (
        <> 
            <TemplatedPageBody
                headerProps={{
                pageTitle: "Component Reliability",
                iconType: "tableDensityNormal",
            }}>
                <ComponentReliabilityTable/>
            </TemplatedPageBody>
        </>
    )
}