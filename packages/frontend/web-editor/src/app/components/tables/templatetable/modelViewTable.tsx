import { EuiButton, EuiDataGrid, EuiFlexGroup, EuiFlexItem } from "@elastic/eui";
import { useCallback, useState } from "react";

type ModelViewTableProps = {
  rows: any[];
  columns: any[];
};

type CellValueProps = {
  rowIndex: number;
  colIndex: number;
};

function ModelViewTable({ rows, columns }: ModelViewTableProps): JSX.Element {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map((column) => column.id),
  );

  const cellValue = ({ rowIndex, colIndex }: CellValueProps): any => {
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

  // Function to divide models into smaller subsets based on their names
  const divideModels = () => {

    const subsets = {};
    rows.forEach((row) => {
      const modelName = row.modelName;
      const firstLetter = modelName.charAt(0).toUpperCase();
      if (!subsets[firstLetter]) {
        subsets[firstLetter] = [];
      }
      subsets[firstLetter].push(row);
    });
    console.log(subsets);
    // Here you can perform actions with the subsets, such as updating state or displaying them in some way
  };

  const columnsWithButton = [
    {
      id: 'model',
      displayAsText: 'Model',
    },
    ...columns, // Include other columns
    {
      id: 'divideButton',
      displayAsText: 'Divide Models',
      cellActions: [
        {
          icon: 'plusInCircle',
          onClick: () => divideModels(),
          label: 'Divide Models',
        },
      ],
    },
  ];

  return (
    <EuiFlexGroup className="eui-xScroll">
      <EuiFlexItem grow={true}>
        <EuiDataGrid
          columns={columnsWithButton}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={cellValue}
          aria-label="modelViewTable"
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

export { ModelViewTable };
