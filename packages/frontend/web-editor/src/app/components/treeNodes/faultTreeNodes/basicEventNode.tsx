import React, {memo} from 'react';
import {Handle, Position, NodeProps} from 'reactflow';
import cx from 'classnames';

import styles from './styles/nodeTypes.module.css';
import {NodeTypes} from "../eventSequenceNodes/icons/interfaces/nodeProps";
import {NodeIcon} from "../eventSequenceNodes/icons/nodeIcon";

/**
 * Basic Event Node
 * @param id Node identifier
 * @param data Data that the node holds
 * @returns BasicEventNode JSX Element
 */
const BasicEventNode = ({id, data}: NodeProps) => {

  return (
    <div className={styles.node_container}>
      <div className={cx(styles.node)} title="right click to update node">
        {"Basic Event"}

        <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false}/>
        <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false}/>
      </div>
      <NodeIcon nodeType={NodeTypes.BasicEvent}
                iconProps={{width: "30px", height: "100%", viewBox: "0 3 122.61 125.61"}}/>
    </div>
  );
};

export default memo(BasicEventNode);
