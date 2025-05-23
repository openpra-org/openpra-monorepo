import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { GlobalParametersList } from "../../components/lists/globalParametersList";

const BasicEvents = (): JSX.Element => {
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
};

export { BasicEvents };
