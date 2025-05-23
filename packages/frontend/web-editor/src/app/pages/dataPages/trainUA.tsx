//this is all placeholder so that I can test hrefs and stuff
import { TemplatedPageBody } from "../../components/headers/TemplatedPageBody";
import { TrainUaTable } from "../../components/tables/trainUaTable";

const TrainUA = (): JSX.Element => {
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
};

export { TrainUA };
