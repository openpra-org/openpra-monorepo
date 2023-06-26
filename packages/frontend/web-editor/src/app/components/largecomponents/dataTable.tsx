import { EuiBasicTable, EuiBasicTableColumn } from '@elastic/eui';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

export default function DataTable({rows, columns}: DataTableProps) {

  return (
    <EuiBasicTable
      tableCaption="Silly Little Table"
      items={rows}
      columns={columns}
    />
  );
}
