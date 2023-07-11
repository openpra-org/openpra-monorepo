import GlobalParametersList from '../../components/largecomponents/lists/globalParametersList';
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import {ModelPageFilter} from "../../components/largecomponents/headers/headers";

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