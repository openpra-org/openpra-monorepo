import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
function QuantificationHistory(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Quantification History",
        iconType: "visAreaStacked",
      }}
    ></TemplatedPageBody>
  );
}

export { QuantificationHistory };
