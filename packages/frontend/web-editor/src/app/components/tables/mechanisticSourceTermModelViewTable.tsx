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
    {
      id: "form",
      displayAsText: "Form",
    },
    {
      id: "release rate",
      displayAsText: "Release Rate",
    },
    {
      id: "energy",
      displayAsText: "Energy",
    },
  ];

  return <ModelViewTable rows={rows} columns={columns} />;
}

export { MechanisticSourceTermModelViewTable };
