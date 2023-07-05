import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme } from '@elastic/eui';
import { useState } from 'react';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}

export default function DataTable({ rows, columns }: DataTableProps) {
  const { euiTheme } = useEuiTheme();

  const renderCellValue = ({ rowIndex, colIndex }: CellValueProps) => {
    const columnId = columns[colIndex].id;
    const row = rows[rowIndex];
    const value = row[columnId];
    return value;
  };

  const [visibleColumns, setVisibleColumns] = useState(() => [...columns]);

  const onColumnSort = (columns: any[]) => {
    setVisibleColumns(columns.map((column) => column.id));
  };

  return (
      <EuiFlexGroup style={{ margin: '9px' }} className="eui-xScroll">
        <EuiFlexItem grow={true}>
          <EuiDataGrid
            columns={columns}
            columnVisibility={{ visibleColumns, setVisibleColumns }}
            rowCount={rows.length}
            renderCellValue={renderCellValue}
            aria-labelledby="dataGridLabel"
          />
        </EuiFlexItem>
      </EuiFlexGroup>
  );
}
