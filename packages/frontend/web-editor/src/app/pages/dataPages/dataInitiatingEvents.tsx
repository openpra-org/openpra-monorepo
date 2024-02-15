//this is all placeholder so that I can test hrefs and stuff
import { InitiatingEventsTable } from "../../components/tables/initiatingEventsTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function DataInitiatingEvents() {
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
