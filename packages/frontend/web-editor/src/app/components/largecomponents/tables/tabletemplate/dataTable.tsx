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

  // Pagination
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const onChangeItemsPerPage = useCallback(
      (pageSize) =>
          setPagination((pagination) => ({
            ...pagination,
            pageSize,
            pageIndex: 0,
          })),
      [setPagination]
  );
  const onChangePage = useCallback(
      (pageIndex) =>
          setPagination((pagination) => ({ ...pagination, pageIndex })),
      [setPagination]
  );

  // Sorting
  const [sortingColumns, setSortingColumns] = useState([]);

  const onSort = useCallback(
    (sortingColumns) => {
      setSortingColumns(sortingColumns);
    },
    [setSortingColumns]
  );

  return (
    <EuiFlexGroup style={{marginLeft: '10px'}} className='eui-xScroll'>
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          sorting={{ columns: sortingColumns, onSort}}
          inMemory={{ level: 'sorting' }}
          aria-label="dataGridLabel"
          pagination={{
            ...pagination,
            pageSizeOptions: [20, 50, 100],
            onChangeItemsPerPage: onChangeItemsPerPage,
            onChangePage: onChangePage,
          }}
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
