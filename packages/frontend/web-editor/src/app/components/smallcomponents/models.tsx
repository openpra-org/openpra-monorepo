import {EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";
import ModelItemsList from "../largecomponents/modelItemsList";

export function Models(): JSX.Element {
  return (
    <>
    {/** this is a EuiFlexGroup with a gutter to provide some space between objects, and it is surrounded by spacers as well
     * there are spacers location in the model items as well
     */}
      <EuiFlexGroup gutterSize="s">
        <EuiSpacer size="s" />
          <EuiFlexItem grow={true}>
            {/**this is the spacer that divides filter from the cards for items*/}
            <EuiSpacer size="s" />
            <ModelItemsList/>
          </EuiFlexItem>
        <EuiSpacer size="s" />
      </EuiFlexGroup>
    </>
  )
}
