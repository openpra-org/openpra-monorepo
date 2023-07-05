import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";


export default function BasicEventsTable(){

    const {euiTheme} = useEuiTheme();

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
            name: 'name2',
            value: 'value2',
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
            initialWidth: 200,
        },
        {
            id: 'type',
            displayAsText: 'Type',
            initialWidth: 200,
        },
        {
            id: 'name',
            displayAsText: 'Name',
            initialWidth: 200,
        },
        {
            id: 'value',
            displayAsText: 'Value',
            initialWidth: 200,
        },
        {
            id: 'proxy',
            displayAsText: 'Proxy',
            initialWidth: 200,
        },
        {
            id: 'source',
            displayAsText: 'Source',
            initialWidth: 200,
        },
        {
            id: 'description',
            displayAsText: 'Description',
            initialWidth: 200,
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}