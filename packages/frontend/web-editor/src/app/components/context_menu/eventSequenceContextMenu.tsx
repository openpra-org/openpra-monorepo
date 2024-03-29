import React, { useCallback } from "react";
import { EuiContextMenu, EuiIcon } from "@elastic/eui";
import { EuiContextMenuPanelDescriptor } from "@elastic/eui/src/components/context_menu";
import { EuiContextMenuPanelItemDescriptor } from "@elastic/eui/src/components/context_menu/context_menu";
import { useReactFlow, Node, NodeProps } from "reactflow";
import { useParams } from "react-router-dom";
import {
  EventSequenceNodeProps,
  EventSequenceNodeTypes,
} from "../treeNodes/eventSequenceNodes/eventSequenceNodeType";
import {
  DeleteEventSequenceNode,
  GetDefaultLabelOfNode,
  GetESToast,
  UpdateEventSequenceDiagram,
  UpdateEventSequenceNode,
} from "../../../utils/treeUtils";
import FunctionalNodeIcon from "../../../assets/images/nodeIcons/functionalNodeIcon.svg";
import DescriptionNodeIcon from "../../../assets/images/nodeIcons/descriptionNodeIcon.svg";
import IntermediateNodeIcon from "../../../assets/images/nodeIcons/intermediateNodeIcon.svg";
import EndStateNodeIcon from "../../../assets/images/nodeIcons/endStateNodeIcon.svg";
import TransferStateNodeIcon from "../../../assets/images/nodeIcons/transferStateNodeIcon.svg";
import UndevelopedNodeIcon from "../../../assets/images/nodeIcons/undevelopedNodeIcon.svg";
import { UseToastContext } from "../../providers/toastProvider";
import { EventSequenceContextMenuOptions } from "./interfaces/eventSequenceContextMenuOptions.interface";

/**
 * @public The context menu with different types of nodes of Event Sequence Diagram
 * @param EventSequenceContextMenuOptions - options to load the menu
 * @returns JSX Element
 */
function EventSequenceContextMenu({
  id,
  onClick,
  isDelete = false,
}: EventSequenceContextMenuOptions): JSX.Element {
  const { getNode, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { addToast } = UseToastContext();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };

  const onItemClick = useCallback(
    (id: NodeProps["id"], type: "delete" | EventSequenceNodeTypes) => {
      // we need the parent node object for positioning the new child node
      const parentNode:
        | Node<EventSequenceNodeProps, EventSequenceNodeTypes>
        | undefined = getNode(id) as
        | Node<EventSequenceNodeProps, EventSequenceNodeTypes>
        | undefined;
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      if (!parentNode) {
        return;
      }

      if (
        parentNode.data.isDeleted === true ||
        parentNode.data.tentative === true
      )
        return;

      // if the event is for delete node, handle it separately
      if (type === "delete") {
        const onDeleteState = DeleteEventSequenceNode(
          parentNode,
          currentNodes,
          currentEdges,
        );
        if (onDeleteState !== undefined) {
          setNodes(onDeleteState.updatedState.nodes);
          setEdges(onDeleteState.updatedState.edges);
          if (onDeleteState.syncState) {
            UpdateEventSequenceDiagram(
              eventSequenceId,
              onDeleteState.updatedSubgraph,
              onDeleteState.deletedSubgraph,
              onDeleteState.updatedState,
            );
          }
        }
        onClick && onClick();
        return;
      }

      // if the selected node type is already the current node's type, simply return
      if (parentNode.type === type) {
        addToast(
          GetESToast(
            "warning",
            "The selected node type is already the current node's type.",
          ),
        );
        return;
      }

      // change child nodes based on the updated type of node
      parentNode.type = type;
      parentNode.data.label = GetDefaultLabelOfNode(type);

      const state = UpdateEventSequenceNode(
        parentNode,
        currentNodes,
        currentEdges,
      );
      if (state !== undefined) {
        setNodes(state.updatedState.nodes);
        setEdges(state.updatedState.edges);
        if (state.syncState) {
          UpdateEventSequenceDiagram(
            eventSequenceId,
            state.updatedSubgraph,
            state.deletedSubgraph,
            state.updatedState,
          );
        }
      }
      onClick && onClick();
    },
    [
      addToast,
      eventSequenceId,
      getEdges,
      getNode,
      getNodes,
      onClick,
      setEdges,
      setNodes,
    ],
  );

  const basePanelItems: EuiContextMenuPanelItemDescriptor[] = [
    {
      name: "Update node type",
      icon: <EuiIcon type="wrench" size={"m"} color={"#0984e3"}></EuiIcon>,
      panel: 1,
    },
  ];
  if (isDelete) {
    basePanelItems.push({
      name: "Delete node",
      icon: <EuiIcon type="trash" size={"m"} color={"#0984e3"}></EuiIcon>,
      onClick: (): void => {
        onItemClick(id, "delete");
      },
    });
  }

  const panels: EuiContextMenuPanelDescriptor[] | undefined = [
    {
      id: 0,
      items: basePanelItems,
    },
    {
      id: 1,
      title: "Node Types",
      items: [
        {
          name: "Functional",
          icon: <EuiIcon type={FunctionalNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "functional");
          },
        },
        {
          name: "Description",
          icon: <EuiIcon type={DescriptionNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "description");
          },
        },
        {
          name: "Intermediate",
          icon: <EuiIcon type={IntermediateNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "intermediate");
          },
        },
        {
          name: "End State",
          icon: <EuiIcon type={EndStateNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "end");
          },
        },
        {
          name: "Transfer State",
          icon: <EuiIcon type={TransferStateNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "transfer");
          },
        },
        {
          name: "Undeveloped",
          icon: <EuiIcon type={UndevelopedNodeIcon} size={"l"}></EuiIcon>,
          onClick: (): void => {
            onItemClick(id, "undeveloped");
          },
        },
      ],
    },
  ];

  return <EuiContextMenu initialPanelId={0} panels={panels} size={"s"} />;
}
export { EventSequenceContextMenu };
