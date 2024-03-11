import { DataTable } from "./templatetable/dataTable";

function SpecialEventsTable(): JSX.Element {
  const rows = [
    {
      id: "1",
      name: "TDP-PRST(RCIC)",
    },
  ];

  const columns = [
    {
      id: "id",
      displayAsText: "ID",
      truncateText: true,
    },
    {
      id: "name",
      displayAsText: "Name",
      truncateText: true,
    },
  ];

  return <DataTable rows={rows} columns={columns} />;
}

export { SpecialEventsTable };
