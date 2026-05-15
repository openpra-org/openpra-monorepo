import { SetStateAction, useCallback, useState } from "react";
import { EuiButton, EuiButtonIcon, EuiDataGrid, EuiFlexGroup, EuiFlexItem } from "@elastic/eui";
import { EuiDataGridColumnSortingConfig } from "@elastic/eui/src/components/datagrid/data_grid_types";
import { ComponentParameterType } from "shared-sdk/lib/api/NestedModelApiManager";
export type ComponentReliabilityTableProps = {
  rows: ComponentParameterType[];
  onAdd: () => void;
  onEdit: (row: ComponentParameterType) => void;
  onDelete: (id: number) => void;
  onImport: () => void;
};
const SCIENTIFIC_COLUMNS = new Set([
  "fth",
  "median",
  "nfth",
  "alpha",
  "beta",
  "mean",
  "errorFactor",
  "dhValue",
  "componentCount",
]);
const COLUMNS = [
  { id: "grouping", displayAsText: "Grouping", truncateText: true },
  { id: "componentType", displayAsText: "Component Type", truncateText: true },
  { id: "componentFailureMode", displayAsText: "Component Failure Mode" },
  { id: "description", displayAsText: "Description" },
  { id: "dataSource", displayAsText: "Data Source", truncateText: true },
  { id: "failures", displayAsText: "Failures", dataType: "number" },
  { id: "units", displayAsText: "Units", truncateText: true },
  { id: "dhUnit", displayAsText: "D/H Unit", truncateText: true },
  { id: "dhValue", displayAsText: "D/H Value", dataType: "number" },
  { id: "componentCount", displayAsText: "Component Count", dataType: "number" },
  { id: "distribution", displayAsText: "Distribution", truncateText: true },
  { id: "analysisType", displayAsText: "Analysis Type", truncateText: true },
  { id: "fth", displayAsText: "5th", dataType: "number" },
  { id: "median", displayAsText: "Median", dataType: "number" },
  { id: "nfth", displayAsText: "95th", dataType: "number" },
  { id: "alpha", displayAsText: "\u03B1", dataType: "number" },
  { id: "beta", displayAsText: "\u03B2", dataType: "number" },
  { id: "mean", displayAsText: "Mean", dataType: "number" },
  { id: "errorFactor", displayAsText: "Error Factor", dataType: "number" },
  { id: "dateRange", displayAsText: "Date Range" },
  { id: "effectiveDate", displayAsText: "Effective Date" },
];
function ComponentReliabilityTable({
  rows,
  onAdd,
  onEdit,
  onDelete,
  onImport,
}: ComponentReliabilityTableProps): JSX.Element {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(COLUMNS.map((c) => c.id));
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sortingColumns, setSortingColumns] = useState<EuiDataGridColumnSortingConfig[]>([]);
  const onChangeItemsPerPage = useCallback((pageSize: number): void => {
    setPagination((p) => ({ ...p, pageSize, pageIndex: 0 }));
  }, []);
  const onChangePage = useCallback((pageIndex: number): void => {
    setPagination((p) => ({ ...p, pageIndex }));
  }, []);
  const onSort = useCallback((updated: SetStateAction<EuiDataGridColumnSortingConfig[]>): void => {
    setSortingColumns(updated);
  }, []);
  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: { rowIndex: number; columnId: string }): string | null => {
      const row = rows[rowIndex];
      if (!row) return null;
      const value = row[columnId as keyof ComponentParameterType];
      if (value === undefined || value === null) return null;
      if (typeof value === "number" && SCIENTIFIC_COLUMNS.has(columnId)) {
        return value.toExponential(3);
      }
      return String(value);
    },
    [rows],
  );
  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem grow={false}>
        <EuiFlexGroup
          justifyContent="flexEnd"
          responsive={false}
        >
          <EuiFlexItem grow={false}>
            <EuiButton
              iconType="importAction"
              onClick={onImport}
            >
              Import from Excel / CSV
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              iconType="plusInCircle"
              onClick={onAdd}
            >
              Add Component Parameter
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiDataGrid
          aria-label="Component Reliability Parameters"
          columns={COLUMNS}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={rows.length}
          renderCellValue={renderCellValue}
          sorting={{ columns: sortingColumns, onSort }}
          inMemory={{ level: "sorting" }}
          pagination={{
            ...pagination,
            pageSizeOptions: [20, 50, 100],
            onChangeItemsPerPage,
            onChangePage,
          }}
          leadingControlColumns={[
            {
              id: "actions",
              width: 70,
              headerCellRender: () => null,
              rowCellRender: ({ rowIndex }: { rowIndex: number }) => {
                const row = rows[rowIndex];
                if (!row) return null;
                return (
                  <EuiFlexGroup
                    gutterSize="xs"
                    responsive={false}
                    alignItems="center"
                  >
                    <EuiFlexItem grow={false}>
                      <EuiButtonIcon
                        iconType="pencil"
                        aria-label={`Edit component parameter ${String(row.id)}`}
                        onClick={() => {
                          onEdit(row);
                        }}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButtonIcon
                        iconType="trash"
                        color="danger"
                        aria-label={`Delete component parameter ${String(row.id)}`}
                        onClick={() => {
                          onDelete(row.id);
                        }}
                      />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                );
              },
            },
          ]}
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
export { ComponentReliabilityTable };
