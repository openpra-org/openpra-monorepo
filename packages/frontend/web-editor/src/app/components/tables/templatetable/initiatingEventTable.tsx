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

// Minimal column shape used by this table
type BasicColumn = {
  id: string;
  displayAsText?: string;
} & Record<string, unknown>;

// Base row shape (dynamic cells). Group headers add metadata fields.
type CellValue = string | number | boolean | null | undefined | JSX.Element;
type BaseRow = Record<string, CellValue>; // dynamic cell access by column id

interface GroupHeaderRow extends BaseRow {
  isHeader: true;
  group: string;
}

// TableRow always maintains index signature from BaseRow; add union for header metadata
type TableRow = BaseRow & Partial<GroupHeaderRow>;

// Type guard to distinguish header rows
function isGroupHeaderRow(row: TableRow): row is GroupHeaderRow {
  return row.isHeader === true;
}

interface DataTableProps {
  rows: TableRow[];
  columns: BasicColumn[];
  // onRowClick receives the raw row object (non-header) for consumer logic
  onRowClick: (row: TableRow) => void;
}

interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}

/**
 * DataTable component that renders a data grid using Elastic UI components.
 * Returns an EuiDataGrid populated with the provided data.
 */

function DataTable({ rows, columns, onRowClick }: DataTableProps): JSX.Element {
  /**
   * State to manage the visibility of columns in the data grid.
   */
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((column) => column.id));

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
   * @param newSortingColumns - The new sorting configuration for the columns.
   */
  const onSort = useCallback(
    (newSortingColumns: SetStateAction<EuiDataGridColumnSortingConfig[]>): void => {
      setGroupbyColumn("");
      setGroupedRows([]);
      setRowCount(rows.length);
      setSortingColumns(newSortingColumns);
    },
    [setSortingColumns, rows.length],
  );

  /**
   * State to manage the visibility of the group by popover.
   */
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const groupbyButtonClick = (): void => {
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  };
  const closePopover = useCallback((): void => {
    setIsPopoverOpen(false);
  }, []);

  /**
   * State to manage the column to group by and the grouped rows.
   * Run whenever any column is clicked in groupBy Column
   */
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

  /**
   * Groups the original rows by a column id and returns a new flat list with group headers.
   *
   * @param rows - Original table data rows.
   * @param columnId - Column name to group by.
   * @returns Grouped rows containing header and data rows.
   */
  function makeGroups(originalRows: TableRow[], columnId: string): TableRow[] {
    const grouped = groupBy(originalRows, columnId) as Record<string, TableRow[]>;
    const newGroupedRows: TableRow[] = [];
    for (const groupKey in grouped) {
      newGroupedRows.push({ isHeader: true, group: groupKey });
      grouped[groupKey].forEach((row) => {
        // Non-mutating: create a shallow copy with group metadata
        newGroupedRows.push({ ...row, group: groupKey });
      });
    }
    return newGroupedRows;
  }

  /**
   * State to manage the hidden groups.
   * Run whenever a group header is clicked
   */
  // TODO: Apply hiddenGroups in cell rendering to hide collapsed groups
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const handleGroupHeaderClick = useCallback((group: string): void => {
    setHiddenGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }, []);

  /**
   * Retrieves the value for a cell given its row and column index.
   *
   * @param cellProps - The properties for the cell.
   * @returns The cell contents for the specified row/column.
   */
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
              onRowClick(row); // row is a non-header row here
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
