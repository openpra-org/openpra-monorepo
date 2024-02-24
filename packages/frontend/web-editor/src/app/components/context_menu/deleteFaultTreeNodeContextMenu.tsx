import {
  EuiButton,
  EuiContextMenu,
  EuiForm,
  EuiIcon,
  EuiSpacer,
} from "@elastic/eui";
import { UseFaultTreeContextMenuClick } from "../../hooks/faultTree/useFaultTreeContextMenuClick";

const DeleteFaultTreeNodeContextMenu = (id: any) => {
  const { handleContextMenuClick } = UseFaultTreeContextMenuClick(id);
  // const onDeleteHandler = (id: number) => {
  //   () => handleContextMenuClick(id);
  // };
  const panels = [
    {
      id: 0,
      items: [
        {
          name: "Delete",
          icon: <EuiIcon type={"trash"}></EuiIcon>,
          panel: 1,
        },
      ],
    },
    {
      id: 1,
      title: "Delete",
      initialFocusedItem: 1,
      items: [
        {
          name: "Delete node",
        },
        {
          name: "Delete subtree",
        },
      ],
      // content: (
      //   <EuiForm>
      //     <EuiButton id={"delete"} onClick={handleContextMenuClick}>
      //       Delete node
      //     </EuiButton>
      //     <EuiSpacer />
      //     <EuiButton id={"basicEvent"} onClick={handleContextMenuClick}>
      //       Delete subtree
      //     </EuiButton>
      //   </EuiForm>
      // ),
    },
  ];

  return (
    <EuiContextMenu
      size={"m"}
      initialPanelId={0}
      panels={panels}
    ></EuiContextMenu>
  );
};

export default DeleteFaultTreeNodeContextMenu;
