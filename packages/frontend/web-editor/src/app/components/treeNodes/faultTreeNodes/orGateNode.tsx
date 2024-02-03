import React, {memo} from 'react';
import {Handle, Position, NodeProps} from 'reactflow';
import cx from 'classnames';

import styles from './styles/nodeTypes.module.css';
import useNodeDoubleClick from "../../../hooks/faultTree/useNodeDoubleClick";
import {NodeTypes} from "../eventSequenceNodes/icons/interfaces/nodeProps";
import {NodeIcon} from "../eventSequenceNodes/icons/nodeIcon";

/**
 * Or Gate Node
 * @param id Node identifier
 * @param data Data that the node holds
 * @returns OrGateNode JSX Element
 */
const OrGateNode = ({id, data}: NodeProps) => {

  const {handleNodeDoubleClick} = useNodeDoubleClick(id);
  return (
    <div data-testid={"or-gate-node"} className={styles.node_container} onDoubleClick={handleNodeDoubleClick}>
      <div className={cx(styles.node)} title="double click to add a basic event">
        {"OR Gate"}

        <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false}/>
        <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false}/>
      </div>
      <NodeIcon nodeType={NodeTypes.OrGate}
                iconProps={{width: "30px", height: "100%", viewBox: "109.34 8.5 234.19 193.67"}}/>
    </div>
  );
};

export default memo(OrGateNode);
