import BasicEventsTable from "../../components/tables/basicEventsTable";
import TemplatedPageBody from "../../components/headers/TemplatedPageBody";

//documenting how this works here, basically it just uses pagelayout and passes it content, so go there for more!
export default function BasicEvents() {
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
