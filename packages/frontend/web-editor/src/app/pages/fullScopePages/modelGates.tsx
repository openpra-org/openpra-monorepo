import GatesTable from '../../components/tables/gatesTable';
import TemplatedPageBody from "../../components/headers/TemplatedPageBody";

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
