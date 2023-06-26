import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";

export default function ComponentReliabilityTable(){

    const {euiTheme} = useEuiTheme();

    const rows = [
        {
            id: '1',
            firstName: 'Nick',
            lastName: 'Trachtman',
            github: 'nick_trachtman',
            dateOfBirth: '3/4/03',
            location: 'raleigh',
        },
    ];

    //has the following column headers
    // Grouping, Component Type, Component Failure Mode, Description, Data Source, Failures, Units, D/H Type, D/H Value,
    // Component Count, Distribution, Analysis Type, 5th Percentile, Median, 95th Percentile, alpha, beta, Mean, Error Factor, Date Range, Effective Date
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
            field: 'dhType',
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
            field: 'Analysis Type',
            name: 'D/H Unit',
            truncateText: true,
            textOnly: true,
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}