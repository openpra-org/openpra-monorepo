import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

const QuantificationHistory = (): JSX.Element => {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Quantification History",
        iconType: "visAreaStacked",
      }}
    />
  );
};

export { QuantificationHistory };
