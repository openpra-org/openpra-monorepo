import { EuiOverlayMask, EuiButton } from "@elastic/eui";
import { useState } from "react";
import NewItem from "../listchanging/newItem";
import NewParameter from "../listchanging/newParameter";

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
export interface NewItemProps {
    title: string
}

export function CreateButton(props: NewItemProps) {
    //this is to make sure the new thing gets set
    const [addNewVisible, setAddNewVisible] = useState(false);

    //grab the props
    const { title } = props;

    //called when button is clicked to add a new thing
    function onNewClick(){
        setAddNewVisible(!addNewVisible);
    }

    return (
        <>
            <EuiButton iconType="plus" fill={true} onClick={onNewClick} size="s">Create</EuiButton>

            {addNewVisible && title !== "Global Parameter" && (
                <EuiOverlayMask>
                    <NewItem title={title} toggleBox={setAddNewVisible}/>
                </EuiOverlayMask>
            )}
            {addNewVisible && title === "Model" && (
                <EuiOverlayMask>
                    <NewItem title={title} toggleBox={setAddNewVisible}/>
                </EuiOverlayMask>
            )}
            {addNewVisible && title === "Global Parameter" && (
                <EuiOverlayMask>
                    <NewParameter toggleBox={setAddNewVisible}/>
                </EuiOverlayMask>
            )}
        </>
    )
}
