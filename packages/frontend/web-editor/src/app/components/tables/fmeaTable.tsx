import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiDataGrid,
  EuiFieldNumber,
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
  EuiText,
} from "@elastic/eui";
import { EuiDataGridColumn } from "@elastic/eui/src/components/datagrid/data_grid_types";
import { FmeaColumn, FmeaColumnBadge, FmeaRow, FmeaType } from "shared-sdk/lib/api/FmeaApiManager";
function computeRpn(row: FmeaRow, computedFrom: string[]): number | null {
  const vals = computedFrom.map((id) => Number(row.row_data[id] ?? ""));
  if (vals.some((v) => isNaN(v) || v === 0)) return null;
  return vals.reduce((acc, v) => acc * v, 1);
}
function rpnToRisk(rpn: number | null): {
  label: string;
  color: "danger" | "warning" | "success" | "hollow";
} {
  if (rpn === null) return { label: "—", color: "hollow" };
  if (rpn > 100) return { label: "HIGH", color: "danger" };
  if (rpn > 50) return { label: "MEDIUM", color: "warning" };
  return { label: "LOW", color: "success" };
}
function badgeForColumn(col: FmeaColumn): FmeaColumnBadge | undefined {
  if (col.type === "computed") return { text: "Auto-calculated", color: "success" };
  if (col.type === "risk") return { text: "Auto-calculated", color: "success" };
  if (col.type === "number" && ["S", "D", "O"].includes(col.id)) return { text: "Auto RPN", color: "accent" };
  if (col.id === "pra_be_id") return { text: "Links: Fault Trees", color: "primary" };
  if (col.id === "ccf_group") return { text: "Links: CCF", color: "primary" };
  return undefined;
}
function initialWidth(col: FmeaColumn): number {
  if (col.type === "number") return 70;
  if (col.type === "computed") return 80;
  if (col.type === "risk") return 90;
  if (col.type === "dropdown") return 100;
  const narrow = new Set(["fmea_id", "fm_code", "subsystem", "safety_class"]);
  if (narrow.has(col.id)) return 130;
  const wide = new Set(["local_effect", "system_effect", "end_effect", "recommended_actions", "failure_cause"]);
  if (wide.has(col.id)) return 220;
  return 160;
}
function parseOptions(text: string): {
  number: number;
  description: string;
}[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const ci = line.indexOf(":");
      if (ci > -1) {
        const n = Number(line.slice(0, ci).trim());
        return { number: isNaN(n) ? i + 1 : n, description: line.slice(ci + 1).trim() };
      }
      return { number: i + 1, description: line };
    });
}
function optionsToText(
  opts: {
    number: number;
    description: string;
  }[],
): string {
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
  const [open, setOpen] = useState(false);
  const badge = badgeForColumn(col);
  const isReadOnly = col.type === "computed" || col.type === "risk";
  return (
    <EuiPopover
      isOpen={open}
      closePopover={(): void => {
        setOpen(false);
      }}
      button={
        <div
          style={{ cursor: "pointer", lineHeight: 1.3 }}
          onClick={(): void => {
            setOpen(true);
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.85em" }}>{col.name}</span>
          {badge && (
            <div style={{ marginTop: 2 }}>
              <EuiBadge
                color={badge.color}
                style={{ fontSize: "0.6em" }}
              >
                {badge.text}
              </EuiBadge>
            </div>
          )}
        </div>
      }
      panelPaddingSize="s"
    >
      <EuiFlexGroup
        direction="column"
        gutterSize="xs"
      >
        {!isReadOnly && (
          <EuiFlexItem>
            <EuiButtonEmpty
              size="s"
              iconType="pencil"
              onClick={(): void => {
                setOpen(false);
                onEdit(col);
              }}
            >
              Edit column
            </EuiButtonEmpty>
          </EuiFlexItem>
        )}
        <EuiFlexItem>
          <EuiButtonEmpty
            size="s"
            iconType="trash"
            color="danger"
            onClick={(): void => {
              setOpen(false);
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
export interface FmeaTableProps {
  fmea: FmeaType;
  onAddColumn: (
    name: string,
    type: "string" | "dropdown",
    dropdownOptions?: {
      number: number;
      description: string;
    }[],
  ) => void;
  onAddRow: () => void;
  onUpdateCell: (rowId: string, columnId: string, value: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateColumn: (
    columnId: string,
    body: {
      name: string;
      type: "string" | "dropdown";
      dropdownOptions?: {
        number: number;
        description: string;
      }[];
    },
  ) => void;
}
type EditingCell = {
  rowId: string;
  columnId: string;
  draft: string;
};
type ColumnModalState = {
  mode: "add" | "edit";
  columnId?: string;
  name: string;
  type: "string" | "dropdown";
  optionsText: string;
};
const EMPTY_MODAL: ColumnModalState = { mode: "add", name: "", type: "string", optionsText: "" };
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
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => fmea.columns.map((c) => c.id));
  useEffect(() => {
    setVisibleColumns((prev) => {
      const current = new Set(fmea.columns.map((c) => c.id));
      const prevSet = new Set(prev);
      const next = prev.filter((id) => current.has(id));
      fmea.columns.forEach((c) => {
        if (!prevSet.has(c.id)) next.push(c.id);
      });
      return next;
    });
  }, [fmea.columns]);
  const openEditColumn = useCallback((col: FmeaColumn): void => {
    setColumnModal({
      mode: "edit",
      columnId: col.id,
      name: col.name,
      type: col.type as "string" | "dropdown",
      optionsText: optionsToText(col.dropdownOptions ?? []),
    });
  }, []);
  const handleColumnModalConfirm = useCallback((): void => {
    if (!columnModal || !columnModal.name.trim()) return;
    const { name, type, optionsText, mode, columnId } = columnModal;
    const opts = type === "dropdown" ? parseOptions(optionsText) : [];
    if (mode === "add") {
      onAddColumn(name.trim(), type, opts.length > 0 ? opts : undefined);
    } else if (columnId) {
      onUpdateColumn(columnId, { name: name.trim(), type, dropdownOptions: opts.length > 0 ? opts : undefined });
    }
    setColumnModal(null);
  }, [columnModal, onAddColumn, onUpdateColumn]);
  const commitCell = useCallback((): void => {
    if (!editingCell) return;
    const col = fmea.columns.find((c) => c.id === editingCell.columnId);
    if (!col || col.type === "computed" || col.type === "risk") {
      setEditingCell(null);
      return;
    }
    onUpdateCell(editingCell.rowId, editingCell.columnId, editingCell.draft);
    setEditingCell(null);
  }, [editingCell, fmea.columns, onUpdateCell]);
  const gridColumns: EuiDataGridColumn[] = useMemo(
    () =>
      fmea.columns.map((col) => ({
        id: col.id,
        display: (
          <ColumnHeader
            col={col}
            onEdit={openEditColumn}
            onDelete={onDeleteColumn}
          />
        ),
        displayAsText: col.name,
        initialWidth: initialWidth(col),
        isResizable: true,
        isSortable: false,
        actions: false as const,
      })),
    [fmea.columns, openEditColumn, onDeleteColumn],
  );
  const renderCellValue = useCallback(
    ({ rowIndex, columnId }: { rowIndex: number; columnId: string }): JSX.Element | null => {
      const row = fmea.rows[rowIndex];
      if (!row) return null;
      const col = fmea.columns.find((c) => c.id === columnId);
      if (!col) return null;
      const value = row.row_data[col.id] ?? "";
      if (col.type === "computed") {
        const rpn = computeRpn(row, col.computedFrom ?? []);
        return (
          <span style={{ fontWeight: 600 }}>
            {rpn !== null ? String(rpn) : <span style={{ color: "#aaa" }}>—</span>}
          </span>
        );
      }
      if (col.type === "risk") {
        const rpn = computeRpn(row, ["S", "D", "O"]);
        const { label, color } = rpnToRisk(rpn);
        return <EuiBadge color={color}>{label}</EuiBadge>;
      }
      const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;
      if (isEditing) {
        if (col.type === "dropdown") {
          const opts = (col.dropdownOptions ?? []).map((o) => ({
            value: String(o.number),
            text: `${o.number} — ${o.description}`,
          }));
          return (
            <EuiSelect
              compressed
              options={opts}
              value={editingCell.draft}
              onChange={(e): void => {
                setEditingCell({ ...editingCell, draft: e.target.value });
              }}
              onBlur={commitCell}
              autoFocus
            />
          );
        }
        if (col.type === "number") {
          return (
            <EuiFieldNumber
              compressed
              value={editingCell.draft}
              min={1}
              max={10}
              onChange={(e): void => {
                setEditingCell({ ...editingCell, draft: e.target.value });
              }}
              onBlur={commitCell}
              onKeyDown={(e): void => {
                e.stopPropagation();
                if (e.key === "Enter") commitCell();
                if (e.key === "Escape") setEditingCell(null);
              }}
              style={{ width: 60 }}
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
              e.stopPropagation();
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
          title={display}
          style={{
            cursor: "text",
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          onClick={(): void => {
            setEditingCell({ rowId: row.id, columnId: col.id, draft: value });
          }}
        >
          {display || <span style={{ color: "#aaa" }}>—</span>}
        </span>
      );
    },
    [fmea.rows, fmea.columns, editingCell, commitCell],
  );
  const leadingControlColumns = useMemo(
    () => [
      {
        id: "delete_row",
        width: 36,
        headerCellRender: (): null => null,
        rowCellRender: ({ rowIndex }: { rowIndex: number }): JSX.Element | null => {
          const row = fmea.rows[rowIndex];
          if (!row) return null;
          return (
            <EuiButtonIcon
              iconType="trash"
              color="danger"
              size="xs"
              aria-label="Delete row"
              onClick={(): void => {
                onDeleteRow(row.id);
              }}
            />
          );
        },
      },
    ],
    [fmea.rows, onDeleteRow],
  );
  return (
    <>
      <EuiFlexGroup
        alignItems="center"
        gutterSize="s"
        style={{ marginBottom: 12 }}
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
            onClick={(): void => {
              setColumnModal({ ...EMPTY_MODAL, mode: "add" });
            }}
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

      {fmea.columns.length > 0 && (
        <>
          <EuiDataGrid
            aria-label="FMEA Table"
            columns={gridColumns}
            columnVisibility={{ visibleColumns, setVisibleColumns }}
            rowCount={fmea.rows.length}
            renderCellValue={renderCellValue}
            leadingControlColumns={leadingControlColumns}
            toolbarVisibility={{
              showColumnSelector: true,
              showDisplaySelector: false,
              showSortSelector: false,
              showFullScreenSelector: true,
              additionalControls: null,
            }}
            pagination={{
              ...pagination,
              pageSizeOptions: [10, 25, 50],
              onChangeItemsPerPage: (pageSize): void => {
                setPagination((p) => ({ ...p, pageSize, pageIndex: 0 }));
              },
              onChangePage: (pageIndex): void => {
                setPagination((p) => ({ ...p, pageIndex }));
              },
            }}
            gridStyle={{ border: "horizontal", rowHover: "highlight", header: "shade" }}
          />
          {fmea.rows.length === 0 && (
            <EuiText
              size="s"
              color="subdued"
              style={{ padding: "12px 0" }}
            >
              <p>No rows yet. Click &lsquo;Add Row&rsquo; to begin.</p>
            </EuiText>
          )}
        </>
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
                    setColumnModal({ ...columnModal, type: e.target.value as "string" | "dropdown" });
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
