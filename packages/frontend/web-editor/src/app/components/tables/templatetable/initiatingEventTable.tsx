import {
  EuiDataGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiListGroup,
  EuiListGroupItem,
  EuiPopover,
  EuiText,
} from "@elastic/eui";
import { SetStateAction, useCallback, useState } from "react";
import { EuiDataGridColumnSortingConfig } from "@elastic/eui/src/components/datagrid/data_grid_types";
import { groupBy } from "lodash";
type BasicColumn = {
  id: string;
  displayAsText?: string;
} & Record<string, unknown>;
type CellValue = string | number | boolean | null | undefined | JSX.Element;
type BaseRow = Record<string, CellValue>;
interface GroupHeaderRow extends BaseRow {
  isHeader: true;
  group: string;
}
type TableRow = BaseRow & Partial<GroupHeaderRow>;
function isGroupHeaderRow(row: TableRow): row is GroupHeaderRow {
  return row.isHeader === true;
}
interface DataTableProps {
  rows: TableRow[];
  columns: BasicColumn[];
  onRowClick: (row: TableRow) => void;
}
interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}
function DataTable({ rows, columns, onRowClick }: DataTableProps): JSX.Element {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((column) => column.id));
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
      setGroupbyColumn("");
      setGroupedRows([]);
      setRowCount(rows.length);
      setSortingColumns(newSortingColumns);
    },
    [setSortingColumns, rows.length],
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const groupbyButtonClick = (): void => {
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  };
  const closePopover = useCallback((): void => {
    setIsPopoverOpen(false);
  }, []);
  const [groupbyColumn, setGroupbyColumn] = useState<string>("");
  const [groupedRows, setGroupedRows] = useState<TableRow[]>([]);
  const [rowCount, setRowCount] = useState<number>(rows.length);
  const handleGroupByOptionClick = useCallback(
    (columnId: string): void => {
      setHiddenGroups([]);
      if (groupbyColumn === columnId) {
        setGroupbyColumn("");
        setGroupedRows([]);
        setRowCount(rows.length);
        closePopover();
        return;
      }
      const groupedRows = makeGroups(rows, columnId);
      setGroupedRows(groupedRows);
      setRowCount(groupedRows.length);
      setGroupbyColumn(columnId);
      closePopover();
    },
    [groupbyColumn, rows, closePopover],
  );
  function makeGroups(originalRows: TableRow[], columnId: string): TableRow[] {
    const grouped = groupBy(originalRows, columnId) as Record<string, TableRow[]>;
    const newGroupedRows: TableRow[] = [];
    for (const groupKey in grouped) {
      newGroupedRows.push({ isHeader: true, group: groupKey });
      grouped[groupKey].forEach((row) => {
        newGroupedRows.push({ ...row, group: groupKey });
      });
    }
    return newGroupedRows;
  }
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const handleGroupHeaderClick = useCallback((group: string): void => {
    setHiddenGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }, []);
  const cellValue = useCallback(
    ({ rowIndex, colIndex }: CellValueProps): JSX.Element => {
      if (groupbyColumn !== "") {
        const visibleColumnId = visibleColumns[colIndex];
        const row = groupedRows[rowIndex];
        if (isGroupHeaderRow(row)) {
          if (visibleColumnId === groupbyColumn) {
            return (
              <div
                onClick={() => {
                  handleGroupHeaderClick(row.group);
                }}
              >
                <strong>{row.group}</strong>
              </div>
            );
          } else {
            return (
              <div
                onClick={() => {
                  handleGroupHeaderClick(row.group);
                }}
              ></div>
            );
          }
        }
        return (
          <div
            onClick={() => {
              onRowClick(row);
            }}
          >
            {row[visibleColumnId]}
          </div>
        );
      }
      const visibleColumnId = visibleColumns[colIndex];
      const row = rows[rowIndex];
      return (
        <div
          onClick={() => {
            onRowClick(row);
          }}
        >
          {row[visibleColumnId]}
        </div>
      );
    },
    [visibleColumns, rows, groupbyColumn, groupedRows, onRowClick, handleGroupHeaderClick],
  );
  return (
    <div>
      <EuiFlexGroup>
        <EuiPopover
          button={
            <button onClick={groupbyButtonClick}>
              Group By: {groupbyColumn !== "" && <EuiText>{groupbyColumn}</EuiText>}
            </button>
          }
          isOpen={isPopoverOpen}
          closePopover={closePopover}
        >
          <EuiListGroup>
            {columns.map((column) => (
              <EuiListGroupItem
                key={column.id}
                label={column.displayAsText}
                onClick={() => {
                  handleGroupByOptionClick(column.id);
                }}
                size="xs"
              />
            ))}
          </EuiListGroup>
        </EuiPopover>
      </EuiFlexGroup>
      <EuiFlexGroup className="eui-xScroll">
        <EuiFlexItem grow={true}>
          <EuiDataGrid
            columns={columns}
            columnVisibility={{ visibleColumns, setVisibleColumns }}
            rowCount={rowCount}
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
            toolbarVisibility={{
              showColumnSelector: true,
              showSortSelector: true,
            }}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </div>
  );
}
export { DataTable };
