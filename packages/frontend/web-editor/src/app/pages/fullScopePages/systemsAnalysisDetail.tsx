import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiCheckbox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPageTemplate,
  EuiSkeletonRectangle,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from "@elastic/eui";
import {
  AddFmeaColumn,
  AddFmeaRow,
  CreateFmea,
  DEFAULT_FMEA_COLUMNS,
  DeleteFmeaColumn,
  DeleteFmeaRow,
  FmeaColumn,
  FmeaColumnSpec,
  FmeaType,
  GetFmeaBySaId,
  UpdateFmeaCell,
  UpdateFmeaColumnDetails,
} from "shared-sdk/lib/api/FmeaApiManager";
import { FmeaTable } from "../../components/tables/fmeaTable";

const GROUPS = ["Identification", "Component", "Analysis", "Effects", "Risk Scoring", "Actions", "PRA Links"];

function ColumnSetupModal({ onConfirm }: { onConfirm: (selected: FmeaColumnSpec[]) => void }): JSX.Element {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(DEFAULT_FMEA_COLUMNS.map((c) => c.id)));

  const toggle = (id: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (): void => setChecked(new Set(DEFAULT_FMEA_COLUMNS.map((c) => c.id)));
  const selectNone = (): void => setChecked(new Set());

  const handleConfirm = (): void => {
    onConfirm(DEFAULT_FMEA_COLUMNS.filter((c) => checked.has(c.id)));
  };

  return (
    <EuiModal
      onClose={(): void => {
        onConfirm([]);
      }}
      style={{ minWidth: 560, maxHeight: "80vh" }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>Set Up FMEA Columns</EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody style={{ overflowY: "auto" }}>
        <EuiText
          size="s"
          color="subdued"
        >
          <p>
            Choose the default columns for this FMEA. You can add, edit, or remove columns at any time. Columns marked{" "}
            <EuiBadge color="success">Auto-calculated</EuiBadge> and <EuiBadge color="accent">Auto RPN</EuiBadge> have
            special behaviour.
          </p>
        </EuiText>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="s"
              onClick={selectAll}
            >
              Select all
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="s"
              onClick={selectNone}
            >
              Deselect all
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="m" />

        {GROUPS.map((group) => {
          const cols = DEFAULT_FMEA_COLUMNS.filter((c) => c.group === group);
          if (cols.length === 0) return null;
          return (
            <div
              key={group}
              style={{ marginBottom: 16 }}
            >
              <EuiText
                size="xs"
                style={{ textTransform: "uppercase", fontWeight: 700, color: "#69707d", marginBottom: 6 }}
              >
                {group}
              </EuiText>
              {cols.map((col) => (
                <EuiFlexGroup
                  key={col.id}
                  alignItems="center"
                  gutterSize="s"
                  style={{ marginBottom: 4, paddingLeft: 4 }}
                >
                  <EuiFlexItem grow={false}>
                    <EuiCheckbox
                      id={`col-${col.id}`}
                      checked={checked.has(col.id)}
                      onChange={(): void => {
                        toggle(col.id);
                      }}
                      label=""
                    />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiFlexGroup
                      alignItems="center"
                      gutterSize="xs"
                      responsive={false}
                    >
                      <EuiFlexItem grow={false}>
                        <EuiText size="s">{col.name}</EuiText>
                      </EuiFlexItem>
                      {col.badge && (
                        <EuiFlexItem grow={false}>
                          <EuiBadge
                            color={col.badge.color}
                            style={{ fontSize: "0.65em" }}
                          >
                            {col.badge.text}
                          </EuiBadge>
                        </EuiFlexItem>
                      )}
                    </EuiFlexGroup>
                  </EuiFlexItem>
                </EuiFlexGroup>
              ))}
            </div>
          );
        })}
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty
          onClick={(): void => {
            onConfirm([]);
          }}
        >
          Start Empty
        </EuiButtonEmpty>
        <EuiButton
          fill
          onClick={handleConfirm}
          isDisabled={checked.size === 0}
        >
          Create with {checked.size} column{checked.size !== 1 ? "s" : ""}
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
}

function SystemsAnalysisDetail(): JSX.Element {
  const { systemsAnalysisId } = useParams<{ systemsAnalysisId: string }>();
  const parsedId = Number(systemsAnalysisId ?? "0");

  const [fmea, setFmea] = useState<FmeaType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!parsedId) return;
    setIsLoading(true);
    setError(null);
    GetFmeaBySaId(parsedId)
      .then((results) => {
        if (results.length > 0) {
          setFmea(results[0]);
          setIsLoading(false);
        } else {
          setIsLoading(false);
          setShowSetup(true);
        }
      })
      .catch(() => {
        setError("Failed to load FMEA. Please try again.");
        setIsLoading(false);
      });
  }, [parsedId]);

  const handleSetupConfirm = useCallback(
    (selectedCols: FmeaColumnSpec[]): void => {
      setShowSetup(false);
      setIsLoading(true);
      const columns: FmeaColumn[] = selectedCols.map(({ group: _g, badge: _b, linkedTo: _l, ...rest }) => rest);
      CreateFmea({ systemsAnalysisId: parsedId, title: "FMEA", description: "", columns })
        .then((created) => {
          setFmea(created);
        })
        .catch(() => {
          setError("Failed to create FMEA. Please try again.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [parsedId],
  );

  const handleAddColumn = useCallback(
    (name: string, type: "string" | "dropdown", dropdownOptions?: { number: number; description: string }[]): void => {
      if (!fmea) return;
      AddFmeaColumn(fmea.id, { name, type, dropdownOptions })
        .then((updated) => {
          if (updated) setFmea(updated);
        })
        .catch(() => undefined);
    },
    [fmea],
  );

  const handleAddRow = useCallback((): void => {
    if (!fmea) return;
    AddFmeaRow(fmea.id)
      .then((updated) => {
        if (updated) setFmea(updated);
      })
      .catch(() => undefined);
  }, [fmea]);

  const handleUpdateCell = useCallback(
    (rowId: string, columnId: string, value: string): void => {
      if (!fmea) return;
      UpdateFmeaCell(fmea.id, rowId, columnId, value)
        .then((ok) => {
          if (!ok) return;
          setFmea((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              rows: prev.rows.map((r) =>
                r.id === rowId ? { ...r, row_data: { ...r.row_data, [columnId]: value } } : r,
              ),
            };
          });
        })
        .catch(() => undefined);
    },
    [fmea],
  );

  const handleDeleteRow = useCallback(
    (rowId: string): void => {
      if (!fmea) return;
      DeleteFmeaRow(fmea.id, rowId)
        .then((updated) => {
          if (updated) setFmea(updated);
        })
        .catch(() => undefined);
    },
    [fmea],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string): void => {
      if (!fmea) return;
      DeleteFmeaColumn(fmea.id, columnId)
        .then((updated) => {
          if (updated) setFmea(updated);
        })
        .catch(() => undefined);
    },
    [fmea],
  );

  const handleUpdateColumn = useCallback(
    (
      columnId: string,
      body: { name: string; type: "string" | "dropdown"; dropdownOptions?: { number: number; description: string }[] },
    ): void => {
      if (!fmea) return;
      UpdateFmeaColumnDetails(fmea.id, columnId, body)
        .then((updated) => {
          if (updated) setFmea(updated);
        })
        .catch(() => undefined);
    },
    [fmea],
  );

  return (
    <>
      {showSetup && <ColumnSetupModal onConfirm={handleSetupConfirm} />}

      <EuiPageTemplate
        panelled={false}
        offset={48}
        grow={true}
      >
        <EuiPageTemplate.Section>
          <EuiTitle size="m">
            <h2>Failure Modes and Effects Analysis (FMEA)</h2>
          </EuiTitle>
          <EuiSpacer size="m" />

          {error !== null && (
            <>
              <EuiCallOut
                title="Error"
                color="danger"
                iconType="alert"
              >
                <p>{error}</p>
              </EuiCallOut>
              <EuiSpacer size="s" />
            </>
          )}

          <EuiSkeletonRectangle
            width="100%"
            height={300}
            borderRadius="m"
            isLoading={isLoading}
            contentAriaLabel="FMEA table"
          >
            {fmea !== null && (
              <FmeaTable
                fmea={fmea}
                onAddColumn={handleAddColumn}
                onAddRow={handleAddRow}
                onUpdateCell={handleUpdateCell}
                onDeleteRow={handleDeleteRow}
                onDeleteColumn={handleDeleteColumn}
                onUpdateColumn={handleUpdateColumn}
              />
            )}
          </EuiSkeletonRectangle>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </>
  );
}

export { SystemsAnalysisDetail };
