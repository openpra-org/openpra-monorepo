import {ModelPageFilter} from "../../components/headers/headers";
import ListlessPageTitleHeader from "../../components/headers/listlessPageTitleHeader";
import GlobalParametersList from "../../components/lists/globalParametersList";
import PageLayout from "../../components/stylingaids/pageLayout";

export default function BasicEvents() {
    return (
        <> 
            <ListlessPageTitleHeader title="Global Parameters" icon="beta"/>
            <GlobalParametersList/>
        </>
    )
}