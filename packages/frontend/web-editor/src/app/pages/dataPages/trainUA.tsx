//this is all placeholder so that I can test hrefs and stuff
import {EuiSpacer} from "@elastic/eui";
import TrainUaTable from "../../components/tables/trainUaTable";
import PageLayout from "../../components/stylingaids/pageLayout";

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