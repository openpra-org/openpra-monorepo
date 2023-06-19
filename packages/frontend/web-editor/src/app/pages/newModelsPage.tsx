import { EuiSpacer } from '@elastic/eui';
import {PageHeader} from '../components/headers'
import NewItem from '../components/newitem';

export default function ModelsPage() {
    //this page is used to display all of our big components on a main page.
    const userStrings = ["ifrit", "bahamut", "pheonix", "ramuh", "shiva", "odin", "titan", "garuda" ];


    return (
        <>
            <PageHeader />
            <EuiSpacer size = "s"/>
            <NewItem title = "New Model" users = {userStrings} />
        </>
    )
}