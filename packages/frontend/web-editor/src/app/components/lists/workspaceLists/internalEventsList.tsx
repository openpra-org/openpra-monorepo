import GenericItemList from "../GenericItemList";
import GenericListItem from "../GenericListItem";
import { EuiPageTemplate } from "@elastic/eui";
import { CreateInternalEventsButton } from "../../buttons/CreateItemButton";
import ApiManager from "shared-types/src/lib/api/ApiManager";
const getFixtures = (count = 100): JSX.Element[] => {
    const modelList = ApiManager.getModels( 0 , 0)
    //console.log(modelList.data)
    return Array.from(Array(count).keys()).map((e, i) => {
        return (<GenericListItem
            itemName="model"
            id={i}
            key={i}
            label={{
                name: `Model #${i}`,
                description: `This is model number ${i}`,
            }}
            path={`/internal-events/${i}`}
            endpoint="/api/model/:id"
        />)});
}

export default function InternalEventsList(){
    return (
        <EuiPageTemplate panelled={false} offset={48} grow={true} restrictWidth={true}>
            {/* <EuiPageTemplate.Header
                alignItems="center"
                pageTitle="Internal Events"
                responsive={false}
                bottomBorder="extended"
                rightSideItems={[
                    <CreateInternalEventsButton />
                ]}
            /> */}
            <EuiPageTemplate.Section>
                <GenericItemList>
                    {getFixtures()}
                </GenericItemList>
            </EuiPageTemplate.Section>
        </EuiPageTemplate>
    );
}
