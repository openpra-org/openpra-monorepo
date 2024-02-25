import { DataTable } from "./templatetable/dataTable";

function InitiatingEventsTable(): JSX.Element {
  //data has fields for every label
  //fth is 5th, nfth is 95th
  const rows = [
    {
      id: "id1",
      section: "Primary/Secondary Inventory",
      subSection: "High Energy Line Breaks",
      initiatingEvent: "FWLB BWR FI",
      description: "Feedwater Line Break (BWR)",
      source: "RADS",
      numberOfEvents: 0,
      reactorCriticalYears: 0.000505,
      distribution: "Gamma",
      analysisType: "JNID/IL",
      fth: 0.000304,
      median: 0.000304,
      nfth: 0.000304,
      alpha: 0.000304,
      beta: 0.000304,
      mean: 0.000304,
      stdDeviation: 0.000304,
      errorFactor: 0.000304,
      baselinePeriod: "2006-2020",
      effectiveDate: "2021-11-01",
    },
  ];

  //has the following column headers
  // Section, Sub Section, Initiating Event, Description, Source, Number of Events, Reactor Critical Years
  // Distribution, Analysis Type, 5th Percentile, Median, 95th Percentile, alpha, beta, Mean, std dev, Error Factor, Baseline Period, Effective Date
  // It may be worth going back and making some of these enums instead for limited options
  const columns = [
    {
      id: "id",
      displayAsText: "ID",
      truncateText: true,
    },
    {
      id: "section",
      displayAsText: "Section",
      truncateText: true,
      width: "200px",
    },
    {
      id: "subSection",
      displayAsText: "Sub Section",
      truncateText: true,
    },
    {
      id: "initiatingEvent",
      displayAsText: "Initiating Event",
    },
    {
      id: "description",
      displayAsText: "Description",
      truncateText: true,
    },
    {
      id: "source",
      displayAsText: "Source",
    },
    {
      id: "numberOfEvents",
      displayAsText: "Number Of Events",
      dataType: "number",
    },
    {
      id: "reactorCriticalYears",
      displayAsText: "Reactor Critical Years",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "distribution",
      displayAsText: "Distribution",
      truncateText: true,
      textOnly: true,
    },
    {
      id: "analysisType",
      displayAsText: "Analysis Type",
      truncateText: true,
      textOnly: true,
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
    {
      id: "stdDeviation",
      displayAsText: "Std Dev",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "errorFactor",
      displayAsText: "Error Factor",
      dataType: "number",
      formatter: "scientificFormatter",
    },
    {
      id: "baselinePeriod",
      displayAsText: "Vaseline Period",
    },
    {
      id: "effectiveDate",
      displayAsText: "Effective Date",
    },
  ];

  return <DataTable rows={rows} columns={columns} />;
}

export { InitiatingEventsTable };
