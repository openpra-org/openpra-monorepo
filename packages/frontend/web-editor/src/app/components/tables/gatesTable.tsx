import { DataTable } from "./templatetable/dataTable";

const GatesTable = (): JSX.Element => {
  //data has fields for every label
  //fth is 5th, nfth is 95th
  const rows = [
    {
      id: "Id",
      type: "type",
      name: "name",
      description: "description",
      probability: ".002",
    },
  ];

  //has the following column headers
  // id, type, name, description, probability
  const columns = [
    {
      id: "id",
      displayAsText: "ID",
    },
    {
      id: "type",
      displayAsText: "Type",
    },
    {
      id: "name",
      displayAsText: "Name",
    },
    {
      id: "description",
      displayAsText: "Description",
      truncateText: true,
    },
    {
      id: "probability",
      name: "Probability",
      dataType: "number",
      formatter: "scientificFormatter",
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
    />
  );
};

export { GatesTable };
