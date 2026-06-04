import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiConfirmModal,
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
  EuiPageTemplate,
  EuiProgress,
  EuiSkeletonRectangle,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from "@elastic/eui";
import {
  ComponentParameterType,
  CreateComponentParameterBody,
  DeleteComponentParameter,
  GetComponentParameters,
  PatchComponentParameter,
  PostComponentParameter,
} from "shared-sdk/lib/api/NestedModelApiManager";
import { ComponentReliabilityTable } from "../../components/tables/componentReliabilityTable";
function excelSerialToISO(serial: number): string {
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}
function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "" || v === "--") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" || s === "--" ? undefined : s;
}
function parseComponentReliabilitySheet(wb: XLSX.WorkBook): CreateComponentParameterBody[] {
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("component reliability")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  let dataStart = 5;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i] as unknown[];
    if (
      String(row[1] ?? "")
        .toLowerCase()
        .includes("component type")
    ) {
      dataStart = i + 2;
      break;
    }
  }
  const results: CreateComponentParameterBody[] = [];
  let currentGrouping: string | undefined;
  let currentComponentType: string | undefined;
  for (let i = dataStart; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const colA = str(r[0]);
    const colB = str(r[1]);
    const colC = str(r[2]);
    const colD = str(r[3]);
    if (!colC && !colD) continue;
    if (colA && isNaN(Number(colA))) {
      currentGrouping = colA;
    }
    if (colB) {
      currentComponentType = colB;
    }
    const componentType = currentComponentType;
    const componentFailureMode = colC ?? colD ?? "";
    if (!componentType || !componentFailureMode) continue;
    const rawT = r[19];
    let effectiveDate: string | undefined;
    if (rawT !== "" && rawT !== undefined) {
      const n = Number(rawT);
      effectiveDate = isNaN(n) ? str(rawT) : excelSerialToISO(n);
    }
    results.push({
      grouping: currentGrouping,
      componentType,
      componentFailureMode,
      description: colC ? colD : undefined,
      dataSource: str(r[4]),
      failures: num(r[5]),
      dhValue: num(r[6]),
      dhUnit: str(r[7]),
      componentCount: num(r[8]),
      distribution: str(r[9]),
      analysisType: str(r[10]),
      fth: num(r[11]),
      median: num(r[12]),
      mean: num(r[13]),
      nfth: num(r[14]),
      alpha: num(r[15]),
      beta: num(r[16]),
      errorFactor: num(r[17]),
      dateRange: str(r[18]),
      effectiveDate,
    });
  }
  return results;
}
type FormState = {
  componentType: string;
  componentFailureMode: string;
  grouping: string;
  description: string;
  dataSource: string;
  failures: string;
  units: string;
  dhUnit: string;
  dhValue: string;
  componentCount: string;
  distribution: string;
  analysisType: string;
  fth: string;
  median: string;
  nfth: string;
  alpha: string;
  beta: string;
  mean: string;
  errorFactor: string;
  dateRange: string;
  effectiveDate: string;
};
const EMPTY_FORM: FormState = {
  componentType: "",
  componentFailureMode: "",
  grouping: "",
  description: "",
  dataSource: "",
  failures: "",
  units: "",
  dhUnit: "",
  dhValue: "",
  componentCount: "",
  distribution: "",
  analysisType: "",
  fth: "",
  median: "",
  nfth: "",
  alpha: "",
  beta: "",
  mean: "",
  errorFactor: "",
  dateRange: "",
  effectiveDate: "",
};
function rowToForm(row: ComponentParameterType): FormState {
  const n = (v: number | undefined): string => (v !== undefined ? String(v) : "");
  return {
    componentType: row.componentType,
    componentFailureMode: row.componentFailureMode,
    grouping: row.grouping ?? "",
    description: row.description ?? "",
    dataSource: row.dataSource ?? "",
    failures: n(row.failures),
    units: row.units ?? "",
    dhUnit: row.dhUnit ?? "",
    dhValue: n(row.dhValue),
    componentCount: n(row.componentCount),
    distribution: row.distribution ?? "",
    analysisType: row.analysisType ?? "",
    fth: n(row.fth),
    median: n(row.median),
    nfth: n(row.nfth),
    alpha: n(row.alpha),
    beta: n(row.beta),
    mean: n(row.mean),
    errorFactor: n(row.errorFactor),
    dateRange: row.dateRange ?? "",
    effectiveDate: row.effectiveDate ?? "",
  };
}
function formToBody(form: FormState): CreateComponentParameterBody {
  const num = (s: string): number | undefined => (s !== "" ? Number(s) : undefined);
  const str = (s: string): string | undefined => (s !== "" ? s : undefined);
  return {
    componentType: form.componentType,
    componentFailureMode: form.componentFailureMode,
    grouping: str(form.grouping),
    description: str(form.description),
    dataSource: str(form.dataSource),
    failures: num(form.failures),
    units: str(form.units),
    dhUnit: str(form.dhUnit),
    dhValue: num(form.dhValue),
    componentCount: num(form.componentCount),
    distribution: str(form.distribution),
    analysisType: str(form.analysisType),
    fth: num(form.fth),
    median: num(form.median),
    nfth: num(form.nfth),
    alpha: num(form.alpha),
    beta: num(form.beta),
    mean: num(form.mean),
    errorFactor: num(form.errorFactor),
    dateRange: str(form.dateRange),
    effectiveDate: str(form.effectiveDate),
  };
}
function DataAnalysisDetail(): JSX.Element {
  const { dataAnalysisId } = useParams<{
    dataAnalysisId: string;
  }>();
  const parsedId = Number(dataAnalysisId ?? "0");
  const [rows, setRows] = useState<ComponentParameterType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<CreateComponentParameterBody[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const loadRows = useCallback((): void => {
    if (!parsedId) return;
    setIsLoading(true);
    GetComponentParameters(parsedId)
      .then((data) => {
        setRows(data);
      })
      .catch((_: unknown) => {
        setRows([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [parsedId]);
  useEffect(() => {
    loadRows();
  }, [loadRows]);
  const handleAdd = useCallback((): void => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  }, []);
  const handleEdit = useCallback((row: ComponentParameterType): void => {
    setForm(rowToForm(row));
    setIsEditing(true);
    setEditingId(row.id);
    setFormError(null);
    setModalOpen(true);
  }, []);
  const handleCloseModal = useCallback((): void => {
    setModalOpen(false);
    setFormError(null);
  }, []);
  const handleSubmit = useCallback((): void => {
    if (form.componentType.trim() === "" || form.componentFailureMode.trim() === "") {
      setFormError("Component Type and Failure Mode are required.");
      return;
    }
    setIsSubmitting(true);
    const body = formToBody(form);
    const request =
      isEditing && editingId !== null ?
        PatchComponentParameter(editingId, body)
      : PostComponentParameter(parsedId, body);
    request
      .then(() => {
        setModalOpen(false);
        loadRows();
      })
      .catch((_: unknown) => {
        setFormError("An error occurred. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [form, isEditing, editingId, parsedId, loadRows]);
  const handleDelete = useCallback((id: number): void => {
    setDeletingId(id);
  }, []);
  const handleConfirmDelete = useCallback((): void => {
    if (deletingId === null) return;
    setIsDeleting(true);
    DeleteComponentParameter(deletingId)
      .then(() => {
        setDeletingId(null);
        loadRows();
      })
      .catch((_: unknown) => {
        setDeletingId(null);
      })
      .finally(() => {
        setIsDeleting(false);
      });
  }, [deletingId, loadRows]);
  const handleCancelDelete = useCallback((): void => {
    setDeletingId(null);
  }, []);
  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
  }, []);
  const handleImportClick = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (evt): void => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const parsed = parseComponentReliabilitySheet(wb);
        if (parsed.length === 0) {
          setImportError("No data rows were found. Make sure you selected the correct sheet.");
          return;
        }
        setImportRows(parsed);
        setImportModalOpen(true);
      } catch {
        setImportError("Failed to parse the file. Please check the format and try again.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);
  const handleImportConfirm = useCallback((): void => {
    if (importRows.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    let completed = 0;
    const postNext = (): void => {
      if (completed >= importRows.length) {
        setIsImporting(false);
        setImportModalOpen(false);
        setImportRows([]);
        loadRows();
        return;
      }
      PostComponentParameter(parsedId, importRows[completed])
        .then(() => {
          completed++;
          setImportProgress(Math.round((completed / importRows.length) * 100));
          postNext();
        })
        .catch(() => {
          setImportError(`Failed on row ${String(completed + 1)}. Partial import may have occurred.`);
          setIsImporting(false);
        });
    };
    postNext();
  }, [importRows, parsedId, loadRows]);
  const handleImportCancel = useCallback((): void => {
    if (isImporting) return;
    setImportModalOpen(false);
    setImportRows([]);
    setImportError(null);
  }, [isImporting]);
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
    >
      <EuiPageTemplate.Section>
        <EuiTitle size="m">
          <h2>Component Reliability Parameters</h2>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiSkeletonRectangle
          width="100%"
          height={490}
          borderRadius="m"
          isLoading={isLoading}
          contentAriaLabel="Component reliability parameters table"
        >
          {importError !== null && !importModalOpen && (
            <>
              <EuiCallOut
                title="Import error"
                color="danger"
                iconType="alert"
              >
                <p>{importError}</p>
              </EuiCallOut>
              <EuiSpacer size="s" />
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <ComponentReliabilityTable
            rows={rows}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onImport={handleImportClick}
          />
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>

      {modalOpen && (
        <EuiModal
          onClose={handleCloseModal}
          style={{ minWidth: 600 }}
        >
          <EuiModalHeader>
            <EuiModalHeaderTitle>
              {isEditing ? "Edit Component Parameter" : "Add Component Parameter"}
            </EuiModalHeaderTitle>
          </EuiModalHeader>

          <EuiModalBody>
            <EuiForm
              isInvalid={formError !== null}
              error={formError !== null ? [formError] : []}
            >
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow
                    label="Component Type"
                    isInvalid={form.componentType.trim() === ""}
                  >
                    <EuiFieldText
                      value={form.componentType}
                      isInvalid={form.componentType.trim() === ""}
                      onChange={(e): void => {
                        setField("componentType", e.target.value);
                      }}
                      placeholder="e.g. AOV, MOV, Pump"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow
                    label="Failure Mode"
                    isInvalid={form.componentFailureMode.trim() === ""}
                  >
                    <EuiFieldText
                      value={form.componentFailureMode}
                      isInvalid={form.componentFailureMode.trim() === ""}
                      onChange={(e): void => {
                        setField("componentFailureMode", e.target.value);
                      }}
                      placeholder="e.g. FTO, FTC, SPO"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Grouping">
                    <EuiFieldText
                      value={form.grouping}
                      onChange={(e): void => {
                        setField("grouping", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Data Source">
                    <EuiFieldText
                      value={form.dataSource}
                      onChange={(e): void => {
                        setField("dataSource", e.target.value);
                      }}
                      placeholder="e.g. NUREG/CR-6928"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiFormRow label="Description">
                <EuiFieldText
                  value={form.description}
                  onChange={(e): void => {
                    setField("description", e.target.value);
                  }}
                />
              </EuiFormRow>

              <EuiSpacer size="s" />

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Failures">
                    <EuiFieldNumber
                      value={form.failures}
                      onChange={(e): void => {
                        setField("failures", e.target.value);
                      }}
                      min={0}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Units">
                    <EuiFieldText
                      value={form.units}
                      onChange={(e): void => {
                        setField("units", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="D/H Unit">
                    <EuiFieldText
                      value={form.dhUnit}
                      onChange={(e): void => {
                        setField("dhUnit", e.target.value);
                      }}
                      placeholder="D or H"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="D/H Value">
                    <EuiFieldNumber
                      value={form.dhValue}
                      onChange={(e): void => {
                        setField("dhValue", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Component Count">
                    <EuiFieldNumber
                      value={form.componentCount}
                      onChange={(e): void => {
                        setField("componentCount", e.target.value);
                      }}
                      min={0}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Date Range">
                    <EuiFieldText
                      value={form.dateRange}
                      onChange={(e): void => {
                        setField("dateRange", e.target.value);
                      }}
                      placeholder="e.g. 2000-2020"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Distribution">
                    <EuiFieldText
                      value={form.distribution}
                      onChange={(e): void => {
                        setField("distribution", e.target.value);
                      }}
                      placeholder="e.g. LOGNORMAL, BETA"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Analysis Type">
                    <EuiFieldText
                      value={form.analysisType}
                      onChange={(e): void => {
                        setField("analysisType", e.target.value);
                      }}
                      placeholder="e.g. MLE, Bayesian"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Effective Date">
                    <EuiFieldText
                      value={form.effectiveDate}
                      onChange={(e): void => {
                        setField("effectiveDate", e.target.value);
                      }}
                      placeholder="YYYY-MM-DD"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiSpacer size="s" />

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="5th Percentile">
                    <EuiFieldNumber
                      value={form.fth}
                      onChange={(e): void => {
                        setField("fth", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Median">
                    <EuiFieldNumber
                      value={form.median}
                      onChange={(e): void => {
                        setField("median", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="95th Percentile">
                    <EuiFieldNumber
                      value={form.nfth}
                      onChange={(e): void => {
                        setField("nfth", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label={"\u03B1 (Alpha)"}>
                    <EuiFieldNumber
                      value={form.alpha}
                      onChange={(e): void => {
                        setField("alpha", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label={"\u03B2 (Beta)"}>
                    <EuiFieldNumber
                      value={form.beta}
                      onChange={(e): void => {
                        setField("beta", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Mean">
                    <EuiFieldNumber
                      value={form.mean}
                      onChange={(e): void => {
                        setField("mean", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Error Factor">
                    <EuiFieldNumber
                      value={form.errorFactor}
                      onChange={(e): void => {
                        setField("errorFactor", e.target.value);
                      }}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiForm>
          </EuiModalBody>

          <EuiModalFooter>
            <EuiButtonEmpty onClick={handleCloseModal}>Cancel</EuiButtonEmpty>
            <EuiButton
              fill
              isLoading={isSubmitting}
              onClick={handleSubmit}
            >
              {isEditing ? "Save Changes" : "Add"}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}

      {importModalOpen && (
        <EuiModal
          onClose={handleImportCancel}
          style={{ minWidth: 480 }}
        >
          <EuiModalHeader>
            <EuiModalHeaderTitle>Import Component Parameters</EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            {importError !== null ?
              <EuiCallOut
                title="Import error"
                color="danger"
                iconType="alert"
              >
                <p>{importError}</p>
              </EuiCallOut>
            : isImporting ?
              <>
                <EuiText size="s">
                  <p>Importing {String(importRows.length)} rows…</p>
                </EuiText>
                <EuiSpacer size="s" />
                <EuiProgress
                  value={importProgress}
                  max={100}
                  size="m"
                  color="primary"
                />
              </>
            : <EuiText size="s">
                <p>
                  <strong>{String(importRows.length)} rows</strong> were detected. They will be imported into this data
                  analysis. This cannot be undone.
                </p>
              </EuiText>
            }
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButtonEmpty
              onClick={handleImportCancel}
              isDisabled={isImporting}
            >
              Cancel
            </EuiButtonEmpty>
            <EuiButton
              fill
              isLoading={isImporting}
              isDisabled={importError !== null}
              onClick={handleImportConfirm}
            >
              Import
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}

      {deletingId !== null && (
        <EuiConfirmModal
          title="Delete component parameter?"
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          isLoading={isDeleting}
        >
          <p>This action cannot be undone.</p>
        </EuiConfirmModal>
      )}
    </EuiPageTemplate>
  );
}
export { DataAnalysisDetail };
