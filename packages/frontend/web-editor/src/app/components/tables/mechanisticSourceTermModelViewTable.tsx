import { ModelViewTable } from "./templatetable/modelViewTable";

function MechanisticSourceTermModelViewTable(): JSX.Element {
  const rows = [
    {
      isotope: "Xe",
      location: "1",
    },
  ];

  const columns = [
    {
      id: "isotope",
      displayAsText: "Isotope",
      truncateText: true,
    },
    {
      id: "location",
      displayAsText: "Location",
    },
  ];

  return <ModelViewTable rows={rows} columns={columns} />;
}

export { MechanisticSourceTermModelViewTable };
