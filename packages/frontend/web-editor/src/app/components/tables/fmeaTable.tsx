import { useCallback, useState } from "react";
import {
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPopover,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiToolTip,
} from "@elastic/eui";
import { FmeaColumn, FmeaRow, FmeaType } from "shared-sdk/lib/api/FmeaApiManager";

export interface FmeaTableProps {
  fmea: FmeaType;
  onAddColumn: (
    name: string,
    type: "string" | "dropdown",
    dropdownOptions?: { number: number; description: string }[],
  ) => void;
  onAddRow: () => void;
  onUpdateCell: (rowId: string, columnId: string, value: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateColumn: (
    columnId: string,
    body: { name: string; type: "string" | "dropdown"; dropdownOptions?: { number: number; description: string }[] },
  ) => void;
}

type EditingCell = { rowId: string; columnId: string; draft: string };

type ColumnModalState = {
  mode: "add" | "edit";
  columnId?: string;
  name: string;
  type: "string" | "dropdown";
  optionsText: string;
};

const EMPTY_COLUMN_MODAL: ColumnModalState = {
  mode: "add",
  name: "",
  type: "string",
  optionsText: "",
};

function parseOptions(text: string): { number: number; description: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > -1) {
        const num = Number(line.slice(0, colonIdx).trim());
        const desc = line.slice(colonIdx + 1).trim();
        return { number: isNaN(num) ? i + 1 : num, description: desc };
      }
      return { number: i + 1, description: line };
    });
}

function optionsToText(opts: { number: number; description: string }[]): string {
  return opts.map((o) => `${o.number}:${o.description}`).join("\n");
}

function ColumnHeader({
  col,
  onEdit,
  onDelete,
}: {
  col: FmeaColumn;
  onEdit: (col: FmeaColumn) => void;
  onDelete: (colId: string) => void;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EuiPopover
      isOpen={isOpen}
      closePopover={(): void => {
        setIsOpen(false);
      }}
      button={
        <span
          style={{ cursor: "pointer", fontWeight: 600 }}
          onClick={(): void => {
            setIsOpen(true);
          }}
        >
          {col.name}
          {col.type === "dropdown" && (
            <span style={{ fontSize: "0.75em", color: "#888", marginLeft: 4 }}>(dropdown)</span>
          )}
        </span>
      }
      panelPaddingSize="s"
    >
      <EuiFlexGroup
        direction="column"
        gutterSize="xs"
      >
        <EuiFlexItem>
          <EuiButtonEmpty
            size="s"
            iconType="pencil"
            onClick={(): void => {
              setIsOpen(false);
              onEdit(col);
            }}
          >
            Edit column
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiButtonEmpty
            size="s"
            iconType="trash"
            color="danger"
            onClick={(): void => {
              setIsOpen(false);
              onDelete(col.id);
            }}
          >
            Delete column
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPopover>
  );
}

function FmeaTable({
  fmea,
  onAddColumn,
  onAddRow,
  onUpdateCell,
  onDeleteRow,
  onDeleteColumn,
  onUpdateColumn,
}: FmeaTableProps): JSX.Element {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [columnModal, setColumnModal] = useState<ColumnModalState | null>(null);

  const commitCell = useCallback((): void => {
    if (!editingCell) return;
    onUpdateCell(editingCell.rowId, editingCell.columnId, editingCell.draft);
    setEditingCell(null);
  }, [editingCell, onUpdateCell]);

  const openAddColumn = useCallback((): void => {
    setColumnModal({ ...EMPTY_COLUMN_MODAL, mode: "add" });
  }, []);

  const openEditColumn = useCallback((col: FmeaColumn): void => {
    setColumnModal({
      mode: "edit",
      columnId: col.id,
      name: col.name,
      type: col.type,
      optionsText: optionsToText(col.dropdownOptions ?? []),
    });
  }, []);

  const handleColumnModalConfirm = useCallback((): void => {
    if (!columnModal) return;
    const { name, type, optionsText, mode, columnId } = columnModal;
    if (!name.trim()) return;
    const opts = type === "dropdown" ? parseOptions(optionsText) : [];
    if (mode === "add") {
      onAddColumn(name.trim(), type, opts.length > 0 ? opts : undefined);
    } else if (columnId) {
      onUpdateColumn(columnId, { name: name.trim(), type, dropdownOptions: opts.length > 0 ? opts : undefined });
    }
    setColumnModal(null);
  }, [columnModal, onAddColumn, onUpdateColumn]);

  const columns: EuiBasicTableColumn<FmeaRow>[] = [
    ...fmea.columns.map(
      (col): EuiBasicTableColumn<FmeaRow> => ({
        field: col.id,
        name: (
          <ColumnHeader
            col={col}
            onEdit={openEditColumn}
            onDelete={onDeleteColumn}
          />
        ),
        render: (_val: unknown, row: FmeaRow): JSX.Element => {
          const value = row.row_data[col.id] ?? "";
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;

          if (isEditing) {
            if (col.type === "dropdown") {
              const options = (col.dropdownOptions ?? []).map((o) => ({
                value: String(o.number),
                text: `${o.number} — ${o.description}`,
              }));
              return (
                <EuiSelect
                  compressed
                  options={options}
                  value={editingCell.draft}
                  onChange={(e): void => {
                    setEditingCell({ ...editingCell, draft: e.target.value });
                  }}
                  onBlur={commitCell}
                  autoFocus
                />
              );
            }
            return (
              <EuiFieldText
                compressed
                value={editingCell.draft}
                onChange={(e): void => {
                  setEditingCell({ ...editingCell, draft: e.target.value });
                }}
                onBlur={commitCell}
                onKeyDown={(e): void => {
                  if (e.key === "Enter") commitCell();
                  if (e.key === "Escape") setEditingCell(null);
                }}
                autoFocus
              />
            );
          }

          const display =
            col.type === "dropdown" ?
              ((col.dropdownOptions ?? []).find((o) => String(o.number) === value)?.description ?? value)
            : value;

          return (
            <span
              style={{ cursor: "text", display: "block", minWidth: 80, minHeight: 20 }}
              onClick={(): void => {
                setEditingCell({ rowId: row.id, columnId: col.id, draft: value });
              }}
            >
              {display || <span style={{ color: "#aaa" }}>—</span>}
            </span>
          );
        },
      }),
    ),
    {
      name: "",
      width: "40px",
      actions: [
        {
          name: "Delete row",
          description: "Delete this row",
          icon: "trash",
          color: "danger",
          type: "icon",
          onClick: (row: FmeaRow): void => {
            onDeleteRow(row.id);
          },
        },
      ],
    },
  ];

  return (
    <>
      <EuiFlexGroup
        alignItems="center"
        gutterSize="s"
        wrap
      >
        <EuiFlexItem grow={false}>
          <EuiButton
            size="s"
            iconType="plusInCircle"
            onClick={onAddRow}
          >
            Add Row
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            size="s"
            iconType="listAdd"
            onClick={openAddColumn}
          >
            Add Column
          </EuiButton>
        </EuiFlexItem>
        {fmea.columns.length === 0 && (
          <EuiFlexItem>
            <EuiText
              size="s"
              color="subdued"
            >
              <p>Start by adding columns, then rows.</p>
            </EuiText>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {fmea.columns.length > 0 && (
        <EuiBasicTable<FmeaRow>
          tableCaption="FMEA Table"
          items={fmea.rows ?? []}
          rowHeader={fmea.columns[0]?.id}
          columns={columns}
          noItemsMessage="No rows yet. Click 'Add Row' to begin."
        />
      )}

      {columnModal !== null && (
        <EuiModal
          onClose={(): void => {
            setColumnModal(null);
          }}
          style={{ minWidth: 420 }}
        >
          <EuiModalHeader>
            <EuiModalHeaderTitle>{columnModal.mode === "add" ? "Add Column" : "Edit Column"}</EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiForm>
              <EuiFormRow label="Column Name">
                <EuiFieldText
                  value={columnModal.name}
                  onChange={(e): void => {
                    setColumnModal({ ...columnModal, name: e.target.value });
                  }}
                  placeholder="e.g. Component, Failure Mode, Effect"
                  autoFocus
                />
              </EuiFormRow>
              <EuiFormRow label="Type">
                <EuiSelect
                  options={[
                    { value: "string", text: "Text" },
                    { value: "dropdown", text: "Dropdown" },
                  ]}
                  value={columnModal.type}
                  onChange={(e): void => {
                    setColumnModal({
                      ...columnModal,
                      type: e.target.value as "string" | "dropdown",
                    });
                  }}
                />
              </EuiFormRow>
              {columnModal.type === "dropdown" && (
                <EuiFormRow
                  label="Options"
                  helpText='One per line. Format: "number:description" or just "description".'
                >
                  <textarea
                    rows={5}
                    style={{
                      width: "100%",
                      fontFamily: "monospace",
                      fontSize: 13,
                      padding: "6px 8px",
                      border: "1px solid #d3dae6",
                      borderRadius: 4,
                      resize: "vertical",
                    }}
                    value={columnModal.optionsText}
                    onChange={(e): void => {
                      setColumnModal({ ...columnModal, optionsText: e.target.value });
                    }}
                    placeholder={"1:Critical\n2:Major\n3:Minor"}
                  />
                </EuiFormRow>
              )}
            </EuiForm>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButtonEmpty
              onClick={(): void => {
                setColumnModal(null);
              }}
            >
              Cancel
            </EuiButtonEmpty>
            <EuiButton
              fill
              onClick={handleColumnModalConfirm}
              isDisabled={!columnModal.name.trim()}
            >
              {columnModal.mode === "add" ? "Add" : "Save"}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}
    </>
  );
}

export { FmeaTable };
