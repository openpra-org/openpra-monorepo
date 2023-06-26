import {EuiBasicTable, EuiBasicTableColumn} from '@elastic/eui'

interface Columns {
    field: string,
    name: string,
    dataType?: string,
    truncateText?: boolean,
    textOnly?: string
}
interface Users {
    id: string,
    firstName: string,
    lastName: string,
    github: string,
    dateOfBirth: string,
    location: string
}

export default function DataTable() {
    const users: Users[] = [
        {
            id: '1',
            firstName: 'Nick',
            lastName: 'Trachtman',
            github: 'nick_trachtman',
            dateOfBirth: '3/4/03',
            location: 'raleigh'
        },
        {
            id: '2',
            firstName: 'Nick',
            lastName: 'Trachtman',
            github: 'nick_trachtman',
            dateOfBirth: '3/4/03',
            location: 'raleigh'
        },
    ];

    const columns: EuiBasicTableColumn<Columns>[] = [
        {
            field: 'firstName',
            name: 'First Name',
            truncateText: true
        },
        {
            field: 'lastName',
            name: 'Last Name',
            truncateText: true
        },
        {
            field: 'github',
            name: 'Github'
        },
        {
            field: 'dateOfBirth',
            name: 'Date of Birth',
            dataType: 'date'
        },
        {
            field: 'location',
            name: 'Location',
            truncateText: true,
            textOnly: true
        }
    ];
    return (
        <EuiBasicTable
            tableCaption="Demo for EuiBasicTable with pagination"
            items={users}
            columns={columns}
            pagination={pagination}
            onChange={onTableChange}
        />
    )
}