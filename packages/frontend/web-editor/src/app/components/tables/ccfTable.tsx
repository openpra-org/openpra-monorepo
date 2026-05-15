import { DataTable } from "./templatetable/dataTable";
function CcfTable(): JSX.Element {
  const rows = [
    {
      id: "\n id1",
      rule: "ALL-MDP-FS",
      templateName: "ALL-MDP-FS-02A01",
      cccg: 2,
      alphaFactor: "\u03B1 1",
      fth: 0.000304,
      median: 0.000304,
      nfth: 0.000304,
      alpha: 0.000304,
      beta: 0.000304,
      mean: 0.000304,
    },
  ];
  const columns = [
    {
      id: "id",
      displayAsText: "ID",
      truncateText: true,
    },
    {
      id: "rule",
      displayAsText: "Rule",
    },
    {
      id: "templateName",
      displayAsText: "Template Name",
    },
    {
      id: "cccg",
      displayAsText: "CCCG",
      dataType: "number",
    },
    {
      id: "alphaFactor",
      displayAsText: "Alpha Factor",
      truncateText: true,
    },
    {
      id: "fth",
      displayAsText: "5th",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "median",
      displayAsText: "Median",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "nfth",
      displayAsText: "95th",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "alpha",
      displayAsText: "\u03B1",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "beta",
      displayAsText: "\u03B2",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "mean",
      displayAsText: "Mean",
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
export { CcfTable };
