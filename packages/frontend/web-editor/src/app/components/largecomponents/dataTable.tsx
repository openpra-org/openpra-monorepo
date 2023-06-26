import {EuiBasicTable, EuiFlexGroup, EuiThemeProvider, useEuiTheme} from '@elastic/eui';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

export default function DataTable({rows, columns}: DataTableProps) {
  const {euiTheme} = useEuiTheme();


  return (
      <EuiFlexGroup style={{margin: '9px', height: '100%'}}>
        <EuiThemeProvider>
          <EuiBasicTable
            tableCaption="Table"
            items={rows}
            columns={columns}
            responsive={false}
          />
        </EuiThemeProvider>
      </EuiFlexGroup>
  );
}
