//this is all placeholder so that I can test hrefs and stuff
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { ComponentReliabilityTable } from "../../components/tables/componentReliabilityTable";

const ComponentReliability = (): JSX.Element => {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Component Reliability",
        iconType: "tableDensityNormal",
      }}
    >
      <ComponentReliabilityTable />
    </TemplatedPageBody>
  );
};

export { ComponentReliability };
