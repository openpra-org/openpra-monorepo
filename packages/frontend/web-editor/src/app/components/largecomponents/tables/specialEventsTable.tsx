import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";

export default function SpecialEventsTable(){

    const {euiTheme} = useEuiTheme();

    const rows = [
        {
            id: 'id1',
            name: 'TDP-PRST(RCIC)'
        },
    ];

    const columns = [
        {
            id: 'id',
            displayAsText: 'ID',
            truncateText: true,
        },
        {
            id: 'name',
            displayAsText: 'Name',
            truncateText: true,
        },
    ];


    return(
        <DataTable rows={rows} columns={columns} />
    )
}