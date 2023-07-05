import { EuiDataGrid } from "@elastic/eui";
import { useState } from "react";

const columns = [{ id: 'A' }, { id: 'B' }];
const [visibleColumns, setVisibleColumns] = useState(['A', 'B']);

export default function Testiong(){
  return (
    <EuiDataGrid
      columns={columns}
      columnVisibility={{ visibleColumns, setVisibleColumns }}
      rowCount={10}
      renderCellValue={({ rowIndex, colIndex }) => `${rowIndex},${colIndex}`}
      aria-label="Data grid demo"
    />
  )
}
