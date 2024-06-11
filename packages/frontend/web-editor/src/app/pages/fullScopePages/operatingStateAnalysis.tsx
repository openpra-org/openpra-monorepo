import React, { useCallback, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { OperatingStateAnalysisApiManager } from "../../../../../../shared-types/src/lib/api/OperatingStateAnalysisApiManager";
import "../../../../../../shared-types/src/lib/types/OperatingStates/types";
import "..//..//components/OperatingStateStyles/styles.modules.css";
// ../../components/OperatingStateStyles/styles.module.css
import { OperatingStateAnalysisList } from "../../components/lists/nestedLists/operatingStateAnalysisList";
//----------------------------EUIdatagrid---------------------
import {
  EuiButton,
  EuiButtonEmpty,
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
  EuiSpacer,
} from "@elastic/eui";
import "@elastic/eui/dist/eui_theme_light.css";
import { useEffect } from "react";
import { JSX } from "react/jsx-runtime";
import { OperatingState } from "../../../../../../shared-types/src/lib/types/OperatingStates/types";
type SearchBarQuery = {
  text: string;
};

type SearchBarError = {
  message: string;
};
type QueryFilters = { [key: string]: string };
type SearchBarWithFilterTagsProps = {
  queryText: string;
  setQueryText: React.Dispatch<React.SetStateAction<string>>;
  activeFilters: { [key: string]: boolean };
  removeFilter: (filterKey: string) => void;
  showAddFilterModal: () => void;
  addFilter: (newFilter: Filter) => void;
};
type FilterSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddFilter: (newFilter: string) => void;
  availableFilters: string[];
};

// Define the filter type
type Filter = {
  key: string;
  value: string;
};

// Define the props for the FilterTag component
type FilterTagProps = {
  filter: Filter;
  onRemove: () => void; // This should not expect any arguments now
};
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
interface Column {
  id: string;
  name: string;
  type: "text" | "number" | "dropdown";
  dropdownOptions?: Array<{ value: string; text: string }>;
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

  // Exclude pencil icon for 'select' and 'delete' columns
  if (column.id === "select" || column.id === "delete") {
    return <span style={{ display: "flex", alignItems: "center" }}>{column.displayAsText}</span>;
    // return null;
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
        onClick={() => onEdit(column.id)}
        aria-label={`Edit column ${column.displayAsText}`}
        size="s"
        style={iconStyle}
      />
    </div>
  );
};

const App: React.FC = () => {
  const [isAddFilterModalVisible, setIsAddFilterModalVisible] = useState(false);
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [activeDropdownKey, setActiveDropdownKey] = useState<string | null>(null);
  const [showError, setShowError] = useState(true);
  // Add state for error message
  const [errorMessage, setErrorMessage] = useState("");
  const dismissError = () => {
    setShowError(false);
    setErrorMessage("");
  };

  // Function to toggle search bar visibility
  const toggleSearchBarVisibility = () => {
    setShowSearchBar((prev) => !prev);
  };

  const openDropdown = (filterKey: string) => {
    setActiveDropdownKey(filterKey);
  };
  const onDropdownFilterChange = (filterKey: string, selectedValue: string) => {
    setQueryText((prevQuery) => {
      const newQuery = prevQuery.replace(`${filterKey}:"yes"`, `${filterKey}:"${selectedValue}"`).trim();
      return newQuery;
    });
    setActiveDropdownKey(null); // Close the dropdown after selection
    filterDataBasedOnQuery(queryText); // Make sure to apply the filter
  };
  // This will store the operating state rows
  const [data, setData] = useState<DataRow[]>([]);
  const [filteredItems, setFilteredItems] = useState<DataRow[]>([]);
  //to fetch and transform the data
  useEffect(() => {
    const fetchRows = async () => {
      try {
        const fetchedStates = await OperatingStateAnalysisApiManager.getAllOperatingStates();
        console.log("Fetched States:", fetchedStates);
        const transformedData = transformOperatingStatesToDataRows(fetchedStates);
        console.log("Transformed Data:", transformedData);
        setData(transformedData);
        setFilteredItems(transformedData);
      } catch (error) {
        console.error("Error fetching operating states:", error);
      }
    };

    fetchRows();
  }, []);
  // convert Map to object if necessary
  const mapToObject = (map: Map<string, string>): { [key: string]: string } => {
    const obj: { [key: string]: string } = {};
    for (let [key, value] of map.entries()) {
      obj[key] = value;
    }
    return obj;
  };
  // CRUD Functions
  const createOperatingState = async (operatingState: DataRow) => {
    try {
      const response = await fetch("http://localhost:4200/api/operating-state-analysis/operating-states", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(operatingState),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${errorText}`);
      }
      const newState = await response.json();
      setData((prevData) => [...prevData, newState]); // Assuming setData updates your state
      return newState;
      // return await response.json();
    } catch (error) {
      console.error("API call failed:", error);
    }
  };

  // const createOperatingState = async (operatingState: OperatingState) => {
  //   try {
  //     const newState =
  //       await OperatingStateAnalysisApiManager.createOperatingState(
  //         operatingState,
  //       );
  //     console.log("Data received from API:", newState); // Check what data is received from the backend

  //     const transformedNewState = transformOperatingStatesToDataRows([
  //       newState,
  //     ]);
  //     console.log("Transformed state:", transformedNewState); // Verify the output of the transformation

  //     if (transformedNewState && transformedNewState.length > 0) {
  //       setData((prevData) => [...prevData, transformedNewState[0]]);
  //       setError(null);
  //     } else {
  //       throw new Error("Transformation resulted in empty or invalid data.");
  //     }
  //   } catch (error) {
  //     console.error("Failed to create operating state:", error);
  //     setError("Failed to create new operating state.");
  //   }
  // };

  const updateOperatingState = async (id: string, updatedData: Partial<OperatingState>): Promise<DataRow | null> => {
    try {
      const updatedState = await OperatingStateAnalysisApiManager.updateOperatingState(id, updatedData);

      if (!updatedState) {
        console.error("No updated state returned from the API");
        return null;
      }

      const transformedUpdatedState = transformOperatingStatesToDataRows([updatedState]);
      if (transformedUpdatedState.length > 0) {
        setData((prevData) =>
          prevData.map((item) => (String(item.id) === String(id) ? transformedUpdatedState[0] : item)),
        );
        return transformedUpdatedState[0];
      } else {
        throw new Error("Failed to transform updated state");
      }
    } catch (error) {
      console.error(`Failed to update operating state with ID ${id}:`, error);
      return null; // Consider setting an error state here for UI feedback
    }
  };

  const deleteOperatingState = async (id: string) => {
    try {
      await OperatingStateAnalysisApiManager.deleteOperatingState(id);
      setData(data.filter((item) => String(item.id) !== id));
    } catch (error) {
      console.error(`Failed to delete operating state with ID ${id}:`, error);
    }
  };
  const transformOperatingStatesToDataRows = (operatingStates: OperatingState[]): DataRow[] => {
    //map the received operating states to data rows
    return operatingStates.map((operatingState) => {
      // return an object that matches the DataRow type
      return {
        id: operatingState.id,
        definition: operatingState.definition || "",
        characteristics: operatingState.characteristics || "",
        processCriteriaIdentification: operatingState.processCriteriaIdentification || "",
        controlRodInsertion: operatingState.controlRodInsertion || "",
        feedwaterPump: operatingState.feedwaterPump || "",
        reactorCoolantCirculator: operatingState.reactorCoolantCirculator || "",
        others: operatingState.others || "",
      };
    });
  };

  // const [data, setData] = useState<DataRow[]>([
  //   {
  //     id: 1,
  //     definition: "Definition 1",
  //     characteristics: "Characteristics 1",
  //     processCriteriaIdentification: "Criteria 1",
  //     controlRodInsertion: "yes",
  //     feedwaterPump: "no",
  //     reactorCoolantCirculator: "yes",
  //     others: "no",
  //   },
  //   {
  //     id: 2,
  //     definition: "Definition 2",
  //     characteristics: "Characteristics 2",
  //     processCriteriaIdentification: "Criteria 2",
  //     controlRodInsertion: "no",
  //     feedwaterPump: "yes",
  //     reactorCoolantCirculator: "no",
  //     others: "yes",
  //   },
  // ]);
  // const { operatingStateAnalysisId } = useParams();
  // // This will retrieve the 'id' from the URL
  // useEffect(() => {
  //   const fetchOperatingState = async () => {
  //     if (operatingStateAnalysisId) {
  //       try {
  //         const response =
  //           await OperatingStateAnalysisManager.getOperatingStateById(
  //             operatingStateAnalysisId,
  //           );
  //         if (response) {
  //           setData((response as any).data);
  //         } else {
  //           // Handle the null response here
  //           console.error("Received null response from getOperatingStateById");
  //           // Set data to an empty array or some error state
  //           setData([]);
  //         }
  //       } catch (error) {
  //         console.error("Error fetching operating state:", error);
  //         // Handle your error state here
  //       }
  //     }
  //   };

  //   fetchOperatingState();
  // }, [operatingStateAnalysisId]);

  // Define the available filters, either as a state or a constant
  // This should be an array of filters that the user can select from
  const availableFilters: Filter[] = [
    { key: "controlRodInsertion", value: "yes" },
    { key: "controlRodInsertion", value: "no" },
    { key: "controlRodInsertion", value: "unknown" },
    { key: "feedwaterPump", value: "yes" },
    { key: "feedwaterPump", value: "no" },
    { key: "feedwaterPump", value: "unknown" },
    // Add more filters and values as needed
  ];
  // Convert to the format expected by EuiSelect
  const selectOptions = availableFilters.map((filter) => ({
    value: filter.key,
    text: filter.value,
  })) as { value: string; text: string }[];

  const addFilter = (newFilter: string | Filter) => {
    setQueryText((prev) => `${prev} ${newFilter}:"yes"`.trim());
    setIsAddFilterModalVisible(false);
    setShowSearchBar(true);
  };

  const removeFilter = (filterKey: string): void => {
    setQueryText((prev) => prev.replace(`${filterKey}:"yes"`, "").trim());
  };
  const dataCellStyle: React.CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    minWidth: "max-content",
  };

  const [baseColumns, setBaseColumns] = useState<CustomColumn[]>([
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

  // Add useState for query state management
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [controlRodInsertionFilter, setControlRodInsertionFilter] = useState<string | undefined | "all">("all");
  const toggleControlRodInsertionFilter = () => {
    setControlRodInsertionFilter((prevFilter) => (prevFilter === "yes" ? "all" : "yes"));
  };

  //state to handle inline-editing-enabled on full screen
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    controlRodInsertion: true,
    feedwaterPump: true,
  });
  // Function to handle the removal of a filter
  // const handleRemoveFilterClick = (filterKey: Filter) => {
  //   // Update the query text
  //   const newQueryText = queryText.replace(`${filterKey}:"yes"`, "").trim();
  //   setQueryText(newQueryText);

  //   // Update the active filters
  //   setActiveFilters((prevFilters) => ({
  //     ...prevFilters,
  //     [filterKey]: false,
  //   }));
  // };

  // State for managing the feedwaterPump filter
  const [showOnlyFeedwaterPump, setShowOnlyFeedwaterPump] = useState(false);

  // Function to toggle the feedwaterPump filter
  const toggleShowOnlyFeedwaterPump = () => {
    setQueryText((currentQuery) => {
      const feedwaterPumpQuery = 'feedwaterPump:"yes"';
      if (currentQuery.includes(feedwaterPumpQuery)) {
        return currentQuery.replace(feedwaterPumpQuery, "").trim();
      } else {
        return `${currentQuery} ${feedwaterPumpQuery}`.trim();
      }
    });
  };
  const toggleShowOnlyControlRodInsertion = () => {
    setQueryText((currentQuery) => {
      const controlRodInsertionQuery = 'controlRodInsertion:"yes"';
      if (currentQuery.includes(controlRodInsertionQuery)) {
        return currentQuery.replace(controlRodInsertionQuery, "").trim();
      } else {
        return `${currentQuery} ${controlRodInsertionQuery}`.trim();
      }
    });
  };

  // Add state to manage the width of the data grid and the side panel
  const [dataGridWidth, setDataGridWidth] = useState("calc(100% - 300px)");
  const [sidePanelWidth, setSidePanelWidth] = useState("300px");
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(false);
  const [queriedData, setQueriedData] = useState([...data]);

  const [showOnlyYes, setShowOnlyYes] = useState(false);
  const toggleShowOnlyYes = () => {
    setShowOnlyYes((prevShowOnlyYes) => {
      const newShowOnlyYes = !prevShowOnlyYes;
      const filterQuery = 'controlRodInsertion:"yes"';
      let newQueryText = queryText;

      if (newShowOnlyYes) {
        // Add filterQuery if not present
        if (!newQueryText.includes(filterQuery)) {
          newQueryText += ` ${filterQuery}`;
        }
      } else {
        // Remove filterQuery if present
        newQueryText = newQueryText.replace(new RegExp(`\\b${filterQuery}\\b`, "g"), "").trim();
      }

      setQueryText(newQueryText);
      return newShowOnlyYes;
    });
  };
  const toggleFilter = (currentQueryText: string, filterToToggle: Filter): string => {
    const filterRegex = new RegExp(`${filterToToggle.key}:"${filterToToggle.value}"`, "g");
    if (currentQueryText.match(filterRegex)) {
      // Remove filter
      return currentQueryText.replace(filterRegex, "").trim();
    } else {
      // Add filter
      return `${currentQueryText} ${filterToToggle.key}:"${filterToToggle.value}"`.trim();
    }
  };
  const updateQueryTextWithToggleFilter = (currentQuery: string, toggleState: boolean, filterCriteria: string) => {
    const filterRegex = new RegExp(`\\b${filterCriteria}\\b`, "g");
    let newQuery = currentQuery;

    if (toggleState) {
      if (!currentQuery.includes(filterCriteria)) {
        newQuery += ` ${filterCriteria}`;
      }
    } else {
      newQuery = newQuery.replace(filterRegex, "").trim();
    }

    return newQuery;
  };

  const removeFilterFromQuery = (query: string, field: string, value: string): string => {
    const regex = new RegExp(`${field}:${value}`, "g");
    return query.replace(regex, "").trim();
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  // Search bar onChange handler
  const onSearchChange = (e: { target: { value: any } }) => {
    const newQuery = e.target.value;
    setQueryText(newQuery);
    // Additional logic to filter data based on the search query
    // ...
  };
  // Function to filter data based on query text
  const filterDataBasedOnQuery = useCallback(
    (query: string) => {
      // If query is empty or only contains white space, show all items
      if (!query.trim()) {
        setFilteredItems(data);
      } else {
        // Otherwise, parse the filters and apply them
        const filterPattern = /\b(\w+):"([^"]*)"/g;
        let match;
        let filteredData = [...data]; // Start with all items

        while ((match = filterPattern.exec(query)) !== null) {
          // Apply each filter to the data
          const [_, key, value] = match; // eslint-disable-line no-unused-vars
          filteredData = filteredData.filter((item) => item[key] === value);
        }

        // After all filters are applied, update the state
        setFilteredItems(filteredData);
      }
    },
    [data], // Depend on the full dataset
  );

  const [isColumnEditModalVisible, setIsColumnEditModalVisible] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Function to open the edit column modal
  const openEditColumnModal = useCallback(
    (columnId: string) => {
      const column = [...baseColumns, ...customColumns].find((col) => col.id === columnId);
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
          updateColumnType(newColumnData.id, newColumnData.columnType as ColumnType);

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
  const [operatingStateId, setOperatingStateId] = useState(1712820576964);

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

  // const handleCreateColumn = () => {
  //   if (!newColumnData.id && !newColumnData.displayAsText) {
  //     console.error("Both Column ID and Display Text are required.");
  //     return;
  //   }

  //   // Make sure that inputType is assigned a value from ColumnType or is undefined
  //   const inputType = newColumnData.columnType as ColumnType | undefined;

  //   const newColumn: CustomColumn = {
  //     id: newColumnData.id.trim(),
  //     displayAsText: newColumnData.displayAsText.trim(),
  //     inputType: inputType, // Ensure this matches the expected type
  //     // Only include dropdownOptions if inputType is 'dropdown'
  //     ...(inputType === "dropdown" && {
  //       dropdownOptions: newColumnData.dropdownOptions,
  //     }),
  //   };

  //   setCustomColumns((prevColumns) => [...prevColumns, newColumn]);
  //   // closeSidePanel();
  // };
  // const handleCreateColumn = async () => {
  //   if (!newColumnData.id || !newColumnData.displayAsText) {
  //     console.error("Both Column ID and Display Text are required.");
  //     return;
  //   }

  //   const columnData = {
  //     name: newColumnData.displayAsText.trim(),
  //     type: newColumnData.columnType,
  //     dropdownOptions: newColumnData.dropdownOptions || [],
  //   };

  //   try {
  //     const response = await fetch(
  //       "http://localhost:4200/api/operating-state-analysis/operating-states/columns",
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify(columnData),
  //       },
  //     );

  //     if (!response.ok) {
  //       throw new Error(`HTTP error, status = ${response.status}`);
  //     }

  //     const responseData = await response.json();
  //     console.log("Column added successfully", responseData);
  //     setCustomColumns((prev) => [
  //       ...prev,
  //       {
  //         // ...responseData
  //         id: responseData.id, // make sure backend returns id

  //         // id: responseData.addedColumn.id || newColumnData.id, // Adjust according to actual response structure

  //         displayAsText: responseData.name, // Ensure 'displayAsText' is assigned if it's required and not provided by the backend.
  //         inputType: responseData.type, // You may need to map the backend 'type' to your frontend 'inputType' if they differ.
  //         dropdownOptions: responseData.dropdownOptions || [], // Provide default empty array if not present.
  //       },
  //     ]);
  //     // Reset form fields
  //     setNewColumnData({
  //       id: "",
  //       displayAsText: "",
  //       columnType: "text",
  //       dropdownOptions: [],
  //     });
  //     // Assuming response data includes the new ID assigned by the backend
  //   } catch (error) {
  //     console.error("Failed to add column", error);
  //   }
  // };
  const handleCreateColumn = useCallback(async () => {
    if (!newColumnData.displayAsText.trim()) {
      setErrorMessage("Display text is required.");
      console.error("Display text is required.");
      return;
    }

    const columnData = {
      name: newColumnData.displayAsText.trim(),
      type: newColumnData.columnType,
      dropdownOptions: newColumnData.dropdownOptions || [],
    };

    try {
      const response = await fetch("http://localhost:4200/api/operating-state-analysis/operating-states/columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(columnData),
      });

      if (!response.ok) {
        const responseData = await response.json();
        setErrorMessage(`Failed to add column: ${responseData.error || response.status}`);
        throw new Error(`HTTP error, status = ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Column added successfully", responseData);

      setCustomColumns((prev) => [
        ...prev,
        {
          // id: responseData.id, // ensure backend returns id
          // id: responseData.addedColumn.id || newColumnData.id, // Adjust according to actual response structure
          id: responseData.addedColumn.id, // Use the id returned from the backend
          displayAsText: responseData.addedColumn?.name || "",
          inputType: responseData.addedColumn?.type,
          dropdownOptions: responseData.addedColumn?.dropdownOptions || [],
        },
      ]);
      setErrorMessage(""); // Clear error on successful operation

      // resetNewColumnForm();
    } catch (error) {
      console.error("Failed to add column", error);
    }
  }, [newColumnData, setCustomColumns]); // Include dependencies here
  useEffect(() => {
    const fetchGridData = async () => {
      try {
        // Endpoint to fetch grid configuration (columns)
        const configResponse = await fetch(
          "http://localhost:4200/api/operating-state-analysis/operating-states/columns",
        );
        if (!configResponse.ok) throw new Error("Failed to fetch grid configuration");
        const columns: Column[] = await configResponse.json();

        // Endpoint to fetch row data
        const dataResponse = await fetch("http://localhost:4200/api/operating-state-analysis/operating-states");
        if (!dataResponse.ok) throw new Error("Failed to fetch grid data");
        const data = await dataResponse.json();

        // Update the state with fetched data
        setCustomColumns(
          columns.map((col: Column) => ({
            id: col.id,
            displayAsText: col.name,
            inputType: col.type,
            dropdownOptions: col.dropdownOptions || [],
          })),
        );

        setData(data);
      } catch (error) {
        console.error("Error fetching grid data:", error);
      }
    };

    fetchGridData();
  }, []); // Empty dependency array to ensure this runs only once on mount
  useEffect(() => {
    console.log("Columns have been updated:", customColumns);
    // Any other actions that should occur when columns update
  }, [customColumns]); // Runs every time customColumns changes

  // Assuming handleColumnTypeChange is correctly setting the columnType and handling dropdown options:
  const handleColumnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const columnType = e.target.value as ColumnType;
    setNewColumnData((prev) => ({
      ...prev,
      columnType: columnType,
      dropdownOptions: columnType === "dropdown" ? [{ value: "", text: "Please select an option" }] : [],
    }));
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState<DataRow | null>(null);
  const [isNewColumnModalVisible, setIsNewColumnModalVisible] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState([{ value: "", text: "" }]);
  const [selectedColumnType, setSelectedColumnType] = useState<ColumnType>("text");

  // const handleColumnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //   const columnType = e.target.value as ColumnType;
  //   setSelectedColumnType(columnType);
  //   if (columnType === "dropdown") {
  //     // Initialize with one default option when "Dropdown" is selected
  //     setNewColumnData((prev) => ({
  //       ...prev,
  //       columnType,
  //       dropdownOptions: [{ value: "", text: "" }],
  //     }));
  //   } else {
  //     // Clear options for non-dropdown types
  //     setNewColumnData((prev) => ({
  //       ...prev,
  //       columnType,
  //       dropdownOptions: [],
  //     }));
  //   }
  // };
  //This function manages both selectedRowData and data states for change in sidePanel to reflect in Datagrid
  // const updateFieldInData = (
  //   fieldKey: keyof DataRow,
  //   value: string | number,
  // ) => {
  //   if (!selectedRowData) return;

  //   // Find the custom column to check its previous type
  //   const customColumn = customColumns.find((col) => col.id === fieldKey);

  //   // If the new type is text and the previous type was dropdown, reset the value
  //   const newValue =
  //     customColumn &&
  //     customColumn.previousType === "dropdown" &&
  //     customColumn.inputType === "text"
  //       ? "" // Set to empty string if previous type was dropdown
  //       : value;

  //   const updatedSelectedRowData = { ...selectedRowData, [fieldKey]: newValue };
  //   setSelectedRowData(updatedSelectedRowData);

  //   setData((prevData) =>
  //     prevData.map((row) =>
  //       row.id === selectedRowData.id ? updatedSelectedRowData : row,
  //     ),
  //   );
  // };
  // This function manages both selectedRowData and data states for change in sidePanel to reflect in Datagrid
  const updateFieldInData = async (fieldKey: keyof DataRow, value: string | number) => {
    if (!selectedRowData) return;

    // Find the custom column to check its previous type
    const customColumn = customColumns.find((col) => col.id === fieldKey);

    // If the new type is text and the previous type was dropdown, reset the value
    const newValue =
      customColumn && customColumn.previousType === "dropdown" && customColumn.inputType === "text"
        ? "" // Set to empty string if previous type was dropdown
        : value;

    const updatedSelectedRowData = { ...selectedRowData, [fieldKey]: newValue };

    // Update data on the server
    try {
      const response = await OperatingStateAnalysisApiManager.updateOperatingState(
        selectedRowData.id.toString(),
        updatedSelectedRowData,
      );
      console.log("Server update successful:", response);

      // Update local state only if server update is successful
      setSelectedRowData(updatedSelectedRowData);

      setData((prevData) => prevData.map((row) => (row.id === selectedRowData.id ? updatedSelectedRowData : row)));
    } catch (error) {
      console.error("Failed to update data on server:", error);
      // Optionally handle errors, e.g., by showing an error message to the user
    }
  };

  const handleAddDropdownOption = () => {
    setNewColumnData((prev) => ({
      ...prev,
      dropdownOptions: [...prev.dropdownOptions, { value: "", text: "" }],
    }));
  };
  // Function to handle changing dropdown option values
  const handleDropdownOptionChange = (index: number, key: string, value: string) => {
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
    displayAsText: "",
    columnType: "text",
  });
  const renderDropdownOptions = () => {
    return (
      newColumnData.dropdownOptions &&
      (newColumnData.dropdownOptions as DropdownOption[]).map((option, index) => (
        <div key={index}>
          <EuiFieldText
            placeholder="Option text"
            value={option.text}
            onChange={(e) => handleDropdownOptionChange(index, "text", e.target.value)}
          />
          <EuiFieldText
            placeholder="Option value"
            value={option.value}
            onChange={(e) => handleDropdownOptionChange(index, "value", e.target.value)}
          />
          <EuiButtonIcon
            iconType="minusInCircle"
            onClick={() => handleRemoveDropdownOption(index)}
            aria-label="Remove dropdown option"
          />
        </div>
      ))
    );
  };
  // const handleAddNewColumn = () => {
  //   // we are making sure that new column has an ID and a display text
  //   if (!newColumnDetails.id || !newColumnDetails.displayAsText) {
  //     console.error("Both Column ID and Display Text are required.");
  //     return;
  //   }
  //   // Omit the delete column from being added again
  //   if (newColumnDetails.id === "delete") {
  //     console.error(
  //       "The 'delete' column ID is reserved and cannot be used for new columns.",
  //     );
  //     return;
  //   }

  //   // Prepare the new column configuration
  //   const newColumnConfig = {
  //     id: newColumnDetails.id.trim(),
  //     displayAsText: newColumnDetails.displayAsText.trim(),
  //     columnType: selectedColumnType,
  //     // here Include dropdown options if the column type is 'dropdown'
  //     ...(selectedColumnType === "dropdown" && {
  //       dropdownOptions: dropdownOptions.filter(
  //         (option) => option.value && option.text,
  //       ),
  //     }),
  //   };

  //   // Temporarily remove the delete column
  //   setCustomColumns((prevColumns) => {
  //     const filteredColumns = prevColumns.filter(
  //       (column) => column.id !== "delete",
  //     );
  //     // Add the new column and then re-add the delete column at the end
  //     return [
  //       ...filteredColumns,
  //       newColumnConfig,
  //       {
  //         id: "delete",
  //         displayAsText: "",
  //         // ... any other properties for the delete column
  //       },
  //     ];
  //   });

  //   // // Add the new column config to the grid, without adding a new delete column
  //   // setCustomColumns((prevColumns) => {
  //   //   // First, remove the existing delete column if it is present
  //   //   const columnsWithoutDelete = prevColumns.filter(
  //   //     (column) => column.id !== "delete",
  //   //   );
  //   //   // Then, add the new column configuration
  //   //   return [...columnsWithoutDelete, newColumnConfig];
  //   // });

  //   // Add the new column config to the grid
  //   // setCustomColumns((prevColumns) => [...prevColumns, newColumnConfig]);

  //   // Reset the modal form state and close the modal
  //   // Ensure that each row has a default value for the new column
  //   setData((prevData) =>
  //     prevData.map((row) => ({
  //       ...row,
  //       [newColumnConfig.id]: getDefaultColumnValue(newColumnConfig),
  //     })),
  //   );

  //   resetNewColumnForm();

  //   // setNewColumnDetails({ id: "", displayAsText: "", columnType: "text" });
  //   // setSelectedColumnType("text"); // or your default column type
  //   // setDropdownOptions([{ value: "", text: "" }]);
  //   // setIsNewColumnModalVisible(false);
  // };
  const handleAddNewColumn = () => {
    // Clear previous errors
    setShowError(false);
    setErrorMessage("");

    // Ensure the Display As text is provided and unique
    if (!newColumnDetails.displayAsText.trim()) {
      setErrorMessage("Display As text is required.");
      setShowError(true);
      console.error("Display As text is required.");
      return;
    }

    // Check for uniqueness of the displayAsText
    if (customColumns.some((column) => column.displayAsText.trim() === newColumnDetails.displayAsText.trim())) {
      setErrorMessage("A column with this display text already exists.");
      console.error("A column with this display text already exists.");
      setShowError(true);

      return;
    }

    // Prepare the new column configuration
    const newColumnConfig = {
      id: newColumnDetails.displayAsText.trim(), // Use displayAsText as the unique ID
      displayAsText: newColumnDetails.displayAsText.trim(),
      columnType: selectedColumnType,
      ...(selectedColumnType === "dropdown" && {
        dropdownOptions: dropdownOptions.filter((option) => option.value && option.text),
      }),
    };

    // Add the new column to the grid and update existing data rows with default values for this new column
    setCustomColumns((prevColumns) => [...prevColumns, newColumnConfig]);
    setData((prevData) =>
      prevData.map((row) => ({
        ...row,
        [newColumnConfig.id]: getDefaultColumnValue(newColumnConfig),
      })),
    );

    resetNewColumnForm();
  };
  const getDefaultColumnValue = (column: CustomColumn) => {
    if (column.inputType === "dropdown" && column.dropdownOptions && column.dropdownOptions.length > 0) {
      return column.dropdownOptions[0].value;
    }
    return ""; // Default value for text or other types
  };

  const resetNewColumnForm = () => {
    setNewColumnDetails({ displayAsText: "", columnType: "text" });
    setSelectedColumnType("text");
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
  const renderDetailsButton = ({ rowIndex, columnId }: { rowIndex: number; columnId: string }) => {
    const rowData = data[rowIndex];
    return (
      <EuiButtonIcon
        iconType="inspect"
        onClick={() => {
          setSelectedRowData(rowData); // Update the state with the details of the selected row
          setIsSidePanelOpen(true); // Open the side panel
        }}
        aria-label="View details"
      />
    );
  };
  //state for selecting rows
  const [selectedRowIds, setSelectedRowIds] = useState(new Set<number>());
  // state for checking symbol for checkboxes
  const [checked, setChecked] = useState(false);
  // const handleRowSelectionChange = useCallback((rowId: number) => {
  //   const rowExists = data.some((row) => row.id === rowId);
  //   if (!rowExists) {
  //     console.error(
  //       "Attempted to toggle selection on non-existent row with id",
  //       rowId,
  //     );
  //     return;
  //   }
  //   setSelectedRowIds((prevSelectedRowIds) => {
  //     const newSelectedRowIds = new Set(prevSelectedRowIds);
  //     if (newSelectedRowIds.has(rowId)) {
  //       newSelectedRowIds.delete(rowId);
  //     } else {
  //       newSelectedRowIds.add(rowId);
  //     }
  //     console.log("In setSelectedRowId");
  //     console.log(newSelectedRowIds);
  //     localStorage.setItem(
  //       "selectedRowIds",
  //       JSON.stringify([...newSelectedRowIds]),
  //     );
  //     return newSelectedRowIds;
  //   });
  // }, []);
  const handleRowSelectionChange = useCallback((rowId: number) => {
    const rowExists = data.some((row) => row.id === rowId);
    if (!rowExists) {
      console.error("Attempted to toggle selection on non-existent row with id", rowId);
      return;
    }
    setSelectedRowIds((prevSelectedRowIds) => {
      // Create a new Set to avoid direct mutations which React state should avoid
      const newSelectedRowIds = new Set(prevSelectedRowIds);

      // Toggle the selection state for the rowId
      if (newSelectedRowIds.has(rowId)) {
        newSelectedRowIds.delete(rowId);
      } else {
        newSelectedRowIds.add(rowId);
      }

      // Update localStorage with the new selection state
      localStorage.setItem("selectedRowIds", JSON.stringify([...newSelectedRowIds]));

      // Log the change, if needed for debugging
      console.log("Selected Row IDs:", newSelectedRowIds);

      return newSelectedRowIds;
    });
  }, []);

  // const handleDeleteSelectedRows = useCallback(() => {
  //   setData((prevData) =>
  //     prevData.filter((row) => !selectedRowIds.has(row.id)),
  //   );
  //   // Also delete from the filtered data set
  //   setFilteredItems((prevFilteredItems) =>
  //     prevFilteredItems.filter((row) => !selectedRowIds.has(row.id)),
  //   );
  //   setSelectedRowIds(new Set()); // Clear selection after deletion
  //   setSelectedRowData(null); // Add this line to clear selected row data
  // }, [selectedRowIds]);
  const handleDeleteSelectedRows = useCallback(async () => {
    try {
      for (let id of selectedRowIds) {
        await OperatingStateAnalysisApiManager.deleteOperatingState(id.toString());
      }
      setData((prevData) => prevData.filter((row) => !selectedRowIds.has(row.id)));
      setFilteredItems((prevFilteredItems) => prevFilteredItems.filter((row) => !selectedRowIds.has(row.id)));
      setSelectedRowIds(new Set()); // Clear selection after deletion
      setSelectedRowData(null); // Clear selected row data
    } catch (error) {
      console.error("Failed to delete rows:", error);
    }
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

    // Checkbox column for row selection
    const selectColumn = {
      id: "select",
      displayAsText: "", // No header text for the selection column
      // Custom render for the cell to show a checkbox
      cellRenderer: ({ rowIndex }: EuiDataGridCellValueElementProps) => {
        const row = filteredItems[rowIndex];

        if (!row) {
          console.error("Row data is undefined at index", rowIndex);
          return null; // render nothing or some fallback UI
        }
        const rowId = row.id;
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
    const filteredBaseColumns = baseColumns.filter((column) => column.id !== "details");
    const filteredCustomColumns = customColumns.filter((column) => column.id !== "details");

    // Combine and deduplicate the base and custom columns, exclude 'delete' column logic
    let combinedColumns = [selectColumn, ...filteredBaseColumns, ...filteredCustomColumns].reduce<CustomColumn[]>(
      (acc, current) => {
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
      },
      [],
    );

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
  }, [
    baseColumns,
    customColumns,
    openEditColumnModal,
    renderDetailsButton,
    selectedRowIds,
    handleRowSelectionChange,
    data,
    filteredItems,
  ]);

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
  const [visibleColumns, setVisibleColumns] = useState(getMergedColumns.map((column) => column.id));
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
      // id: newColumnDetails.id,
      displayAsText: newColumnDetails.displayAsText,
      columnType: newColumnDetails.columnType,
      // If it's a dropdown, you would handle dropdownOptions similarly
    };

    // Add the new column to your grid columns state (this logic depends on your existing code)
    // ...

    // Reset the modal form state and close the modal
    setNewColumnDetails({ displayAsText: "", columnType: "text" });
    // Close modal logic goes here...
  };
  // When opening the modal to edit, make sure to set the editing cell state
  const openEditModal = (rowIndex: number, columnId: string) => {
    const rowData = data[rowIndex];
    setEditingCell({ rowIndex, columnId });
    setSelectedRowData(rowData);
    setIsModalVisible(true);
  };
  // Handler to change individual column configuration
  const handleChange = (id: string, key: keyof CustomColumn, value: string) => {
    // Update the state of a specific column's configuration
    setCustomColumns((prevColumns) =>
      prevColumns.map((column) => (column.id === id ? { ...column, [key]: value } : column)),
    );
  };

  // This function should be defined within your component where 'setCustomColumns' is available
  const onSave = (updatedColumns: React.SetStateAction<CustomColumn[]>) => {
    // Assuming 'setCustomColumns' is the state updater function for your custom columns
    setCustomColumns(updatedColumns);
  };

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
        // Add new row
        newData = [...currentData, editedData];
      }
      return newData;
    });
    setIsModalVisible(false);
  }, []);

  // Function to handle closing the modal
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  // Function to handle adding a new row
  const handleAddNewRow = () => {
    // Open the modal to add a new row
    const newRow = {
      id: Date.now(), // Unique ID for the new row
      definition: "",
      characteristics: "",
      processCriteriaIdentification: "",
      controlRodInsertion:
        customColumns.find((col) => col.id === "controlRodInsertion")?.dropdownOptions?.[0].value || "",
      feedwaterPump: customColumns.find((col) => col.id === "feedwaterPump")?.dropdownOptions?.[0].value || "",
      reactorCoolantCirculator:
        customColumns.find((col) => col.id === "reactorCoolantCirculator")?.dropdownOptions?.[0].value || "",
      others: customColumns.find((col) => col.id === "others")?.dropdownOptions?.[0].value || "",
    };

    setSelectedRowData(newRow);
    setIsModalVisible(true);
  };
  // const handleAddNewRow = () => {
  //   const newRow = {
  //     id: Date.now(), // Temp ID before backend assigns one
  //     definition: "",
  //     characteristics: "",
  //     processCriteriaIdentification: "",
  //     controlRodInsertion: "",
  //     feedwaterPump: "",
  //     reactorCoolantCirculator: "",
  //     others: "",
  //   };
  //   setSelectedRowData(newRow); // Preset data to be edited in modal
  //   setIsModalVisible(true); // Open modal to edit new state
  // };

  // const handleModalSubmit = () => {
  //   // Ensure selectedRowData is not null before proceeding
  //   if (selectedRowData) {
  //     // Check if we're adding a new row or editing an existing one
  //     const isNewRow = !data.find((row) => row.id === selectedRowData.id);

  //     if (isNewRow) {
  //       // Adding a new row
  //       const newRowData = { ...modalFormState, id: Date.now() }; // Ensure a unique ID for the new row
  //       setData((prevData) => [...prevData, newRowData]); // Append the new row to the existing data
  //     } else {
  //       // Editing an existing row
  //       setData((prevData) =>
  //         prevData.map((row) =>
  //           row.id === selectedRowData.id ? { ...row, ...modalFormState } : row,
  //         ),
  //       );
  //     }
  //   }
  //   setIsModalVisible(false);
  // };

  const handleModalSubmit = async () => {
    // Check if required fields are not filled. This assumes all fields must have meaningful input.
    const allFieldsFilled = Object.values(modalFormState).some((field) => {
      if (typeof field === "string") {
        return field.trim() !== ""; // Ensures no field is just empty or whitespace
      }
      return field != null; // Assuming non-string fields are dropdowns and always have valid pre-set values
    });

    if (!allFieldsFilled) {
      setErrorMessage("Error: All fields must be filled out.");
      console.error("Submission blocked: All fields must be filled out.");
      return; // Prevent submission if any field is empty
    }

    console.log("Submitting data:", modalFormState);

    try {
      const response = await createOperatingState(modalFormState);
      console.log("Operation successful:", response);
      handleCloseModal(); // Close modal on successful operation
      setErrorMessage(""); // Reset any error messages
    } catch (error) {
      console.error("Failed to submit data:", error);
      setErrorMessage("Failed to submit data. Please try again.");
    }
  };

  useEffect(() => {
    const loadOperatingStateAnalysis = async (): Promise<void> => {
      try {
        const res = await OperatingStateAnalysisApiManager.getOperatingStateById("1712820576964");
        console.log(res);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Handle not found or other errors here
      }
    };
    loadOperatingStateAnalysis();
  }, []);

  // const handleModalSubmit = async () => {
  //   if (!selectedRowData) {
  //     console.error("No data to save.");
  //     return;
  //   }

  //   // Create a new OperatingState object from selectedRowData
  //   const operatingStateData: OperatingState = {
  //      id: selectedRowData.id, // Assuming the backend expects a string ID
  //     definition: selectedRowData.definition,
  //     characteristics: selectedRowData.characteristics,
  //     processCriteriaIdentification: selectedRowData.processCriteriaIdentification,
  //     controlRodInsertion: selectedRowData.controlRodInsertion,
  //     feedwaterPump: selectedRowData.feedwaterPump,
  //     reactorCoolantCirculator: selectedRowData.reactorCoolantCirculator,
  //     others: selectedRowData.others,
  //     // id: 0
  //   };
  //   try {
  //     const savedRow =
  //       await OperatingStateAnalysisApiManager.storeOperatingStateAnalysis(
  //         operatingStateData,
  //       );
  //     setData((prevData) => [...prevData, savedRow as DataRow]);
  //     setIsModalVisible(false);
  //   } catch (error) {
  //     console.error("There was an error saving the row: ", error);
  //   }
  // };

  const handleCellEdit = useCallback((rowIndex: number, columnId: keyof DataRow, value: string) => {
    // Update the specific cell data within the row
    setData((currentData) => {
      const newData = [...currentData];
      newData[rowIndex] = { ...newData[rowIndex], [columnId]: value };
      return newData;
    });
  }, []);
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
      //const rowData = data[rowIndex];
      const rowData = filteredItems[rowIndex];

      const customColumn = [...baseColumns, ...customColumns].find((col) => col.id === columnId);
      const isEditing = isFullScreen && editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId;

      // const handleRowClick = () => {
      //   console.log("Row clicked: ", rowData);
      //   if (selectedRowData && rowData.id === selectedRowData.id) {
      //     setIsSidePanelOpen((isOpen) => !isOpen);
      //   } else {
      //     setSelectedRowData(rowData);
      //     setIsSidePanelOpen(true);
      //     // Update the URL when a row is selected
      //     window.history.pushState({}, "", `/operating-states/${rowData.id}`);
      //   }
      // };
      const handleRowClick = () => {
        console.log("Row clicked: ", rowData);
        if (selectedRowData && rowData.id === selectedRowData.id) {
          setIsSidePanelOpen((isOpen) => {
            if (isOpen) {
              // When closing, revert to base URL
              window.history.pushState({}, "", "http://localhost:4200/api/operating-state-analysis/operating-states");
            }
            return !isOpen;
          });
        } else {
          setSelectedRowData(rowData);
          setIsSidePanelOpen(true);
          // Update the URL when a new row is selected
          window.history.pushState(
            {},
            "",
            `http://localhost:4200/api/operating-state-analysis/operating-states/${rowData.id}`,
          );
        }
      };

      const handleValueChange = (value: string) => {
        // If the new type is text and the previous type was dropdown, set the value to empty string
        const newValue = customColumn?.previousType === "dropdown" && customColumn?.inputType === "text" ? "" : value;
        handleCellEdit(rowIndex, columnId, value);
        // Update side panel data as well if open
        if (isSidePanelOpen) {
          updateFieldInData(columnId, newValue);
        }
      };
      // Define a function to handle changes in dropdown selection
      const handleDropdownChange = (selectedValue: string) => {
        // This function will update the DataRow in the grid data state
        setFilteredItems((prevData) =>
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
            onChange={() => handleRowSelectionChange(rowId)}
            aria-label={`Select row ${rowId}`}
            onClick={(e) => e.stopPropagation()} // Prevent this click from bubbling up
          />
        );
      }

      // Common cell content rendering logic
      const renderCellContent = () => {
        // Custom rendering for different column types
        // If the column type has changed to text from dropdown, render an empty field
        if (isFullScreen && customColumn?.inputType === "text") {
          if (isEditing) {
            return (
              <div style={{ position: "relative" }}>
                <EuiFieldText
                  fullWidth
                  value={customColumn.previousType === "dropdown" ? "" : rowData[columnId]}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onBlur={() => setEditingCell(null)}
                />
              </div>
            );
          } else {
            // If not editing, render the cell normally with a double-click handler to enable editing
            return (
              <span onDoubleClick={() => setEditingCell({ rowIndex, columnId })}>
                {customColumn.previousType === "dropdown" ? "" : rowData[columnId]}
              </span>
            );
          }
        } else if (customColumn?.inputType === "dropdown") {
          return (
            <EuiSelect
              fullWidth
              options={customColumn.dropdownOptions}
              value={rowData[columnId]}
              onChange={(e) => handleDropdownChange(e.target.value)}
              // onBlur={() => setEditingCell(null)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        } else {
          return <span>{rowData[columnId]}</span>;
        }
      };

      return (
        <div
          onClick={handleRowClick}
          style={{ cursor: "pointer", height: "10px" }}
        >
          {renderCellContent()}
        </div>
      );
    },
    [
      isFullScreen,
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
      setData,
      filteredItems,
    ],
  );

  // ... rest of your component code

  // Form state for the modal fields
  const [modalFormState, setModalFormState] = useState<DataRow>(() => {
    const initialState: Partial<DataRow> = {};
    // Initialize dropdowns with the first available option
    customColumns.forEach((column) => {
      if (column.inputType === "dropdown" && column.dropdownOptions && column.dropdownOptions.length > 0) {
        initialState[column.id as keyof DataRow] = column.dropdownOptions[0].value;
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
  // const handleModalFormChange = (field: keyof DataRow, value: string) => {
  //   console.log(`Updating field ${field} to ${value}`); // Debugging output
  //   setModalFormState((prev) => {
  //     const updatedState = { ...prev, [field]: value };
  //     console.log(`New modal form state:`, updatedState); // Debugging output
  //     return updatedState;
  //   });
  // };
  // Update the form state when modal input fields change
  const handleModalFormChange = (field: keyof DataRow, value: string) => {
    // Trim the input and check if it's empty for non-dropdown fields
    const trimmedValue = value.trim();
    if (customColumns.find((column) => column.id === field)?.inputType !== "dropdown" && !trimmedValue) {
      console.error(`Invalid input for ${field}: Cannot be empty.`);
      return; // Prevent updating state if the field is empty
    }

    console.log(`Updating field ${field} to ${trimmedValue}`); // Debugging output
    setModalFormState((prev) => {
      const updatedState = { ...prev, [field]: trimmedValue };
      console.log(`New modal form state:`, updatedState); // Debugging output
      return updatedState;
    });
  };

  // Load the selected rows from localStorage when the component mounts
  useEffect(() => {
    const savedSelectedRowIds = localStorage.getItem("selectedRowIds");
    if (savedSelectedRowIds) {
      setSelectedRowIds(new Set(JSON.parse(savedSelectedRowIds)));
    }
  }, []);
  // Update full-screen state based on 'fullscreenchange' event
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
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

  const toggleControlRodInsertion = () => {
    setShowOnlyYes((prevShowOnlyYes) => {
      const newState = !prevShowOnlyYes;
      let newQueryText = updateQueryTextWithToggleFilter(queryText, newState, 'controlRodInsertion:"yes"');
      setQueryText(newQueryText);
      return newState;
    });
  };

  const toggleFeedwaterPump = () => {
    setShowOnlyFeedwaterPump((prevShowOnlyFeedwaterPump) => {
      const newState = !prevShowOnlyFeedwaterPump;
      let newQueryText = updateQueryTextWithToggleFilter(queryText, newState, 'feedwaterPump:"yes"');
      setQueryText(newQueryText);
      return newState;
    });
  };

  // Function to construct the query string from the current filter states
  const constructQueryString = () => {
    let parts = [];

    // If the toggle for 'controlRodInsertion' is on, add it to the query parts
    if (showOnlyYes) {
      parts.push('controlRodInsertion:"yes"');
    }

    // Always include the current search bar query (handles other filters like feedwaterPump)
    if (queryText) {
      parts.push(queryText);
    }

    // Join all parts of the query with a space (to form a valid query string)
    return parts.join(" ");
  };
  useEffect(() => {
    // Construct the query string from both the search bar and the toggle
    // const combinedQuery = constructQueryString();
    // Call the filter function with the combined query
    filterDataBasedOnQuery(queryText);
  }, [queryText, filterDataBasedOnQuery]);
  // This function renders buttons for active filters based on queryText
  const renderActiveFilterButtons = () => {
    const filters = [
      { key: 'controlRodInsertion:"yes"', label: "Control Rod Insertion: Yes" },
      { key: 'feedwaterPump:"yes"', label: "Feedwater Pump: Yes" },
    ];

    return filters
      .filter((filter) => queryText.includes(filter.key))
      .map((filter, index) => (
        <div
          key={index}
          style={{ display: "inline-block", marginRight: "10px" }}
        >
          {filter.label}
          <EuiButtonIcon
            iconType="cross"
            color="danger"
            onClick={() => removeFilter(filter.key)}
            aria-label={`Remove filter ${filter.label}`}
          />
        </div>
      ));
  };

  // Function to remove a specific filter from queryText
  // const removeFilter = (filterKey: string) => {
  //   setQueryText((currentQuery) => currentQuery.replace(filterKey, "").trim());
  // };

  // FilterTag component
  const FilterTag: React.FC<FilterTagProps> = ({ filter, onRemove }) => {
    return (
      <div style={{ display: "inline-block", marginRight: "10px" }}>
        {`${filter.key}: ${filter.value}`}
        <button
          onClick={onRemove}
          style={{ marginLeft: "5px" }}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    );
  };

  // const SearchBarWithFilterTags: React.FC<SearchBarWithFilterTagsProps> = ({
  //   queryText,
  //   setQueryText,
  //   activeFilters,
  //   removeFilter,
  //   showAddFilterModal,
  // }) => {
  //   // Function to handle the removal of the filter tag
  //   const handleRemoveFilter = (filterKey: string) => {
  //     removeFilter(filterKey);
  //     // Check if any active filters are left after removing this one
  //     if (Object.values(activeFilters).every((isActive) => !isActive)) {
  //       setShowSearchBar(false); // Hide search bar if no filters are active
  //     }
  //   };
  //   const shouldShowSearchBar =
  //     Object.values(activeFilters).some((isActive) => isActive) ||
  //     showSearchBar;

  //   // Convert the queryText into filter tags for display
  //   const filterTags = parseFiltersFromQueryText(queryText);

  //   // Check if there are any active filters
  //   const hasActiveFilters = filterTags.length > 0;

  //   return (
  //     shouldShowSearchBar && (
  //       <div
  //         style={{
  //           position: "relative",
  //           display: "flex",
  //           alignItems: "center",
  //           padding: "10px",
  //           border: "1px solid #ced4da",
  //           borderRadius: "4px",
  //           gap: "5px",
  //           flexWrap: "wrap",
  //         }}
  //       >
  //         {/* Render filter tags inside the input field */}
  //         {filterTags.map((filter, index) => (
  //           <div
  //             key={index}
  //             style={{
  //               background: "#0079B8",
  //               borderRadius: "3px",
  //               color: "white",
  //               padding: "2px 6px",
  //               display: "flex",
  //               alignItems: "center",
  //               fontSize: "0.8em",
  //             }}
  //           >
  //             {filter.key}:{filter.value}
  //             <button onClick={() => openDropdown(filter.key)}>+</button>
  //             {activeDropdownKey === filter.key && (
  //               <div>
  //                 <select
  //                   onChange={(e) =>
  //                     onDropdownFilterChange(filter.key, e.target.value)
  //                   }
  //                 >
  //                   {/* Generate options based on your filter values */}
  //                   {availableFilters
  //                     .filter((f) => f.key === filter.key)
  //                     .map((f) => (
  //                       <option key={f.value} value={f.value}>
  //                         {f.value}
  //                       </option>
  //                     ))}
  //                 </select>
  //               </div>
  //             )}
  //             {/* <button
  //               onClick={() => handleRemoveFilter(filter.key)}
  //               style={{
  //                 background: "transparent",
  //                 border: "none",
  //                 color: "white",
  //                 cursor: "pointer",
  //                 marginLeft: "5px",
  //               }}
  //             >
  //               ×
  //             </button> */}
  //           </div>
  //         ))}
  //         {/* <input
  //           type="text"
  //           // value={queryText}
  //           // onChange={(e) => setQueryText(e.target.value)}
  //           // placeholder="Search..."
  //           // style={{ flex: 1, border: "none", outline: "none" }}
  //         /> */}
  //         {/* Plus icon inside the search bar */}
  //         <button
  //           onClick={showAddFilterModal}
  //           style={{
  //             border: "none",
  //             background: "transparent",
  //             cursor: "pointer",
  //             color: "#0079B8",
  //           }}
  //         >
  //           +
  //         </button>
  //       </div>
  //     )
  //   );
  // };
  const SearchBarWithFilterTags: React.FC<SearchBarWithFilterTagsProps> = ({
    queryText,
    setQueryText,
    activeFilters,
    removeFilter,
    showAddFilterModal,
  }) => {
    const [activeDropdownKey, setActiveDropdownKey] = useState<string | null>(null);

    const openDropdown = (filterKey: string) => {
      setActiveDropdownKey(filterKey);
    };

    const onDropdownFilterChange = (filterKey: string, selectedValue: string) => {
      const regex = new RegExp(`\\b${filterKey}:"[^"]*"`, "g");
      const newQueryText = queryText.replace(regex, `${filterKey}:"${selectedValue}"`).trim();
      setQueryText(newQueryText);
      setActiveDropdownKey(null);
    };

    const handleRemoveFilter = (filterKey: string) => {
      // Update the query text to remove the filter
      setQueryText((currentQuery) => {
        // Remove the specific filter key from the query text
        const newQueryText = currentQuery
          .replace(new RegExp(`\\b${filterKey}:"[^"]*"`, "g"), "")
          .replace(/\s{2,}/g, " ")
          .trim();
        // Update the filtered items based on the new query text
        filterDataBasedOnQuery(newQueryText);
        return newQueryText;
      });
    };

    const filterTags = parseFiltersFromQueryText(queryText);

    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "10px",
          border: "1px solid #ced4da",
          borderRadius: "4px",
          gap: "5px",
          flexWrap: "wrap",
        }}
      >
        {filterTags.map((filter, index) => (
          <div
            key={index}
            style={{
              background: "#0079B8",
              borderRadius: "3px",
              color: "white",
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              fontSize: "0.8em",
            }}
          >
            {`${filter.key}: ${filter.value}`}
            <button onClick={() => openDropdown(filter.key)}>+</button>
            {activeDropdownKey === filter.key && (
              <select
                onChange={(e) => onDropdownFilterChange(filter.key, e.target.value)}
                value={filter.value}
              >
                {availableFilters
                  .filter((f) => f.key === filter.key)
                  .map((f) => (
                    <option
                      key={f.value}
                      value={f.value}
                    >
                      {f.value}
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={() => handleRemoveFilter(filter.key)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                marginLeft: "5px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={showAddFilterModal}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#0079B8",
          }}
        >
          +
        </button>
      </div>
    );
  };

  const FilterSelectionModal: React.FC<FilterSelectionModalProps> = ({
    isOpen,
    onClose,
    onAddFilter,
    availableFilters,
  }) => {
    const [selectedFilter, setSelectedFilter] = useState("");

    return (
      <EuiModal
        onClose={() => setIsAddFilterModalVisible(false)}
        style={{ width: "300px" }}
      >
        <EuiModalHeader>
          <EuiModalHeaderTitle>Add a Filter</EuiModalHeaderTitle>
        </EuiModalHeader>
        <EuiModalBody>
          <EuiSelect
            options={selectOptions}
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            aria-label="Select a filter"
          />
        </EuiModalBody>
        <EuiModalFooter>
          <EuiButtonEmpty onClick={onClose}>Cancel</EuiButtonEmpty>
          <EuiButton
            onClick={() => onAddFilter(selectedFilter)}
            fill
          >
            Add
          </EuiButton>
        </EuiModalFooter>
      </EuiModal>
    );
  };
  // Helper function to parse filters from the query text
  function parseFiltersFromQueryText(query: string): Filter[] {
    const filterPattern = /\b(\w+):"([^"]*)"/g;
    let match: RegExpExecArray | null;
    const filters: Filter[] = [];

    while ((match = filterPattern.exec(query)) !== null) {
      filters.push({ key: match[1], value: match[2].trim() });
    }

    return filters;
  }

  return (
    <div
      className="app-container"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <EuiResizableContainer style={{ flexGrow: "400px" }}>
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
                <br></br>

                <div>
                  Number of filtered items: {filteredItems.length}
                  {/* ... rest of your component */}
                </div>
                {/* Toggle Buttons Section */}
                <div>
                  <EuiButton onClick={toggleShowOnlyControlRodInsertion}>Control Rod Insertion Enabled</EuiButton>
                  &nbsp;&nbsp;&nbsp;
                  <EuiButton onClick={toggleShowOnlyFeedwaterPump}>Resolved Feedwater Pump</EuiButton>
                  <br></br>
                  <br></br>
                  {/* <br></br>
                  <br></br> */}
                  {showSearchBar ? (
                    <div>
                      <SearchBarWithFilterTags
                        queryText={queryText}
                        setQueryText={setQueryText}
                        activeFilters={activeFilters}
                        removeFilter={removeFilter}
                        showAddFilterModal={() => setIsAddFilterModalVisible(true)}
                        addFilter={addFilter}
                      />
                      <button onClick={toggleSearchBarVisibility}>
                        {Object.keys(activeFilters).length === 0 ? "Hide Search Bar" : "Adjust Filters"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={toggleSearchBarVisibility}>Show Search Bar</button>
                  )}
                  {/* {isAddFilterModalVisible && (
                    <FilterSelectionModal
                      isOpen={isAddFilterModalVisible}
                      onClose={() => setIsAddFilterModalVisible(false)}
                      availableFilters={availableFilters.map(
                        (filter) => filter.value,
                      )}
                      onAddFilter={addFilter}
                    />
                  )} */}
                  {/* Place your EuiDataGrid and other components here */}
                </div>
                {/* <EuiSearchBar
                  query={queryText}
                  onChange={onSearchChange}
                  box={{
                    placeholder: "Search...",
                    incremental: true,
                  }}
                /> */}
                {/* <SearchBarWithCancelButtons
                  query={queryText}
                  onQueryChange={handleQueryChange}
                  onRemoveFilter={handleRemoveFilter}
                /> */}

                {/* {error && (
                  <EuiCallOut title="Error" color="danger">
                    {error}
                  </EuiCallOut>
                )} */}
                {/* {showError && (
                  <EuiCallOut
                    title="Error"
                    color="danger"
                    iconType="alert"
                    size="s"
                    // onClose={() => setShowError(false)}

                    // onClose={dismissError}
                  >
                    <p>{errorMessage}</p>
                    <EuiButtonIcon
                      iconType="cross"
                      onClick={() => setShowError(false)}
                      aria-label="Close error message"
                      color="danger"
                    />
                  </EuiCallOut>
                )} */}
                <EuiSpacer size="m" />

                <EuiDataGrid
                  aria-label="Data grid for Operating State Analysis"
                  // className="hideColumnHeaders" // This is how you apply the CSS module class
                  columns={getMergedColumns}
                  // rowCount={data.length}
                  rowCount={filteredItems.length}
                  renderCellValue={renderCellValue}
                  columnVisibility={{
                    visibleColumns: visibleColumns,
                    setVisibleColumns: setVisibleColumns,
                  }}
                  style={{ height: "100%" }}
                  toolbarVisibility={{
                    showFullScreenSelector: true,
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
                              {/* <EuiFormRow label="Column ID">
                                <EuiFieldText
                                  value={newColumnData.id}
                                  onChange={(e) =>
                                    setNewColumnData({
                                      ...newColumnData,
                                      id: e.target.value,
                                    })
                                  }
                                />
                              </EuiFormRow> */}
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
                              <EuiButton onClick={handleCreateColumn}>Create Column</EuiButton>
                            </EuiForm>
                          </div>

                          {newColumnData.columnType === "dropdown" && (
                            <React.Fragment>
                              {newColumnData.dropdownOptions.map((option, index) => (
                                <div key={index}>
                                  <EuiFormRow label={`Option ${index + 1} Text`}>
                                    <EuiFieldText
                                      value={option.text}
                                      onChange={(e) => handleDropdownOptionChange(index, "text", e.target.value)}
                                    />
                                  </EuiFormRow>
                                  <EuiFormRow label={`Option ${index + 1} Value`}>
                                    <EuiFieldText
                                      value={option.value}
                                      onChange={(e) => handleDropdownOptionChange(index, "value", e.target.value)}
                                    />
                                  </EuiFormRow>
                                  <EuiButtonIcon
                                    iconType="minusInCircle"
                                    onClick={() => handleRemoveDropdownOption(index)}
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
                />
                {/* {isNewColumnModalVisible && (
                  <EuiModal onClose={() => setIsNewColumnModalVisible(false)}>
                    <EuiModalHeader>
                      <EuiModalHeaderTitle>Add New Column</EuiModalHeaderTitle>
                    </EuiModalHeader>
                    <EuiModalBody>
                      <EuiForm>
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
                        </EuiFormRow> */}
                {/* <EuiFormRow label="Display As">
                          <EuiFieldText
                            value={newColumnDetails.displayAsText}
                            onChange={(e) =>
                              setNewColumnDetails({
                                ...newColumnDetails,
                                displayAsText: e.target.value,
                              })
                            }
                          />
                        </EuiFormRow> */}
                {/* <EuiFormRow label="Column Type">
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
                )} */}
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
                          <EuiFieldText
                            value={newColumnData.id}
                            disabled
                          />
                        </EuiFormRow>
                        <EuiFormRow label="Column Heading">
                          <EuiFieldText
                            value={newColumnData.displayAsText}
                            onChange={(e) => handleEditColumnChange(e, "displayAsText")}
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
                            onChange={(e) => handleEditColumnChange(e, "columnType")}
                          />
                        </EuiFormRow>
                        {/* Dropdown options go here if columnType is 'dropdown' */}
                        {/* ... */}
                      </EuiForm>
                    </EuiModalBody>
                    <EuiModalFooter>
                      <EuiButton onClick={() => setIsColumnEditModalVisible(false)}>Cancel</EuiButton>
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
                      {errorMessage && <div style={{ color: "red", marginBottom: "10px" }}>{errorMessage}</div>}
                      <EuiForm component="form">
                        {
                          // Dynamically create form fields for all columns
                          getMergedColumns.map((column) => {
                            const customColumn = column as CustomColumn;
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
                                      options={customColumn.dropdownOptions || []}
                                      value={modalFormState[column.id]}
                                      onChange={(e) => handleModalFormChange(column.id, e.target.value)}
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
                                      onChange={(e) => handleModalFormChange(column.id, e.target.value)}
                                    />
                                  </EuiFormRow>
                                );
                              }
                            }
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
              minSize="300px"
              // color="plain"
              // hasShadow
              borderRadius="m"
              wrapperPadding="m"
              tabIndex={0}
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
                      const customColumn = column as CustomColumn;
                      // Determine the value to display in the input field
                      let valueForField = selectedRowData[customColumn.id] || "";
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
                              options={customColumn.dropdownOptions || []}
                              value={valueForField}
                              onChange={(e) => updateFieldInData(customColumn.id as keyof DataRow, e.target.value)}
                            />
                          ) : (
                            <EuiFieldText
                              value={valueForField}
                              onChange={(e) => updateFieldInData(customColumn.id as keyof DataRow, e.target.value)}
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
                  // Set the URL back to the base URL when the side panel is closed
                  window.history.pushState(
                    {},
                    "",
                    "http://localhost:4200/api/operating-state-analysis/operating-states",
                  );
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

export function OperatingStateAnalysis1(): JSX.Element {
  return (
    <>
      <App />
    </>
  );
}
function OperatingStateAnalysis() {
  return (
    <Routes>
      <Route
        path=""
        element={<OperatingStateAnalysisList />}
      />
      <Route
        path=":operatingStateAnalysisId"
        element={<OperatingStateAnalysis1 />}
      />
    </Routes>
  );
}
export { OperatingStateAnalysis };

//export default App;
