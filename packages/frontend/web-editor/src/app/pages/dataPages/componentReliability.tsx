import { ComponentReliabilityTable } from "../../components/tables/componentReliabilityTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function ComponentReliability(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Component Reliability",
        iconType: "tableDensityNormal",
      }}
    >
      <ComponentReliabilityTable
        rows={[]}
        onAdd={(): void => undefined}
        onEdit={(): void => undefined}
        onDelete={(): void => undefined}
      />
    </TemplatedPageBody>
  );
}

export { ComponentReliability };
