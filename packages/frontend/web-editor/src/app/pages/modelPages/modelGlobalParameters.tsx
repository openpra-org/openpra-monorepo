import {ModelPageFilter} from "../../components/headers/headers";
import GlobalParametersList from "../../components/lists/globalParametersList";
import PageLayout from "../../components/stylingaids/pageLayout";

export default function BasicEvents() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Global Parameters' contentType={
                <>
                    <ModelPageFilter title="Global Parameters" page="model/1/globalParameters" />
                    <GlobalParametersList/>
                </>
            }/>
        </>
    )
}