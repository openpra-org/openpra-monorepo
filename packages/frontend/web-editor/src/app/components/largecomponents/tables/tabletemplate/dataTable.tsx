import { EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme } from '@elastic/eui';
import { useEffect, useState } from 'react';

//
interface DataTableProps {
  rows: any[];
  columns: any[];
}

//the indexes in a sell
interface CellValueProps {
  rowIndex: number;
  colIndex: number;
}

export default function DataTable({ rows, columns }: DataTableProps) {

  //declares the theme if we need to style it
  const { euiTheme } = useEuiTheme();

  //this renders the content, it uses visible columns instead of just columns so everything shows up as intended, with the correct id
  //EUI hands the complexities.
  const renderCellValue = ({ rowIndex, colIndex }: CellValueProps) => {
    const visibleColumnId = visibleColumns[colIndex];
    const row = rows[rowIndex];
    const value = row[visibleColumnId];
    return value;
  };

  //mapping the initial data here to the visible columns
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.id));

  return (
    <EuiFlexGroup style={{ margin: '9px' }} className="eui-xScroll">
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={renderCellValue}
          aria-labelledby="dataGridLabel"
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
