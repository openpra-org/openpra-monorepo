import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EuiCallOut, EuiPageTemplate, EuiSkeletonRectangle, EuiSpacer, EuiTitle } from "@elastic/eui";
import {
  AddFmeaColumn,
  AddFmeaRow,
  CreateFmea,
  DeleteFmeaColumn,
  DeleteFmeaRow,
  FmeaType,
  GetFmeaBySaId,
  UpdateFmeaCell,
  UpdateFmeaColumnDetails,
} from "shared-sdk/lib/api/FmeaApiManager";
import { FmeaTable } from "../../components/tables/fmeaTable";

function SystemsAnalysisDetail(): JSX.Element {
  const { systemsAnalysisId } = useParams<{ systemsAnalysisId: string }>();
  const parsedId = Number(systemsAnalysisId ?? "0");

  const [fmea, setFmea] = useState<FmeaType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFmea = useCallback((): void => {
    if (!parsedId) return;
    setIsLoading(true);
    setError(null);
    GetFmeaBySaId(parsedId)
      .then((results) => {
        if (results.length > 0) {
          setFmea(results[0]);
          setIsLoading(false);
        } else {
          return CreateFmea({ systemsAnalysisId: parsedId, title: "FMEA", description: "" }).then((created) => {
            setFmea(created);
            setIsLoading(false);
          });
        }
      })
      .catch(() => {
        setError("Failed to load FMEA. Please try again.");
        setIsLoading(false);
      });
  }, [parsedId]);

  useEffect(() => {
    loadFmea();
  }, [loadFmea]);

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
  );
}

export { SystemsAnalysisDetail };
