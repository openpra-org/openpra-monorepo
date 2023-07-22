import { CreateInternalHazardsButton } from "../../buttons/CreateItemButton";
import GenericItemList from "../GenericItemList";
import GenericListItem from "../GenericListItem";
import { EuiPageTemplate } from "@elastic/eui";

const getFixtures = (count = 100): JSX.Element[] => {
    return Array.from(Array(count).keys()).map((e, i) => {
        return (<GenericListItem
            itemName="model"
            id={i}
            key={i}
            label={{
                name: `Model #${i}`,
                description: `This is model number ${i}`,
            }}
            path={`/internal-hazards/${i}`}
            endpoint="/api/model/:id"
        />)});
}

export default function InternalHazardsList(){
    return (
        <EuiPageTemplate panelled={false} offset={48} grow={true} restrictWidth={true}>
            {/* <EuiPageTemplate.Header
                alignItems="center"
                pageTitle="Internal Hazards"
                responsive={false}
                bottomBorder="extended"
                rightSideItems={[
                    <CreateInternalHazardsButton />
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