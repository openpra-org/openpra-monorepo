import { EuiBasicTable, EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme } from '@elastic/eui';
import { useState, useEffect } from "react";

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

  const ids = columns.map((items) => items.id);

  const renderCellValue = ({ rowIndex, colIndex }: CellValueProps) => {
    const columnId = columns[colIndex].id;
    const row = rows[rowIndex];
    const value = row[columnId];
    return value;
  };

  const [visibleColumns, setVisibleColumns] = useState(ids);

  useEffect(() => {
    const hideColumn = (columnId: string) => {
      setVisibleColumns((prevVisibleColumns) =>
        prevVisibleColumns.filter((id) => id !== columnId)
      );
    };

    hideColumn('id');
  }, []);

  return (
    <EuiFlexGroup style={{ margin: '9px' }} className="eui-xScroll">
      <EuiFlexItem >
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={renderCellValue}
          aria-labelledby="dataGridLabel" // Add the 'aria-labelledby' property
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
