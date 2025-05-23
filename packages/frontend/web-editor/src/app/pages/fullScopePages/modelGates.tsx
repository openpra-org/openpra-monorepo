import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { GatesTable } from "../../components/tables/gatesTable";

const ModelGates = (): JSX.Element => {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Gates",
        iconType: "tokenRepo",
      }}
    >
      <GatesTable />
    </TemplatedPageBody>
  );
};

export { ModelGates };
