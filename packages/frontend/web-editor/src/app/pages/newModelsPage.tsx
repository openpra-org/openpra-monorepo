import { EuiSpacer, EuiPageTemplate } from '@elastic/eui';
import {PageHeader} from '../components/headers/headers'
import NewItem from "../components/listchanging/newItem";

export default function NewModelsPage() {
    //this page is used to display all of our big components on a main page.
    const userStrings = ["ifrit", "bahamut", "pheonix", "ramuh", "shiva", "odin", "titan", "garuda" ];

    return (
      <EuiPageTemplate panelled={true} offset={64} grow={false} restrictWidth={true}>
        <EuiPageTemplate.EmptyPrompt paddingSize="none">
        </EuiPageTemplate.EmptyPrompt>
      </EuiPageTemplate>
    )
}
