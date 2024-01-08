import React, {memo} from 'react';
import {Handle, NodeProps, Position} from 'reactflow';
import cx from 'classnames';

import styles from './styles/nodeTypes.module.css';
import {NodeIcon} from "../eventSequenceNodes/icons/nodeIcon";
import {NodeTypes} from "../eventSequenceNodes/icons/interfaces/nodeProps";

/**
 * At Least Gate Node
 * @param id Node identifier
 * @param data Data that the node holds
 * @returns AtLeastGateNode JSX Element
 */
const AtLeastGateNode = ({id, data}: NodeProps) => {

  return (
    <div className={styles.node_container}>
      <div className={cx(styles.node)} title="click to add a child node">
        {"At Least Gate"}

        <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false}/>
        <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false}/>
      </div>
      <NodeIcon nodeType={NodeTypes.AtLeastGate} iconProps={{width: "30px", height: "100%", viewBox: "96 96 308 308"}}/>
    </div>
  );
};

export default memo(AtLeastGateNode);
