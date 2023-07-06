import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, useEuiTheme, EuiDataGridColumn, Direction } from '@elastic/eui';
import { useCallback, useState } from 'react';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}


export default function DataTable({ rows, columns }: DataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.id));

  const cellValue = ({ rowIndex, colIndex }: CellValueProps) => {
    const visibleColumnId = visibleColumns[colIndex];
    const row = rows[rowIndex];
    const value = row[visibleColumnId];
    return value;
  };

  // Sorting
  const [sortingColumns, setSortingColumns] = useState([]);

  const onSort = useCallback(
    (sortingColumns) => {
      setSortingColumns(sortingColumns);
    },
    [setSortingColumns]
  );

  return (
    <EuiFlexGroup style={{ margin: '9px' }}>
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          sorting={{ columns: sortingColumns, onSort}}
          aria-label="dataGridLabel"
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
