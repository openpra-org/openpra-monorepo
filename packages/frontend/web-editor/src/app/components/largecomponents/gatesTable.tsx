import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";


export default function GatesTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            id: 'Id',
            type: 'type',
            name: 'name',
            description: 'description',
            probability: '.002',
        }
    ];

    //has the following column headers
    // id, type, name, description, probability
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
            field: 'description',
            name: 'Description',
            truncateText: true,
        },
        {
            field: 'probability',
            name: 'Probability',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}