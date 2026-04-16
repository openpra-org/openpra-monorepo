import React, { useState } from "react";
import {
  EuiTitle,
  EuiSpacer,
  EuiFormRow,
  EuiSelect,
  EuiButton,
  EuiLoadingSpinner,
  EuiText,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiBasicTable,
  EuiBadge,
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiButtonEmpty,
} from "@elastic/eui";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import {
  EventTreeAlgorithm,
  EventTreeQuantificationResult,
  EventTreeSequenceResult,
} from "shared-types/src/lib/types/eventTreeQuantification";

interface EventTreeQuantificationPanelProps {
  eventTreeId: string;
}

export function EventTreeQuantificationPanel({ eventTreeId }: EventTreeQuantificationPanelProps): JSX.Element {
  const [algorithm, setAlgorithm] = useState<EventTreeAlgorithm>("zbdd");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<EventTreeQuantificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const algorithmOptions = [
    { value: "zbdd", text: "ZBDD" },
    { value: "mocus", text: "MOCUS" },
    { value: "bdd", text: "BDD" },
    { value: "monte_carlo", text: "Monte Carlo" },
  ];

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await GraphApiManager.quantifyEventTree(eventTreeId, { algorithm });
      setResult(res);
      if (res.sequences.length > 0) setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quantification failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <div style={{ padding: "24px 16px 16px" }}>
        <EuiTitle size="xs">
          <h3>Quantification</h3>
        </EuiTitle>
        <EuiSpacer size="s" />

        <EuiFormRow
          label="Algorithm"
          fullWidth
        >
          <EuiSelect
            fullWidth
            options={algorithmOptions}
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value as EventTreeAlgorithm);
              setError(null);
              setResult(null);
            }}
          />
        </EuiFormRow>

        <EuiSpacer size="m" />

        <EuiButton
          fullWidth
          fill
          iconType="play"
          isLoading={isRunning}
          onClick={handleRun}
        >
          {isRunning ? "Running…" : "Quantify"}
        </EuiButton>

        {isRunning && (
          <>
            <EuiSpacer size="s" />
            <EuiFlexGroup
              justifyContent="center"
              alignItems="center"
              gutterSize="s"
            >
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="m" />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText
                  size="s"
                  color="subdued"
                >
                  Running {algorithm.toUpperCase()}…
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </>
        )}

        {error && (
          <>
            <EuiSpacer size="s" />
            <EuiCallOut
              title="Quantification failed"
              color="danger"
              iconType="alert"
              size="s"
            >
              <EuiText size="xs">{error}</EuiText>
            </EuiCallOut>
          </>
        )}

        {result && !isRunning && (
          <>
            <EuiSpacer size="m" />
            <EuiButton
              fullWidth
              iconType="tableDensityNormal"
              onClick={() => setIsModalOpen(true)}
            >
              View Results
            </EuiButton>
          </>
        )}
      </div>

      {result && isModalOpen && (
        <ResultsModal
          result={result}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

function ResultsModal({ result, onClose }: { result: EventTreeQuantificationResult; onClose: () => void }) {
  const columns = [
    {
      field: "sequenceId",
      name: "Sequence ID",
      width: "120px",
    },
    {
      field: "frequency",
      name: "Frequency",
      width: "120px",
      render: (freq: number) => <span style={{ fontFamily: "monospace" }}>{freq.toExponential(3)}</span>,
    },
    {
      field: "cutSets",
      name: "Cut Sets",
      render: (cutSets: any[]) => (
        <EuiText size="xs">
          {cutSets.length > 0 ? cutSets.map((cs) => cs.events.join(", ")).join(" | ") : "No cut sets"}
        </EuiText>
      ),
    },
  ];

  return (
    <EuiModal
      onClose={onClose}
      maxWidth={800}
      style={{ width: "min(800px, 90vw)" }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>Event Tree Results</EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        <EuiBasicTable
          items={result.sequences}
          columns={columns}
        />
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiModalFooter>
    </EuiModal>
  );
}
