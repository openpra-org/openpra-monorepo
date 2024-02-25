//this is all placeholder so that I can test hrefs and stuff
import { TrainUaTable } from "../../components/tables/trainUaTable";
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";

function TrainUA(): JSX.Element {
  return (
    <TemplatedPageBody
      headerProps={{
        pageTitle: "Train UA",
        iconType: "tableDensityNormal",
      }}
    >
      <TrainUaTable />
    </TemplatedPageBody>
  );
}

export { TrainUA };
