import React, { useCallback } from "react";
import { EuiIcon } from "@elastic/eui";
import { useReactFlow, Node, NodeProps } from "reactflow";
import { useParams } from "react-router-dom";
import { EventSequenceNodeProps, EventSequenceNodeTypes } from "../treeNodes/eventSequenceNodes/eventSequenceNodeType";
import {
  DeleteEventSequenceNode,
  GetChildCount,
  GetDefaultLabelOfNode,
  GetESToast,
  GetParentNode,
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
import { UseFocusContext } from "../../providers/focusProvider";
import { EventSequenceContextMenuOptions } from "./interfaces/eventSequenceContextMenuOptions.interface";
import { MenuPanel, MenuPanelItem, TypedContextMenu } from "./contextMenuTypes";

/**
 * @public The context menu with different types of nodes of Event Sequence Diagram
 * @param EventSequenceContextMenuOptions - options to load the menu
 * @returns JSX Element
 */
type EventSequenceMenuAction = "delete" | EventSequenceNodeTypes;

function EventSequenceContextMenu({ id, onClick, isDelete = false }: EventSequenceContextMenuOptions): JSX.Element {
  const { fitView, getNode, getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const { addToast } = UseToastContext();
  const { eventSequenceId } = useParams() as { eventSequenceId: string };
  const { setFocus } = UseFocusContext();

  const onItemClick = useCallback(
    (id: NodeProps["id"], type: EventSequenceMenuAction) => {
      // we need the parent node object for positioning the new child node
      const parentNode = getNode(id) as Node<EventSequenceNodeProps, EventSequenceNodeTypes> | undefined;
      // React Flow generics are not preserved at runtime; assert types once and keep subsequent usage strongly typed.
      const currentNodes = getNodes() as Node<EventSequenceNodeProps, EventSequenceNodeTypes>[];
      const currentEdges = getEdges();
      if (!parentNode) {
        return;
      }

      if (parentNode.type === undefined) {
        return;
      }

      if (parentNode.data.isDeleted === true || parentNode.data.tentative === true) return;

      // if the event is for delete node, handle it separately
      if (type === "delete") {
        if (parentNode.type === "functional") {
          fitView({
            nodes: [{ id: parentNode.id }],
            duration: 500,
            maxZoom: 1.6,
          });
        } else {
          setFocus(GetParentNode(parentNode, currentNodes, currentEdges).id);
        }
        const deleteState = DeleteEventSequenceNode(parentNode, currentNodes, currentEdges);
        if (deleteState) {
          const { updatedState, syncState, updatedSubgraph, deletedSubgraph } = deleteState;
          setNodes(updatedState.nodes as Node<EventSequenceNodeProps, EventSequenceNodeTypes>[]);
          setEdges(updatedState.edges);
          if (syncState) {
            UpdateEventSequenceDiagram(eventSequenceId, updatedSubgraph, deletedSubgraph)
              .then((r) => {
                if (!r) {
                  addToast(GetESToast("danger", "Something went wrong"));
                }
              })
              .catch(() => {
                addToast(GetESToast("danger", "Something went wrong"));
              });
          }
        }
        onClick && onClick();
        return;
      }

      // if the selected node type is already the current node's type, simply return
      if (parentNode.type === type) {
        addToast(GetESToast("warning", "The selected node type is already the current node's type."));
        return;
      }

      // change child nodes based on the updated type of node
      const childCount = GetChildCount(parentNode.type);
      const newChildCount = GetChildCount(type);
      parentNode.type = type;
      parentNode.data.label = GetDefaultLabelOfNode(type);

      const state = UpdateEventSequenceNode(parentNode, currentNodes, currentEdges);
      if (state) {
        const { updatedState, syncState, updatedSubgraph, deletedSubgraph } = state;
        setNodes(updatedState.nodes as Node<EventSequenceNodeProps, EventSequenceNodeTypes>[]);
        setEdges(updatedState.edges);
        if (syncState) {
          UpdateEventSequenceDiagram(eventSequenceId, updatedSubgraph, deletedSubgraph)
            .then((r) => {
              if (!r) {
                addToast(GetESToast("danger", "Something went wrong"));
              }
            })
            .catch(() => {
              addToast(GetESToast("danger", "Something went wrong"));
            });
        }
      }
      if (childCount === newChildCount) {
        fitView({
          nodes: [{ id: parentNode.id }],
          duration: 500,
          maxZoom: 1.6,
        });
      } else {
        setFocus(parentNode.id);
      }
      onClick && onClick();
    },
    [addToast, eventSequenceId, fitView, getEdges, getNode, getNodes, onClick, setEdges, setFocus, setNodes],
  );

  const basePanelItems: MenuPanelItem[] = [
    {
      name: "Update node type",
      icon: (
        <EuiIcon
          type="wrench"
          size={"m"}
          color={"#0984e3"}
        ></EuiIcon>
      ),
      panel: 1,
    },
  ];
  if (isDelete) {
    basePanelItems.push({
      name: "Delete node",
      icon: (
        <EuiIcon
          type="trash"
          size={"m"}
          color={"#0984e3"}
        ></EuiIcon>
      ),
      onClick: (): void => {
        onItemClick(id, "delete");
      },
    });
  }

  // Build panels as a readonly literal so item shapes remain inferred without any widening.
  const panels: readonly MenuPanel[] = [
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
          icon: (
            <EuiIcon
              type={FunctionalNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "functional");
          },
        },
        {
          name: "Description",
          icon: (
            <EuiIcon
              type={DescriptionNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "description");
          },
        },
        {
          name: "Intermediate",
          icon: (
            <EuiIcon
              type={IntermediateNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "intermediate");
          },
        },
        {
          name: "End State",
          icon: (
            <EuiIcon
              type={EndStateNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "end");
          },
        },
        {
          name: "Transfer State",
          icon: (
            <EuiIcon
              type={TransferStateNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "transfer");
          },
        },
        {
          name: "Undeveloped",
          icon: (
            <EuiIcon
              type={UndevelopedNodeIcon}
              size={"l"}
            ></EuiIcon>
          ),
          onClick: (): void => {
            onItemClick(id, "undeveloped");
          },
        },
      ],
    },
  ];

  return (
    <TypedContextMenu
      initialPanelId={0}
      panels={panels}
      size="s"
    />
  );
}
export { EventSequenceContextMenu };
