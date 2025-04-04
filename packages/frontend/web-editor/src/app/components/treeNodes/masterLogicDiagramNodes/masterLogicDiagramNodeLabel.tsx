import React, { useState } from "react";
import styles from "./styles/masterLogicDiagramNodeStyles.module.css";

interface MasterLogicDiagramNodeLabelProps {
  label: string;
}

const stylesMap = styles as Record<string, string>;

const MasterLogicDiagramNodeLabel = ({ label }: MasterLogicDiagramNodeLabelProps) => {
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

export { MasterLogicDiagramNodeLabel };
