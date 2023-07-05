import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";

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
            Analysis: 'CurveFit/Train',
            mspiTrains: 0.0005050,
            distribution: 'Normal',
            fth: 0.0003040,
            median: 0.0003040,
            nfth: 0.0003040,
            alpha: 0.0003040,
            beta: 0.0003040,
            mean: 0.0003040,
            stdDev: 0.0003040,
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
            id: 'section',
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
            id: 'stdDeviation',
            displayAsText: 'Std Dev',
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