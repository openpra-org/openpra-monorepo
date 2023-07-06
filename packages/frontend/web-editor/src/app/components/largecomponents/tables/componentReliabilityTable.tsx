import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";

export default function ComponentReliabilityTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            id: 'id1',
            grouping: 'Values',
            componentType: 'Air-Operated Valve (AOV)',
            componentFailureMode: 'AOV_FTO',
            description: 'Air-Operated Valve Fails To Open',
            dataSource: 'EPIX/RADS',
            failures: 50,
            units: '',
            dhUnit: 'd',
            dhValue: 0.0003040,
            componentCount: 0.0003040,
            distribution: 'Beta',
            analysisType: 'JNID/IL',
            fth: 0.0003040,
            median: 0.0003040,
            nfth: 0.0003040,
            alpha: 0.0003040,
            beta: 0.0003040,
            mean: 0.0003040,
            errorFactor: 0.0003040,
            dateRange: '2006-2020',
            effectiveDate: '2021-11-01'

        }
    ];

    //has the following column headers
    // Grouping, Component Type, Component Failure Mode, Description, Data Source, Failures, Units, D/H Type, D/H Value,
    // Component Count, Distribution, Analysis Type, 5th Percentile, Median, 95th Percentile, alpha, beta, Mean, Error Factor, Date Range, Effective Date
    // It may be worth going back and making some of these enums instead for limited options
    const columns = [
        {
            id: 'id',
            displayAsText: 'ID',
        },
        {
            id: 'grouping',
            displayAsText: 'Grouping',
            truncateText: true,
        },
        {
            id: 'componentType',
            displayAsText: 'Component Type',
            truncateText: true,
        },
        {
            id: 'componentFailureMode',
            displayAsText: 'Component Failure Mode',
        },
        {
            id: 'description',
            displayAsText: 'Description',
        },
        {
            id: 'dataSource',
            displayAsText: 'Data Source',
            truncateText: true,
        },
        {
            id: 'failures',
            displayAsText: 'Failure',
            dataType: 'number',
        },
        {
            id: 'units',
            displayAsText: 'Units',
            truncateText: true,
            textOnly: true,
        },
        {
            id: 'dhUnit',
            displayAsText: 'D/H Unit',
            truncateText: true,
            textOnly: true,
        },
        {
            id: 'dhValue',
            displayAsText: 'D/H Value',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'componentCount',
            displayAsText: 'Component Count',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'distribution',
            displayAsText: 'Distribution',
            truncateText: true,
            textOnly: true,
        },
        {
            id: 'analysisType',
            displayAsText: 'Analysis Type',
            truncateText: true,
            textOnly: true,
        },
        {
            id: 'fth',
            displayAsText: '5th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'median',
            displayAsText: 'Median',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'nfth',
            displayAsText: '95th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'alpha',
            displayAsText: '\u03B1',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'beta',
            displayAsText: '\u03B2',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'mean',
            displayAsText: 'Mean',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'errorFactor',
            displayAsText: 'Error Factor',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'dateRange',
            displayAsText: 'Date Range',
        },
        {
            id: 'effectiveDate',
            displayAsText: 'Effective Date',
        },
    ];


    return(
        <DataTable rows={rows} columns={columns} />
    )
}