import { Handle, Node, NodeProps, Position } from "reactflow";
import { useState, useEffect, useCallback } from "react";
import { EuiText, EuiIcon, EuiButton, EuiSuperSelect, EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";
import { useStore } from "reactflow";
import { getInitials } from "../../../hooks/eventTree/useTreeData";
import { useCategoryContext } from "../../../hooks/eventTree/useCreateReleaseCategory";
import { GenericModal } from "../../modals/genericModal";
export interface OutputNodeData {
  label: string;
  isSequenceId?: boolean;
  width?: number;
}
const ManageCategoriesForm = ({
  categories,
  addCategory,
  deleteCategory,
}: {
  categories: {
    value: string;
    text: string;
  }[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
}): JSX.Element => {
  const [newCategory, setNewCategory] = useState("");
  return (
    <div>
      {categories.map((category) => (
        <div
          key={category.value}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>{category.value}</span>
          {categories.length > 1 && (
            <EuiIcon
              type="trash"
              onClick={() => {
                deleteCategory(category.value);
              }}
              style={{ color: "red", cursor: "pointer" }}
            />
          )}
        </div>
      ))}
      <EuiSpacer size="m" />
      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #eee" }}>
        <EuiFlexGroup gutterSize="s">
          <EuiFlexItem>
            <input
              type="text"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "14px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                width: "100%",
              }}
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              size="s"
              onClick={() => {
                if (newCategory.trim()) {
                  addCategory(newCategory.trim());
                  setNewCategory("");
                }
              }}
              disabled={!newCategory.trim()}
            >
              Add
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
    </div>
  );
};
let firstColumnLabel = "Initiating Event";
export const setFirstColumnLabel = (label: string): void => {
  firstColumnLabel = label;
};
function OutputNode({ id, data }: NodeProps<OutputNodeData>): JSX.Element {
  const { categories, addCategory, deleteCategory } = useCategoryContext();
  const [releaseCategory, setReleaseCategory] = useState(data.label);
  const [displayLabel, setDisplayLabel] = useState(data.label);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const nodes = useStore((store) => store.getNodes() as Node<OutputNodeData>[]);
  const superSelectOptions = categories.map((category) => ({
    value: category.value,
    inputDisplay: category.text || category.value,
    dropdownDisplay: category.text || category.value,
  }));
  const updateSequenceId = useCallback((): void => {
    if (data.isSequenceId) {
      const sequenceIdNodes = nodes
        .filter((node) => node.type === "outputNode" && node.data.isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);
      sequenceIdNodes.forEach((node, index) => {
        if (node.id === id) {
          const initials = getInitials(firstColumnLabel);
          const calculatedSequenceId = `${initials}-${String(index + 1)}`;
          if (sequenceId !== calculatedSequenceId) {
            setSequenceId(calculatedSequenceId);
            setDisplayLabel(calculatedSequenceId);
          }
        }
      });
    }
  }, [data.isSequenceId, nodes, id, sequenceId]);
  useEffect(() => {
    setDisplayLabel(data.label);
  }, [data.label]);
  useEffect(() => {
    updateSequenceId();
  }, [updateSequenceId]);
  const handleCategoryChange = (value: string): void => {
    setReleaseCategory(value);
  };
  const handleModalSubmit = (): Promise<void> => {
    setIsManageModalVisible(false);
    return Promise.resolve();
  };
  const handleModalClose = (): void => {
    setIsManageModalVisible(false);
  };
  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        id="b"
        style={{ position: "absolute", top: "50%", left: "0%", visibility: "hidden" }}
      />
      <div
        style={{
          width: data.width,
          height: 40,
          textAlign: "center",
          border: "1px solid black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "5px",
          boxSizing: "border-box",
        }}
      >
        {data.label === "Category A" || data.label === "Category B" ?
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <div style={{ flex: 1 }}>
              <EuiSuperSelect
                options={superSelectOptions}
                valueOfSelected={releaseCategory}
                onChange={handleCategoryChange}
                compressed
                fullWidth
                style={{
                  minWidth: "100px",
                  fontSize: "0.7rem",
                }}
                popoverProps={{
                  ownFocus: true,
                  anchorPosition: "downCenter",
                }}
              />
            </div>
            <div>
              <EuiIcon
                type="pencil"
                size="s"
                onClick={() => {
                  setIsManageModalVisible(true);
                }}
                style={{ cursor: "pointer" }}
              />
            </div>
          </div>
        : <EuiText style={{ fontSize: "0.7rem" }}>{displayLabel}</EuiText>}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{ position: "absolute", top: "50%", right: "0%", visibility: "hidden" }}
      />
      {isManageModalVisible && (
        <GenericModal
          title="Manage Release Categories"
          body={
            <ManageCategoriesForm
              categories={categories}
              addCategory={addCategory}
              deleteCategory={deleteCategory}
            />
          }
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          modalFormId="manage-categories"
          showButtons
        />
      )}
    </div>
  );
}
export default OutputNode;
