import { DataTable } from "./templatetable/dataTable";
function GatesTable(): JSX.Element {
  const rows = [
    {
      id: "Id",
      type: "type",
      name: "name",
      description: "description",
      probability: ".002",
    },
  ];
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
}
export { GatesTable };
