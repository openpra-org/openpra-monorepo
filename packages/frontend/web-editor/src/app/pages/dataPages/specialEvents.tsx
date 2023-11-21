//this is all placeholder so that I can test hrefs and stuff

import TemplatedPageBody from "../../components/headers/TemplatedPageBody";
import SpecialEventsTable from "../../components/tables/specialEventsTable";

export default function SpecialEvents() {
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
}
