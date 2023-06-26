import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";

export default function TrainUaTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
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
            field: 'section',
            name: 'Section',
            truncateText: true,
        },
        {
            field: 'subSection',
            name: 'Sub Section',
            truncateText: true,
        },
        {
            field: 'trainUnavailabilityEvent',
            name: 'Train Unavailability Event',
        },
        {
            field: 'trainDescription',
            name: 'Train Description',
            truncateText: true,
        },
        {
            field: 'dataSource',
            name: 'Data Source',
        },
        {
            field: 'analysis',
            name: 'Analysis',
        },
        {
            field: 'mspiTrains',
            name: 'MSPI Trains',
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