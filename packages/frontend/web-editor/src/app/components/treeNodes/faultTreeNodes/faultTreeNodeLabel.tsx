import React, { useState } from "react";
import styles from "./styles/faultTreeNodeStyles.module.css";

type FaultTreeNodeLabelProps = {
  label: string;
};

const stylesMap = styles as Record<string, string>;

const FaultTreeNodeLabel = ({ label }: FaultTreeNodeLabelProps) => {
  const [isEditable, setIsEditable] = useState(false);
  const handleClick = (): void => {
    setIsEditable(true);
  };

  return (
    <textarea
      defaultValue={label}
      className={stylesMap.editable_text_field}
      onClick={handleClick}
      readOnly={!isEditable}
    />
  );
};

export { FaultTreeNodeLabel };
