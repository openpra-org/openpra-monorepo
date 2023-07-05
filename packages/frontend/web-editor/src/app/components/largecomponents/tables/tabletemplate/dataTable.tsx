import { EuiBasicTable, EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme } from '@elastic/eui';
import { useEffect, useState } from "react";

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

  const [visibleColumns, setVisibleColumns] = useState(() => columns.map((item) => item.id));

  const hideColumn = (columnId: string) => {
    setVisibleColumns((prevVisibleColumns) =>
      prevVisibleColumns.filter((id) => id !== columnId)
    );
  };

  useEffect(() => {
    hideColumn('id');
  }, []);

  const visibleColumnsWithDefinition = columns.filter((column) => visibleColumns.includes(column.id));

  return (
    <EuiFlexGroup style={{ margin: '9px' }} className="eui-xScroll">
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={visibleColumnsWithDefinition}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={renderCellValue}
          aria-labelledby="dataGridLabel" // Add the 'aria-labelledby' property
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
