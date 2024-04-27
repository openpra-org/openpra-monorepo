import React, { useEffect, useState } from "react";
import {
  EuiButton,
  EuiListGroup,
  EuiListGroupItem,
  EuiPageTemplate,
} from "@elastic/eui";
import FmeaApiManager from "shared-types/src/lib/api/InitiatingEventsApiManager";
import { Route, Routes, useNavigate } from "react-router-dom";
import { EditableTable } from "./fmeaEditor";

interface ListItem {
  id: number; // Assuming IDs are numeric based on your data
  label: string;
}

const ClickableList: React.FC<{ items: ListItem[] }> = ({ items }) => {
  const navigate = useNavigate();
  return (
    <EuiListGroup flush gutterSize="s">
      {items.map((item) => (
        <EuiListGroupItem
          key={item.id}
          label={`${item.label}`}
          onClick={() => {
            navigate(`${item.id}`);
          }}
          aria-label={`Click to view details for ${item.label}`}
        />
      ))}
    </EuiListGroup>
  );
};

function FMEAListView(): JSX.Element {
  const [listItems, setListItems] = useState<ListItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let response = await FmeaApiManager.getAllFmea(); // Make sure this function call matches your actual data fetching method
        if (response) {
          // Simulating response conversion
          const processedItems = response.map((item: any) => ({
            id: item.id,
            label: item.title || "No title provided", // Fallback for missing titles
          }));
          setListItems(processedItems);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <Routes>
      <Route
        path=""
        element={
          <EuiPageTemplate
            panelled={false}
            offset={48}
            grow={true}
            restrictWidth={true}
          >
            <EuiPageTemplate.Section>
              <EuiButton
                size={"s"}
                onClick={() => console.log("Create FMEA clicked")}
                style={{ margin: "10px" }}
              >
                Create FMEA
              </EuiButton>
              <ClickableList items={listItems} />
            </EuiPageTemplate.Section>
          </EuiPageTemplate>
        }
      />
      <Route path=":fmeaId" element={<EditableTable />} />
    </Routes>
  );
}

export { FMEAListView };
