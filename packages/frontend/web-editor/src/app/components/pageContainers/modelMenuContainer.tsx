import React, { useEffect, useState } from "react";
import { EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer } from "@elastic/eui";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { CreateGenericList } from "../lists/GenericList";
import { UseGlobalStore } from "../../zustand/Store";
import { GenericItemList } from "../lists/GenericItemList";

function ModelMenuContainer(): JSX.Element {
    // State variables
    const [isLoading, setIsLoading] = useState(true);
    const [genericListItems, setGenericListItems] = useState<React.ReactElement[]>([]);

    // Global store hooks
    const internalEventsList = UseGlobalStore.use.InternalEvents();
    const internalHazardsList = UseGlobalStore.use.InternalHazards();
    const setInternalEvents = UseGlobalStore.use.SetInternalEvents();
    const setInternalHazards = UseGlobalStore.use.SetInternalHazards();

    // Effect to set internal hazards and update generic list
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            await setInternalHazards();
            setIsLoading(false);
        };
        fetchData();
    }, [setInternalHazards]);

    useEffect(() => {
        const combinedList = internalEventsList.concat(internalHazardsList);
        setGenericListItems(
            CreateGenericList<InternalEventsModelType>({
                modelList: combinedList,
                endpoint: "Internal Events and Hazards",
            })
        );
    }, [internalEventsList, internalHazardsList]);

    return (
        <EuiPageTemplate
            panelled={false}
            offset={48}
            grow={true}
            restrictWidth={true}
        >
            <EuiPageTemplate.Section>
                <EuiSkeletonRectangle
                    width="100%"
                    height={490}
                    isLoading={isLoading}
                    contentAriaLabel="Loading internal events and hazards"
                >
                    <GenericItemList>{genericListItems}</GenericItemList>
                </EuiSkeletonRectangle>
                <EuiSpacer size="s" />
            </EuiPageTemplate.Section>
        </EuiPageTemplate>
    );
}

export { ModelMenuContainer };
