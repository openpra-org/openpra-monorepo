import {PageHeader} from '../components/headers'
import NewModel from '../components/largecomponents/newmodel'

export default function ModelsPage() {
    //this page is used to display all of our big components on a main page.
    const userStrings = ["ifrit", "bahamut", "pheonix", "ramuh", "shiva", "odin", "titan", "garuda" ];


    return (
        <>
            <PageHeader />
            <NewModel users = {userStrings} />
        </>
    )
}