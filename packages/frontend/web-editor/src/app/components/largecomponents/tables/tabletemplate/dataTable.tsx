import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, useEuiTheme, EuiDataGridColumn } from '@elastic/eui';
import {useState, useRef, useCallback, useContext, useEffect, createContext} from 'react';

interface DataTableProps {
  rows: any[];
  columns: EuiDataGridColumn[];
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

  const [gridRows, setGridRows] = useState(rows);





  // const handleColumnSort = (sortedColumns: { id: string; direction: Direction }[]) => {
  //   const sortedColumn = sortedColumns[0];
  //   const { id, direction } = sortedColumn;

  //   let sortedRows: any[];

  //   if (direction === 'asc') {
  //     sortedRows = [...gridRows].sort((a, b) => {
  //       if (a[id] < b[id]) return -1;
  //       if (a[id] > b[id]) return 1;
  //       return 0;
  //     });
  //   } else {
  //     sortedRows = [...gridRows].sort((a, b) => {
  //       if (a[id] < b[id]) return 1;
  //       if (a[id] > b[id]) return -1;
  //       return 0;
  //     });
  //   }

  //   setGridRows(sortedRows);
  // };

  const [sortingColumns, setSortingColumns] = useState([]);
  const onSort = useCallback(
      (sortingColumns) => {
        setSortingColumns(sortingColumns);
      },
      [setSortingColumns]
  );

  const columns2 = visibleColumns

  return (
    <EuiFlexGroup style={{ margin: '9px' }}>
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          sorting={{ columns: sortingColumns, onSort }}
            //sorting={{ columns: visibleColumns.map((id) => ({ id, direction: 'asc' })), onSort: handleColumnSort }}
          aria-label="dataGridLabel"
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
