import { GlobalParametersList } from "../../components/lists/globalParametersList";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
function BasicEvents(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Global Parameters",
        iconType: "beta",
      }}
    >
      <GlobalParametersList />
    </TemplatedPageBody>
  );
}

export { BasicEvents };
