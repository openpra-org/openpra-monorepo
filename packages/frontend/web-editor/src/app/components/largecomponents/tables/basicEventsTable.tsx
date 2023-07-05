import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";


export default function BasicEventsTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            ID: 'Id',
            Type: 'type',
            Name: 'name',
            Value: 'value',
            Proxy: 'proxy',
            Source: 'source',
            Description: 'description',
        }
    ];

    // has the following column headers
    // id, type, name, value, proxy, source, description
    const columns = [
        {
            id: 'ID',
            field: 'id',
            name: 'ID',
        },
        {
            id: 'Type',
            field: 'type',
            name: 'Type',
        },
        {
            id: 'Name',
            field: 'name',
            name: 'Name',
        },
        {
            id: 'Value',
            field: 'value',
            name: 'Value',
        },
        {
            id: 'Proxy',
            field: 'proxy',
            name: 'Proxy',
        },
        {
            id: 'Source',
            field: 'source',
            name: 'Source',
        },
        {
            id: 'Description',
            field: 'description',
            name: 'Description',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}