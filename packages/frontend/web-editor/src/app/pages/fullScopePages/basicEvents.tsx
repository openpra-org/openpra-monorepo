import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { BasicEventsTable } from "../../components/tables/basicEventsTable";

//documenting how this works here, basically it just uses pagelayout and passes it content, so go there for more!
const BasicEvents = (): JSX.Element => {
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
};

export { BasicEvents };
