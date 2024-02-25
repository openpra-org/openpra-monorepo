//this is all placeholder so that I can test hrefs and stuff
import { CcfTable } from "../../components/tables/ccfTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function Ccf(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Common Cause Failure",
        iconType: "tableDensityNormal",
      }}
    >
      <CcfTable />
    </TemplatedPageBody>
  );
}

export { Ccf };
