import { useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Edge, Node } from "reactflow";
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCard,
  EuiEmptyPrompt,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPageTemplate,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from "@elastic/eui";
import {
  CreatePlantDiagram,
  GetPlantDiagramById,
  GetPlantDiagramsByModel,
  PlantDiagramType,
  SavePlantDiagram,
} from "shared-sdk/lib/api/PlantDiagramApiManager";
import { PlantDiagramEditor } from "../../components/diagrams/plantDiagramEditor";
import { parseDexpiXml } from "../../components/diagrams/dexpiParser";
interface CreateModalProps {
  modelId: number;
  onCreated: (diagram: PlantDiagramType) => void;
  onClose: () => void;
}
function CreateDiagramModal({ modelId, onCreated, onClose }: CreateModalProps): JSX.Element {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"PID" | "PFD">("PID");
  const [loading, setLoading] = useState(false);
  const [dexpiXml, setDexpiXml] = useState<string | null>(null);
  const [dexpiFileName, setDexpiFileName] = useState<string | null>(null);
  const [dexpiError, setDexpiError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDexpiFileName(file.name);
    setDexpiError(null);
    const reader = new FileReader();
    reader.onload = (): void => {
      setDexpiXml(reader.result as string);
    };
    reader.readAsText(file);
  };
  const handleCreate = async (): Promise<void> => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const diagram = await CreatePlantDiagram({
        typedModelId: modelId,
        title: title.trim(),
        diagramType: type,
      });
      if (dexpiXml) {
        const result = parseDexpiXml(dexpiXml);
        if (result.error) {
          setDexpiError(`Import error: ${result.error}`);
          setLoading(false);
          return;
        }
        if (result.nodes.length > 0 || result.edges.length > 0) {
          await SavePlantDiagram(diagram.id, {
            nodes: result.nodes as PlantDiagramType["nodes"],
            edges: result.edges as PlantDiagramType["edges"],
          });
          diagram.nodes = result.nodes as PlantDiagramType["nodes"];
          diagram.edges = result.edges as PlantDiagramType["edges"];
        }
      }
      onCreated(diagram);
    } finally {
      setLoading(false);
    }
  };
  return (
    <EuiModal
      onClose={onClose}
      style={{ minWidth: 460 }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>Create Plant Diagram</EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Title</label>
            <EuiFieldText
              value={title}
              onChange={(e): void => {
                setTitle(e.target.value);
              }}
              placeholder="e.g. Feed System P&ID"
              autoFocus
              onKeyDown={(e): void => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Diagram type</label>
            <EuiSelect
              options={[
                { value: "PID", text: "P&ID — Piping & Instrumentation Diagram" },
                { value: "PFD", text: "PFD — Process Flow Diagram" },
              ]}
              value={type}
              onChange={(e): void => {
                setType(e.target.value as "PID" | "PFD");
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Import from DEXPI XML <span style={{ fontWeight: 400, color: "#69707d" }}>(optional)</span>
            </label>
            <EuiText
              size="xs"
              color="subdued"
              style={{ marginBottom: 6 }}
            >
              <p>
                Select a DEXPI / Proteus XML file to pre-populate the diagram with equipment, valves, instruments, and
                piping connections.
              </p>
            </EuiText>
            <EuiButton
              size="s"
              iconType="importAction"
              onClick={(): void => {
                fileRef.current?.click();
              }}
            >
              {dexpiFileName ? `File: ${dexpiFileName}` : "Choose DEXPI XML file…"}
            </EuiButton>
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            {dexpiFileName && !dexpiError && (
              <EuiText
                size="xs"
                color="success"
                style={{ marginTop: 4 }}
              >
                <p>File ready — diagram will be pre-populated on creation.</p>
              </EuiText>
            )}
            {dexpiError && (
              <EuiText
                size="xs"
                color="danger"
                style={{ marginTop: 4 }}
              >
                <p>{dexpiError}</p>
              </EuiText>
            )}
          </div>
        </div>
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>Cancel</EuiButtonEmpty>
        <EuiButton
          fill
          isLoading={loading}
          isDisabled={!title.trim()}
          onClick={handleCreate}
        >
          Create
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
}
function PlantDiagramsList(): JSX.Element {
  const { modelId } = useParams<{
    modelId: string;
  }>();
  const navigate = useNavigate();
  const parsedModelId = Number(modelId);
  const [diagrams, setDiagrams] = useState<PlantDiagramType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await GetPlantDiagramsByModel(parsedModelId);
        setDiagrams(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [parsedModelId]);
  const handleCreated = useCallback(
    (diagram: PlantDiagramType): void => {
      setDiagrams((prev) => [...prev, diagram]);
      setShowCreate(false);
      navigate(String(diagram.id));
    },
    [navigate],
  );
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
    >
      <EuiPageTemplate.Section>
        <EuiFlexGroup
          justifyContent="spaceBetween"
          alignItems="center"
        >
          <EuiFlexItem grow={false}>
            <EuiTitle size="m">
              <h2>Plant Diagrams</h2>
            </EuiTitle>
            <EuiText
              size="s"
              color="subdued"
              style={{ marginTop: 4 }}
            >
              <p>P&amp;ID and PFD diagrams for this PRA model.</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              iconType="plusInCircle"
              onClick={(): void => {
                setShowCreate(true);
              }}
            >
              Create Diagram
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="l" />

        {loading && (
          <EuiFlexGroup justifyContent="center">
            <EuiFlexItem grow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiFlexItem>
          </EuiFlexGroup>
        )}

        {!loading && diagrams.length === 0 && (
          <EuiEmptyPrompt
            iconType="tableDensityNormal"
            title={<h2>No plant diagrams yet</h2>}
            body={
              <p>
                Create a P&amp;ID or PFD to start building your plant diagram. You can also import an existing DEXPI XML
                file during creation.
              </p>
            }
            actions={
              <EuiButton
                fill
                onClick={(): void => {
                  setShowCreate(true);
                }}
              >
                Create Diagram
              </EuiButton>
            }
          />
        )}

        {!loading && diagrams.length > 0 && (
          <EuiFlexGroup
            wrap
            gutterSize="m"
          >
            {diagrams.map((d) => (
              <EuiFlexItem
                key={d.id}
                grow={false}
                style={{ minWidth: 280, maxWidth: 320 }}
              >
                <EuiCard
                  title={d.title}
                  description={d.description || "No description"}
                  footer={
                    <EuiFlexGroup
                      justifyContent="spaceBetween"
                      alignItems="center"
                    >
                      <EuiFlexItem grow={false}>
                        <EuiBadge color={d.diagramType === "PFD" ? "accent" : "primary"}>{d.diagramType}</EuiBadge>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText
                          size="xs"
                          color="subdued"
                        >
                          {d.nodes.length} symbol{d.nodes.length !== 1 ? "s" : ""}, {d.edges.length} line
                          {d.edges.length !== 1 ? "s" : ""}
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  }
                  onClick={(): void => {
                    navigate(String(d.id));
                  }}
                />
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        )}

        {showCreate && (
          <CreateDiagramModal
            modelId={parsedModelId}
            onCreated={handleCreated}
            onClose={(): void => {
              setShowCreate(false);
            }}
          />
        )}
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
function PlantDiagramEditorPage(): JSX.Element {
  const { diagramId } = useParams<{
    diagramId: string;
  }>();
  const navigate = useNavigate();
  const [diagram, setDiagram] = useState<PlantDiagramType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const d = await GetPlantDiagramById(Number(diagramId));
        if (!d) {
          setError("Diagram not found.");
          return;
        }
        setDiagram(d);
      } catch {
        setError("Failed to load diagram.");
      } finally {
        setLoading(false);
      }
    })();
  }, [diagramId]);
  const handleSave = useCallback(
    async (
      nodes: Node[],
      edges: Edge[],
      viewport: {
        x: number;
        y: number;
        zoom: number;
      },
    ): Promise<void> => {
      if (!diagram) return;
      await SavePlantDiagram(diagram.id, {
        nodes: nodes as PlantDiagramType["nodes"],
        edges: edges as PlantDiagramType["edges"],
        viewport,
      });
    },
    [diagram],
  );
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <EuiLoadingSpinner size="xl" />
      </div>
    );
  }
  if (error || !diagram) {
    return (
      <EuiEmptyPrompt
        iconType="alert"
        color="danger"
        title={<h2>Error</h2>}
        body={<p>{error ?? "Unknown error"}</p>}
        actions={
          <EuiButton
            onClick={(): void => {
              navigate("..");
            }}
          >
            Back to diagrams
          </EuiButton>
        }
      />
    );
  }
  return (
    <div style={{ width: "100%", height: "calc(100vh - 48px)", overflow: "hidden" }}>
      <PlantDiagramEditor
        diagram={diagram}
        onSave={handleSave}
        onBack={(): void => {
          navigate("..");
        }}
      />
    </div>
  );
}
function PlantDiagrams(): JSX.Element {
  return (
    <Routes>
      <Route
        path=""
        element={<PlantDiagramsList />}
      />
      <Route
        path=":diagramId"
        element={<PlantDiagramEditorPage />}
      />
    </Routes>
  );
}
export { PlantDiagrams };
