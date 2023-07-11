import { EuiOverlayMask, EuiButton } from "@elastic/eui";
import { useState } from "react";
import NewItem from "../listchanging/newItem";
import AddParameter from "../listchanging/addParameter";

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
export interface NewItemProps {
    title: string
    page: string
}

export function NewItemButton(props: NewItemProps) {
    //this is to make sure the new thing gets set
    const [addNewVisible, setAddNewVisible] = useState(false);

    //grab the props
    const { title, page } = props;

    //called when button is clicked to add a new thing
    function onNewClick(){
        setAddNewVisible(!addNewVisible)
    }

    return (
        <>
            <EuiButton iconType="plus" onClick={onNewClick} size="s" color='text'>NEW</EuiButton>

            {addNewVisible && title !== "Global Parameters" && (
                <EuiOverlayMask>
                    <NewItem title={title} page={page}/>
                </EuiOverlayMask>
            )}
            {addNewVisible && title === "Models" && (
                <EuiOverlayMask>
                    <NewItem title={title} page={page} users={[]}/>
                </EuiOverlayMask>
            )}
            {addNewVisible && title === "Global Parameters" && (
                <EuiOverlayMask>
                    <AddParameter/>
                </EuiOverlayMask>
            )}
        </>
    )
}