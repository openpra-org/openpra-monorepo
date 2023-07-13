import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, useEuiTheme, EuiDataGridColumn, Direction } from '@elastic/eui';
import { createRef, useCallback, useState } from 'react';

interface DataTableProps {
  rows: any[];
  columns: any[];
}

interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}


export default function DataTable({ rows, columns }: DataTableProps) {

  //sets the visibile columns in a state
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.id));

  //this sets all the values in the cells
  const cellValue = ({ rowIndex, colIndex }: CellValueProps) => {
    const visibleColumnId = visibleColumns[colIndex];
    const row = rows[rowIndex];
    const value = row[visibleColumnId];
    return value;
  };

  // Pagination, basic taken from official place
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

  //updates pagination stuff
  const onChangePage = useCallback(
      (pageIndex) =>
          setPagination((pagination) => ({ ...pagination, pageIndex })),
      [setPagination]
  );

  // Sorting the columns
  const [sortingColumns, setSortingColumns] = useState([]);

  //this jsut sorts the columns, works as the example does
  const onSort = useCallback(
    (sortingColumns) => {
      setSortingColumns(sortingColumns);
    },
    [setSortingColumns]
  );

  return (
    <EuiFlexGroup className='eui-xScroll'>
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          sorting={{ columns: sortingColumns, onSort}}
          inMemory={{ level: 'sorting' }}
          aria-label="dataTable"
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
