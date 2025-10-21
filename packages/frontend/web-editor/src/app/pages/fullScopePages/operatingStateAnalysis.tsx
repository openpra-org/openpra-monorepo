import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
//----------------------------EUIdatagrid---------------------
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
// Define the interface for a single row of data.
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

// Removed unused Item interface
// interface ColumnTypeEditorProps {
//   columns: CustomColumn[];
//   onSave: (updatedColumns: CustomColumn[]) => void;
//   onCancel: () => void;
//   // Add handleChange if it's supposed to be passed as a prop
//   handleChange?: (id: string, key: keyof CustomColumn, value: string) => void;
// }
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
  dropdownOptions?: { value: string; text: string }[];
  previousType?: ColumnType; // Add this line to include the previousType property

  // display?: React.ReactNode | ((props: CustomHeaderProps) => React.ReactNode);
}
// interface ColumnTypeEditorProps {
//   columns: CustomColumn[];
//   onSave: (updatedColumns: CustomColumn[]) => void;
//   onCancel: () => void; // Explicitly defining the type of onCancel as a function that returns void
// }
// Define the props for the CustomHeader component
interface CustomHeaderProps {
  column: CustomColumn;
  onEdit: (columnId: string) => void;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ column, onEdit }) => {
  // Style object for the header text container
  const headerTextStyle: React.CSSProperties = {
    overflow: "hidden", // Prevent text from overflowing
    textOverflow: "ellipsis", // Add an ellipsis if the text is too long
    whiteSpace: "nowrap", // Keep the text on a single line
    maxWidth: "calc(100% - 25px)", // Reserve space for the pencil icon
    display: "inline-block", // Allow the text to be inline with the icon
    verticalAlign: "middle", // Align the text with the icon vertically
  };

  // Style object for the icon container
  const iconStyle: React.CSSProperties = {
    display: "inline-block", // Allow the icon to be inline with the text
    verticalAlign: "middle", // Align the icon with the text vertically
    marginLeft: "5px", // Add some space between the text and the icon
  };

  if (column.id === "delete") {
    // For the delete column, return null or a different header component without the pencil icon
    return <span>&nbsp;</span>; // or your own custom JSX for this header
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

// const columns: CustomColumn[] = [
//   // ... (your existing columns)
//   {
//     id: "definition",
//     displayAsText: "Definition",
//     //display: <CustomHeader column={/* column data */} onEdit={openEditColumnModal} />
//   },
//   { id: "characteristics", displayAsText: "Characteristics" },
//   {
//     id: "processCriteriaIdentification",
//     displayAsText: "Process Criteria Identification",
//   },
//   {
//     id: "controlRodInsertion",
//     displayAsText: "Control Rod Insertion",
//     isSortable: true,
//   },
//   { id: "feedwaterPump", displayAsText: "Feedwater Pump", isSortable: true },
//   {
//     id: "reactorCoolantCirculator",
//     displayAsText: "Reactor Coolant Circulator",
//     isExpandable: true,
//   },
//   { id: "others", displayAsText: "Others", isExpandable: true },
// ];

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
  // const dataCellStyle: React.CSSProperties = {
  //   whiteSpace: "nowrap",
  //   overflow: "hidden",
  //   minWidth: "max-content",
  // };

  const [baseColumns, setBaseColumns] = useState<CustomColumn[]>([
    // ... your initial columns here
    {
      id: "definition",
      displayAsText: "Definition",
      //display: <CustomHeader column={/* column data */} onEdit={openEditColumnModal} />
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
    // Delete column configuration
    // {
    //   id: "delete",
    //   displayAsText: "",
    //   // You can specify other properties here as needed
    //   isSortable: false, // Deleting a row is an action, not something you sort by
    // },
  ]);

  // Add state to manage the width of the data grid and the side panel
  const [dataGridWidth] = useState("calc(100% - 300px)");

  // // Toggle the side panel and adjust the width of the data grid accordingly
  // const toggleSidePanel = (): void => {
  //   setIsSidePanelOpen((prev) => !prev);
  // };

  const [isColumnEditModalVisible, setIsColumnEditModalVisible] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Function to open the edit column modal
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
  // Function to handle the changes in the edit column modal
  const handleEditColumnChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof ColumnConfig,
  ): void => {
    setNewColumnData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  // Deleted unused handleDeleteRow (no callers)

  // Function to save the changes of the edit column modal
  // const saveColumnChanges = () => {
  //   setCustomColumns((prevColumns) =>
  //     prevColumns.map((col) => {
  //       if (col.id === newColumnData.id) {
  //         return {
  //           ...col,
  //           displayAsText: newColumnData.displayAsText,
  //           inputType: newColumnData.columnType as ColumnType,
  //           dropdownOptions: newColumnData.dropdownOptions,
  //         };
  //       }
  //       return col;
  //     }),
  //   );
  //   setIsColumnEditModalVisible(false);
  // };
  const saveColumnChanges = (): void => {
    // Update baseColumns if necessary
    const updatedBaseColumns = baseColumns.map((col) => {
      // If this is the column we're updating, return a new object with the updated displayAsText
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
    // Update the customColumns with the new type
    setCustomColumns((prevColumns) =>
      prevColumns.map((col) => {
        if (col.id === newColumnData.id) {
          // Keep track of the previous type to decide if we need to clear data
          // Call updateColumnType to update the type and possibly clear data
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
  // // Handler to close the side panel
  // const closeSidePanel = useCallback(() => {
  //   setIsSidePanelOpen(false);
  // }, []);

  // // Function to open the side panel
  // const openSidePanel = () => setIsSidePanelOpen(true);

  // // Handler to save column changes from the side panel
  // const handleSaveColumnChanges = (
  //   updatedColumns: React.SetStateAction<CustomColumn[]>,
  // ) => {
  //   setCustomColumns(updatedColumns);
  //   setIsSidePanelVisible(false);
  // };
  // // Handler to cancel the side panel
  // const handleCancelColumnChanges = () => {
  //   setIsSidePanelVisible(false);
  // };
  // const ColumnTypeEditor: React.FC<ColumnTypeEditorProps> = ({
  //   columns,
  //   onSave,
  //   onCancel,
  // }) => {
  //   const [localColumns, setLocalColumns] = useState<CustomColumn[]>([
  //     ...columns,
  //   ]);

  //   const handleChange = (id: any, key: string, value: string) => {
  //     setLocalColumns((current) =>
  //       current.map((col) => (col.id === id ? { ...col, [key]: value } : col)),
  //     );
  //   };

  //   return (
  //     <div className="side-panel">
  //       <h2>Edit Column Types</h2>
  //       {localColumns.map((col) => (
  //         <div key={col.id} className="column-type-editor">
  //           <EuiFieldText
  //             value={col.displayAsText}
  //             onChange={(e) =>
  //               handleChange(col.id, "displayAsText", e.target.value)
  //             }
  //           />
  //           <EuiSelect
  //             options={[
  //               { value: "text", text: "Text" },
  //               { value: "dropdown", text: "Dropdown" },
  //               { value: "number", text: "Number" },
  //             ]}
  //             value={col.inputType || "text"}
  //             onChange={(e) =>
  //               handleChange(col.id, "inputType", e.target.value)
  //             }
  //           />
  //         </div>
  //       ))}
  //       <EuiButton onClick={() => onSave(localColumns)}>Save Changes</EuiButton>
  //       <EuiButton onClick={onCancel}>Cancel</EuiButton>
  //     </div>
  //   );
  // };

  const [newColumnData, setNewColumnData] = useState<ColumnConfig>({
    id: "",
    displayAsText: "",
    columnType: "text",
    dropdownOptions: [],
  });

  // State for managing popover visibility
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Function to toggle popover visibility
  const togglePopover = (): void => {
    setIsPopoverOpen((current) => !current);
  };
  // Function to close the popover
  const closePopover = (): void => {
    setIsPopoverOpen(false);
  };

  const handleCreateColumn = (): void => {
    if (!newColumnData.id || !newColumnData.displayAsText) {
      return;
    }

    // Make sure that inputType is assigned a value from ColumnType or is undefined
    const inputType = newColumnData.columnType as ColumnType | undefined;

    const newColumn: CustomColumn = {
      id: newColumnData.id.trim(),
      displayAsText: newColumnData.displayAsText.trim(),
      inputType: inputType, // Ensure this matches the expected type
      // Only include dropdownOptions if inputType is 'dropdown'
      ...(inputType === "dropdown" && {
        dropdownOptions: newColumnData.dropdownOptions,
      }),
    };

    setCustomColumns((prevColumns) => [...prevColumns, newColumn]);
    // closeSidePanel();
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
      // Initialize with one default option when "Dropdown" is selected
      setNewColumnData((prev) => ({
        ...prev,
        columnType,
        dropdownOptions: [{ value: "", text: "" }],
      }));
    } else {
      // Clear options for non-dropdown types
      setNewColumnData((prev) => ({
        ...prev,
        columnType,
        dropdownOptions: [],
      }));
    }
  };
  //This function manages both selectedRowData and data states for change in sidePanel to reflect in Datagrid
  const updateFieldInData = useCallback(
    (fieldKey: keyof DataRow, value: string | number): void => {
      if (!selectedRowData) return;

      // Find the custom column to check its previous type
      const customColumn = customColumns.find((col) => col.id === fieldKey);

      // If the new type is text and the previous type was dropdown, reset the value
      const newValue =
        customColumn && customColumn.previousType === "dropdown" && customColumn.inputType === "text"
          ? "" // Set to empty string if previous type was dropdown
          : value;

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
  // Function to handle changing dropdown option values
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
  // Function to handle removing a dropdown option
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
  // const renderDropdownOptions = (): JSX.Element => {
  //   return (
  //     <>
  //       {newColumnData.dropdownOptions?.map((option, index) => (
  //         <div key={index}>
  //           <EuiFieldText
  //             placeholder="Option text"
  //             value={option.text}
  //             onChange={(e) => {
  //               handleDropdownOptionChange(index, "text", e.target.value);
  //             }}
  //           />
  //           <EuiFieldText
  //             placeholder="Option value"
  //             value={option.value}
  //             onChange={(e) => {
  //               handleDropdownOptionChange(index, "value", e.target.value);
  //             }}
  //           />
  //           <EuiButtonIcon
  //             iconType="minusInCircle"
  //             onClick={() => {
  //               handleRemoveDropdownOption(index);
  //             }}
  //             aria-label="Remove dropdown option"
  //           />
  //         </div>
  //       ))}
  //     </>
  //   );
  // };
  const handleAddNewColumn = (): void => {
    // we are making sure that new column has an ID and a display text
    if (!newColumnDetails.id || !newColumnDetails.displayAsText) {
      return;
    }
    // Omit the delete column from being added again
    if (newColumnDetails.id === "delete") {
      return;
    }

    // Prepare the new column configuration
    const newColumnConfig = {
      id: newColumnDetails.id.trim(),
      displayAsText: newColumnDetails.displayAsText.trim(),
      columnType: selectedColumnType,
      // here Include dropdown options if the column type is 'dropdown'
      ...(selectedColumnType === "dropdown" && {
        dropdownOptions: dropdownOptions.filter((option) => option.value && option.text),
      }),
    };

    // Temporarily remove the delete column
    setCustomColumns((prevColumns) => {
      const filteredColumns = prevColumns.filter((column) => column.id !== "delete");
      // Add the new column and then re-add the delete column at the end
      return [
        ...filteredColumns,
        newColumnConfig,
        {
          id: "delete",
          displayAsText: "",
          // ... any other properties for the delete column
        },
      ];
    });

    // // Add the new column config to the grid, without adding a new delete column
    // setCustomColumns((prevColumns) => {
    //   // First, remove the existing delete column if it is present
    //   const columnsWithoutDelete = prevColumns.filter(
    //     (column) => column.id !== "delete",
    //   );
    //   // Then, add the new column configuration
    //   return [...columnsWithoutDelete, newColumnConfig];
    // });

    // Add the new column config to the grid
    // setCustomColumns((prevColumns) => [...prevColumns, newColumnConfig]);

    // Reset the modal form state and close the modal
    setNewColumnDetails({ id: "", displayAsText: "", columnType: "text" });
    setSelectedColumnType("text"); // or your default column type
    setDropdownOptions([{ value: "", text: "" }]);
    setIsNewColumnModalVisible(false);
  };

  /// The intermediate button click handler
  const handleButtonClick = (_event: React.MouseEvent<HTMLButtonElement>): void => {
    // You'll need to define how these values are determined - possibly from state or form inputs.
    const newColumnId = "newColumnId"; // This should be a unique ID for the new column
    const newColumnDisplayText = "New Column"; // The display text for the new column
    const newColumnType: ColumnType = "dropdown"; // for example

    // Example config for a text column
    const columnConfig: ColumnConfig = {
      id: newColumnId,
      displayAsText: newColumnDisplayText,
      columnType: newColumnType,
      dropdownOptions: [],
    };

    // If the column type is 'dropdown', you would set the dropdownOptions like this:
    columnConfig.dropdownOptions = [
      { value: "option1", text: "Option 1" },
      { value: "option2", text: "Option 2" },
      // ... more options
    ];

    handleAddNewColumn();
  };
  // Details button is not currently used (side panel toggles on cell click)
  //state for selecting rows
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set<number>());
  // state for checking symbol for checkboxes (unused) removed
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
    setSelectedRowIds(new Set()); // Clear selection after deletion
  }, [selectedRowIds]);

  const getMergedColumns = useMemo<CustomColumn[]>(() => {
    // Checkbox column for row selection

    // removed unused decorative styles

    // Checkbox column for row selection
    const selectColumn = {
      id: "select",
      displayAsText: "", // No header text for the selection column
      // Custom render for the cell to show a checkbox
      cellRenderer: ({ rowIndex }: EuiDataGridCellValueElementProps): JSX.Element => {
        const rowId = data[rowIndex].id;
        const isChecked = selectedRowIds.has(rowId);
        const optionId = `checkbox_${String(rowId)}`;

        // Return a checkbox with the correct 'checked' state and an onChange handler
        return (
          <EuiCheckbox
            key={optionId}
            id={optionId}
            checked={isChecked}
            onChange={(): void => {
              handleRowSelectionChange(rowId);
            }}
            label="" // Since we don't need a label next to each checkbox, we can leave this empty
            // compressed // Use the compressed style if space is limited (property no longer supported in our EUI version)
          />
        );
      },
    };

    // Prepare columns excluding the 'delete' column as it's not individual row action anymore
    const filteredBaseColumns = baseColumns.filter((column) => column.id !== "details");
    const filteredCustomColumns = customColumns.filter((column) => column.id !== "details");

    // Combine and deduplicate the base and custom columns, exclude 'delete' column logic
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
            current.id !== "delete" ? (
              <CustomHeader
                key={`${current.id}-${current.displayAsText}`}
                column={current}
                onEdit={openEditColumnModal}
              />
            ) : undefined,
        });
      }
      return acc;
    }, []);

    // Optionally add other columns like 'Details' if needed
    // combinedColumns.push({
    //   id: "details",
    //   displayAsText: "Details",
    //   actions: {
    //     showHide: false,
    //     showMoveLeft: false,
    //     showMoveRight: false,
    //   },
    //   cellActions: [renderDetailsButton],
    // });

    return combinedColumns;
  }, [baseColumns, customColumns, openEditColumnModal, selectedRowIds, handleRowSelectionChange, data]);

  // const getMergedColumns = useCallback(() => {
  //   // Separate out the delete column configuration
  //   const deleteColumnConfig = {
  //     id: "delete",
  //     displayAsText: "",

  //     // disableColumnsMenu: false,
  //     // ... other delete column configurations
  //   };
  //   // Remove any existing delete column from baseColumns and customColumns
  //   const filteredBaseColumns = baseColumns.filter(
  //     (column) => column.id !== "delete",
  //   );
  //   const filteredCustomColumns = customColumns.filter(
  //     (column) => column.id !== "delete",
  //   );

  //   // Combine baseColumns and filteredCustomColumns
  //   let combinedColumns = [...filteredBaseColumns, ...filteredCustomColumns];

  //   // Combine both arrays and eliminate duplicates
  //   combinedColumns = combinedColumns.reduce<CustomColumn[]>((acc, current) => {
  //     const columnExists = acc.find((item) => item.id === current.id);
  //     //return x ? acc : [...acc, current];
  //     if (!columnExists) {
  //       acc.push({
  //         ...current,
  //         // Apply the CustomHeader to all columns except 'delete'
  //         display:
  //           current.id !== "delete" ? (
  //             <CustomHeader
  //               key={`${current.id}-${current.displayAsText}`}
  //               column={current}
  //               onEdit={openEditColumnModal}
  //             />
  //           ) : undefined,
  //       });
  //     }
  //     return acc;
  //   }, []);

  //   // Add the 'Details' column if it doesn't already exist
  //   // if (!combinedColumns.find(column => column.id === "details")) {
  //   combinedColumns.push({
  //     id: "details",
  //     displayAsText: "Details",
  //     actions: {
  //       showHide: false,
  //       showMoveLeft: false,
  //       showMoveRight: false,
  //     },
  //     cellActions: [renderDetailsButton], // Ensure renderDetailsButton is defined
  //   });

  //   combinedColumns.push(deleteColumnConfig);
  //   return combinedColumns;
  // }, [baseColumns, customColumns, openEditColumnModal, renderDetailsButton]);
  //   // Apply the CustomHeader to all
  //   combinedColumns = combinedColumns.map((col) => ({
  //     ...col,
  //     display:
  //       col.id !== "delete" ? (
  //         <CustomHeader
  //           key={`${col.id}-${col.displayAsText}`}
  //           column={col}
  //           onEdit={openEditColumnModal}
  //         />
  //       ) : undefined,
  //   }));
  //   combinedColumns.push(deleteColumnConfig);
  //   return combinedColumns;
  // }, [
  //   baseColumns,
  //   customColumns,
  //   openEditColumnModal,
  //   deleteColumnConfig,
  //   renderDetailsButton,
  // ]);

  // const getMergedColumns = useCallback(() => {
  //   // Merge the default columns with the custom columns
  //   return columns
  //     .map((col) => {
  //       // Find if there's a custom column with the same id
  //       const customCol = customColumns.find((c) => c.id === col.id);
  //       if (customCol) {
  //         // Merge the default column with the custom column properties
  //         return {
  //           ...col,
  //           ...customCol,
  //           display: (
  //             <CustomHeader column={customCol} onEdit={openEditColumnModal} />
  //           ),
  //         } as CustomColumn;
  //       }
  //       return col;
  //     })
  //     .concat(
  //       // Include custom columns that are not already included in the default columns
  //       customColumns
  //         .filter(
  //           (customCol) => !columns.some((col) => col.id === customCol.id),
  //         )
  //         .map((customCol) => ({
  //           ...customCol,
  //           display: (
  //             <CustomHeader column={customCol} onEdit={openEditColumnModal} />
  //           ),
  //         })),
  //     );
  // }, [columns, customColumns, openEditColumnModal]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getMergedColumns.map((column) => column.id));
  // Removed unused editingCell state; reintroduce if inline editing is implemented again

  // Function to handle opening the modal with selected row data
  // Removed unused handleOpenModal (no current callers)
  // Removed unused handleSaveNewColumn (previous inline stub removed)
  // When opening the modal to edit, make sure to set the editing cell state
  // Removed unused openEditModal (no current callers)
  // Removed unused items state and related handlers (handleChange, onSave)

  // Modify handleSaveData to handle both adding and editing rows
  // Removed unused handleSaveData (superseded by handleModalSubmit)

  // Function to handle closing the modal
  const handleCloseModal = useCallback((): void => {
    setIsModalVisible(false);
  }, []);

  // Function to handle adding a new row
  const handleAddNewRow = (): void => {
    // Open the modal to add a new row
    const newRow = {
      id: Date.now(), // Unique ID for the new row
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
    // Ensure selectedRowData is not null before proceeding
    if (selectedRowData) {
      // Check if we're adding a new row or editing an existing one
      const isNewRow = !data.find((row) => row.id === selectedRowData.id);

      if (isNewRow) {
        // Adding a new row
        const newRowData = { ...modalFormState, id: Date.now() }; // Ensure a unique ID for the new row
        setData((prevData) => [...prevData, newRowData]); // Append the new row to the existing data
      } else {
        // Editing an existing row
        setData((prevData) =>
          prevData.map((row) => (row.id === selectedRowData.id ? { ...row, ...modalFormState } : row)),
        );
      }
    }
    setIsModalVisible(false);
  };

  const handleCellEdit = useCallback((rowIndex: number, columnId: keyof DataRow, value: string): void => {
    // Update the specific cell data within the row
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
            // Keep track of the previous type before changing
            previousType: column.inputType,
            inputType: newType,
          };
        }
        return column;
      }),
    );
    // If the new type is text and the previous type was dropdown, reset the values in the data
    if (newType === "text") {
      setData((prevData) =>
        prevData.map((item) => ({
          ...item,
          [columnId]: "",
        })),
      );
    }
  };

  // const renderCellValue = useCallback(
  //   ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
  //     const item = data[rowIndex];
  //     const key = columnId as keyof DataRow;
  //     const isEditing =
  //       editingCell?.rowIndex === rowIndex &&
  //       editingCell?.columnId === columnId;

  //     // Only allow inline editing for text fields, not dropdowns
  //     const isDropdownColumn = [
  //       "controlRodInsertion",
  //       "feedwaterPump",
  //       "reactorCoolantCirculator",
  //       "others",
  //     ].includes(key as ColumnType);
  //     // Render the delete button for the 'delete' column
  //     if (columnId === "delete") {
  //       const rowId = data[rowIndex].id;
  //       return (
  //         <EuiButtonIcon
  //           iconType="trash"
  //           color="danger"
  //           onClick={() => handleDeleteRow(rowId)}
  //           aria-label="Delete row"
  //         />
  //       );
  //     }
  //     if (isEditing && !isDropdownColumn) {
  //       // Render text input for inline editing on double click
  //       return (
  //         <EuiFieldText
  //           fullWidth
  //           value={item[key]}
  //           onChange={(e) => handleCellEdit(rowIndex, key, e.target.value)}
  //           onBlur={() => setEditingCell(null)}
  //           autoFocus
  //         />
  //       );
  //     } else {
  //       // For dropdown columns, render the dropdowns directly
  //       if (isDropdownColumn) {
  //         return (
  //           <EuiSelect
  //             fullWidth
  //             options={[
  //               { value: "yes", text: "Yes" },
  //               { value: "no", text: "No" },
  //             ]}
  //             value={item[key]}
  //             onChange={(e) => handleCellEdit(rowIndex, key, e.target.value)}
  //           />
  //         );
  //       }

  //       // For text fields, show text and an edit button to open the modal
  //       return (
  //         <div>
  //           <span onDoubleClick={() => setEditingCell({ rowIndex, columnId })}>
  //             {item[key]}
  //           </span>
  //           <EuiButtonIcon
  //             iconType="documentEdit"
  //             onClick={() => handleOpenModal(item)}
  //             aria-label={"Open modal to edit ${key}"}
  //           />
  //         </div>
  //       );
  //     }
  //   },
  //   [data, editingCell, handleCellEdit, handleOpenModal, handleDeleteRow],
  // );

  // const renderCellValue = useCallback(
  //   ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
  //     const rowData = data[rowIndex];
  //     const customColumn = [...baseColumns, ...customColumns].find(
  //       (col) => col.id === columnId,
  //     );
  //     const isEditing =
  //       editingCell?.rowIndex === rowIndex &&
  //       editingCell?.columnId === columnId;

  //     const handleValueChange = (value: string) => {
  //       handleCellEdit(rowIndex, columnId, value);
  //     };

  //     if (columnId === "select") {
  //       const rowId = data[rowIndex].id;
  //       return (
  //         <input
  //           type="checkbox"
  //           checked={selectedRowIds.has(rowId)} // Checked if rowId is in the selectedRowIds set
  //           onChange={() => handleRowSelectionChange(rowId)} // Toggle the selection on change
  //           aria-label={`Select row ${rowId}`}
  //         />
  //       );
  //     }

  //     // If the column is now a text input, render a text field, empty if it used to be a dropdown
  //     if (customColumn?.inputType === "text") {
  //       // Check if the previous type was a dropdown to decide if we should render it empty
  //       const isEmpty = customColumn.previousType === "dropdown";
  //       return (
  //         <div style={{ position: "relative" }}>
  //           <EuiFieldText
  //             fullWidth
  //             value={rowData[columnId]}
  //             onChange={(e) => handleValueChange(e.target.value)}
  //             onBlur={() => setEditingCell(null)}
  //           />
  //         </div>
  //       );
  //     } else if (customColumn?.inputType === "dropdown") {
  //       // Always show the dropdown for 'dropdown' columns
  //       return (
  //         <div style={{ position: "relative" }}>
  //           <EuiSelect
  //             fullWidth
  //             options={customColumn.dropdownOptions}
  //             value={rowData[columnId]}
  //             onChange={(e) => handleValueChange(e.target.value)}
  //             onBlur={() => setEditingCell(null)}
  //           />
  //         </div>
  //       );
  //     } else {
  //       // For text columns, show either an input for editing or plain text
  //       if (isEditing) {
  //         // Render a text input if we are in edit mode
  //         return (
  //           <EuiFieldText
  //             fullWidth
  //             value={rowData[columnId]}
  //             onChange={(e) => handleValueChange(e.target.value)}
  //             onBlur={() => setEditingCell(null)}
  //             autoFocus
  //           />
  //         );
  //       } else {
  //         // Show the cell value as text with an edit icon
  //         return (
  //           <div style={{ position: "relative" }}>
  //             <span onClick={() => setEditingCell({ rowIndex, columnId })}>
  //               {rowData[columnId]}
  //             </span>
  //             {/* <EuiButtonIcon
  //               iconType="documentEdit"
  //               onDoubleClick={() => handleOpenModal(rowData)}
  //               aria-label="Edit"
  //               style={{
  //                 position: "absolute",
  //                 right: 0,
  //                 top: "50%",
  //                 transform: "translateY(-50%)",
  //               }}
  //             /> */}
  //           </div>
  //         );
  //       }
  //     }
  //   },
  //   [
  //     data,
  //     baseColumns,
  //     customColumns,
  //     handleCellEdit,
  //     handleOpenModal,
  //     editingCell,
  //     setEditingCell,
  //     selectedRowIds
  //   ],
  // );

  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
      const rowData = data[rowIndex];
      const customColumn = [...baseColumns, ...customColumns].find((col) => col.id === columnId);
      // Note: inline editing state is currently unused but preserved logic exists for future use

      const handleRowClick = (): void => {
        if (selectedRowData && rowData.id === selectedRowData.id) {
          setIsSidePanelOpen((isOpen) => !isOpen);
        } else {
          setSelectedRowData(rowData);
          setIsSidePanelOpen(true);
        }
      };

      const handleValueChange = (value: string): void => {
        // If the new type is text and the previous type was dropdown, set the value to empty string
        const newValue = customColumn?.previousType === "dropdown" && customColumn.inputType === "text" ? "" : value;
        handleCellEdit(rowIndex, columnId, value);
        // Update side panel data as well if open
        if (isSidePanelOpen) {
          updateFieldInData(columnId, newValue);
        }
      };
      // Define a function to handle changes in dropdown selection
      const handleDropdownChange = (selectedValue: string): void => {
        // This function will update the DataRow in the grid data state
        setData((prevData) =>
          prevData.map((row, index) => {
            if (index === rowIndex) {
              return { ...row, [columnId]: selectedValue };
            }
            return row;
          }),
        );

        // Additionally, if the changed row is currently selected in the side panel,
        // update the selectedRowData state as well.
        if (selectedRowData && selectedRowData.id === rowData.id) {
          setSelectedRowData({ ...selectedRowData, [columnId]: selectedValue });
        }
      };
      // For the select checkbox column, we don't want to toggle the side panel
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
            }} // Prevent this click from bubbling up
          />
        );
      }

      // Common cell content rendering
      const renderCellContent = (): JSX.Element => {
        // Custom rendering for different column types
        // If the column type has changed to text from dropdown, render an empty field
        if (customColumn?.inputType === "text") {
          return (
            <div style={{ position: "relative" }}>
              <EuiFieldText
                fullWidth
                value={customColumn.previousType === "dropdown" ? "" : rowData[columnId]}
                onChange={(e) => {
                  handleValueChange(e.target.value);
                }}
                onBlur={() => {
                  /* no-op */
                }}
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
              // onBlur={() => setEditingCell(null)}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          );
        } else {
          return <span>{rowData[columnId]}</span>;
        }
      };

      // Wrap the cell content to toggle the side panel on click
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

  // ... rest of your component code

  // Form state for the modal fields
  const [modalFormState, setModalFormState] = useState<DataRow>(() => {
    const initialState: Partial<DataRow> = {};
    // Initialize dropdowns with the first available option
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
      ...initialState, // This spreads the initialized dropdowns into the final object
    } as DataRow;
  });

  // Update the form state when modal input fields change
  const handleModalFormChange = (field: keyof DataRow, value: string): void => {
    setModalFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Load the selected rows from localStorage when the component mounts
  useEffect(() => {
    const savedSelectedRowIds = localStorage.getItem("selectedRowIds");
    if (savedSelectedRowIds) {
      const parsed = JSON.parse(savedSelectedRowIds) as number[];
      setSelectedRowIds(new Set<number>(parsed));
    }
  }, []);

  // Update localStorage whenever selectedRowIds changes
  useEffect(() => {
    localStorage.setItem("selectedRowIds", JSON.stringify([...selectedRowIds]));
  }, [selectedRowIds]);

  // When the modal opens, initialize the form state with the selected row's data
  // Inside your App component
  useEffect(() => {
    // This effect sets up the modal form state whenever the selected row data changes.
    if (selectedRowData) {
      const baseState = { ...selectedRowData };

      customColumns.forEach((column) => {
        if (column.inputType === "dropdown") {
          // For dropdown columns, ensure the value is from the dropdown options.
          baseState[column.id] =
            column.dropdownOptions?.find((o) => o.value === selectedRowData[column.id])?.value ??
            column.dropdownOptions?.[0].value ??
            ""; // Fallback to the first option or an empty string if not found.
        } else {
          // For other columns, use the existing value or initialize to an empty string.
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
                {/* <EuiButton onClick={handleAddNewRow} style={{ marginTop: "50px" }}>
        Add New Row
      </EuiButton> */}
                {/* Render edit buttons for each column */}
                {/* {renderEditColumnButtons()} */}
                {/* Button to toggle the side panel */}
                <EuiButtonIcon
                  iconType="gear"
                  onClick={() => {
                    setIsSidePanelOpen((prev) => !prev);
                  }}
                  aria-label="Edit column types"
                />
                {/* Main data grid container with dynamic width */}
                <div style={{ width: dataGridWidth }}>{/* DataGrid and other components */}</div>

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
                            {/* Add some padding for the content */}
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
                {/* Modal for editing columns */}
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
                        {/* Dropdown options go here if columnType is 'dropdown' */}
                        {/* ... */}
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
                        {
                          // Dynamically create form fields for all columns
                          getMergedColumns.map((column) => {
                            const customColumn = column;
                            // Ignore the 'select' column used for row selection
                            if (customColumn.id !== "select") {
                              if (customColumn.inputType === "dropdown") {
                                // Render a dropdown for columns with type 'dropdown'
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
                                // Render a text input for columns with type 'text' or others
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
                          })
                        }
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
                marginTop: "30px", // Adjust this value as needed
                overflowY: isSidePanelOpen ? "auto" : "hidden", // This will create a scrollbar when the content is larger than the panel
                transition: "width 0.2s",
                height: "calc(100vh - 50px)", // Adjust the height calculation if you've changed the marginTop
                display: isSidePanelOpen ? "block" : "none",
              }}
            >
              {isSidePanelOpen && selectedRowData && (
                <EuiForm>
                  {getMergedColumns
                    .filter((column) => column.id !== "select" && column.id !== "details" && column.id !== "delete") // Exclude non-data columns
                    .map((column) => {
                      const customColumn = column;
                      // Determine the value to display in the input field
                      let valueForField = selectedRowData[customColumn.id] ?? "";
                      // If the previous type was 'dropdown' and the current type is 'text', set the value to an empty string
                      if (customColumn.previousType === "dropdown" && customColumn.inputType === "text") {
                        valueForField = "";
                      }
                      return (
                        <EuiFormRow
                          label={customColumn.displayAsText || customColumn.id}
                          key={customColumn.id}
                        >
                          {customColumn.inputType === "dropdown" ? (
                            <EuiSelect
                              options={customColumn.dropdownOptions ?? []}
                              value={valueForField}
                              onChange={(e) => {
                                updateFieldInData(customColumn.id as keyof DataRow, e.target.value);
                              }}
                            />
                          ) : (
                            <EuiFieldText
                              value={valueForField}
                              onChange={(e) => {
                                updateFieldInData(customColumn.id as keyof DataRow, e.target.value);
                              }}
                            />
                          )}
                        </EuiFormRow>
                      );
                    })}
                </EuiForm>
              )}

              {/* Close button */}
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

//export default App;
