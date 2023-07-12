import { EuiSpacer } from '@elastic/eui';
import {PageHeader} from '../components/headers/headers'
import NewItem from "../components/listchanging/newItem";

export default function ModelsPage() {
    //this page is used to display all of our big components on a main page.
    const userStrings = ["ifrit", "bahamut", "pheonix", "ramuh", "shiva", "odin", "titan", "garuda" ];

    //<NewItem title = "New Model" page = 'models' users = {userStrings} />

    return (
        <>
            <PageHeader />
            <EuiSpacer size = "s"/>
        </>
    )
}