import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";

export default function InitiatingEventsTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            section: 'Primary/Secondary Inventory',
            subSection: 'High Energy Line Breaks',
            initiatingEvent: 'FWLB BWR FI',
            description: 'Feedwater Line Break (BWR)',
            source: 'RADS',
            numberOfEvents: 0,
            reactorCriticalYears: 0.0005050,
            distribution: 'Gamma',
            analysisType: 'JNID/IL',
            fth: 0.0003040,
            median: 0.0003040,
            nfth: 0.0003040,
            alpha: 0.0003040,
            beta: 0.0003040,
            mean: 0.0003040,
            stdDev: 0.0003040,
            errorFactor: 0.0003040,
            baselinePeriod: '2006-2020',
            effectiveDate: '2021-11-01'

        }
    ];

    //has the following column headers
    // Section, Sub Section, Initiating Event, Description, Source, Number of Events, Reactor Critical Years
    // Distribution, Analysis Type, 5th Percentile, Median, 95th Percentile, alpha, beta, Mean, std dev, Error Factor, Baseline Period, Effective Date
    // It may be worth going back and making some of these enums instead for limited options
    const columns = [
        {
            field: 'section',
            name: 'Section',
            truncateText: true,
            width: '200px'
        },
        {
            field: 'subSection',
            name: 'Sub Section',
            truncateText: true,
        },
        {
            field: 'initiatingEvent',
            name: 'Initiating Event',
        },
        {
            field: 'description',
            name: 'Description',
            truncateText: true,
        },
        {
            field: 'source',
            name: 'Source',
        },
        {
            field: 'numberOfEvents',
            name: 'Number Of Events',
            dataType: 'number',
        },
        {
            field: 'reactorCriticalYears',
            name: 'Reactor Critical Years',
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
            field: 'stdDeviation',
            name: 'Std Dev',
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
            field: 'baselinePeriod',
            name: 'Vaseline Period',
        },
        {
            field: 'effectiveDate',
            name: 'Effective Date',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns}/>
    )
}