import React, { useCallback, useMemo, useState } from "react";
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
  EuiListGroup,
  EuiListGroupItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPopover,
  EuiResizableContainer,
  EuiSelect,
} from "@elastic/eui";
import "@elastic/eui/dist/eui_theme_light.css";
import { useEffect } from "react";
import { groupBy, set } from "lodash";
import { group } from "console";
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
type DropdownOption = { value: string; text: string };

interface Item {
  id: number;
  value: string;
}
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
  dropdownOptions?: Array<{ value: string; text: string }>;
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
      <div style={headerTextStyle} title={column.displayAsText}>
        {column.displayAsText}
      </div>
      <EuiButtonIcon
        iconType="pencil"
        onClick={() => onEdit(column.id)}
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
  const deleteColumnConfig = {
    id: "delete",
    displayAsText: "",
    // ... other properties
  };

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
  const dataCellStyle: React.CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    minWidth: "max-content",
  };

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
  const [dataGridWidth, setDataGridWidth] = useState("calc(100% - 300px)");
  const [sidePanelWidth, setSidePanelWidth] = useState("300px");
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(false);

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

  const [isColumnEditModalVisible, setIsColumnEditModalVisible] =
    useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Function to open the edit column modal
  const openEditColumnModal = useCallback(
    (columnId: string) => {
      const column = [...baseColumns, ...customColumns].find(
        (col) => col.id === columnId,
      );
      if (column) {
        setNewColumnData({
          id: column.id,
          displayAsText: column.displayAsText || "",
          columnType: column.inputType || "text",
          dropdownOptions: column.dropdownOptions || [],
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
  ) => {
    setNewColumnData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const handleDeleteRow = useCallback((rowId: number) => {
    setData((currentData) => currentData.filter((row) => row.id !== rowId));
  }, []);

  const saveColumnChanges = () => {
    let found = false;
    const updatedCustomColumns = found
      ? customColumns
      : customColumns.map((col) => {
        if (col.id === newColumnData.id) {
          return {
            ...col,
            displayAsText: newColumnData.displayAsText,
            inputType: newColumnData.columnType as ColumnType,
            dropdownOptions: newColumnData.dropdownOptions,
          };
        }
        return col;
      });
    // Update baseColumns if necessary
    const updatedBaseColumns = baseColumns.map((col) => {
      // If this is the column we're updating, return a new object with the updated displayAsText
      if (col.id === newColumnData.id) {
        return {
          ...col,
          displayAsText: newColumnData.displayAsText,
          inputType: newColumnData.columnType as ColumnType,
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
          const previousType = col.inputType;

          // Call updateColumnType to update the type and possibly clear data
          updateColumnType(
            newColumnData.id,
            newColumnData.columnType as ColumnType,
          );

          return {
            ...col,
            displayAsText: newColumnData.displayAsText,
            inputType: newColumnData.columnType as ColumnType,
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
  // Function to handle the selected row for the details panel
  const selectRowForDetails = (rowData: DataRow) => {
    setSelectedRowData(rowData);
    setIsSidePanelOpen(true);
  };

  const [newColumnData, setNewColumnData] = useState<ColumnConfig>({
    id: "",
    displayAsText: "",
    columnType: "text",
    dropdownOptions: [],
  });

  // State for managing popover visibility
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Function to toggle popover visibility
  const togglePopover = () => {
    setIsPopoverOpen((current) => !current);
  };
  // Function to close the popover
  const closePopover = () => {
    setIsPopoverOpen(false);
  };

  const handleCreateColumn = () => {
    if (!newColumnData.id || !newColumnData.displayAsText) {
      console.error("Both Column ID and Display Text are required.");
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
  const [dropdownOptions, setDropdownOptions] = useState([
    { value: "", text: "" },
  ]);
  const [selectedColumnType, setSelectedColumnType] =
    useState<ColumnType>("text");

  const handleColumnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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

  const [didGroupColumnChange, setDidGroupColumnChange] = useState(false);

  //This function manages both selectedRowData and data states for change in sidePanel to reflect in Datagrid
  const updateFieldInData = (
    fieldKey: keyof DataRow,
    value: string | number,
  ) => {
    if (!selectedRowData) return;
    if (fieldKey==groupbyColumn){
      setDidGroupColumnChange(true);
    }
    const updatedSelectedRowData = { ...selectedRowData, [fieldKey]: value };
    setSelectedRowData(updatedSelectedRowData);

    setData((prevData) =>
      prevData.map((row) =>
        row.id === selectedRowData.id ? updatedSelectedRowData : row,
      ),
    );
  };

  const handleSidePanelClose = () => {
    if (didGroupColumnChange){
      let temp = ungroup(data);
      let groupedData = makeGroups(temp, groupbyColumn);
      setData(groupedData);
      setDidGroupColumnChange(false);
    }
    setIsSidePanelOpen(false);
  }

  const handleAddDropdownOption = () => {
    setNewColumnData((prev) => ({
      ...prev,
      dropdownOptions: [...prev.dropdownOptions, { value: "", text: "" }],
    }));
  };
  // Function to handle changing dropdown option values
  const handleDropdownOptionChange = (
    index: number,
    key: string,
    value: string,
  ) => {
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
  const handleRemoveDropdownOption = (index: number) => {
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
  const renderDropdownOptions = () => {
    return (
      newColumnData.dropdownOptions &&
      (newColumnData.dropdownOptions as DropdownOption[]).map(
        (option, index) => (
          <div key={index}>
            <EuiFieldText
              placeholder="Option text"
              value={option.text}
              onChange={(e) =>
                handleDropdownOptionChange(index, "text", e.target.value)
              }
            />
            <EuiFieldText
              placeholder="Option value"
              value={option.value}
              onChange={(e) =>
                handleDropdownOptionChange(index, "value", e.target.value)
              }
            />
            <EuiButtonIcon
              iconType="minusInCircle"
              onClick={() => handleRemoveDropdownOption(index)}
              aria-label="Remove dropdown option"
            />
          </div>
        ),
      )
    );
  };
  const handleAddNewColumn = () => {
    // we are making sure that new column has an ID and a display text
    if (!newColumnDetails.id || !newColumnDetails.displayAsText) {
      console.error("Both Column ID and Display Text are required.");
      return;
    }
    // Omit the delete column from being added again
    if (newColumnDetails.id === "delete") {
      console.error(
        "The 'delete' column ID is reserved and cannot be used for new columns.",
      );
      return;
    }

    // Prepare the new column configuration
    const newColumnConfig = {
      id: newColumnDetails.id.trim(),
      displayAsText: newColumnDetails.displayAsText.trim(),
      columnType: selectedColumnType,
      // here Include dropdown options if the column type is 'dropdown'
      ...(selectedColumnType === "dropdown" && {
        dropdownOptions: dropdownOptions.filter(
          (option) => option.value && option.text,
        ),
      }),
    };

    // Temporarily remove the delete column
    setCustomColumns((prevColumns) => {
      const filteredColumns = prevColumns.filter(
        (column) => column.id !== "delete",
      );
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
  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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
    if (newColumnType === "dropdown") {
      columnConfig.dropdownOptions = [
        { value: "option1", text: "Option 1" },
        { value: "option2", text: "Option 2" },
        // ... more options
      ];
    }

    handleAddNewColumn();
  };
  //state for selecting rows
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<number>());
  // state for checking symbol for checkboxes
  const [checked, setChecked] = useState(false);
  const handleRowSelectionChange = useCallback((rowId: number) => {
    setSelectedRowIds((prevSelectedRowIds) => {
      const newSelectedRowIds = new Set(prevSelectedRowIds);
      if (newSelectedRowIds.has(rowId)) {
        newSelectedRowIds.delete(rowId);
      } else {
        newSelectedRowIds.add(rowId);
      }
      console.log("In setSelectedRowId");
      console.log(newSelectedRowIds);
      localStorage.setItem(
        "selectedRowIds",
        JSON.stringify([...newSelectedRowIds]),
      );
      return newSelectedRowIds;
    });
  }, []);

  const handleDeleteSelectedRows = useCallback(() => {
    setData((prevData) =>
      prevData.filter((row) => !selectedRowIds.has(row.id)),
    );
    setSelectedRowIds(new Set()); // Clear selection after deletion
  }, [selectedRowIds]);

  const getMergedColumns = useMemo(() => {
    // Checkbox column for row selection

    const checkboxStyle = {
      display: "none",
    };

    const labelStyle = {
      display: "inline-block",
      border: "1px solid #000",
      width: "30px",
      height: "30px",
      position: "relative",
      cursor: "pointer",
    };

    const afterCheckedStyle: React.CSSProperties = {
      content: '"✔"', // This is not valid in inline styles, it's just for illustration
      display: "inline-block",
      position: "absolute",
      left: "10px",
      top: "5px",
      fontSize: "1.6em",
    };

    //style for class named euiDataGridRowCell to remove borders
    const euiDataGridRowCellStyle = {
      display: "flex",
      alignItems: "center",
      border: "0px solid black",
    };

    const datagridContainerStyle = {
      border: "none",
      paddingbottom: "0px",
    };

    // Checkbox column for row selection
    const selectColumn = {
      id: "select",
      displayAsText: "", // No header text for the selection column
      // Custom render for the cell to show a checkbox
      cellRenderer: ({ rowIndex }: EuiDataGridCellValueElementProps) => {
        const rowId = data[rowIndex].id;
        const isChecked = selectedRowIds.has(rowId);
        const optionId = `checkbox_${rowId}`;

        // const handleCheckboxChange = (rowId: number) => {
        //   // Toggle the selection on change
        //   handleRowSelectionChange(rowId);
        // };
        console.log(`Row ${rowId} checked: ${isChecked}`);

        // Return a checkbox with the correct 'checked' state and an onChange handler
        return (
          <EuiCheckbox
            key={optionId}
            id={optionId}
            checked={isChecked}
            onChange={() => handleRowSelectionChange(rowId)}
            // aria-label={`Select row ${rowId}`}

            label={""} // Since we don't need a label next to each checkbox, we can leave this empty
            compressed // Use the compressed style if space is limited
          />
        );
      },
    };

    // Prepare columns excluding the 'delete' column as it's not individual row action anymore
    const filteredBaseColumns = baseColumns.filter(
      (column) => column.id !== "delete",
    );
    const filteredCustomColumns = customColumns.filter(
      (column) => column.id !== "delete",
    );

    // Combine and deduplicate the base and custom columns, exclude 'delete' column logic
    let combinedColumns = [
      selectColumn,
      ...filteredBaseColumns,
      ...filteredCustomColumns,
    ].reduce<CustomColumn[]>((acc, current) => {
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

    return combinedColumns;
  }, [
    baseColumns,
    customColumns,
    openEditColumnModal,
    selectedRowIds,
    handleRowSelectionChange,
    data,
  ]);

  const [visibleColumns, setVisibleColumns] = useState(
    getMergedColumns.map((column) => column.id),
  );
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);

  // Function to handle opening the modal with selected row data
  const handleOpenModal = useCallback((rowData: DataRow) => {
    setSelectedRowData(rowData);
    setIsModalVisible(true);
  }, []);
  const handleSaveNewColumn = () => {
    // Construct the new column config object
    const newColumnConfig = {
      id: newColumnDetails.id,
      displayAsText: newColumnDetails.displayAsText,
      columnType: newColumnDetails.columnType,
      // If it's a dropdown, you would handle dropdownOptions similarly
    };

    // Add the new column to your grid columns state (this logic depends on your existing code)
    // ...

    // Reset the modal form state and close the modal
    setNewColumnDetails({ id: "", displayAsText: "", columnType: "text" });
    // Close modal logic goes here...
  };
  // When opening the modal to edit, make sure to set the editing cell state
  const openEditModal = (rowIndex: number, columnId: string) => {
    const rowData = data[rowIndex];
    setEditingCell({ rowIndex, columnId });
    setSelectedRowData(rowData);
    setIsModalVisible(true);
  };
  const [items, setItems] = useState<Item[]>([]);
  // Handler to change individual column configuration
  const handleChange = (id: string, key: keyof CustomColumn, value: string) => {
    // Update the state of a specific column's configuration
    setCustomColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === id ? { ...column, [key]: value } : column,
      ),
    );
  };

  // This function should be defined within your component where 'setCustomColumns' is available
  const onSave = (updatedColumns: React.SetStateAction<CustomColumn[]>) => {
    // Assuming 'setCustomColumns' is the state updater function for your custom columns
    setCustomColumns(updatedColumns);
  };

  //variable to store using which grouping should be performed
  const [groupbyColumn, setGroupbyColumn] = useState<string>("");
  // Modify handleSaveData to handle both adding and editing rows
  const handleSaveData = useCallback((editedData: DataRow) => {
    setData((currentData) => {
      const rowIndex = currentData.findIndex((row) => row.id === editedData.id);
      let newData: any[];
      if (rowIndex !== -1) {
        // Edit existing row
        newData = [...currentData];
        newData[rowIndex] = { ...newData[rowIndex], ...editedData };
      } else {
        alert("In Handle Save Data"+groupbyColumn);
        newData = [...currentData,editedData];
        if (groupbyColumn!=""){
          let temp = ungroup(newData);
          alert("Temp"+temp.length)
          let groupedData = makeGroups(temp, groupbyColumn);
          alert("grouped"+groupedData.length)
          return groupedData;
        }
      }
      return newData;
    });
    setIsModalVisible(false);
  }, [groupbyColumn]);

  // Function to handle closing the modal
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  // Function to handle adding a new row
  const handleAddNewRow = () => {
    // Open the modal to add a new row
    setSelectedRowData({
      id: Date.now(), // Example for a unique ID
      definition: "",
      characteristics: "",
      processCriteriaIdentification: "",
      // Initialize dropdown fields with default options or empty strings
      controlRodInsertion:
        customColumns.find((col) => col.id === "controlRodInsertion")
          ?.dropdownOptions?.[0].value || "",
      feedwaterPump:
        customColumns.find((col) => col.id === "feedwaterPump")
          ?.dropdownOptions?.[0].value || "",
      reactorCoolantCirculator:
        customColumns.find((col) => col.id === "reactorCoolantCirculator")
          ?.dropdownOptions?.[0].value || "",
      others:
        customColumns.find((col) => col.id === "others")?.dropdownOptions?.[0]
          .value || "",
    });

    setIsModalVisible(true);
  };

  const handleModalSubmit = () => {
    // If we are editing an existing row, use the modal state to save it
    if (selectedRowData) {
      handleSaveData(modalFormState);
    } else {
      // If we are adding a new row, create it and then save
      const newRowData = {
        ...modalFormState,
        id: Date.now(), // or use another method to generate a unique ID
      };
      handleSaveData(newRowData);

    }
    setIsModalVisible(false); // Close the modal after saving the data
  };

  const handleCellEdit = useCallback(
    (rowIndex: number, columnId: keyof DataRow, value: string) => {
      // Update the specific cell data within the row

      setData((currentData) => {
        const newData = [...currentData];
        newData[rowIndex] = { ...newData[rowIndex], [columnId]: value };
        return newData;
      });
    },
    [],
  );
  const updateColumnType = (columnId: string, newType: ColumnType) => {
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

  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
      const rowData = data[rowIndex];
      const customColumn = [...baseColumns, ...customColumns].find(
        (col) => col.id === columnId,
      );
      const isEditing =
        editingCell?.rowIndex === rowIndex &&
        editingCell?.columnId === columnId;

      const handleRowClick = () => {
        if (rowData.isHeader) {
          return;
        }
        if (selectedRowData && rowData.id === selectedRowData.id) {
          setIsSidePanelOpen((isOpen) => !isOpen);
          //if sidebar is closed then grouping is performed again
          //if in previously selected row the grouping column changed in sidebar
          if (didGroupColumnChange){
            let temp = ungroup(data);
            let groupedData = makeGroups(temp, groupbyColumn);
            setData(groupedData);
            setDidGroupColumnChange(false);
          }
        } else {
          //if new row is selected then grouping is performed again
          //if previously selected row changed in sidebar
          if (didGroupColumnChange){
            let temp = ungroup(data);
            let groupedData = makeGroups(temp, groupbyColumn);
            setData(groupedData);
            setDidGroupColumnChange(false);
          }
          setSelectedRowData(rowData);
          setIsSidePanelOpen(true);
        }
      };

      const handleValueChange = (value: string) => {
        handleCellEdit(rowIndex, columnId, value);
      };
      // Define a function to handle changes in dropdown selection
      const handleDropdownChange = (selectedValue: string) => {
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

      // Only allow the side panel to open when clicking on text cells, not dropdowns or checkboxes
      const shouldOpenSidePanel =
        customColumn?.inputType === "text" && columnId !== "select";

      // For the select checkbox column, we don't want to toggle the side panel
      if (columnId === "select") {
        if (data[rowIndex].isHeader) {
          return <span></span>;
        }
        const rowId = data[rowIndex].id;
        return (
          <input
            type="checkbox"
            checked={selectedRowIds.has(rowId)}
            onChange={() => handleRowSelectionChange(rowId)}
            aria-label={`Select row ${rowId}`} // Fix: Replace with a template string
            onClick={(e) => e.stopPropagation()} // Prevent this click from bubbling up
          />
        );
      }

      // Common cell content rendering
      const renderCellContent = () => {
        // Custom rendering for different column types
        if(data[rowIndex].isHeader){
          if(columnId == groupbyColumn){
            return <span>{data[rowIndex].group}</span>;
          }
          return <span></span>;
        }
        if (isEditing) {
          return (
            <EuiFieldText
              fullWidth
              value={rowData[columnId]}
              onChange={(e) => handleValueChange(e.target.value)}
              onBlur={() => setEditingCell(null)}

              autoFocus
            />
          );
        } else if (customColumn?.inputType === "dropdown") {
          return (
            <EuiSelect
              fullWidth
              options={customColumn.dropdownOptions}
              value={rowData[columnId]}
              onChange={(e) => handleDropdownChange(e.target.value)}
              onBlur={() => setEditingCell(null)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        } else {
          return <span>{rowData[columnId]}</span>;
        }
      };

      // Wrap the cell content to toggle the side panel on click
      return (
        <div onClick={handleRowClick} style={{ cursor: "pointer" }}>
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
      editingCell,
      setEditingCell,
      selectedRowIds,
      handleRowSelectionChange,
      setSelectedRowData,
      setData,
    ],
  );

  // ... rest of your component code

  // Form state for the modal fields
  const [modalFormState, setModalFormState] = useState<DataRow>(() => {
    const initialState: Partial<DataRow> = {};
    // Initialize dropdowns with the first available option
    customColumns.forEach((column) => {
      if (
        column.inputType === "dropdown" &&
        column.dropdownOptions &&
        column.dropdownOptions.length > 0
      ) {
        initialState[column.id as keyof DataRow] =
          column.dropdownOptions[0].value;
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
  const handleModalFormChange = (field: keyof DataRow, value: string) => {
    setModalFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Load the selected rows from localStorage when the component mounts
  useEffect(() => {
    const savedSelectedRowIds = localStorage.getItem("selectedRowIds");
    if (savedSelectedRowIds) {
      setSelectedRowIds(new Set(JSON.parse(savedSelectedRowIds)));
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
      let baseState = { ...selectedRowData };

      customColumns.forEach((column) => {
        if (column.inputType === "dropdown") {
          // For dropdown columns, ensure the value is from the dropdown options.
          baseState[column.id] =
            column.dropdownOptions?.find(
              (o) => o.value === selectedRowData[column.id],
            )?.value ??
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

  // for groupping

  //open popover for groupby
  const [groupbyPopoverOpen, setGroupbyPopoverOpen] = useState(false);
  //close popover for groupby
  const closeGroupbyPopover = () => {
    setGroupbyPopoverOpen(false);
  }


  // store column by which grouping is done
  function makeGroups(rows: any[], columnId: string) {
    const grouped = groupBy(rows, columnId);
    const groupedRows: any[] = [];
    for (const group in grouped) {
      let headerRow = { isHeader: true, group,};
      groupedRows.push(headerRow);
      grouped[group].forEach((row: any) => {
        row.group = group;
        groupedRows.push(row);
      });
    }
    return groupedRows;
  }
  function ungroup(rows: any[]) {
    let updatedData =[];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].isHeader) {
        continue;
      }
      updatedData.push(rows[i]);
    }
    return updatedData;
  }

  //handle the click on column name in popover
  //if column clicked on is same as groupby column then remove grouping
  //else group by the column clicked on
  const handleGroupByOptionClick = useCallback((columnId: string) => {
    if (groupbyColumn === columnId) {
      setGroupbyColumn("");
      setData(ungroup(data));
      closeGroupbyPopover();
      return;
    }
    alert("Setting Group by column to "+columnId)
    setGroupbyColumn(columnId);
    alert("Group by " + columnId);
    if (groupbyColumn !=""){
      let temp = ungroup(data);
      setData(makeGroups(temp, columnId));
    }
    else{
      setData(makeGroups(data, columnId));
    }
    closeGroupbyPopover();

  }, [groupbyColumn, closePopover]);


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
              <div className="datagrid-container" style={{ marginTop: "20px" }}>
                <EuiButtonIcon
                  iconType="gear"
                  onClick={toggleSidePanel}
                  aria-label="Edit column types"
                />
                <div style={{ width: dataGridWidth }}>
                </div>

                <EuiButtonIcon
                  iconType="plusInCircle"
                  onClick={() => setIsNewColumnModalVisible(true)}
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
                        <EuiButton size="s" onClick={handleAddNewRow}>
                          Create Initiating Event
                        </EuiButton>

                        <EuiButtonIcon
                          iconType="gear"
                          onClick={() => setIsSidePanelVisible(true)}
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
                                  onChange={(e) =>
                                    setNewColumnData({
                                      ...newColumnData,
                                      id: e.target.value,
                                    })
                                  }
                                />
                              </EuiFormRow>
                              <EuiFormRow label="Display As">
                                <EuiFieldText
                                  value={newColumnData.displayAsText}
                                  onChange={(e) =>
                                    setNewColumnData({
                                      ...newColumnData,
                                      displayAsText: e.target.value,
                                    })
                                  }
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
                              <EuiButton onClick={handleCreateColumn}>
                                Create Column
                              </EuiButton>
                            </EuiForm>
                          </div>

                          {newColumnData.columnType === "dropdown" && (
                            <React.Fragment>
                              {newColumnData.dropdownOptions.map(
                                (option, index) => (
                                  <div key={index}>
                                    <EuiFormRow
                                      label={`Option ${index + 1} Text`}
                                    >
                                      <EuiFieldText
                                        value={option.text}
                                        onChange={(e) =>
                                          handleDropdownOptionChange(
                                            index,
                                            "text",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </EuiFormRow>
                                    <EuiFormRow
                                      label={`Option ${index + 1} Value`}
                                    >
                                      <EuiFieldText
                                        value={option.value}
                                        onChange={(e) =>
                                          handleDropdownOptionChange(
                                            index,
                                            "value",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </EuiFormRow>
                                    <EuiButtonIcon
                                      iconType="minusInCircle"
                                      onClick={() =>
                                        handleRemoveDropdownOption(index)
                                      }
                                      aria-label="Remove dropdown option"
                                    />
                                  </div>
                                ),
                              )}
                              <EuiButton
                                onClick={handleAddDropdownOption}
                                iconType="plusInCircle"
                              >
                                Add Option
                              </EuiButton>
                            </React.Fragment>
                          )}
                        </EuiPopover>
                        <EuiPopover
                          button={
                            <EuiButton onClick={() => {setGroupbyPopoverOpen(!groupbyPopoverOpen)}}>
                              Group By
                            </EuiButton>
                          }
                          isOpen={groupbyPopoverOpen}
                          closePopover={closeGroupbyPopover}
                        >
                          <div style={{ padding: 10 }}>
                            <EuiListGroup>
                              {[...baseColumns, ...customColumns].map((column) => (
                                <EuiListGroupItem
                                  key={column.id}
                                  label={column.displayAsText}
                                  onClick={() => handleGroupByOptionClick(column.id)}
                                  size="xs"
                                />
                              ))}
                            </EuiListGroup>
                          </div>
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
                  <EuiModal onClose={() => setIsNewColumnModalVisible(false)}>
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>Add New Column</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm>
                        <EuiFormRow label="Column ID">
                          <EuiFieldText
                            value={newColumnDetails.id}
                            onChange={(e) =>
                              setNewColumnDetails({
                                ...newColumnDetails,
                                id: e.target.value,
                              })
                            }
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Display As">
                          <EuiFieldText
                            value={newColumnDetails.displayAsText}
                            onChange={(e) =>
                              setNewColumnDetails({
                                ...newColumnDetails,
                                displayAsText: e.target.value,
                              })
                            }
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
                            onChange={(e) =>
                              setNewColumnData({
                                ...newColumnData,
                                columnType: e.target.value as ColumnType,
                                dropdownOptions:
                                  e.target.value === "dropdown"
                                    ? []
                                    : newColumnData.dropdownOptions,
                              })
                            }
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
                    onClose={() => setIsColumnEditModalVisible(false)}
                    style={{ width: "800px" }}
                  >
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>Edit Column</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm component="form">
                        <EuiFormRow label="Column ID (cannot be changed)">
                          <EuiFieldText value={newColumnData.id} disabled />
                        </EuiFormRow>
                        <EuiFormRow label="Column Heading">
                          <EuiFieldText
                            value={newColumnData.displayAsText}
                            onChange={(e) =>
                              handleEditColumnChange(e, "displayAsText")
                            }
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
                            onChange={(e) =>
                              handleEditColumnChange(e, "columnType")
                            }
                          />
                        </EuiFormRow>
                        {/* Dropdown options go here if columnType is 'dropdown' */}
                        {/* ... */}
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton
                        onClick={() => setIsColumnEditModalVisible(false)}
                      >
                        Cancel
                      </EuiButton>
                      <EuiButton onClick={saveColumnChanges} fill>
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
                      <EuiModalHeaderTitle>
                        {selectedRowData.id ? "Edit Data" : "Add New Data"}
                      </EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm component="form">
                        {
                          // Dynamically create form fields for all columns
                          getMergedColumns.map((column) => {
                            const customColumn = column as CustomColumn;

                            if (customColumn.inputType === "dropdown") {
                              // Render a dropdown for columns with type 'dropdown'
                              return (
                                <EuiFormRow
                                  label={column.displayAsText}
                                  key={column.id}
                                >
                                  <EuiSelect
                                    options={customColumn.dropdownOptions || []}
                                    value={modalFormState[column.id]}
                                    onChange={(e) =>
                                      handleModalFormChange(
                                        column.id,
                                        e.target.value,
                                      )
                                    }
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
                                    onChange={(e) =>
                                      handleModalFormChange(
                                        column.id,
                                        e.target.value,
                                      )
                                    }
                                  />
                                </EuiFormRow>
                              );
                            }
                          })
                        }
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton onClick={handleCloseModal}>Cancel</EuiButton>
                      <EuiButton onClick={handleModalSubmit} fill>
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

              {/* Close button */}
              <EuiButton
                onClick={() => handleSidePanelClose()}
                style={{ marginTop: "20px" }}
              >
                Close
              </EuiButton>
              {isSidePanelOpen && selectedRowData && (
                <EuiForm>
                  {getMergedColumns
                    .filter(
                      (column) =>
                        column.id !== "select" &&
                        column.id !== "details" &&
                        column.id !== "delete",
                    ) // Exclude non-data columns
                    .map((column) => {
                      const customColumn = column as CustomColumn;
                      return (
                        <EuiFormRow
                          label={customColumn.displayAsText || customColumn.id}
                          key={customColumn.id}
                        >
                          {customColumn.inputType === "dropdown" ? (
                            <EuiSelect
                              options={customColumn.dropdownOptions || []}
                              value={selectedRowData[customColumn.id] || ""}
                              onChange={(e) =>
                                updateFieldInData(
                                  customColumn.id,
                                  e.target.value,
                                )
                              }
                            />
                          ) : (
                            <EuiFieldText
                              value={selectedRowData[customColumn.id] || ""}
                              onChange={(e) =>
                                updateFieldInData(
                                  customColumn.id,
                                  e.target.value,
                                )
                              }
                            />
                          )}
                        </EuiFormRow>
                      );
                    })}
                </EuiForm>
              )}

            </EuiResizablePanel>
          </>
        )}
      </EuiResizableContainer>
    </div>
  );
};

export function InitiatingEventModelViewTable(): JSX.Element{
  return (
    <>
      <App />
    </>
  );
}
