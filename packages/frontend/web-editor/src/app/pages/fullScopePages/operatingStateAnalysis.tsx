import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import {
  EuiButton,
  EuiButtonIcon,
  EuiCheckbox,
  EuiDataGrid,
  EuiDataGridCellValueElementProps,
  EuiDataGridColumn,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPopover,
  EuiResizableContainer,
  EuiSelect,
} from "@elastic/eui";
import { OperatingStateAnalysisList } from "../../components/lists/nestedLists/operatingStateAnalysisList";
interface DataRow {
  id: number;
  definition: string;
  characteristics: string;
  processCriteriaIdentification: string;
  controlRodInsertion: string;
  feedwaterPump: string;
  reactorCoolantCirculator: string;
  others: string;
  [key: string]: string | number;
}
type ColumnType = "text" | "dropdown" | "number";
interface DropdownOption {
  value: string;
  text: string;
}
interface ColumnConfig {
  id: string;
  displayAsText: string;
  columnType: ColumnType;
  dropdownOptions: DropdownOption[];
}
interface CustomColumn extends EuiDataGridColumn {
  id: string;
  displayAsText: string;
  inputType?: ColumnType;
  dropdownOptions?: {
    value: string;
    text: string;
  }[];
  previousType?: ColumnType;
}
interface CustomHeaderProps {
  column: CustomColumn;
  onEdit: (columnId: string) => void;
}
const CustomHeader: React.FC<CustomHeaderProps> = ({ column, onEdit }) => {
  const headerTextStyle: React.CSSProperties = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "calc(100% - 25px)",
    display: "inline-block",
    verticalAlign: "middle",
  };
  const iconStyle: React.CSSProperties = {
    display: "inline-block",
    verticalAlign: "middle",
    marginLeft: "5px",
  };
  if (column.id === "delete") {
    return <span>&nbsp;</span>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={headerTextStyle}
        title={column.displayAsText}
      >
        {column.displayAsText}
      </div>
      <EuiButtonIcon
        iconType="pencil"
        onClick={() => {
          onEdit(column.id);
        }}
        aria-label={`Edit column ${column.displayAsText}`}
        size="s"
        style={iconStyle}
      />
    </div>
  );
};
const App: React.FC = () => {
  const [data, setData] = useState<DataRow[]>([
    {
      id: 1,
      definition: "Definition 1",
      characteristics: "Characteristics 1",
      processCriteriaIdentification: "Criteria 1",
      controlRodInsertion: "yes",
      feedwaterPump: "no",
      reactorCoolantCirculator: "yes",
      others: "no",
    },
    {
      id: 2,
      definition: "Definition 2",
      characteristics: "Characteristics 2",
      processCriteriaIdentification: "Criteria 2",
      controlRodInsertion: "no",
      feedwaterPump: "yes",
      reactorCoolantCirculator: "no",
      others: "yes",
    },
  ]);
  const [baseColumns, setBaseColumns] = useState<CustomColumn[]>([
    {
      id: "definition",
      displayAsText: "Definition",
    },
    { id: "characteristics", displayAsText: "Characteristics" },
    {
      id: "processCriteriaIdentification",
      displayAsText: "Process Criteria Identification",
    },
    {
      id: "controlRodInsertion",
      displayAsText: "Control Rod Insertion",
      isSortable: true,
    },
    { id: "feedwaterPump", displayAsText: "Feedwater Pump", isSortable: true },
    {
      id: "reactorCoolantCirculator",
      displayAsText: "Reactor Coolant Circulator",
      isExpandable: true,
    },
    { id: "others", displayAsText: "Others", isExpandable: true },
  ]);
  const [dataGridWidth] = useState("calc(100% - 300px)");
  const [isColumnEditModalVisible, setIsColumnEditModalVisible] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const openEditColumnModal = useCallback(
    (columnId: string): void => {
      const column = [...baseColumns, ...customColumns].find((col) => col.id === columnId);
      if (column) {
        setNewColumnData({
          id: column.id,
          displayAsText: column.displayAsText,
          columnType: column.inputType ?? "text",
          dropdownOptions: column.dropdownOptions ?? [],
        });
        setIsColumnEditModalVisible(true);
      }
    },
    [baseColumns, customColumns],
  );
  const handleEditColumnChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof ColumnConfig,
  ): void => {
    setNewColumnData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const saveColumnChanges = (): void => {
    const updatedBaseColumns = baseColumns.map((col) => {
      if (col.id === newColumnData.id) {
        return {
          ...col,
          displayAsText: newColumnData.displayAsText,
          inputType: newColumnData.columnType,
          dropdownOptions: newColumnData.dropdownOptions,
        };
      }
      return col;
    });
    setCustomColumns((prevColumns) =>
      prevColumns.map((col) => {
        if (col.id === newColumnData.id) {
          updateColumnType(newColumnData.id, newColumnData.columnType);
          return {
            ...col,
            displayAsText: newColumnData.displayAsText,
            inputType: newColumnData.columnType,
            dropdownOptions: newColumnData.dropdownOptions,
          };
        }
        return col;
      }),
    );
    setBaseColumns(updatedBaseColumns);
    setIsColumnEditModalVisible(false);
  };
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [newColumnData, setNewColumnData] = useState<ColumnConfig>({
    id: "",
    displayAsText: "",
    columnType: "text",
    dropdownOptions: [],
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const togglePopover = (): void => {
    setIsPopoverOpen((current) => !current);
  };
  const closePopover = (): void => {
    setIsPopoverOpen(false);
  };
  const handleCreateColumn = (): void => {
    if (!newColumnData.id || !newColumnData.displayAsText) {
      return;
    }
    const inputType = newColumnData.columnType as ColumnType | undefined;
    const newColumn: CustomColumn = {
      id: newColumnData.id.trim(),
      displayAsText: newColumnData.displayAsText.trim(),
      inputType: inputType,
      ...(inputType === "dropdown" && {
        dropdownOptions: newColumnData.dropdownOptions,
      }),
    };
    setCustomColumns((prevColumns) => [...prevColumns, newColumn]);
  };
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState<DataRow | null>(null);
  const [isNewColumnModalVisible, setIsNewColumnModalVisible] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState([{ value: "", text: "" }]);
  const [selectedColumnType, setSelectedColumnType] = useState<ColumnType>("text");
  const handleColumnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const columnType = e.target.value as ColumnType;
    setSelectedColumnType(columnType);
    if (columnType === "dropdown") {
      setNewColumnData((prev) => ({
        ...prev,
        columnType,
        dropdownOptions: [{ value: "", text: "" }],
      }));
    } else {
      setNewColumnData((prev) => ({
        ...prev,
        columnType,
        dropdownOptions: [],
      }));
    }
  };
  const updateFieldInData = useCallback(
    (fieldKey: keyof DataRow, value: string | number): void => {
      if (!selectedRowData) return;
      const customColumn = customColumns.find((col) => col.id === fieldKey);
      const newValue =
        customColumn && customColumn.previousType === "dropdown" && customColumn.inputType === "text" ? "" : value;
      const updatedSelectedRowData = { ...selectedRowData, [fieldKey]: newValue };
      setSelectedRowData(updatedSelectedRowData);
      setData((prevData) => prevData.map((row) => (row.id === selectedRowData.id ? updatedSelectedRowData : row)));
    },
    [customColumns, selectedRowData, setSelectedRowData, setData],
  );
  const handleAddDropdownOption = (): void => {
    setNewColumnData((prev) => ({
      ...prev,
      dropdownOptions: [...prev.dropdownOptions, { value: "", text: "" }],
    }));
  };
  const handleDropdownOptionChange = (index: number, key: string, value: string): void => {
    setNewColumnData((prev) => ({
      ...prev,
      dropdownOptions: prev.dropdownOptions.map((option, i) => {
        if (i === index) {
          return { ...option, [key]: value };
        }
        return option;
      }),
    }));
  };
  const handleRemoveDropdownOption = (index: number): void => {
    setNewColumnData((prev) => ({
      ...prev,
      dropdownOptions: prev.dropdownOptions.filter((_, i) => i !== index),
    }));
  };
  const [newColumnDetails, setNewColumnDetails] = useState({
    id: "",
    displayAsText: "",
    columnType: "text",
  });
  const handleAddNewColumn = (): void => {
    if (!newColumnDetails.id || !newColumnDetails.displayAsText) {
      return;
    }
    if (newColumnDetails.id === "delete") {
      return;
    }
    const newColumnConfig = {
      id: newColumnDetails.id.trim(),
      displayAsText: newColumnDetails.displayAsText.trim(),
      columnType: selectedColumnType,
      ...(selectedColumnType === "dropdown" && {
        dropdownOptions: dropdownOptions.filter((option) => option.value && option.text),
      }),
    };
    setCustomColumns((prevColumns) => {
      const filteredColumns = prevColumns.filter((column) => column.id !== "delete");
      return [
        ...filteredColumns,
        newColumnConfig,
        {
          id: "delete",
          displayAsText: "",
        },
      ];
    });
    setNewColumnDetails({ id: "", displayAsText: "", columnType: "text" });
    setSelectedColumnType("text");
    setDropdownOptions([{ value: "", text: "" }]);
    setIsNewColumnModalVisible(false);
  };
  const handleButtonClick = (_event: React.MouseEvent<HTMLButtonElement>): void => {
    const newColumnId = "newColumnId";
    const newColumnDisplayText = "New Column";
    const newColumnType: ColumnType = "dropdown";
    const columnConfig: ColumnConfig = {
      id: newColumnId,
      displayAsText: newColumnDisplayText,
      columnType: newColumnType,
      dropdownOptions: [],
    };
    columnConfig.dropdownOptions = [
      { value: "option1", text: "Option 1" },
      { value: "option2", text: "Option 2" },
    ];
    handleAddNewColumn();
  };
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set<number>());
  const handleRowSelectionChange = useCallback((rowId: number): void => {
    setSelectedRowIds((prevSelectedRowIds) => {
      const newSelectedRowIds = new Set(prevSelectedRowIds);
      if (newSelectedRowIds.has(rowId)) {
        newSelectedRowIds.delete(rowId);
      } else {
        newSelectedRowIds.add(rowId);
      }
      localStorage.setItem("selectedRowIds", JSON.stringify([...newSelectedRowIds]));
      return newSelectedRowIds;
    });
  }, []);
  const handleDeleteSelectedRows = useCallback((): void => {
    setData((prevData) => prevData.filter((row) => !selectedRowIds.has(row.id)));
    setSelectedRowIds(new Set());
  }, [selectedRowIds]);
  const getMergedColumns = useMemo<CustomColumn[]>(() => {
    const selectColumn = {
      id: "select",
      displayAsText: "",
      cellRenderer: ({ rowIndex }: EuiDataGridCellValueElementProps): JSX.Element => {
        const rowId = data[rowIndex].id;
        const isChecked = selectedRowIds.has(rowId);
        const optionId = `checkbox_${String(rowId)}`;
        return (
          <EuiCheckbox
            key={optionId}
            id={optionId}
            checked={isChecked}
            onChange={(): void => {
              handleRowSelectionChange(rowId);
            }}
            label=""
          />
        );
      },
    };
    const filteredBaseColumns = baseColumns.filter((column) => column.id !== "details");
    const filteredCustomColumns = customColumns.filter((column) => column.id !== "details");
    const combinedColumns: CustomColumn[] = [
      selectColumn as CustomColumn,
      ...filteredBaseColumns,
      ...filteredCustomColumns,
    ].reduce<CustomColumn[]>((acc, current): CustomColumn[] => {
      const columnExists = acc.find((item) => item.id === current.id);
      if (!columnExists) {
        acc.push({
          ...current,
          display:
            current.id !== "delete" ?
              <CustomHeader
                key={`${current.id}-${current.displayAsText}`}
                column={current}
                onEdit={openEditColumnModal}
              />
            : undefined,
        });
      }
      return acc;
    }, []);
    return combinedColumns;
  }, [baseColumns, customColumns, openEditColumnModal, selectedRowIds, handleRowSelectionChange, data]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getMergedColumns.map((column) => column.id));
  const handleCloseModal = useCallback((): void => {
    setIsModalVisible(false);
  }, []);
  const handleAddNewRow = (): void => {
    const newRow = {
      id: Date.now(),
      definition: "",
      characteristics: "",
      processCriteriaIdentification: "",
      controlRodInsertion:
        customColumns.find((col) => col.id === "controlRodInsertion")?.dropdownOptions?.[0].value ?? "",
      feedwaterPump: customColumns.find((col) => col.id === "feedwaterPump")?.dropdownOptions?.[0].value ?? "",
      reactorCoolantCirculator:
        customColumns.find((col) => col.id === "reactorCoolantCirculator")?.dropdownOptions?.[0].value ?? "",
      others: customColumns.find((col) => col.id === "others")?.dropdownOptions?.[0].value ?? "",
    };
    setSelectedRowData(newRow);
    setIsModalVisible(true);
  };
  const handleModalSubmit = (): void => {
    if (selectedRowData) {
      const isNewRow = !data.find((row) => row.id === selectedRowData.id);
      if (isNewRow) {
        const newRowData = { ...modalFormState, id: Date.now() };
        setData((prevData) => [...prevData, newRowData]);
      } else {
        setData((prevData) =>
          prevData.map((row) => (row.id === selectedRowData.id ? { ...row, ...modalFormState } : row)),
        );
      }
    }
    setIsModalVisible(false);
  };
  const handleCellEdit = useCallback((rowIndex: number, columnId: keyof DataRow, value: string): void => {
    setData((currentData) => {
      const newData = [...currentData];
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: value };
      return newData;
    });
  }, []);
  const updateColumnType = (columnId: string, newType: ColumnType): void => {
    setCustomColumns((prevCustomColumns) =>
      prevCustomColumns.map((column) => {
        if (column.id === columnId) {
          return {
            ...column,
            previousType: column.inputType,
            inputType: newType,
          };
        }
        return column;
      }),
    );
    if (newType === "text") {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          [columnId]: "",
        })),
      );
    }
  };
  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
      const rowData = data[rowIndex];
      const customColumn = [...baseColumns, ...customColumns].find((col) => col.id === columnId);
      const handleRowClick = (): void => {
        if (selectedRowData && rowData.id === selectedRowData.id) {
          setIsSidePanelOpen((isOpen) => !isOpen);
        } else {
          setSelectedRowData(rowData);
          setIsSidePanelOpen(true);
        }
      };
      const handleValueChange = (value: string): void => {
        const newValue = customColumn?.previousType === "dropdown" && customColumn.inputType === "text" ? "" : value;
        handleCellEdit(rowIndex, columnId, value);
        if (isSidePanelOpen) {
          updateFieldInData(columnId, newValue);
        }
      };
      const handleDropdownChange = (selectedValue: string): void => {
        setData((prevData) =>
          prevData.map((row, index) => {
            if (index === rowIndex) {
              return { ...row, [columnId]: selectedValue };
            }
            return row;
          }),
        );
        if (selectedRowData && selectedRowData.id === rowData.id) {
          setSelectedRowData({ ...selectedRowData, [columnId]: selectedValue });
        }
      };
      if (columnId === "select") {
        const rowId = data[rowIndex].id;
        return (
          <input
            type="checkbox"
            checked={selectedRowIds.has(rowId)}
            onChange={() => {
              handleRowSelectionChange(rowId);
            }}
            aria-label={`Select row ${String(rowId)}`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        );
      }
      const renderCellContent = (): JSX.Element => {
        if (customColumn?.inputType === "text") {
          return (
            <div style={{ position: "relative" }}>
              <EuiFieldText
                fullWidth
                value={customColumn.previousType === "dropdown" ? "" : rowData[columnId]}
                onChange={(e) => {
                  handleValueChange(e.target.value);
                }}
                onBlur={() => {}}
              />
            </div>
          );
        } else if (customColumn?.inputType === "dropdown") {
          return (
            <EuiSelect
              fullWidth
              options={customColumn.dropdownOptions}
              value={rowData[columnId]}
              onChange={(e) => {
                handleDropdownChange(e.target.value);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          );
        } else {
          return <span>{rowData[columnId]}</span>;
        }
      };
      return (
        <div
          onClick={handleRowClick}
          style={{ cursor: "pointer" }}
        >
          {renderCellContent()}
        </div>
      );
    },
    [
      data,
      baseColumns,
      customColumns,
      handleCellEdit,
      selectedRowData,
      setIsSidePanelOpen,
      setSelectedRowData,
      selectedRowIds,
      handleRowSelectionChange,
      setData,
      isSidePanelOpen,
      updateFieldInData,
    ],
  );
  const [modalFormState, setModalFormState] = useState<DataRow>(() => {
    const initialState: Partial<DataRow> = {};
    customColumns.forEach((column) => {
      if (column.inputType === "dropdown") {
        const opts = column.dropdownOptions;
        if (opts && opts.length > 0) {
          initialState[column.id as keyof DataRow] = opts[0].value;
        }
      }
    });
    return {
      id: 0,
      definition: "",
      characteristics: "",
      processCriteriaIdentification: "",
      controlRodInsertion: "",
      feedwaterPump: "",
      reactorCoolantCirculator: "",
      others: "",
      ...initialState,
    } as DataRow;
  });
  const handleModalFormChange = (field: keyof DataRow, value: string): void => {
    setModalFormState((prev) => ({ ...prev, [field]: value }));
  };
  useEffect(() => {
    const savedSelectedRowIds = localStorage.getItem("selectedRowIds");
    if (savedSelectedRowIds) {
      const parsed = JSON.parse(savedSelectedRowIds) as number[];
      setSelectedRowIds(new Set<number>(parsed));
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("selectedRowIds", JSON.stringify([...selectedRowIds]));
  }, [selectedRowIds]);
  useEffect(() => {
    if (selectedRowData) {
      const baseState = { ...selectedRowData };
      customColumns.forEach((column) => {
        if (column.inputType === "dropdown") {
          baseState[column.id] =
            column.dropdownOptions?.find((o) => o.value === selectedRowData[column.id])?.value ??
            column.dropdownOptions?.[0].value ??
            "";
        } else {
          baseState[column.id] = selectedRowData[column.id] ?? "";
        }
      });
      setModalFormState(baseState as DataRow);
    }
  }, [selectedRowData, customColumns]);
  return (
    <div
      className="app-container"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <EuiResizableContainer style={{ height: "400px" }}>
        {(EuiResizablePanel, EuiResizableButton) => (
          <>
            <EuiResizablePanel
              initialSize={isSidePanelOpen ? 70 : 100}
              minSize="30%"
              style={{ transition: "width 0.2s" }}
            >
              <div
                className="datagrid-container"
                style={{ marginTop: "20px" }}
              >
                <EuiButtonIcon
                  iconType="gear"
                  onClick={() => {
                    setIsSidePanelOpen((prev) => !prev);
                  }}
                  aria-label="Edit column types"
                />

                <div style={{ width: dataGridWidth }}></div>

                <EuiButtonIcon
                  iconType="plusInCircle"
                  onClick={() => {
                    setIsNewColumnModalVisible(true);
                  }}
                  aria-label="Add new column"
                />

                <EuiDataGrid
                  aria-label="Data grid for Operating State Analysis"
                  columns={getMergedColumns}
                  rowCount={data.length}
                  renderCellValue={renderCellValue}
                  columnVisibility={{
                    visibleColumns: visibleColumns,
                    setVisibleColumns: setVisibleColumns,
                  }}
                  toolbarVisibility={{
                    additionalControls: (
                      <React.Fragment>
                        <EuiButton
                          size="s"
                          onClick={handleAddNewRow}
                        >
                          Add New State
                        </EuiButton>
                        <EuiButtonIcon
                          iconType="gear"
                          onClick={() => {
                            setIsSidePanelOpen(true);
                          }}
                          aria-label="Edit column types"
                        />
                        <EuiButton
                          color="danger"
                          onClick={handleDeleteSelectedRows}
                          disabled={selectedRowIds.size === 0}
                        >
                          Delete State
                        </EuiButton>
                        <EuiPopover
                          button={
                            <EuiButtonIcon
                              size="s"
                              iconType="plusInCircle"
                              color="primary"
                              onClick={togglePopover}
                              aria-label="Add new column"
                            />
                          }
                          isOpen={isPopoverOpen}
                          closePopover={closePopover}
                        >
                          <div style={{ padding: 16 }}>
                            {" "}
                            <EuiForm>
                              <EuiFormRow label="Column ID">
                                <EuiFieldText
                                  value={newColumnData.id}
                                  onChange={(e) => {
                                    setNewColumnData({
                                      ...newColumnData,
                                      id: e.target.value,
                                    });
                                  }}
                                />
                              </EuiFormRow>
                              <EuiFormRow label="Display As">
                                <EuiFieldText
                                  value={newColumnData.displayAsText}
                                  onChange={(e) => {
                                    setNewColumnData({
                                      ...newColumnData,
                                      displayAsText: e.target.value,
                                    });
                                  }}
                                />
                              </EuiFormRow>
                              <EuiFormRow label="Column Type">
                                <EuiSelect
                                  options={[
                                    { value: "text", text: "Text" },
                                    { value: "dropdown", text: "Dropdown" },
                                    { value: "number", text: "Number" },
                                  ]}
                                  value={newColumnData.columnType}
                                  onChange={handleColumnTypeChange}
                                />
                              </EuiFormRow>
                              <EuiButton onClick={handleCreateColumn}>Create Column</EuiButton>
                            </EuiForm>
                          </div>

                          {newColumnData.columnType === "dropdown" && (
                            <React.Fragment>
                              {newColumnData.dropdownOptions.map((option, index) => (
                                <div key={index}>
                                  <EuiFormRow label={`Option ${String(index + 1)} Text`}>
                                    <EuiFieldText
                                      value={option.text}
                                      onChange={(e) => {
                                        handleDropdownOptionChange(index, "text", e.target.value);
                                      }}
                                    />
                                  </EuiFormRow>
                                  <EuiFormRow label={`Option ${String(index + 1)} Value`}>
                                    <EuiFieldText
                                      value={option.value}
                                      onChange={(e) => {
                                        handleDropdownOptionChange(index, "value", e.target.value);
                                      }}
                                    />
                                  </EuiFormRow>
                                  <EuiButtonIcon
                                    iconType="minusInCircle"
                                    onClick={() => {
                                      handleRemoveDropdownOption(index);
                                    }}
                                    aria-label="Remove dropdown option"
                                  />
                                </div>
                              ))}
                              <EuiButton
                                onClick={handleAddDropdownOption}
                                iconType="plusInCircle"
                              >
                                Add Option
                              </EuiButton>
                            </React.Fragment>
                          )}
                        </EuiPopover>
                      </React.Fragment>
                    ),
                  }}
                  rowHeightsOptions={{
                    defaultHeight: "auto",
                  }}
                  style={{ marginBottom: "20px" }}
                />

                {isNewColumnModalVisible && (
                  <EuiModal
                    onClose={() => {
                      setIsNewColumnModalVisible(false);
                    }}
                  >
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>Add New Column</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm>
                        <EuiFormRow label="Column ID">
                          <EuiFieldText
                            value={newColumnDetails.id}
                            onChange={(e) => {
                              setNewColumnDetails({
                                ...newColumnDetails,
                                id: e.target.value,
                              });
                            }}
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Display As">
                          <EuiFieldText
                            value={newColumnDetails.displayAsText}
                            onChange={(e) => {
                              setNewColumnDetails({
                                ...newColumnDetails,
                                displayAsText: e.target.value,
                              });
                            }}
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Column Type">
                          <EuiSelect
                            options={[
                              { value: "text", text: "Text" },
                              { value: "dropdown", text: "Dropdown" },
                              { value: "number", text: "Number" },
                            ]}
                            value={newColumnData.columnType}
                            onChange={(e) => {
                              setNewColumnData({
                                ...newColumnData,
                                columnType: e.target.value as ColumnType,
                                dropdownOptions: e.target.value === "dropdown" ? [] : newColumnData.dropdownOptions,
                              });
                            }}
                          />
                        </EuiFormRow>
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton onClick={handleButtonClick}>Add</EuiButton>
                    </EuiModalFooter>
                  </EuiModal>
                )}

                {isColumnEditModalVisible && (
                  <EuiModal
                    onClose={() => {
                      setIsColumnEditModalVisible(false);
                    }}
                    style={{ width: "800px" }}
                  >
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>Edit Column</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm component="form">
                        <EuiFormRow label="Column ID (cannot be changed)">
                          <EuiFieldText
                            value={newColumnData.id}
                            disabled
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Column Heading">
                          <EuiFieldText
                            value={newColumnData.displayAsText}
                            onChange={(e) => {
                              handleEditColumnChange(e, "displayAsText");
                            }}
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Column Type">
                          <EuiSelect
                            options={[
                              { value: "text", text: "Text" },
                              { value: "dropdown", text: "Dropdown" },
                              { value: "number", text: "Number" },
                            ]}
                            value={newColumnData.columnType}
                            onChange={(e) => {
                              handleEditColumnChange(e, "columnType");
                            }}
                          />
                        </EuiFormRow>
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton
                        onClick={() => {
                          setIsColumnEditModalVisible(false);
                        }}
                      >
                        Cancel
                      </EuiButton>
                      <EuiButton
                        onClick={saveColumnChanges}
                        fill
                      >
                        Save Changes
                      </EuiButton>
                    </EuiModalFooter>
                  </EuiModal>
                )}

                {isModalVisible && selectedRowData && (
                  <EuiModal
                    onClose={handleCloseModal}
                    style={{ width: "800px" }}
                  >
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>{selectedRowData.id ? "Edit Data" : "Add New Data"}</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm component="form">
                        {getMergedColumns.map((column) => {
                          const customColumn = column;
                          if (customColumn.id !== "select") {
                            if (customColumn.inputType === "dropdown") {
                              return (
                                <EuiFormRow
                                  label={column.displayAsText}
                                  key={column.id}
                                >
                                  <EuiSelect
                                    options={customColumn.dropdownOptions ?? []}
                                    value={modalFormState[column.id]}
                                    onChange={(e) => {
                                      handleModalFormChange(column.id, e.target.value);
                                    }}
                                  />
                                </EuiFormRow>
                              );
                            } else {
                              return (
                                <EuiFormRow
                                  label={column.displayAsText}
                                  key={column.id}
                                >
                                  <EuiFieldText
                                    name={column.id}
                                    value={modalFormState[column.id]}
                                    onChange={(e) => {
                                      handleModalFormChange(column.id, e.target.value);
                                    }}
                                  />
                                </EuiFormRow>
                              );
                            }
                          }
                          return null;
                        })}
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton onClick={handleCloseModal}>Cancel</EuiButton>
                      <EuiButton
                        onClick={handleModalSubmit}
                        fill
                      >
                        Save
                      </EuiButton>
                    </EuiModalFooter>
                  </EuiModal>
                )}
              </div>
            </EuiResizablePanel>
            <EuiResizableButton />

            <EuiResizablePanel
              initialSize={isSidePanelOpen ? 30 : 0}
              minSize="200px"
              style={{
                background: "#F5F7FA",
                padding: "16px",
                boxShadow: "inset -3px 0px 5px rgba(0,0,0,0.05)",
                borderLeft: "1px solid #EBEFF5",
                color: "#333",
                fontFamily: "Arial, sans-serif",
                lineHeight: "1.5",
                marginTop: "30px",
                overflowY: isSidePanelOpen ? "auto" : "hidden",
                transition: "width 0.2s",
                height: "calc(100vh - 50px)",
                display: isSidePanelOpen ? "block" : "none",
              }}
            >
              {isSidePanelOpen && selectedRowData && (
                <EuiForm>
                  {getMergedColumns
                    .filter((column) => column.id !== "select" && column.id !== "details" && column.id !== "delete")
                    .map((column) => {
                      const customColumn = column;
                      let valueForField = selectedRowData[customColumn.id] ?? "";
                      if (customColumn.previousType === "dropdown" && customColumn.inputType === "text") {
                        valueForField = "";
                      }
                      return (
                        <EuiFormRow
                          label={customColumn.displayAsText || customColumn.id}
                          key={customColumn.id}
                        >
                          {customColumn.inputType === "dropdown" ?
                            <EuiSelect
                              options={customColumn.dropdownOptions ?? []}
                              value={valueForField}
                              onChange={(e) => {
                                updateFieldInData(customColumn.id as keyof DataRow, e.target.value);
                              }}
                            />
                          : <EuiFieldText
                              value={valueForField}
                              onChange={(e) => {
                                updateFieldInData(customColumn.id as keyof DataRow, e.target.value);
                              }}
                            />
                          }
                        </EuiFormRow>
                      );
                    })}
                </EuiForm>
              )}

              <EuiButton
                onClick={() => {
                  setIsSidePanelOpen(false);
                }}
                style={{ marginTop: "20px" }}
              >
                Close
              </EuiButton>
            </EuiResizablePanel>
          </>
        )}
      </EuiResizableContainer>
    </div>
  );
};
export function OperatingStateAnalysis(): JSX.Element {
  return <App />;
}
export function OperatingState(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<OperatingStateAnalysisList />}
      />
      <Route
        path=":operatingStateAnalysisId"
        element={<OperatingStateAnalysis />}
      />
    </Routes>
  );
}
