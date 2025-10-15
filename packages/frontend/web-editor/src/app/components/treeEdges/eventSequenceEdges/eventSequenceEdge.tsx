import { memo, MemoExoticComponent, useCallback, useEffect, useMemo, useState } from "react";
import { EdgeProps, getBezierPath, Edge, useReactFlow } from "reactflow";
import { EuiFieldText } from "@elastic/eui";
import cx from "classnames";
import { debounce } from "lodash";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import { UseEdgeClick } from "../../../hooks/eventSequence/useEdgeClick";
import { GetESToast } from "../../../../utils/treeUtils";
import { UseToastContext } from "../../../providers/toastProvider";
import styles from "./styles/edgeType.module.css";
import { EventSequenceEdgeProps } from "./eventSequenceEdgeType";

function EventSequenceEdge(type: string): MemoExoticComponent<React.ComponentType<EdgeProps<EventSequenceEdgeProps>>> {
  return memo(
    ({
      id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      style,
      markerEnd,
      data = {},
    }: EdgeProps<EventSequenceEdgeProps>): JSX.Element => {
      const { getEdges, setEdges } = useReactFlow();
      const onClick = UseEdgeClick(id);
      const stylesMap = styles as Record<string, string>;
      const [edgePath, edgeCenterX, edgeCenterY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      const [edgeLabel, setEdgeLabel] = useState(data.label ?? "");
      const { addToast } = UseToastContext();
      const updateHandler = useMemo(
        () =>
          debounce((newLabel: string): void => {
            setEdges(
              getEdges().map((n: Edge<EventSequenceEdgeProps>) => {
                if (n.id === id) {
                  n.data = { ...n.data, label: newLabel };
                }
                return n;
              }),
            );
            GraphApiManager.updateESLabel(id, newLabel, "edge")
              .then((r) => {
                if (!r) {
                  addToast(GetESToast("danger", "Something went wrong"));
                }
              })
              .catch(() => {
                addToast(GetESToast("danger", "Something went wrong"));
              });
          }, 500),
        [getEdges, id, setEdges, addToast],
      );

      useEffect((): (() => void) => {
        return () => {
          updateHandler.cancel();
        };
      }, [updateHandler]);
      const onEdgeLabelChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>): void => {
          const newLabel = e.target.value;
          setEdgeLabel(newLabel);
          updateHandler(newLabel);
        },
        [updateHandler],
      );
      const edgeLabelElement =
        type === "normal" ? (
          <span style={{ width: 0 }}></span>
        ) : (
          <foreignObject
            x={10}
            y={-10}
            width={40}
            height={30}
          >
            <EuiFieldText
              className={cx(stylesMap.edge_label)}
              placeholder="Label"
              value={edgeLabel}
              onChange={onEdgeLabelChange}
              compressed={true}
              disabled={data.tentative}
              title={edgeLabel}
            />
          </foreignObject>
        );
      const edgeBtn = (
        <g transform={`translate(${String(edgeCenterX)}, ${String(edgeCenterY)})`}>
          <rect
            onClick={onClick}
            x={-5}
            y={-5}
            width={10}
            ry={2}
            rx={2}
            height={10}
            className={stylesMap.edgeButton}
          />
          <text
            className={stylesMap.edgeButtonText}
            y={3}
            x={-3}
          >
            +
          </text>
          {edgeLabelElement}
        </g>
      );

      return (
        <>
          <path
            id={id}
            style={style}
            className={data.tentative ? stylesMap.placeholderPath : stylesMap.edgePath}
            d={edgePath}
            markerEnd={markerEnd}
          />
          {data.tentative ? <button style={{ width: 0 }} /> : edgeBtn}
        </>
      );
    },
  );
}

export { EventSequenceEdge };
