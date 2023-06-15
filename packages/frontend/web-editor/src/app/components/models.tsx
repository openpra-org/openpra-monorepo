import { useState } from "react";
import ListOption from "./listitems/ListOption";
import ModelItem from "./listitems/ModelItem";
import { EuiButtonEmpty, EuiContextMenuPanel, EuiFlexGroup, EuiFlexItem, EuiPopover, EuiSpacer } from "@elastic/eui";


export function Models(): JSX.Element {
    return (
      <>
      {/** this is a EUiFlexGroup with a gutter to provide some space between objects, and it is surrounded by spacers as well
       * there are spacers location in the model items as well
       */}
        <EuiFlexGroup gutterSize="s">
          <EuiSpacer size="s" />
            <EuiFlexItem grow={true}>
              <EuiSpacer size="xs" />
              <ModelItem title="Title1" description="description" />
              <ModelItem title="Title1" description="description" />
              <ModelItem title="Title1" description="description" />
            </EuiFlexItem>
          <EuiSpacer size="s" />
        </EuiFlexGroup>
      </>
    )
}
