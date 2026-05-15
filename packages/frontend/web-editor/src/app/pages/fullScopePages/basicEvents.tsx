import { BasicEventsTable } from "../../components/tables/basicEventsTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
function BasicEvents(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Basic Events",
        iconType: "editorBold",
      }}
    >
      <BasicEventsTable />
    </TemplatedPageBody>
  );
}
export { BasicEvents };
