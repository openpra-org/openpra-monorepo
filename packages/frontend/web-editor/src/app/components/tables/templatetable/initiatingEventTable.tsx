import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiListGroup, EuiListGroupItem, EuiPopover, EuiText } from "@elastic/eui";
import { SetStateAction, useCallback, useEffect, useState } from "react";
import { EuiDataGridColumnSortingConfig } from "@elastic/eui/src/components/datagrid/data_grid_types";
import { groupBy, set } from "lodash";

type DataTableProps = {
  rows: any[];
  columns: any[];
  onRowClick: (rowIndex: number) => void;
};

type CellValueProps = {
  rowIndex: number;
  colIndex: number;
};

/**
 * DataTable component that renders a data grid using Elastic UI components.
 *
 * @param props - The props for the DataTable component.
 * @param props.columns - The column definitions for the data grid.
 * @param props.rows - The data rows that will populate the grid.
 * @returns The `EuiDataGrid` component populated with the provided data.
 */

function DataTable({ rows, columns, onRowClick }: DataTableProps): JSX.Element {
  /**
   * State to manage the visibility of columns in the data grid.
   */
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map((column) => column.id),
  );



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
  const [sortingColumns, setSortingColumns] = useState<
    EuiDataGridColumnSortingConfig[]
  >([]);

  /**
   * Callback to handle sorting changes.
   * @param newSortingColumns - The new sorting configuration for the columns.
   */
  const onSort = useCallback(
    (
      newSortingColumns: SetStateAction<EuiDataGridColumnSortingConfig[]>,
    ): void => {
      setGroupbyColumn("");
      setGroupedRows([]);
      setRowCount(rows.length);
      setSortingColumns(newSortingColumns);
    },
    [setSortingColumns],
  );

  /**
   * State to manage the visibility of the group by popover.
   */
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const groupbyButtonClick = () => {
    setIsPopoverOpen(isPopoverOpen => !isPopoverOpen);
  }
  const closePopover = () => setIsPopoverOpen(false);


  /**
   * State to manage the column to group by and the grouped rows.
   * Run whenever any column is clicked in groupBy Column
   */
  const [groupbyColumn, setGroupbyColumn] = useState<string>("");
  const [groupedRows, setGroupedRows] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState<number>(rows.length);
  const handleGroupByOptionClick = useCallback((columnId: string) => {
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
  }, [groupbyColumn, rows, closePopover]);

  /**
   * 
   * @param rows original data
   * @param columnId Column named grouping
   * @returns 
   */
  function makeGroups(rows: any[], columnId: string) {
    const grouped = groupBy(rows, columnId);
    const groupedRows: any[] = [];
    for (const group in grouped) {
      groupedRows.push({ isHeader: true, group });
      grouped[group].forEach((row: any) => {
        //add group: group to row
        row.group = group;
        groupedRows.push(row);
      });
    }
    return groupedRows;
  }

  /**
   * State to manage the hidden groups.
   * Run whenever a group header is clicked
   */
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const handleGroupHeaderClick = useCallback((group: string) => {
    if (hiddenGroups.includes(group)) {
      setHiddenGroups(hiddenGroups.filter((g) => g !== group));
    } else {
      setHiddenGroups([...hiddenGroups, group]);
    }
    console.log(hiddenGroups);
    },[hiddenGroups,groupbyColumn,groupedRows]);
  
  
  
  /**
   * Retrieves the value for a cell given its row and column index.
   *
   * @param cellProps - The properties for the cell.
   * @param cellProps.rowIndex - The index of the row for the cell.
   * @param cellProps.colIndex - The index of the column for the cell.
   * @returns The value for the cell at the specified row and column index.
   */
  const cellValue = useCallback(
    ({ rowIndex, colIndex }: CellValueProps) => {
        if (groupbyColumn!=""){
          const visibleColumnId = visibleColumns[colIndex];
          const row = groupedRows[rowIndex];
          if (row.isHeader) {
            if (visibleColumnId === groupbyColumn){
              return (
                <div onClick={() => handleGroupHeaderClick(row.group)}>
                  <strong>{row.group}</strong>
                </div>
              )
            }
            else{
              return (
                <div onClick={() => handleGroupHeaderClick(row.group)}></div>
              )
            }
          }
          return (
            <div onClick={() => onRowClick(row)}>
              {row[visibleColumnId]}
            </div>
          )    
        }
        
        const visibleColumnId = visibleColumns[colIndex];
        const row = rows[rowIndex];
        return (
            <div onClick={() => onRowClick(row)}>
                {row[visibleColumnId]}
            </div>
        )
    }, [visibleColumns, rows, groupbyColumn, groupedRows, hiddenGroups]
  );

  return (
  <div>
    <EuiFlexGroup>
      <EuiPopover
        button={<button onClick={groupbyButtonClick}>Group By: {groupbyColumn!="" && (<EuiText>{groupbyColumn}</EuiText>)}</button>}
        isOpen={isPopoverOpen}
        closePopover={closePopover}
      >
        <EuiListGroup>
          {columns.map((column) => (
            <EuiListGroupItem
              key={column.id}
              label={column.displayAsText}
              onClick={() => handleGroupByOptionClick(column.id)}
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
