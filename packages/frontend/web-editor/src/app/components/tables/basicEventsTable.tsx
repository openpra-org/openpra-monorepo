import { DataTable } from "./templatetable/dataTable";

function BasicEventsTable(): JSX.Element {
  //data has fields for every label
  //fth is 5th, nfth is 95th
  const rows = [
    {
      id: "id",
      type: "type",
      name: "name",
      value: 1,
      proxy: "proxy",
      source: "source",
      description: "description",
    },
  ];

  // has the following column headers
  // id, type, name, value, proxy, source, description
  const columns = [
    {
      id: "id",
      displayAsText: "ID",
      truncateText: true,
    },
    {
      id: "type",
      displayAsText: "Type",
      truncateText: true,
    },
    {
      id: "name",
      displayAsText: "Name",
      truncateText: true,
    },
    {
      id: "value",
      displayAsText: "Value",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "proxy",
      displayAsText: "Proxy",
      truncateText: true,
    },
    {
      id: "source",
      displayAsText: "Source",
      truncateText: true,
    },
    {
      id: "description",
      displayAsText: "Description",
      truncateText: true,
    },
  ];

  return <DataTable rows={rows} columns={columns} />;
}

export { BasicEventsTable };
