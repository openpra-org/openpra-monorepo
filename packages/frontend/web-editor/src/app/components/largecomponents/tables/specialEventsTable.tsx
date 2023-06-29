import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";

export default function SpecialEventsTable(){

    const {euiTheme} = useEuiTheme();

    const rows = [
        {
            name: 'TDP-PRST(RCIC)'
        },
    ];

    const columns = [
        {
            field: 'name',
            name: 'Name',
            truncateText: true,
        },
    ];


    return(
        <DataTable rows={rows} columns={columns} />
    )
}