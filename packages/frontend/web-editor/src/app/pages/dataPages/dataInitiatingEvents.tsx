import { InitiatingEventsTable } from "../../components/tables/initiatingEventsTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
function DataInitiatingEvents(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Initiating Events",
        iconType: "tableDensityNormal",
      }}
    >
      <InitiatingEventsTable />
    </TemplatedPageBody>
  );
}
export { DataInitiatingEvents };
