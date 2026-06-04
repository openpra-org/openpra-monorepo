import styles from "./styles/faultTreeNodeStyles.module.css";
interface FaultTreeNodeLabelProps {
  label: string;
}
const stylesMap = styles as Record<string, string>;
const FaultTreeNodeLabel = ({ label }: FaultTreeNodeLabelProps): JSX.Element => (
  <div className={stylesMap.node_label}>{label}</div>
);
export { FaultTreeNodeLabel };
