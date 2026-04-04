import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  EuiButton,
  EuiButtonEmpty,
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
  EuiSkeletonRectangle,
  EuiSpacer,
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
  const { dataAnalysisId } = useParams<{ dataAnalysisId: string }>();
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
          <ComponentReliabilityTable
            rows={rows}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>

      {}
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
              {}
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

              {}
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
                      min={1}
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

              {}
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

      {}
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
