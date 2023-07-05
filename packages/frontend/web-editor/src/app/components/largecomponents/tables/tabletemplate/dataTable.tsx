import {EuiBasicTable, EuiDataGrid, EuiFlexGroup, EuiFlexItem, EuiThemeProvider, useEuiTheme} from '@elastic/eui';
import {useState} from "react";

interface DataTableProps {
  rows: any[];
  columns: any[];
}

interface CellValueProps {
    rowIndex: number;
    colIndex: number;
}

export default function DataTable({rows, columns}: DataTableProps) {

  //Forces all table columns to have a width of 200px
  //Applies to all data tables
  const {euiTheme} = useEuiTheme();
    const newColumns = columns.map((item) => ({
        ...item,
        width: '200px'
    }))
    const ids = columns.map((item) => (
        item.id
    ))

    const renderCellValue = ({ rowIndex, colIndex }: CellValueProps) => {
        const columnId = columns[colIndex].id;
        const row = rows[rowIndex];
        const value = row[columnId];
        return value;
    };
    console.log(renderCellValue);
    const [visibleColumns, setVisibleColumns] = useState(ids);

    return (
      <EuiFlexGroup style={{margin: '9px', height: '100%'}}  className="eui-xScroll">
          <EuiFlexItem grow={true}>
            <EuiDataGrid
                columns={columns}
                columnVisibility={{ visibleColumns, setVisibleColumns }}
                rowCount={10}
                renderCellValue={({ rowIndex, colIndex }) => `${rowIndex},${colIndex}`}
                aria-labelledby="dataGridLabel" // Add the 'aria-labelledby' property
            />
          </EuiFlexItem>
      </EuiFlexGroup>
  );
}
