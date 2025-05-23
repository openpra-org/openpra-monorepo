//this is all placeholder so that I can test hrefs and stuff
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { InitiatingEventsTable } from "../../components/tables/initiatingEventsTable";

const DataInitiatingEvents = (): JSX.Element => {
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
};

export { DataInitiatingEvents };
