import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";

export default function ComponentReliabilityTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            grouping: 'Values',
            componentType: 'Air-Operated Valve (AOV)',
            componentFailureMode: 'AOV_FTO',
            description: 'Air-Operated Valve Fails To Open',
            dataSource: 'EPIX/RADS',
            failures: 50,
            Units: '',
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
            field: 'grouping',
            name: 'Grouping',
            truncateText: true,
        },
        {
            field: 'componentType',
            name: 'Component Type',
            truncateText: true,
        },
        {
            field: 'componentFailureMode',
            name: 'Component Failure Mode',
        },
        {
            field: 'description',
            name: 'Description',
        },
        {
            field: 'dataSource',
            name: 'Data Source',
            truncateText: true,
        },
        {
            field: 'dataSource',
            name: 'Data Source',
            truncateText: true,
        },
        {
            field: 'failures',
            name: 'Failure',
            dataType: 'number',
        },
        {
            field: 'units',
            name: 'Units',
            truncateText: true,
            textOnly: true,
        },
        {
            field: 'dhUnit',
            name: 'D/H Unit',
            truncateText: true,
            textOnly: true,
        },
        {
            field: 'dhUnit',
            name: 'D/H Value',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'componentCount',
            name: 'Component Count',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'distribution',
            name: 'Distribution',
            truncateText: true,
            textOnly: true,
        },
        {
            field: 'analysisType',
            name: 'Analysis Type',
            truncateText: true,
            textOnly: true,
        },
        {
            field: 'fth',
            name: '5th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'median',
            name: 'Median',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'nfth',
            name: '95th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'alpha',
            name: '\u03B1',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'beta',
            name: '\u03B2',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'mean',
            name: 'Mean',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'errorFactor',
            name: 'Error Factor',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'dateRange',
            name: 'Date Range',
        },
        {
            field: 'effectiveDate',
            name: 'Effective Date',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}