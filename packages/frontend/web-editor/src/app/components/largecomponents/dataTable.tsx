import {EuiBasicTable, EuiFlexGroup, EuiThemeProvider, useEuiTheme} from '@elastic/eui';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

export default function DataTable({rows, columns}: DataTableProps) {
  const {euiTheme} = useEuiTheme();
    const newColumns = columns.map((item) => ({
        ...item,
        width: '200px'
    }))


  return (
      <EuiFlexGroup style={{margin: '9px', height: '100%'}}  className="eui-xScroll">
        <EuiThemeProvider>
          <EuiBasicTable
            tableCaption="Table"
            items={rows}
            columns={newColumns}
            responsive={false}
          />
        </EuiThemeProvider>
      </EuiFlexGroup>
  );
}
