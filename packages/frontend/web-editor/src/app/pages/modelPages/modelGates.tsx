import GatesTable from '../../components/tables/gatesTable';
import TemplatedPageHeader from "../../components/headers/TemplatedPageHeader";
import TemplatedPageBody from "../../components/headers/TemplatedPageBody";
import GlobalParametersList from "../../components/lists/globalParametersList";

export default function ModelGates() {

    return (
      <TemplatedPageBody
        headerProps={{
          pageTitle: "Gates",
          iconType: "tokenRepo",
        }}>
        <GatesTable/>
      </TemplatedPageBody>
    )
}
