//this is all placeholder so that I can test hrefs and stuff

import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { SpecialEventsTable } from "../../components/tables/specialEventsTable";

const SpecialEvents = (): JSX.Element => {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Special Events",
        iconType: "tableDensityNormal",
      }}
    >
      <SpecialEventsTable />
    </TemplatedPageBody>
  );
};

export { SpecialEvents };
