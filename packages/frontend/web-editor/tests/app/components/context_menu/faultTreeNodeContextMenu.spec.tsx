import {test, expect} from "@playwright/experimental-ct-react"
import FaultTreeNodeContextMenu from "../../../../src/app/components/menus/faultTreeNodeContextMenu";
import {FaultTreeEditor} from "../../../../src/app/pages/fullScopePages/faultTrees";
import OrGateNode from "../../../../src/app/components/treeNodes/faultTreeNodes/orGateNode";

test.describe("fault tree context menu", () => {

  test("renders on screen", async ({mount, page}) => {

    const component = await mount(<OrGateNode id={""} data={undefined} selected={false} type={""} zIndex={0} isConnectable={false} xPos={0} yPos={0} dragging={false} />);
    await page.getByTestId("or-gate-node").dblclick();
    await expect(component).toBeHidden();
  })
})

