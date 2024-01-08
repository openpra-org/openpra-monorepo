import React, {memo} from 'react';
import {Handle, Position, NodeProps} from 'reactflow';
import cx from 'classnames';

import styles from './styles/nodeTypes.module.css';
import {NodeTypes} from "../eventSequenceNodes/icons/interfaces/nodeProps";
import {NodeIcon} from "../eventSequenceNodes/icons/nodeIcon";

/**
 * Transfer Gate Node
 * @param id Node identifier
 * @param data Data that the node holds
 * @returns AndGateNode JSX Element
 */
const TransferGateNode = ({id, data}: NodeProps) => {

  return (
    <div className={styles.node_container}>
      <div className={cx(styles.node)} title="click to add a child node">
        {"Transfer Gate"}

        <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false}/>
        <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false}/>
      </div>
      <NodeIcon nodeType={NodeTypes.TransferGate}
                iconProps={{width: "30px", height: "100%", viewBox: "14.4 15.4 71.2 70.2"}}/>
    </div>
  );
};

export default memo(TransferGateNode);
