import { EuiDataGrid, EuiFlexGroup, EuiFlexItem } from "@elastic/eui";
import { SetStateAction, useCallback, useState } from "react";
import { EuiDataGridColumnSortingConfig } from "@elastic/eui/src/components/datagrid/data_grid_types";
type BasicColumn = {
  id: string;
  displayAsText?: string;
} & Record<string, unknown>;
type BasicCell = string | number | boolean | null | undefined | JSX.Element;
export type BasicRow = Record<string, BasicCell>;
interface DataTableProps<R extends BasicRow = BasicRow> {
  rows: R[];
  columns: BasicColumn[];
}
interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}
function DataTable<R extends BasicRow>({ rows, columns }: DataTableProps<R>): JSX.Element {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((column) => column.id));
  const cellValue = ({ rowIndex, colIndex }: CellValueProps): BasicCell => {
    const visibleColumnId = visibleColumns[colIndex];
    const row = rows[rowIndex];
    return row[visibleColumnId];
  };
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
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
  const onChangePage = useCallback(
    (pageIndex: number): void => {
      setPagination((pagination) => ({ ...pagination, pageIndex }));
    },
    [setPagination],
  );
  const [sortingColumns, setSortingColumns] = useState<EuiDataGridColumnSortingConfig[]>([]);
  const onSort = useCallback(
    (newSortingColumns: SetStateAction<EuiDataGridColumnSortingConfig[]>): void => {
      setSortingColumns(newSortingColumns);
    },
    [setSortingColumns],
  );
  return (
    <EuiFlexGroup className="eui-xScroll">
      <EuiFlexItem grow={true}>
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
}
export { DataTable };
