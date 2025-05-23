import { EuiDataGrid, EuiFlexGroup, EuiFlexItem } from "@elastic/eui";
import { EuiDataGridColumnSortingConfig } from "@elastic/eui/src/components/datagrid/data_grid_types";
import { SetStateAction, useCallback, useState } from "react";

interface DataTableProps {
  rows: any[];
  columns: any[];
}

interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}

/**
 * DataTable component that renders a data grid using Elastic UI components.
 *
 * @param props - The props for the DataTable component.
 * @param columns - The column definitions for the data grid.
 * @param rows - The data rows that will populate the grid.
 * @returns The `EuiDataGrid` component populated with the provided data.
 */
const DataTable = ({ rows, columns }: DataTableProps): JSX.Element => {
  /**
   * State to manage the visibility of columns in the data grid.
   */
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((column) => column.id));

  /**
   * Retrieves the value for a cell given its row and column index.
   *
   * @param cellProps - The properties for the cell.
   * @param rowIndex - The index of the row for the cell.
   * @param colIndex - The index of the column for the cell.
   * @returns The value for the cell at the specified row and column index.
   */
  const cellValue = ({ rowIndex, colIndex }: CellValueProps): any => {
    const visibleColumnId = visibleColumns[colIndex];
    const row = rows[rowIndex];
    return row[visibleColumnId];
  };

  /**
   * State to manage pagination settings for the data grid.
   */
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  /**
   * Callback to handle changes in the number of items per page.
   *
   * @param pageSize - The new page size.
   */
  const onChangeItemsPerPage = useCallback(
    (pageSize: number): void => {
      setPagination((pagination) => ({
        ...pagination,
        pageSize,
        pageIndex: 0,
      }));
    },
    [setPagination],
  );

  /**
   * Callback to handle page changes.
   *
   * @param pageIndex - The new page index.
   */
  const onChangePage = useCallback(
    (pageIndex: number): void => {
      setPagination((pagination) => ({ ...pagination, pageIndex }));
    },
    [setPagination],
  );

  /**
   * State to manage sorting configurations for the data grid columns.
   */
  const [sortingColumns, setSortingColumns] = useState<EuiDataGridColumnSortingConfig[]>([]);

  /**
   * Callback to handle sorting changes.
   *
   * @param newSortingColumns - The new sorting configuration for the columns.
   */
  const onSort = useCallback(
    (newSortingColumns: SetStateAction<EuiDataGridColumnSortingConfig[]>): void => {
      setSortingColumns(newSortingColumns);
    },
    [setSortingColumns],
  );

  return (
    <EuiFlexGroup className="eui-xScroll">
      <EuiFlexItem grow>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          sorting={{ columns: sortingColumns, onSort }}
          inMemory={{ level: "sorting" }}
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
};

export { DataTable };
