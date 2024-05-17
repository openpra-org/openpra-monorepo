import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import {
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPageTemplate,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTextColor,
  EuiTitle,
} from "@elastic/eui";

interface Item {
  id: number;
  name: string;
}

const items: Item[] = [
  { id: 1, name: "Item 1" },
  { id: 2, name: "Item 2" },
  // ... other items
];
type RouteParams = Record<string, string>;

const List: React.FC = () => {
  const params = useParams<RouteParams>();
  const [intiatingEventId, setIntiatingEventId] = useState("");
  useEffect(() => {
    setIntiatingEventId(params.intiatingEventId ? params.intiatingEventId : "");
  }, []);
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
    >
      <EuiPageTemplate.Section>
        <>
          <EuiTitle size="m">
            <h2>
              <EuiTextColor color="secondary">Initiators for Initiating Event ID: {intiatingEventId}</EuiTextColor>
            </h2>
          </EuiTitle>
          <EuiSpacer size="l" />

          <EuiFlexGroup
            direction="column"
            gutterSize="s"
          >
            {items.map((item) => (
              <EuiFlexItem key={`${item.id}`}>
                <EuiPanel>
                  <EuiFlexGroup
                    justifyContent="spaceBetween"
                    alignItems="center"
                  >
                    <EuiFlexItem grow={false}>
                      <EuiText>{item.name}</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <Link to={`${item.id}`}>
                        <EuiButton size="s">FMEA</EuiButton>
                      </Link>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
};

const InitiatorList: React.FC = () => (
  <Routes>
    <Route
      path=""
      element={<List />}
    />
  </Routes>
);

export default InitiatorList;
