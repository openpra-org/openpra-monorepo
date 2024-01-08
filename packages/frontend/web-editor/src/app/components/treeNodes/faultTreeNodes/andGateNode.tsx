import React, {memo} from 'react';
import {Handle, Position, NodeProps} from 'reactflow';
import cx from 'classnames';

import styles from './styles/nodeTypes.module.css';
import useNodeDoubleClick from "../../../hooks/faultTree/useNodeDoubleClick";
import {NodeIcon} from "../eventSequenceNodes/icons/nodeIcon";
import {NodeTypes} from "../eventSequenceNodes/icons/interfaces/nodeProps";

/**
 * And Gate Node
 * @param id Node identifier
 * @param data Data that the node holds
 * @returns AndGateNode JSX Element
 */
const AndGateNode = ({id, data}: NodeProps) => {
  const {handleNodeDoubleClick} = useNodeDoubleClick(id)
  return (
    <div className={styles.node_container} onDoubleClick={handleNodeDoubleClick}>
      <div className={cx(styles.node)} title="double click to add a basic event">
        {"AND Gate"}

        <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false}/>
        <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false}/>
      </div>
      <NodeIcon nodeType={NodeTypes.AndGate}
                iconProps={{width: "30px", height: "100%", viewBox: "135.61 4.76 137.82 120.94"}}/>
    </div>
  );
};

export default memo(AndGateNode);
