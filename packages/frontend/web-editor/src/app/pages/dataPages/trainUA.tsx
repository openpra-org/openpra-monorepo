//this is all placeholder so that I can test hrefs and stuff

import PageLayout from '../../components/largecomponents/stylingaids/pageLayout'
import {ModelPageFilter} from '../../components/largecomponents/headers/headers'
import {EuiSpacer} from "@elastic/eui";
import TrainUaTable from "../../components/largecomponents/tables/trainUaTable";

export default function TrainUA() {
    return (
        <> 
            <PageLayout isModel={false} pageName='Train UA' contentType={
                <>
                    <EuiSpacer size="m"/>
                    <TrainUaTable/>
                    <div/>
                </>
            }/>
        </>
    )
}