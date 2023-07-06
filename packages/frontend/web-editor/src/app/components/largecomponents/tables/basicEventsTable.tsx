import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";


export default function BasicEventsTable(){

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            id: 'Id',
            type: 'type',
            name: 'name',
            value: 'value',
            proxy: 'proxy',
            source: 'source',
            description: 'description',
        },
        {
            id: 'Id2',
            type: 'type2',
            name: 'zname2',
            value: 'balue',
            proxy: 'proxy2',
            source: 'source2',
            description: 'description2',
        },
        {
            id: 'Id2',
            type: 'type2',
            name: 'zname2',
            value: 'ralue',
            proxy: 'proxy2',
            source: 'source2',
            description: 'description2',
        }
    ];

    // has the following column headers
    // id, type, name, value, proxy, source, description
    const columns = [
        {
            id: 'id',
            displayAsText: 'ID',
        },
        {
            id: 'type',
            displayAsText: 'Type',
        },
        {
            id: 'name',
            displayAsText: 'Name',
        },
        {
            id: 'value',
            displayAsText: 'Value',
            defaultSortDirection: 'asc',
        },
        {
            id: 'proxy',
            displayAsText: 'Proxy',
        },
        {
            id: 'source',
            displayAsText: 'Source',
        },
        {
            id: 'description',
            displayAsText: 'Description',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}