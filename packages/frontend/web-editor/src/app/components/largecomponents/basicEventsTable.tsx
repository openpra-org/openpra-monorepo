import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";


export default function BasicEventTable(){

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
        }
    ];

    // has the following column headers
    // id, type, name, value, proxy, source, description
    const columns = [
        {
            field: 'id',
            name: 'ID',
        },
        {
            field: 'type',
            name: 'Type',
        },
        {
            field: 'name',
            name: 'Name',
        },
        {
            field: 'value',
            name: 'Value',
        },
        {
            field: 'proxy',
            name: 'Proxy',
        },
        {
            field: 'source',
            name: 'Source',
        },
        {
            field: 'description',
            name: 'Description',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}