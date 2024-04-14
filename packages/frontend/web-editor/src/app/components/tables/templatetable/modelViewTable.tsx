import React, { useState, useMemo } from "react";
import {
  EuiDataGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiModal,
  EuiModalBody,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalFooter,
  EuiFieldSearch,
  EuiPopover,
  EuiButtonIcon,
  EuiListGroup,
  EuiListGroupItem,
} from "@elastic/eui";
import "@elastic/eui/dist/eui_theme_light.css";

type ModelViewTableProps = {
  columns: any[];
  rows: any[];
};

const ModelViewTable: React.FC<ModelViewTableProps> = ({ columns, rows }) => {
  const [visibleColumns, setVisibleColumns] = useState(
    columns.map((column) => column.id),
  );
  const [queryText, setQueryText] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);
  const [groupByColumn, setGroupByColumn] = useState("");
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  const togglePopover = () => {
    setPopoverOpen(!isPopoverOpen);
  };

  const handleRowClick = (rowId: number) => {
    const row = rows.find((row) => row.id === rowId);
    setModalContent(row);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
  };

  const sortedAndFilteredRows = useMemo(() => {
    let processedRows = rows;
    if (queryText) {
      processedRows = processedRows.filter((row) =>
        Object.values(row).some((value) =>
          value
            ? value.toString().toLowerCase().includes(queryText.toLowerCase())
            : false,
        ),
      );
    }
    if (groupByColumn) {
      const grouped = processedRows.reduce<Record<string, typeof rows>>(
        (acc, row) => {
          const key = row[groupByColumn] || "Other"; // Explicit casting if `groupByColumn` is dynamic
          acc[key] = acc[key] || [];
          acc[key].push(row);
          return acc;
        },
        {},
      );
    }
    return processedRows;
  }, [rows, queryText, groupByColumn]);

  return (
    <EuiFlexGroup direction="column" gutterSize="s">
      <EuiFlexItem>
        <EuiButton onClick={togglePopover}>Button</EuiButton>
        {isPopoverOpen && (
          <EuiPopover
            isOpen={isPopoverOpen}
            closePopover={togglePopover}
            button={
              <EuiButtonIcon
                iconType="arrowDown"
                onClick={togglePopover}
                aria-label="More options"
              />
            }
          >
            <EuiListGroup maxWidth={300}>
              {columns.map((column) => (
                <EuiListGroupItem
                  key={column.id}
                  label={column.displayAsText || column.id}
                  onClick={() => {
                    setGroupByColumn(column.id);
                    togglePopover();
                  }}
                />
              ))}
            </EuiListGroup>
          </EuiPopover>
        )}
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiFieldSearch
          placeholder="Search..."
          value={queryText}
          onChange={(e) => {
            setQueryText(e.target.value);
          }}
          isClearable={true}
        />
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiDataGrid
          aria-label="Model view grid"
          columns={columns}
          columnVisibility={{ visibleColumns, setVisibleColumns }}
          rowCount={sortedAndFilteredRows.length}
          renderCellValue={({ rowIndex, columnId }) => (
            <div
              onClick={() => {
                handleRowClick(sortedAndFilteredRows[rowIndex].id);
              }}
            >
              {sortedAndFilteredRows[rowIndex][columnId]}
            </div>
          )}
        />
      </EuiFlexItem>
      {isModalVisible && (
        <EuiModal onClose={closeModal}>
          <EuiModalHeader>
            <EuiModalHeaderTitle>
              <h1>Row Details</h1>
            </EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>{JSON.stringify(modalContent, null, 2)}</EuiModalBody>
          <EuiModalFooter>
            <EuiButton onClick={closeModal} fill>
              Close
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}
    </EuiFlexGroup>
  );
};

export { ModelViewTable };
