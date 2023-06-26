import {useEuiTheme} from "@elastic/eui";
import DataTable from "./dataTable";

export default function InitiatingEventsTable(){

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
        {
            id: '2',
            firstName: 'Nick',
            lastName: 'Trachtman',
            github: 'nick_trachtman',
            dateOfBirth: '3/4/03',
            location: 'raleigh',
        },
        {
            id: '3',
            firstName: 'Sophie',
            lastName: 'Soleil',
            github: 'sgsoleil',
            dateOfBirth: '4/20/2001',
            location: 'raleigh',
        },
    ];

    const columns = [
        {
            field: 'firstName',
            name: 'First Name',
            truncateText: true,
        },
        {
            field: 'lastName',
            name: 'Last Name',
            truncateText: true,
        },
        {
            field: 'github',
            name: 'Github',
        },
        {
            field: 'dateOfBirth',
            name: 'Date of Birth',
            dataType: 'date',
        },
        {
            field: 'location',
            name: 'Location',
            truncateText: true,
            textOnly: true,
        },
    ];

    return(
        <DataTable rows={rows} columns={columns} />
    )
}