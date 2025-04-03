import { Handle, NodeProps, Position } from "reactflow";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { EuiText, EuiSelect, EuiIcon, EuiButton } from "@elastic/eui";
import { useStore } from "reactflow";
import { getInitials } from "../../../hooks/eventTree/useTreeData";
import { ScientificNotation } from "../../../../utils/scientificNotation";
import { useCategoryContext } from "../../../hooks/eventTree/useCreateReleaseCategory";
import Tooltip from "../../tooltips/customTooltip";
import { GenericModal } from "../../modals/genericModal";

const ManageCategoriesForm = ({
  categories,
  addCategory,
  deleteCategory,
}: {
  categories: { value: string; text: string }[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
}) => {
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
      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", gap: "8px" }}>
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
              width: "200px",
            }}
          />
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
        </div>
      </div>
    </div>
  );
};

// Store first column label
let firstColumnLabel = "Initiating Event";

export const setFirstColumnLabel = (label: string) => {
  firstColumnLabel = label;
};

function OutputNode({ id, data }: NodeProps) {
  const { categories, addCategory, deleteCategory } = useCategoryContext();
  const [releaseCategory, setReleaseCategory] = useState(data.label);
  const [displayLabel, setDisplayLabel] = useState(data.label);
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const selectOptions = categories;
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const nodes = useStore((store) => store.getNodes());

  const updateSequenceId = useCallback(() => {
    if (data.isSequenceId) {
      const sequenceIdNodes = nodes
        .filter((node) => node.type === "outputNode" && node.data.isSequenceId)
        .sort((a, b) => a.position.y - b.position.y);

      sequenceIdNodes.forEach((node, index) => {
        if (node.id === id) {
          const initials = getInitials(firstColumnLabel);
          const calculatedSequenceId = `${initials}-${index + 1}`;
          if (sequenceId !== calculatedSequenceId) {
            setSequenceId(calculatedSequenceId);
            setDisplayLabel(calculatedSequenceId);
          }
        }
      });
    }
  }, [data.isSequenceId, nodes, id, sequenceId]);

  useEffect(() => {
    if (data.isFrequencyNode && typeof data.frequency === "number") {
      setDisplayLabel(ScientificNotation.toScientific(data.frequency, 2));
    } else {
      setDisplayLabel(data.label);
    }
  }, [data.label, data.frequency, data.isFrequencyNode]);

  useEffect(() => {
    updateSequenceId();
  }, [updateSequenceId]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setReleaseCategory(value);
  };

  const handleModalSubmit = async (): Promise<void> => {
    setIsManageModalVisible(false);
  };

  const handleModalClose = () => {
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
        {data.label === "Category A" || data.label === "Category B" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <EuiSelect
              options={selectOptions}
              value={releaseCategory}
              onChange={handleCategoryChange}
              compressed
              style={{
                width: "115px",
                height: "30px",
                fontSize: "0.7rem",
                padding: "0 5px",
                boxSizing: "border-box",
              }}
            />
            <EuiIcon
              type="pencil"
              size="s"
              onClick={() => {
                setIsManageModalVisible(true);
              }}
              style={{ cursor: "pointer" }}
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
        ) : data.isFrequencyNode ? (
          <Tooltip content={ScientificNotation.toScientific(data.frequency ?? 0, 8)}>
            <EuiText style={{ fontSize: "0.7rem" }}>{ScientificNotation.toScientific(data.frequency ?? 0, 3)}</EuiText>
          </Tooltip>
        ) : (
          <EuiText style={{ fontSize: "0.7rem" }}>{displayLabel}</EuiText>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{ position: "absolute", top: "50%", right: "0%", visibility: "hidden" }}
      />
    </div>
  );
}

export default OutputNode;
