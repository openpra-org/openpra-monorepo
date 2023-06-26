//this is all placeholder so that I can test hrefs and stuff

import PageLayout from '../../components/largecomponents/pageLayout'
import {ModelPageFilter} from '../../components/smallcomponents/headers'
import {EuiSpacer} from "@elastic/eui";
import TrainUaTable from "../../components/largecomponents/trainUaTable";

export default function TrainUA() {
    return (
        <> 
            <PageLayout isModel={false} pageName='CCF' contentType={
                <>
                    <ModelPageFilter/>
                    <EuiSpacer size="m"/>
                    <TrainUaTable/>
                    <div/>
                </>
            }/>
        </>
    )
}