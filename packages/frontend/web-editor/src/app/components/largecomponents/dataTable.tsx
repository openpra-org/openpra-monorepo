import {EuiBasicTable, EuiBasicTableColumn, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme} from '@elastic/eui';

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
            tableCaption="Silly Little Table"
            items={rows}
            columns={columns}
          />
        </EuiThemeProvider>
      </EuiFlexGroup>
  );
}
