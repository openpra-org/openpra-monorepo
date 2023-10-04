import {useEuiTheme} from "@elastic/eui";
import DataTable from "./templatetable/dataTable";

export default function TrainUaTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            id: 'id1',
            section: 'Generators',
            subSection: '1E EDG',
            trainUnavailabilityEvent: 'EDG-EPS',
            trainDescription: 'Disel Generator Test or Maintenence',
            dataSource: 'dataSource',
            analysis: 'CurveFit/Train',
            mspiTrains: 0.0005050,
            distribution: 'Normal',
            fth: 0.0003040,
            median: 0.0003040,
            nfth: 0.0003040,
            alpha: 0.0003040,
            beta: 0.0003040,
            mean: 0.0003040,
            stdDeviation: 0.0003040,
            errorFactor: 0.0003040,
            dateRange: '2006-2020',
            effectiveDate: '2021-11-01'
        }
    ];

    //has the following column headers
    // Section, Sub Section, Train Unavailability Event, Train Description, Data Source, Analysis, MSPI Trains, 
    // Distribution, 5th Percentile, Median, 95th Percentile, alpha, beta, Mean, std dev, Error Factor, Baseline Period, Effective Date
    // It may be worth going back and making some of these enums instead for limited options
    const columns = [
        {
            id: 'id',
            displayAsText: 'Section',
            truncateText: true,
        },
        {
            id: 'section',
            displayAsText: 'Section',
            truncateText: true,
        },
        {
            id: 'subSection',
            displayAsText: 'Sub Section',
            truncateText: true,
        },
        {
            id: 'trainUnavailabilityEvent',
            displayAsText: 'Train Unavailability Event',
        },
        {
            id: 'trainDescription',
            displayAsText: 'Train Description',
            truncateText: true,
        },
        {
            id: 'dataSource',
            displayAsText: 'Data Source',
        },
        {
            id: 'analysis',
            displayAsText: 'Analysis',
        },
        {
            id: 'mspiTrains',
            displayAsText: 'MSPI Trains',
        },
        {
            id: 'distribution',
            displayAsText: 'Distribution',
            truncateText: true,
        },
        {
            id: 'fth',
            displayAsText: '5th',
        },
        {
            id: 'median',
            displayAsText: 'Median',
        },
        {
            id: 'nfth',
            displayAsText: '95th',
        },
        {
            id: 'alpha',
            displayAsText: '\u03B1',
        },
        {
            id: 'beta',
            displayAsText: '\u03B2',
        },
        {
            id: 'mean',
            displayAsText: 'Mean',
        },
        {
            id: 'stdDeviation',
            displayAsText: 'Std Dev',
        },
        {
            id: 'errorFactor',
            displayAsText: 'Error Factor',
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