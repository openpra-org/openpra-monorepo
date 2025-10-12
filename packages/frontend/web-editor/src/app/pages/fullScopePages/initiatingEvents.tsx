import {
  EuiButton,
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiFieldText,
  EuiSelect,
  EuiOverlayMask,
  EuiForm,
  EuiFormRow,
  EuiPageTemplate,
  EuiButtonIcon,
  EuiFieldNumber,
  EuiDataGrid,
  EuiDataGridCellValueElementProps,
  EuiGlobalToastList,
  EuiToast,
  EuiResizableContainer,
} from "@elastic/eui";
import React, { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { Column } from "shared-types/src/lib/types/fmea/Column";
import { Row } from "shared-types/src/lib/types/fmea/Row";

import FmeaApiManager from "shared-sdk/lib/api/InitiatingEventsApiManager";

import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import InitiatorList from "../../components/lists/InitiatorList";
import { InitiatingEventsList } from "../../components/lists/nestedLists/initiatingEventsList";

export function EditableTable(): JSX.Element | null {
  const [data, setData] = useState<Row[]>([]);
  const [columns, setColumn] = useState<Column[]>([]);
  const [newColumn, setNewColumn] = useState({
    name: "",
    type: "string",
    dropdownOptions: [
      { number: 1, description: "low" },
      { number: 2, description: "mid" },
      { number: 3, description: "high" },
    ],
  });
  const [originalColumnId, setOriginalColumnId] = useState(""); // Tracks the original id of the editing column
  const [editingColumn, setEditingColumn] = useState<Column | null>(null); // Holds the column being edited
  const [dropdownOptions, setDropdownOptions] = useState<Column["dropdownOptions"]>([
    { number: 1, description: "low" },
  ]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [toasts, setToasts] = useState<any[]>([]);
  const [dataGridWidth, setDataGridWidth] = useState("calc(100% - 300px)");
  const [sidePanelWidth, setSidePanelWidth] = useState("300px");
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(false);
  const [selectedRowIdSidePanel, setSelectedRowIdSidePanel] = useState<string>("");
  // // Toggle the side panel and adjust the width of the data grid accordingly
  const toggleSidePanel = () => {
    setIsSidePanelVisible(!isSidePanelVisible);
    if (isSidePanelVisible) {
      // If side panel is visible, hide it and extend the main grid
      setSidePanelWidth("0px");
    } else {
      // If side panel is hidden, show it and shrink the main grid
      setSidePanelWidth("300px");
    }
  };
  const addToast = (toast: any) => {
    setToasts(toasts.concat(toast));
  };

  const removeToast = (removedToast: any) => {
    setToasts(toasts.filter((toast) => toast.id !== removedToast.id));
  };

  interface DatagridColumn {
    id: string;
    display?: JSX.Element; // Assuming you're using JSX elements for the display property
    displayAsText?: string; // This could be optional based on your logic
  }

  useEffect(() => {
    const loadFmea = async (): Promise<void> => {
      const res = await FmeaApiManager.getFmea(3);

      // Modify the columns as needed
      const modifiedColumns = [
        ...res.columns,
        {
          id: "actions",
          name: "actions",
          type: "string",
          dropdownOptions: [],
        },
        {
          id: "details",
          name: "details",
          type: "string",
          dropdownOptions: [],
        },
      ];

      // Assuming setColumn and setData are setState functions from React's useState
      setColumn(modifiedColumns);
      setData(res.rows);
    };

    void loadFmea();
  }, []);

  function showModal(columnName: string): void {
    if (columnName) {
      const columnToEdit = columns.find((col) => col.name === columnName);
      if (columnToEdit) {
        setEditingColumn({
          ...columnToEdit,
        });
        setOriginalColumnId(columnToEdit.id);
        setNewColumn({
          ...columnToEdit,
          dropdownOptions: columnToEdit.dropdownOptions,
        });
        if (columnToEdit.type === "dropdown") {
          setDropdownOptions(columnToEdit.dropdownOptions);
        }
      }
    } else {
      setEditingColumn(null);
      setOriginalColumnId("");
      setNewColumn({
        name: "",
        type: "string",
        dropdownOptions: [{ number: 1, description: "low" }],
      });
    }
    setIsModalVisible(true);
  }

  function updateCell(id: string, column: string, value: string): void {
    const update = async (): Promise<void> => {
      const res = await FmeaApiManager.updateCell(3, {
        rowId: id,
        column,
        value,
      });

      // Create a new object/array that includes the modifications you want to make.
      const updatedColumns = [
        ...res.columns,
        { id: "actions", name: "actions", type: "string", dropdownOptions: [] },
        {
          id: "details",
          name: "details",
          type: "string",
          dropdownOptions: [],
        },
      ];

      setColumn(updatedColumns);
      setData(res.rows);
    };
    void update();
  }

  const datagridColumns: DatagridColumn[] = columns.map((column) => {
    if (column.name !== "actions" && column.name !== "details") {
      return {
        id: column.id,
        display: (
          <div>
            {column.name}
            <EuiButtonIcon
              onClick={(): void => {
                showModal(column.name);
              }}
              iconType="pencil"
              aria-label={`Edit ${column.name}`}
            />
          </div>
        ),
      };
    } else {
      if (column.name == "actions") {
        return {
          id: "actions",
          displayAsText: "Actions",
        };
      } else {
        return {
          id: "details",
          displayAsText: "Details",
        };
      }
    }
  });

  function deleteRow(id: string): void {
    const del = async (): Promise<void> => {
      const res = await FmeaApiManager.deleteRow(3, id);

      // Assuming res.columns is mutable and you're okay with modifying it directly
      const updatedColumns = [
        ...res.columns,
        { id: "actions", name: "actions", type: "string", dropdownOptions: [] },
        {
          id: "details",
          name: "details",
          type: "string",
          dropdownOptions: [],
        },
      ];
      setSelectedRowIdSidePanel("");
      setColumn(updatedColumns);
      setData(res.rows);
    };
    void del();
  }

  const addNewRow = (): void => {
    const callAddRow = async (): Promise<void> => {
      await FmeaApiManager.addRow(3).then((resposne) => {
        setData(resposne.rows);
      });
    };

    void callAddRow();
  };
  const closeModal = (): void => {
    setIsModalVisible(false);
    setNewColumn({ name: "", type: "string", dropdownOptions: [] });
    setDropdownOptions([{ number: 1, description: "low" }]);
  };
  const showErrorToast = () => {
    addToast({
      id: "formErrorToast",
      title: "Error addinf new column",
      color: "danger",
      iconType: "alert",
      text: <p>Minimum 1 DropDown Options Required. Try Again.</p>,
    });
  };
  function addNewColumn(): void {
    const isInvalid = newColumn.name.trim() === "";
    setIsSubmitted(true);
    if (!isInvalid) {
      if (newColumn.type == "dropdown" && newColumn.dropdownOptions.length == 0) {
        showErrorToast();
      } else {
        if (editingColumn) {
          // Update existing column
          const updateColumn = async (): Promise<void> => {
            const body = { ...newColumn, prev_column_name: originalColumnId };
            await FmeaApiManager.updateColumnDetails(3, body).then((res) => {
              res.columns.push({
                id: "actions",
                name: "actions",
                type: "string",
                dropdownOptions: [],
              });
              res.columns.push({
                id: "details",
                name: "details",
                type: "string",
                dropdownOptions: [],
              });
              setColumn(res.columns);
              setData(res.rows);
            });
          };
          void updateColumn();
        } else {
          // Add new column
          const addColumn = async (): Promise<void> => {
            const body = {
              name: newColumn.name,
              type: newColumn.type,
              dropdownOptions: newColumn.dropdownOptions,
            };
            await FmeaApiManager.addColumn(3, body).then((res) => {
              res.columns.push({
                id: "actions",
                name: "actions",
                type: "string",
                dropdownOptions: [],
              });
              res.columns.push({
                id: "details",
                name: "details",
                type: "string",
                dropdownOptions: [],
              });
              setColumn(res.columns);
              setData(res.rows);
            });
          };
          void addColumn();
        }

        // Reset states and close modal
        setEditingColumn(null);
        setOriginalColumnId("");
        closeModal();
      }
    }
  }

  function renderAddColumnModal(): JSX.Element {
    const updateNewColumn = (key: keyof Column, value: string): void => {
      setNewColumn({ ...newColumn, [key]: value });
    };
    const updateDropdownOption = (index: number, value: string): void => {
      const updatedOptions = dropdownOptions.map((option, i) => {
        if (i === index) {
          return {
            number: parseInt(value, 10),
            description: option.description,
          };
        }
        return option;
      });
      setDropdownOptions(updatedOptions);
      setNewColumn({ ...newColumn, dropdownOptions: updatedOptions });
    };
    const addDropdownOption = (): void => {
      setNewColumn({
        ...newColumn,
        dropdownOptions: [
          ...dropdownOptions,
          {
            number: 0,
            description: "",
          },
        ],
      });
      setDropdownOptions([
        ...dropdownOptions,
        {
          number: 0,
          description: "",
        },
      ]);
    };

    const deleteDropdownOption = (index: number): void => {
      const updatedOptions = dropdownOptions.filter((_, i) => i !== index);
      setDropdownOptions(updatedOptions);
      setNewColumn({ ...newColumn, dropdownOptions: updatedOptions });
    };
    return (
      <EuiOverlayMask>
        <EuiModal onClose={closeModal}>
          <EuiModalHeader>
            <EuiModalHeaderTitle>{editingColumn ? "Edit Column" : "Add a New Column"}</EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiForm>
              <EuiFormRow label="Column Name">
                <EuiFieldText
                  isInvalid={isSubmitted && newColumn.name.trim() === ""}
                  value={newColumn.name}
                  onChange={(e): void => {
                    updateNewColumn("name", e.target.value);
                  }}
                />
              </EuiFormRow>
              <EuiFormRow label="Column Type">
                <EuiSelect
                  options={[
                    { value: "string", text: "String" },
                    { value: "dropdown", text: "Dropdown" },
                  ]}
                  value={newColumn.type}
                  onChange={(e): void => {
                    updateNewColumn("type", e.target.value);
                    if (e.target.value === "string") {
                      setDropdownOptions([]);
                    }
                  }}
                />
              </EuiFormRow>
              {newColumn.type === "dropdown" &&
                dropdownOptions.map((option, index) => (
                  <EuiFormRow
                    key={index}
                    label={`Option ${index + 1}`}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <EuiFieldNumber
                        value={option.number}
                        onChange={(e): void => {
                          updateDropdownOption(index, e.target.value);
                        }}
                        style={{ flexGrow: 1, marginRight: "10px" }}
                      />
                      <EuiButtonIcon
                        iconType="trash"
                        color="danger"
                        onClick={(): void => {
                          deleteDropdownOption(index);
                        }}
                        aria-label={`Delete option ${index + 1}`}
                      />
                    </div>
                  </EuiFormRow>
                ))}
              {newColumn.type === "dropdown" && <EuiButton onClick={addDropdownOption}>Add Option</EuiButton>}
            </EuiForm>
          </EuiModalBody>
          <EuiModalFooter>
            {/*{editingColumn && (*/}
            {/*  <EuiButton color="danger" onClick={deleteColumn}>*/}
            {/*    Delete Column*/}
            {/*  </EuiButton>*/}
            {/*)}*/}
            <EuiButton onClick={closeModal}>Cancel</EuiButton>
            <EuiButton
              fill
              onClick={addNewColumn}
            >
              {editingColumn ? "Save Changes" : "Add Column"}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      </EuiOverlayMask>
    );
  }
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const onSelectionChange = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };
  type RowData = Record<string, unknown>;
  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
      const column = columns.find((col) => col.id === columnId);

      const item: RowData = data[rowIndex].row_data;
      const rowID = data[rowIndex].id;
      if (column !== undefined) {
        const value = item[column.id] as string;
        // Use `value` here within the if block
        if (columnId == "id") {
          const id = data[rowIndex].id;
          return (
            <input
              type="checkbox"
              checked={selectedItems.has(id)}
              onChange={() => {
                onSelectionChange(id);
              }}
              aria-label={`Select row with id ${id}`}
            />
          );
        }
        if (column.name !== "actions" && column.name !== "details") {
          if (column.type === "string") {
            return (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e): void => {
                  updateCell(rowID, column.id, e.currentTarget.textContent ?? "");
                }}
                // onDoubleClick={() => {
                //   setEditingCell({ rowIndex, columnId });
                // }}
                data-testid={column.name}
              >
                <span>{value}</span>
              </div>
            );
          } else {
            return (
              <div data-testid={column.name}>
                <EuiSelect
                  options={column.dropdownOptions.map((option) => ({
                    value: option.number.toString(),
                    text: option.number.toString(),
                  }))}
                  value={value}
                  onChange={(e): void => {
                    updateCell(rowID, column.id, e.target.value);
                  }}
                  style={{ minWidth: "100px" }}
                />
              </div>
            );
          }
        } else {
          if (column.name == "actions") {
            return (
              <EuiButtonIcon
                onClick={(): void => {
                  deleteRow(rowID);
                }}
                iconType="trash"
                aria-label="Delete row"
              />
            );
          } else {
            return (
              <EuiButtonIcon
                onClick={(): void => {
                  toggleSidePanel();

                  setSelectedRowIdSidePanel(rowID);
                }}
                iconType="searchProfilerApp"
                aria-label="Delete row"
              />
            );
          }
        }
      }
    },
    [data, columns, updateCell],
  );
  return (
    <div>
      {isModalVisible && renderAddColumnModal()}
      <EuiPageTemplate
        panelled={false}
        offset={48}
        grow={false}
      >
        <EuiPageTemplate.Section>
          <EuiButton
            size={"s"}
            onClick={addNewRow}
            style={{ margin: "10px" }}
          >
            Add Row
          </EuiButton>
          <EuiButton
            size={"s"}
            onClick={(): void => {
              showModal("");
            }}
            style={{ margin: "10px" }}
          >
            Add Column
          </EuiButton>
          <EuiResizableContainer style={{ height: "400px" }}>
            {(EuiResizablePanel, EuiResizableButton) => (
              <>
                <EuiResizablePanel
                  initialSize={isSidePanelVisible ? 70 : 100}
                  minSize="30%"
                  style={{ transition: "width 0.2s" }}
                >
                  <EuiDataGrid
                    aria-label="Data grid for FMEA"
                    columns={datagridColumns}
                    rowCount={data.length}
                    renderCellValue={renderCellValue}
                    columnVisibility={{
                      visibleColumns: datagridColumns.map((column: DatagridColumn) => column.id),
                      setVisibleColumns: (): void => {
                        datagridColumns.map((column: DatagridColumn) => column.id);
                      },
                    }}
                    toolbarVisibility={{
                      additionalControls: (
                        <React.Fragment>
                          {" "}
                          <EuiButton
                            size={"s"}
                            onClick={addNewRow}
                            style={{ margin: "10px" }}
                          >
                            Add Row
                          </EuiButton>
                          <EuiButton
                            size={"s"}
                            onClick={(): void => {
                              showModal("");
                            }}
                            style={{ margin: "10px" }}
                          >
                            Add Column
                          </EuiButton>
                        </React.Fragment>
                      ),
                    }}
                    rowHeightsOptions={{
                      defaultHeight: "auto", // This sets the default row height to auto-fit content
                    }}
                    style={{ marginBottom: "20px", height: "auto" }}
                  />
                </EuiResizablePanel>
                <EuiResizableButton />
                <EuiResizablePanel
                  initialSize={isSidePanelVisible ? 30 : 0}
                  minSize="200px"
                  style={{
                    padding: "16px",
                    boxShadow: "inset -3px 0px 5px rgba(0,0,0,0.05)",
                    borderLeft: "1px solid #EBEFF5",
                    // color: "#333",
                    fontFamily: "Arial, sans-serif",
                    lineHeight: "1.5",
                    marginTop: "30px", // Adjust this value as needed
                    overflowY: isSidePanelVisible ? "auto" : "hidden", // This will create a scrollbar when the content is larger than the panel
                    transition: "width 0.2s",
                    height: "calc(100vh - 50px)", // Adjust the height calculation if you've changed the marginTop
                    display: isSidePanelVisible ? "block" : "none",
                  }}
                >
                  <div>
                    {isSidePanelVisible && selectedRowIdSidePanel !== "" && (
                      <EuiForm>
                        {columns
                          .filter((column) => column.id !== "actions" && column.id !== "details")
                          .map((column) => {
                            const row = data.filter((r) => r.id == selectedRowIdSidePanel);
                            const value = row[0].row_data[column.id] as string;
                            return (
                              <EuiFormRow
                                label={column.name}
                                key={column.id}
                              >
                                {column.type === "dropdown" ? (
                                  <EuiSelect
                                    options={column.dropdownOptions.map((option) => ({
                                      value: option.number.toString(),
                                      text: option.number.toString(),
                                    }))}
                                    value={value}
                                    onChange={(e): void => {
                                      updateCell(selectedRowIdSidePanel, column.id, e.target.value);
                                    }}
                                    style={{ minWidth: "100px" }}
                                  />
                                ) : (
                                  <EuiFieldText
                                    value={value}
                                    onChange={(e): void => {
                                      updateCell(selectedRowIdSidePanel, column.id, e.target.value);
                                    }}
                                  />
                                )}
                              </EuiFormRow>
                            );
                          })}
                      </EuiForm>
                    )}
                  </div>
                </EuiResizablePanel>
              </>
            )}
          </EuiResizableContainer>
          <EuiGlobalToastList
            toasts={toasts}
            dismissToast={removeToast}
            toastLifeTimeMs={60000}
          />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </div>
  );
}

export function InitiatingEventAnalysis(): JSX.Element {
  return (
    <>
      <EditableTable />
      <div> this is event data grid page </div>
    </>
  );
}
export function InitiatingEvents(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<InitiatingEventsList />}
      />
      <Route
        path=":intiatingEventId"
        element={<InitiatorList />}
      />
      <Route
        path=":intiatingEventId/:initiator"
        element={<EditableTable />}
      />
    </Routes>
  );
}
