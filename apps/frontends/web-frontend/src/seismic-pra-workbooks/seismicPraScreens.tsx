import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type JSX, type ReactNode, useMemo, useState } from "react";
import { useSeismicPraWorkbook } from "./seismicPraWorkbookContext";
import { AdvancedJsonEditor, EmptyState, Field, NumberInput, Section, SelectInput, Tag, TextArea, TextInput } from "./seismicPraFields";
import { generateSeismicPraReport } from "./seismicPraDocx";

function useUpdate(): { mef: SeismicPRA; editable: boolean; update: (change: (draft: SeismicPRA) => void) => void } {
  const { mef, editable, mutate } = useSeismicPraWorkbook();
  function update(change: (draft: SeismicPRA) => void): void {
    mutate((current) => {
      const draft = structuredClone(current);
      change(draft);
      const now = new Date().toISOString();
      draft.modified = now;
      draft.metadata.lastModifiedDate = now;
      return draft;
    });
  }
  return { mef, editable, update };
}

function FieldGrid({ children }: { children: ReactNode }): JSX.Element { return <div className="sfieldgrid">{children}</div>; }

function StringList({ values, editable, onChange, addLabel = "Add item" }: { values: string[]; editable: boolean; onChange: (values: string[]) => void; addLabel?: string }): JSX.Element {
  return <div className="sstringlist">{values.map((value, index) => <div className="sstringlist__row" key={`${index}-${value}`}><TextInput value={value} disabled={!editable} onChange={(next) => onChange(values.map((item, itemIndex) => itemIndex === index ? next : item))} />{editable && <button type="button" className="siconbtn" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove">×</button>}</div>)}{editable && <button type="button" className="sbtn sbtn--ghost" onClick={() => onChange([...values, ""])}>+ {addLabel}</button>}</div>;
}

function ScopeScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const identity = mef.metadata.plantIdentity;
  return <>
    <Section eyebrow="S1 · Integrated basis" title="Seismic PRA scope" description="One integrated technical element, with three separately traceable subelements and controlled interfaces." tone="integration">
      <Field label="PRA scope" wide><TextArea value={mef.praScope} rows={6} disabled={!editable} onChange={(value) => update((draft) => { draft.praScope = value; draft.metadata.scope = value; })} /></Field>
      <FieldGrid>
        <Field label="Plant stage"><SelectInput value={mef.plantStage} disabled={!editable} options={[{ value: "PRE_OPERATIONAL", label: "Pre-operational" }, { value: "OPERATIONAL", label: "Operational" }]} onChange={(value) => update((draft) => { draft.plantStage = value as SeismicPRA["plantStage"]; })} /></Field>
        <Field label="Capability category"><SelectInput value={mef.capabilityCategory ?? "CC-II"} disabled={!editable} options={[{ value: "CC-I", label: "CC-I" }, { value: "CC-II", label: "CC-II" }]} onChange={(value) => update((draft) => { draft.capabilityCategory = value as "CC-I" | "CC-II"; })} /></Field>
        <Field label="Version"><TextInput value={mef.version} disabled={!editable} onChange={(value) => update((draft) => { draft.version = value; draft.metadata.versionInfo.version = value; })} /></Field>
        <Field label="Owner"><TextInput value={mef.owner ?? ""} disabled={!editable} onChange={(value) => update((draft) => { draft.owner = value; })} /></Field>
      </FieldGrid>
    </Section>
    <Section eyebrow="Plant representation" title="Reference plant and site" description="The plant identity is shared by the hazard, fragility, and plant-response models.">
      <FieldGrid>
        <Field label="Plant name"><TextInput value={identity?.name ?? ""} disabled={!editable} onChange={(value) => update((draft) => { draft.metadata.plantIdentity = { name: value, vendor: identity?.vendor ?? "", reactorType: identity?.reactorType ?? "", thermalPower: identity?.thermalPower ?? "", primaryCoolant: identity?.primaryCoolant ?? "" }; })} /></Field>
        <Field label="Reactor type"><TextInput value={identity?.reactorType ?? ""} disabled={!editable} onChange={(value) => update((draft) => { if (draft.metadata.plantIdentity !== undefined) draft.metadata.plantIdentity.reactorType = value; })} /></Field>
        <Field label="Site"><TextInput value={identity?.siteName ?? ""} disabled={!editable} onChange={(value) => update((draft) => { if (draft.metadata.plantIdentity !== undefined) draft.metadata.plantIdentity.siteName = value; })} /></Field>
        <Field label="Modules / units"><NumberInput value={identity?.numberOfModules ?? 1} disabled={!editable} step="1" onChange={(value) => update((draft) => { if (draft.metadata.plantIdentity !== undefined) draft.metadata.plantIdentity.numberOfModules = value; })} /></Field>
      </FieldGrid>
      <Field label="Analysis limitations" wide><StringList values={mef.metadata.limitations} editable={editable} onChange={(values) => update((draft) => { draft.metadata.limitations = values; })} addLabel="limitation" /></Field>
      <AdvancedJsonEditor title="integrated scope and metadata" value={{ praScope: mef.praScope, metadata: mef.metadata, commonAssumptions: mef.commonAssumptions ?? [], preOperationalAssumptions: mef.preOperationalAssumptions ?? [] }} editable={editable} onApply={(value) => update((draft) => { draft.praScope = value.praScope; draft.metadata = value.metadata; draft.commonAssumptions = value.commonAssumptions; draft.preOperationalAssumptions = value.preOperationalAssumptions; })} />
    </Section>
  </>;
}

function HazardBasisScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const sha = mef.seismicHazardAnalysis;
  const site = sha.analysisBasis.site;
  return <>
    <Section eyebrow="SHA · HLR-A" title="Site and structured hazard process" description="Define the site basis and the structured process used to capture the center, body, and range of technically defensible interpretations." tone="sha">
      <FieldGrid>
        <Field label="Site basis"><SelectInput value={site.siteBasis} disabled={!editable} options={[{ value: "IDENTIFIED_SITE", label: "Identified site" }, { value: "BOUNDING_SITE", label: "Bounding site" }]} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.site.siteBasis = value as typeof site.siteBasis; })} /></Field>
        <Field label="Site name"><TextInput value={site.siteName ?? ""} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.site.siteName = value; })} /></Field>
        <Field label="Structured process"><SelectInput value={sha.analysisBasis.structuredProcess.processType} disabled={!editable} options={[1, 2, 3, 4].map((level) => ({ value: `SSHAC_LEVEL_${level}`, label: `SSHAC Level ${level}` }))} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.structuredProcess.processType = value as typeof sha.analysisBasis.structuredProcess.processType; })} /></Field>
        <Field label="Bounds all sites"><SelectInput value={site.boundsAllSitesInScope ? "yes" : "no"} disabled={!editable} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.site.boundsAllSitesInScope = value === "yes"; })} /></Field>
      </FieldGrid>
      <Field label="Selection and applicability basis" wide><TextArea value={site.selectionAndApplicabilityBasis} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.site.selectionAndApplicabilityBasis = value; })} /></Field>
      <Field label="Center, body, and range demonstration" wide><TextArea value={sha.analysisBasis.structuredProcess.centerBodyRangeDemonstration} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.structuredProcess.centerBodyRangeDemonstration = value; })} /></Field>
    </Section>
    <Section eyebrow="Shared motion definition" title="Ground-motion parameters" description="These identifiers, units, component definitions, control points, and ranges must remain consistent through SFR and SPR." tone="sha" actions={editable && <button type="button" className="sbtn sbtn--primary" onClick={() => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters.push({ uuid: crypto.randomUUID(), name: "New ground-motion parameter", parameterType: "SPECTRAL_ACCELERATION", direction: "GEOMETRIC_MEAN_HORIZONTAL", units: "g", dampingRatio: 0.05, componentDefinition: "", selectedRange: { minimum: 0, maximum: 1 }, selectedFrequencyRangeHz: { lower: 0.5, upper: 100 }, usedForHazard: true, usedForFragility: true, usedForPlantResponse: true, consistencyBasis: "", implementsSrs: [] }); })}>+ Parameter</button>}>
      {sha.analysisBasis.groundMotionParameters.length === 0 ? <EmptyState title="No ground-motion parameters" detail="Add the common motion definition that SHA will produce and SFR/SPR will consume." /> : <div className="scards">{sha.analysisBasis.groundMotionParameters.map((parameter, index) => <article className="srecord" key={parameter.uuid}>
        <div className="srecord__head"><div><Tag tone="sha">{parameter.parameterType.replace(/_/g, " ")}</Tag><h3>{parameter.name}</h3><code>{parameter.uuid}</code></div>{editable && <button type="button" className="siconbtn" onClick={() => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters.splice(index, 1); })}>×</button>}</div>
        <FieldGrid><Field label="Name"><TextInput value={parameter.name} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters[index]!.name = value; })} /></Field><Field label="Units"><TextInput value={parameter.units} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters[index]!.units = value; })} /></Field><Field label="Minimum"><NumberInput value={parameter.selectedRange.minimum} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters[index]!.selectedRange.minimum = value; })} /></Field><Field label="Maximum"><NumberInput value={parameter.selectedRange.maximum} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis.groundMotionParameters[index]!.selectedRange.maximum = value; })} /></Field></FieldGrid>
      </article>)}</div>}
      <AdvancedJsonEditor title="SHA analysis basis" value={sha.analysisBasis} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.analysisBasis = value; })} />
    </Section>
  </>;
}

function EarthScienceScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const inputs = mef.seismicHazardAnalysis.earthScienceInputs;
  return <>
    <Section eyebrow="SHA · HLR-B" title="Earth-science data and catalog" description="Current, traceable geology, seismology, geophysics, geotechnical, topographic, paleoseismic, and strong-motion inputs." tone="sha">
      <FieldGrid><Field label="Compilation cutoff"><TextInput value={inputs.compilationCutoffDate} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.earthScienceInputs.compilationCutoffDate = value; })} /></Field><Field label="Catalog end"><TextInput value={inputs.earthquakeCatalog.catalogEndDate} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.earthScienceInputs.earthquakeCatalog.catalogEndDate = value; })} /></Field></FieldGrid>
      <Field label="Data-gap assessment" wide><TextArea value={inputs.dataGapAssessment} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.earthScienceInputs.dataGapAssessment = value; })} /></Field>
      <Field label="Subject-matter-expert review" wide><TextArea value={inputs.subjectMatterExpertReview} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.earthScienceInputs.subjectMatterExpertReview = value; })} /></Field>
      <div className="stablewrap"><table className="stable"><thead><tr><th>Data set</th><th>Discipline</th><th>Coverage</th><th>Currentness</th></tr></thead><tbody>{inputs.dataSets.map((data) => <tr key={data.uuid}><td><strong>{data.name}</strong><code>{data.sourceReference}</code></td><td><Tag tone="sha">{data.discipline}</Tag></td><td>{data.spatialCoverage}</td><td>{data.currentnessAssessment}</td></tr>)}</tbody></table></div>
      <AdvancedJsonEditor title="earth-science inputs" value={inputs} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.earthScienceInputs = value; })} />
    </Section>
  </>;
}

function SourceGroundMotionScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const source = mef.seismicHazardAnalysis.sourceCharacterization;
  const ground = mef.seismicHazardAnalysis.groundMotionCharacterization;
  return <>
    <Section eyebrow="SHA · HLR-C" title="Seismic source characterization" description="Source geometry, maximum magnitude, recurrence, dependencies, and epistemic alternatives." tone="sha">
      <Field label="Structured approach" wide><TextArea value={source.structuredApproach} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.sourceCharacterization.structuredApproach = value; })} /></Field>
      <div className="scards">{source.earthquakeSources.map((item) => <article className="srecord" key={item.uuid}><div className="srecord__head"><div><Tag tone="sha">{item.sourceType}</Tag><h3>{item.name}</h3><code>{item.uuid}</code></div><Tag tone={item.majorHazardContributor ? "warn" : "neutral"}>{item.majorHazardContributor ? "Major contributor" : "Contributor"}</Tag></div><p>{item.characterizationBasis}</p><div className="srecord__stats"><span>Closest distance <strong>{item.geometry.closestDistanceToSiteKm ?? "—"} km</strong></span><span>MFD models <strong>{item.magnitudeFrequencyModels.length}</strong></span><span>Uncertainties <strong>{item.uncertainties.length}</strong></span></div></article>)}</div>
      <AdvancedJsonEditor title="source characterization" value={source} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.sourceCharacterization = value; })} />
    </Section>
    <Section eyebrow="SHA · HLR-D" title="Ground-motion characterization" description="Prediction models, strong-motion data, aleatory variability, reference horizons, and site-to-site variability." tone="sha">
      <Field label="Historical and instrumental review" wide><TextArea value={ground.historicalAndInstrumentalReview} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.groundMotionCharacterization.historicalAndInstrumentalReview = value; })} /></Field>
      <div className="stablewrap"><table className="stable"><thead><tr><th>Prediction model</th><th>Kind</th><th>Magnitude range</th><th>Distance</th><th>Weight</th></tr></thead><tbody>{ground.predictionModels.map((model) => <tr key={model.uuid}><td><strong>{model.name}</strong><code>{model.sourceReference}</code></td><td>{model.modelKind.replace(/_/g, " ")}</td><td>M {model.magnitudeRange.minimum}–{model.magnitudeRange.maximum}</td><td>{model.distanceRangeKm.minimum}–{model.distanceRangeKm.maximum} km</td><td>{model.logicTreeWeight.toFixed(2)}</td></tr>)}</tbody></table></div>
      <AdvancedJsonEditor title="ground-motion characterization" value={ground} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.groundMotionCharacterization = value; })} />
    </Section>
  </>;
}

function SiteResponseScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const site = mef.seismicHazardAnalysis.siteResponseAnalysis;
  return <>
    <Section eyebrow="SHA · HLR-E" title="Local site response" description="Profiles, strain-dependent properties, analysis methods, input motions, amplification, topology, and epistemic uncertainty." tone="sha">
      <FieldGrid><Field label="Local response"><SelectInput value={site.localSiteResponseIncluded ? "included" : "excluded"} disabled={!editable} options={[{ value: "included", label: "Included" }, { value: "excluded", label: "Not included" }]} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.siteResponseAnalysis.localSiteResponseIncluded = value === "included"; })} /></Field><Field label="Bounding variability"><SelectInput value={site.boundingSiteVariabilityIncluded ? "included" : "excluded"} disabled={!editable} options={[{ value: "included", label: "Included" }, { value: "excluded", label: "Not included" }]} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.siteResponseAnalysis.boundingSiteVariabilityIncluded = value === "included"; })} /></Field></FieldGrid>
      <Field label="Approach justification" wide><TextArea value={site.approachJustification} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.siteResponseAnalysis.approachJustification = value; })} /></Field>
      <div className="scards">{site.profiles.map((profile) => <article className="srecord" key={profile.uuid}><div className="srecord__head"><div><Tag tone="sha">{profile.profileType.replace(/_/g, " ")}</Tag><h3>{profile.name}</h3></div><strong>{profile.profileWeight ?? "—"}</strong></div><p>{profile.locationDescription}</p><div className="srecord__stats"><span>Layers <strong>{profile.layers.length}</strong></span><span>Bedrock <strong>{profile.depthToBedrock} {profile.depthUnit}</strong></span><span>Groundwater <strong>{profile.groundwaterDepth ?? "—"} {profile.depthUnit}</strong></span></div></article>)}</div>
      <Field label="Incorporation into hazard" wide><TextArea value={site.incorporationIntoHazardMethod} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.siteResponseAnalysis.incorporationIntoHazardMethod = value; })} /></Field>
      <AdvancedJsonEditor title="site-response analysis" value={site} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.siteResponseAnalysis = value; })} />
    </Section>
  </>;
}

function LineChart({ series, xLabel, yLabel, color = "#315fc7" }: { series: { x: number; y: number }[]; xLabel: string; yLabel: string; color?: string }): JSX.Element {
  if (series.length < 2) return <EmptyState title="No plottable results" detail="Load an example or add at least two result points." />;
  const xMin = Math.min(...series.map((point) => point.x)); const xMax = Math.max(...series.map((point) => point.x));
  const yPositive = series.map((point) => point.y).filter((value) => value > 0); const yMin = Math.min(...yPositive); const yMax = Math.max(...yPositive);
  const px = (x: number): number => 50 + ((x - xMin) / Math.max(xMax - xMin, 1e-12)) * 480;
  const py = (y: number): number => 25 + ((Math.log10(yMax) - Math.log10(Math.max(y, yMin))) / Math.max(Math.log10(yMax) - Math.log10(yMin), 1e-12)) * 210;
  const points = series.map((point) => `${px(point.x)},${py(point.y)}`).join(" ");
  return <div className="schart"><svg viewBox="0 0 570 290" role="img" aria-label={`${yLabel} versus ${xLabel}`}><line x1="50" x2="530" y1="235" y2="235" className="schart__axis" /><line x1="50" x2="50" y1="25" y2="235" className="schart__axis" />{[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}><line x1="50" x2="530" y1={25 + fraction * 210} y2={25 + fraction * 210} className="schart__grid" /><text x="43" y={29 + fraction * 210} textAnchor="end">{(10 ** (Math.log10(yMax) - fraction * (Math.log10(yMax) - Math.log10(yMin)))).toExponential(0)}</text></g>)}<polyline points={points} fill="none" stroke={color} strokeWidth="3" />{series.map((point, index) => <circle key={index} cx={px(point.x)} cy={py(point.y)} r="4" fill={color} />)}<text x="290" y="276" textAnchor="middle" className="schart__label">{xLabel}</text><text x="15" y="130" textAnchor="middle" transform="rotate(-90 15 130)" className="schart__label">{yLabel}</text><text x="50" y="253">{xMin}</text><text x="530" y="253" textAnchor="end">{xMax}</text></svg></div>;
}

function HazardResultsScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const quant = mef.seismicHazardAnalysis.hazardQuantification;
  const spectra = mef.seismicHazardAnalysis.responseSpectraEvaluation;
  const selectedCurve = quant.hazardCurves[0];
  return <>
    <Section eyebrow="SHA · HLR-F/H" title="Hazard curves and discretization" description="Mean and fractile hazard, lower and upper calculation bounds, uncertainty propagation, and the non-overlapping intervals delivered to SPR." tone="sha">
      {selectedCurve !== undefined && <><div className="scharthead"><div><strong>{selectedCurve.name}</strong><span>{selectedCurve.groundMotionParameterRef} · {selectedCurve.controlPointRef}</span></div><Tag tone="sha">{selectedCurve.statistic}</Tag></div><LineChart series={selectedCurve.points.map((point) => ({ x: point.groundMotion, y: point.annualFrequencyOfExceedance }))} xLabel={`Ground motion (${selectedCurve.groundMotionUnits})`} yLabel="Annual frequency of exceedance" /></>}
      <div className="stablewrap"><table className="stable"><thead><tr><th>Interval</th><th>Lower</th><th>Upper</th><th>Representative</th><th>Annual frequency</th></tr></thead><tbody>{quant.seismicPraInputs.hazardIntervals.map((interval) => <tr key={interval.uuid}><td><strong>{interval.name}</strong><code>{interval.uuid}</code></td><td>{interval.lowerGroundMotion} {interval.groundMotionUnits}</td><td>{interval.upperGroundMotion} {interval.groundMotionUnits}</td><td>{interval.representativeGroundMotion} {interval.groundMotionUnits}</td><td className="smono">{interval.annualFrequency.toExponential(3)}</td></tr>)}</tbody></table></div>
      <Field label="Transfer basis" wide><TextArea value={quant.seismicPraInputs.transferBasis} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.hazardQuantification.seismicPraInputs.transferBasis = value; })} /></Field>
      <AdvancedJsonEditor title="hazard quantification" value={quant} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.hazardQuantification = value; })} />
    </Section>
    <Section eyebrow="SHA · HLR-G" title="Response spectra and control points" description="Horizontal hazard-consistent shapes, vertical spectra, and foundation input spectra remain consistent downstream." tone="sha">
      <div className="stablewrap"><table className="stable"><thead><tr><th>Control point</th><th>Type</th><th>Location</th><th>Structures</th></tr></thead><tbody>{spectra.controlPoints.map((point) => <tr key={point.uuid}><td><strong>{point.name}</strong><code>{point.uuid}</code></td><td>{point.controlPointType.replace(/_/g, " ")}</td><td>{point.locationDescription}</td><td>{point.applicableStructureRefs?.length ?? 0}</td></tr>)}</tbody></table></div>
      <Field label="Downstream consistency basis" wide><TextArea value={spectra.downstreamConsistencyBasis} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.responseSpectraEvaluation.downstreamConsistencyBasis = value; })} /></Field>
      <AdvancedJsonEditor title="response spectra" value={spectra} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.responseSpectraEvaluation = value; })} />
    </Section>
  </>;
}

function SecondaryHazardsScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const evaluation = mef.seismicHazardAnalysis.secondaryHazardEvaluation;
  return <Section eyebrow="SHA · HLR-I" title="Secondary seismic hazards" description="Identify, screen, retain, and transfer fault displacement, slope, liquefaction, settlement, ground failure, and earthquake-induced flooding mechanisms." tone="sha">
    <Field label="Identification method" wide><TextArea value={evaluation.identificationMethod} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.secondaryHazardEvaluation.identificationMethod = value; })} /></Field>
    <div className="scards">{evaluation.hazards.map((hazard) => <article className="srecord" key={hazard.uuid}><div className="srecord__head"><div><Tag tone={hazard.screening.disposition === "RETAINED" ? "warn" : "good"}>{hazard.screening.disposition.replace(/_/g, " ")}</Tag><h3>{hazard.name}</h3><code>{hazard.uuid}</code></div><Tag tone="sha">{hazard.hazardType.replace(/_/g, " ")}</Tag></div><p>{hazard.description}</p><div className="srecord__stats"><span>Affected SEL items <strong>{hazard.potentiallyAffectedSeismicEquipmentListItemRefs.length}</strong></span><span>Criterion <strong>{hazard.screening.criterion}</strong></span><span>Analysis <strong>{hazard.retainedAnalysis === undefined ? "Screening" : "Retained"}</strong></span></div></article>)}</div>
    <Field label="Completeness review" wide><TextArea value={evaluation.completenessReview} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicHazardAnalysis.secondaryHazardEvaluation.completenessReview = value; })} /></Field>
    <AdvancedJsonEditor title="secondary-hazard evaluation" value={evaluation} editable={editable} onApply={(value) => update((draft) => { draft.seismicHazardAnalysis.secondaryHazardEvaluation = value; })} />
  </Section>;
}

function SelResponseScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const sel = mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
  const response = mef.seismicFragilityAnalysis.seismicResponseAnalysis;
  return <>
    <Section eyebrow="SPR · HLR-B / SFR · HLR-A" title="Seismic equipment list" description="A single controlled list connects system failure modes, investigations, fragility mechanisms, correlation, and plant-response basic events." tone="spr">
      <Field label="Failure-mode identification process" wide><TextArea value={sel.failureModeIdentificationProcess} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment.failureModeIdentificationProcess = value; })} /></Field>
      <div className="stablewrap"><table className="stable"><thead><tr><th>SSC</th><th>Type / location</th><th>Credited functions</th><th>Failure modes</th><th>Disposition</th></tr></thead><tbody>{sel.equipment.map((item) => <tr key={item.uuid}><td><strong>{item.name}</strong><code>{item.uuid}</code></td><td>{item.sscType}<br /><span>{item.building}</span></td><td>{item.creditedFunctions.join("; ")}</td><td>{item.failureModes.map((mode) => mode.name).join("; ")}</td><td><Tag tone={item.disposition === "ACTIVE" ? "spr" : "neutral"}>{item.disposition.replace(/_/g, " ")}</Tag></td></tr>)}</tbody></table></div>
      <AdvancedJsonEditor title="seismic equipment list" value={sel} editable={editable} onApply={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment = value; })} />
    </Section>
    <Section eyebrow="SFR · HLR-B" title="Reference earthquake and structural response" description="Three-direction input, realistic 3-D response, SSI, median centering, variability, and convergence over the hazard range of interest." tone="sfr">
      <FieldGrid><Field label="Ground-motion consistency"><TextArea value={response.groundMotionParameterConsistency} disabled={!editable} rows={3} onChange={(value) => update((draft) => { draft.seismicFragilityAnalysis.seismicResponseAnalysis.groundMotionParameterConsistency = value; })} /></Field><Field label="Control-point consistency"><TextArea value={response.controlPointConsistency} disabled={!editable} rows={3} onChange={(value) => update((draft) => { draft.seismicFragilityAnalysis.seismicResponseAnalysis.controlPointConsistency = value; })} /></Field></FieldGrid>
      <div className="scards">{response.structuralModels.map((model) => <article className="srecord" key={model.uuid}><div className="srecord__head"><div><Tag tone="sfr">3-D response</Tag><h3>{model.name}</h3><code>{model.uuid}</code></div><span>{model.softwareAndVersion}</span></div><p>{model.verificationAndValidation}</p><div className="srecord__stats"><span>Modes <strong>{model.modalProperties.length}</strong></span><span>Condition <strong>{model.asModeledCondition.replace(/_/g, " ")}</strong></span></div></article>)}</div>
      <AdvancedJsonEditor title="seismic response analysis" value={response} editable={editable} onApply={(value) => update((draft) => { draft.seismicFragilityAnalysis.seismicResponseAnalysis = value; })} />
    </Section>
  </>;
}

function ThresholdInvestigationScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const threshold = mef.seismicFragilityAnalysis.thresholdProgram;
  const investigations = mef.seismicFragilityAnalysis.plantInvestigations;
  return <>
    <Section eyebrow="SFR · HLR-C" title="Ruggedness and fragility thresholds" description="Capacity-based screening includes anchorage, supports, caveats, correlations, cumulative count, and final model confirmation." tone="sfr">
      <Field label="Screening confirmation" wide><TextArea value={threshold.screeningConfirmationMethod} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicFragilityAnalysis.thresholdProgram.screeningConfirmationMethod = value; })} /></Field>
      <AdvancedJsonEditor title="fragility threshold program" value={threshold} editable={editable} onApply={(value) => update((draft) => { draft.seismicFragilityAnalysis.thresholdProgram = value; })} />
    </Section>
    <Section eyebrow="SFR · HLR-D" title="Plant investigations" description="Walkdowns and design reviews address as-built/as-intended condition, load paths, spatial interactions, fire/flood sources, and team qualifications." tone="sfr">
      {investigations.length === 0 ? <EmptyState title="No investigations recorded" detail="Add walkdown, computerized review, or design-document investigation evidence in the advanced section." /> : <div className="scards">{investigations.map((investigation) => <article className="srecord" key={investigation.uuid}><div className="srecord__head"><div><Tag tone="sfr">{investigation.investigationType.replace(/_/g, " ")}</Tag><h3>{investigation.name}</h3><code>{investigation.date ?? "date pending"}</code></div><Tag tone={investigation.limitations.length === 0 ? "good" : "warn"}>{investigation.findings.length} findings</Tag></div><p>{investigation.scope}</p><div className="srecord__stats"><span>Team <strong>{investigation.team.length}</strong></span><span>SSCs reviewed <strong>{investigation.sscRefsReviewed.length}</strong></span><span>Threshold confirmations <strong>{investigation.fragilityThresholdConfirmations.length}</strong></span></div></article>)}</div>}
      <AdvancedJsonEditor title="plant investigations" value={investigations} editable={editable} onApply={(value) => update((draft) => { draft.seismicFragilityAnalysis.plantInvestigations = value; })} />
    </Section>
  </>;
}

function FragilityResultsScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const results = mef.seismicFragilityAnalysis.results;
  const selected = results.fragilityEvaluations[0];
  return <>
    <Section eyebrow="SFR · HLR-E" title="Fragility results" description="Realistic controlling mechanisms, median capacities, randomness, uncertainty, HCLPF, full curves, specialized failures, and correlation." tone="sfr">
      {selected !== undefined && <><div className="scharthead"><div><strong>{selected.name}</strong><span>Median {selected.medianCapacity} {selected.capacityUnits} · βR {selected.betaRandomness} · βU {selected.betaUncertainty}</span></div><Tag tone="sfr">HCLPF {selected.highConfidenceLowProbabilityOfFailureCapacity ?? "—"}</Tag></div><LineChart series={selected.meanFragilityCurve.map((point) => ({ x: point.groundMotion, y: Math.max(point.conditionalFailureProbability, 1e-4) }))} xLabel={`Ground motion (${selected.capacityUnits})`} yLabel="Conditional failure probability" color="#b05a2b" /></>}
      <div className="stablewrap"><table className="stable"><thead><tr><th>Fragility</th><th>SSC / failure mode</th><th>Median</th><th>βR</th><th>βU</th><th>HCLPF</th><th>Importance</th></tr></thead><tbody>{results.fragilityEvaluations.map((fragility) => <tr key={fragility.uuid}><td><strong>{fragility.name}</strong><code>{fragility.uuid}</code></td><td>{fragility.sscRef}<br /><span>{fragility.systemsFailureModeRef}</span></td><td>{fragility.medianCapacity} {fragility.capacityUnits}</td><td>{fragility.betaRandomness}</td><td>{fragility.betaUncertainty}</td><td>{fragility.highConfidenceLowProbabilityOfFailureCapacity ?? "—"}</td><td><Tag tone={fragility.riskSignificance === "HIGH" ? "warn" : "neutral"}>{fragility.riskSignificance}</Tag></td></tr>)}</tbody></table></div>
      <Field label="Systems-model transfer basis" wide><TextArea value={results.systemsModelTransferBasis} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicFragilityAnalysis.results.systemsModelTransferBasis = value; })} /></Field>
      <AdvancedJsonEditor title="fragility analysis results" value={results} editable={editable} onApply={(value) => update((draft) => { draft.seismicFragilityAnalysis.results = value; })} />
    </Section>
  </>;
}

function PlantModelScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const initiators = mef.seismicPlantResponseAnalysis.initiatingEventIdentification;
  const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
  const all = [...initiators.directInitiators, ...initiators.secondaryHazardInitiators];
  return <>
    <Section eyebrow="SPR · HLR-A" title="Seismic initiating events" description="Direct ground motion, retained secondary hazards, industry experience, risk significance, multi-reactor effects, and completeness." tone="spr">
      <Field label="Systematic identification process" wide><TextArea value={initiators.systematicProcess} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.initiatingEventIdentification.systematicProcess = value; })} /></Field>
      <div className="scards">{all.map((event) => <article className="srecord" key={event.uuid}><div className="srecord__head"><div><Tag tone="spr">{event.origin.replace(/_/g, " ")}</Tag><h3>{event.name}</h3><code>{event.uuid}</code></div><Tag tone={event.retained ? "warn" : "good"}>{event.retained ? "Retained" : "Screened"}</Tag></div><p>{event.description}</p><div className="srecord__stats"><span>Affected SSCs <strong>{event.affectedSscRefs.length}</strong></span><span>Sequences <strong>{event.eventSequenceRefs.length}</strong></span><span>Units <strong>{event.reactorUnitRefs.length}</strong></span></div></article>)}</div>
      <Field label="Completeness review" wide><TextArea value={initiators.completenessReview} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.initiatingEventIdentification.completenessReview = value; })} /></Field>
      <AdvancedJsonEditor title="initiating-event identification" value={initiators} editable={editable} onApply={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.initiatingEventIdentification = value; })} />
    </Section>
    <Section eyebrow="SPR · HLR-B" title="Plant-response model" description="Adapt the internal-events base model for seismic failures, thresholds, correlations, contact chatter, mission times, new logic, retained hazards, and multi-unit effects." tone="spr">
      <Field label="Completeness and consistency review" wide><TextArea value={model.completenessAndConsistencyReview} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.plantResponseModel.completenessAndConsistencyReview = value; })} /></Field>
      <AdvancedJsonEditor title="plant-response model" value={model} editable={editable} onApply={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.plantResponseModel = value; })} />
    </Section>
  </>;
}

function HumanReliabilityScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const hra = mef.seismicPlantResponseAnalysis.humanReliabilityModel;
  return <Section eyebrow="SPR · HLR-C" title="Seismic human reliability" description="Apply HLR-HR-D to relevant response actions, failures, recovery, quantification, feasibility, and seismic-specific performance shaping factors." tone="spr">
    <div className="scards">{hra.humanActions.map((action) => <article className="srecord" key={action.uuid}><div className="srecord__head"><div><Tag tone="spr">{action.controlRoomOrExControlRoom.replace(/_/g, " ")}</Tag><h3>{action.name}</h3><code>{action.uuid}</code></div><Tag tone={action.humanErrorProbability <= 0.05 ? "good" : "warn"}>HEP {action.humanErrorProbability}</Tag></div><p>{action.feasibilityBasis}</p><div className="srecord__stats"><span>Available <strong>{action.availableTime} {action.timeUnits}</strong></span><span>Required <strong>{action.requiredTime} {action.timeUnits}</strong></span><span>Sequences <strong>{action.eventSequenceRefs.length}</strong></span></div></article>)}</div>
    <Field label="Seismic influence integration" wide><TextArea value={hra.seismicInfluenceIntegration} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.humanReliabilityModel.seismicInfluenceIntegration = value; })} /></Field>
    <AdvancedJsonEditor title="seismic human-reliability model" value={hra} editable={editable} onApply={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.humanReliabilityModel = value; })} />
  </Section>;
}

function QuantificationIntegrationScreen(): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const integration = mef.integration;
  return <>
    <Section eyebrow="SPR · HLR-D/E" title="Integrated seismic quantification" description="Converged hazard discretization, rare-event correction, ESQ consistency, mean results, parameter uncertainty, contributors, and sensitivity studies." tone="spr">
      <Field label="Integrated hazard-fragility-systems method" wide><TextArea value={quant.integratedHazardFragilitySystemsMethod} disabled={!editable} onChange={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.quantification.integratedHazardFragilitySystemsMethod = value; })} /></Field>
      <div className="stablewrap"><table className="stable"><thead><tr><th>Event-sequence family</th><th>Point estimate</th><th>Mean</th><th>Hazard bins</th><th>Uncertainty sources</th></tr></thead><tbody>{quant.eventSequenceFamilyQuantifications.map((family) => <tr key={family.uuid}><td><strong>{family.name}</strong><code>{family.eventSequenceFamilyRef}</code></td><td className="smono">{family.pointEstimateFrequency.toExponential(3)}</td><td className="smono">{family.meanFrequency?.toExponential(3) ?? "—"}</td><td>{family.hazardBinContributions.length}</td><td>{family.uncertaintyContributions.length}</td></tr>)}</tbody></table></div>
      <AdvancedJsonEditor title="SPR quantification" value={quant} editable={editable} onApply={(value) => update((draft) => { draft.seismicPlantResponseAnalysis.quantification = value; })} />
    </Section>
    <Section eyebrow="SHA ⇄ SFR ⇄ SPR" title="Subelement integration and coverage" description="Explicit producer-consumer records, automated coverage, and multidisciplinary consistency checks prevent interface drift." tone="integration">
      <div className="sflow"><div><Tag tone="sha">SHA</Tag><strong>Hazard</strong><span>Curves · spectra · intervals · secondary hazards</span></div><b>→</b><div><Tag tone="sfr">SFR</Tag><strong>Fragility</strong><span>SEL scope · response · capacity · correlation</span></div><b>→</b><div><Tag tone="spr">SPR</Tag><strong>Plant response</strong><span>Initiators · logic · HRA · family frequencies</span></div></div>
      <div className="stablewrap"><table className="stable"><thead><tr><th>Interface / check</th><th>Subelements</th><th>Type</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{integration.interfaces.map((item) => <tr key={item.uuid}><td><strong>{item.name}</strong><code>{item.uuid}</code></td><td>{item.producer} → {item.consumer}</td><td>{item.payloadType.replace(/_/g, " ")}</td><td><Tag tone={item.consistent ? "good" : "bad"}>{item.consistent ? "Consistent" : "Open"}</Tag></td><td>{item.transferBasis}</td></tr>)}{integration.consistencyChecks.map((check) => <tr key={check.uuid}><td><strong>{check.name}</strong><code>{check.uuid}</code></td><td>{check.subelements.join(" · ")}</td><td>{check.checkType.replace(/_/g, " ")}</td><td><Tag tone={check.result === "PASS" ? "good" : "warn"}>{check.result}</Tag></td><td>{check.evidence}</td></tr>)}</tbody></table></div>
      <Field label="Integration method" wide><TextArea value={integration.integrationMethod} disabled={!editable} onChange={(value) => update((draft) => { draft.integration.integrationMethod = value; })} /></Field>
      <AdvancedJsonEditor title="integrated interfaces and uncertainty" value={{ integration, integratedUncertainties: mef.integratedUncertainties, integratedSensitivityStudies: mef.integratedSensitivityStudies }} editable={editable} onApply={(value) => update((draft) => { draft.integration = value.integration; draft.integratedUncertainties = value.integratedUncertainties; draft.integratedSensitivityStudies = value.integratedSensitivityStudies; })} />
    </Section>
  </>;
}

interface WorkflowActions {
  submitForReview?: () => Promise<void>;
  requestRevision?: (note: string) => Promise<void>;
  postComment?: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", associatedSr?: string) => Promise<void>;
  toggleResolve?: (commentId: string, resolved: boolean) => Promise<void>;
}

function DraftScreen({ renderDocuments, actions }: { renderDocuments?: () => ReactNode; actions?: WorkflowActions }): JSX.Element {
  const { mef, editable, update } = useUpdate();
  const docs = mef.documentation;
  const [busy, setBusy] = useState(false);
  return <>
    <Section eyebrow="Documentation · SHA/SFR/SPR" title="Produce the integrated draft" description="The report preserves the three subelement records while documenting their interfaces, uncertainty, results, and risk insights." tone="integration">
      <Field label="Overall process" wide><TextArea value={docs.overallProcessDescription} rows={5} disabled={!editable} onChange={(value) => update((draft) => { draft.documentation.overallProcessDescription = value; })} /></Field>
      <Field label="SHA summary" wide><TextArea value={docs.shaSummary} disabled={!editable} onChange={(value) => update((draft) => { draft.documentation.shaSummary = value; })} /></Field>
      <Field label="SFR summary" wide><TextArea value={docs.sfrSummary} disabled={!editable} onChange={(value) => update((draft) => { draft.documentation.sfrSummary = value; })} /></Field>
      <Field label="SPR summary" wide><TextArea value={docs.sprSummary} disabled={!editable} onChange={(value) => update((draft) => { draft.documentation.sprSummary = value; })} /></Field>
      <Field label="Integrated results and risk insights" wide><TextArea value={`${docs.integratedResultsSummary}\n\n${docs.integratedRiskInsights}`} rows={6} disabled={!editable} onChange={(value) => update((draft) => { const [results, ...insights] = value.split("\n\n"); draft.documentation.integratedResultsSummary = results ?? ""; draft.documentation.integratedRiskInsights = insights.join("\n\n"); })} /></Field>
      <AdvancedJsonEditor title="integrated documentation" value={docs} editable={editable} onApply={(value) => update((draft) => { draft.documentation = value; })} />
    </Section>
    {renderDocuments?.()}
    <Section eyebrow="Workflow" title="Ready for internal technical review?" description="Autosave all changes, review the 109-row conformance profile, and submit the controlled workbook to assigned reviewers.">
      <div className="sworkflowcall"><div><strong>{mef.workflowState.replace(/_/g, " ")}</strong><span>{mef.conformanceMatrix.filter((row) => row.status === "MET" || row.status === "NOT_APPLICABLE").length} of {mef.conformanceMatrix.length} requirements dispositioned</span></div><div className="sworkflowcall__actions"><button type="button" className="sbtn sbtn--ghost" onClick={() => { void generateSeismicPraReport(mef, false); }}>Download draft (.docx)</button>{actions?.submitForReview !== undefined && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED") && <button type="button" className="sbtn sbtn--primary" disabled={busy} onClick={() => { setBusy(true); actions.submitForReview?.().finally(() => setBusy(false)); }}>{busy ? "Submitting…" : "Submit for review"}</button>}</div></div>
    </Section>
  </>;
}

function ReviewScreen({ actions }: { actions?: WorkflowActions }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const [text, setText] = useState("");
  const [severity, setSeverity] = useState<"MAJOR" | "MINOR" | "OBSERVATION">("OBSERVATION");
  const [sr, setSr] = useState("");
  const [revision, setRevision] = useState("");
  const comments = mef.internalReviewComments.comments;
  return <>
    <Section eyebrow="Internal technical review" title="Review SHA, SFR, SPR, and their interfaces" description="Comments are stored in the shared workbook workflow and may point to a supporting requirement or MEF field.">
      {comments.length === 0 ? <EmptyState title="No review comments" detail="The reviewer can add the first comment below." /> : <div className="scomments">{comments.map((comment) => <article className={`scomment${comment.resolved ? " scomment--resolved" : ""}`} key={comment.uuid}><div className="scomment__head"><div><Tag tone={comment.severity === "MAJOR" ? "bad" : comment.severity === "MINOR" ? "warn" : "neutral"}>{comment.severity ?? "OBSERVATION"}</Tag><strong>{comment.authorId}</strong>{comment.associatedSr !== undefined && <code>{comment.associatedSr}</code>}</div><span>{new Date(comment.createdAt).toLocaleString()}</span></div><p>{comment.text}</p>{actions?.toggleResolve !== undefined && <button type="button" className="sbtn sbtn--ghost" onClick={() => void actions.toggleResolve?.(comment.uuid, !comment.resolved)}>{comment.resolved ? "Reopen" : "Resolve"}</button>}</article>)}</div>}
      {actions?.postComment !== undefined && <div className="scommentform"><FieldGrid><Field label="Severity"><SelectInput value={severity} options={[{ value: "OBSERVATION", label: "Observation" }, { value: "MINOR", label: "Minor" }, { value: "MAJOR", label: "Major" }]} onChange={(value) => setSeverity(value as typeof severity)} /></Field><Field label="Supporting requirement"><TextInput value={sr} placeholder="e.g. SFR-E3" onChange={setSr} /></Field></FieldGrid><Field label="Comment" wide><TextArea value={text} onChange={setText} /></Field><button type="button" className="sbtn sbtn--primary" disabled={text.trim().length === 0} onClick={() => { void actions.postComment?.(text.trim(), severity, sr.trim() || undefined).then(() => { setText(""); setSr(""); }); }}>Add review comment</button></div>}
    </Section>
    {actions?.requestRevision !== undefined && <Section eyebrow="Reviewer decision" title="Request revision" description="Return the workbook to the preparer with a concise integration-level reason."><Field label="Revision note" wide><TextArea value={revision} onChange={setRevision} /></Field><button type="button" className="sbtn sbtn--danger" disabled={revision.trim().length === 0} onClick={() => void actions.requestRevision?.(revision.trim()).then(() => setRevision(""))}>Request revision</button></Section>}
  </>;
}

function ApprovalScreen({ renderApprovalTable, renderSignCard, renderRoster }: { renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode; renderRoster?: () => ReactNode }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  return <>
    <Section eyebrow="Approval and sign-off" title="Controlled Seismic PRA approval" description="Preparers, reviewers, and the approver sign the same integrated SHA/SFR/SPR baseline after review comments close." tone="integration">
      <div className="sapprovalsummary"><div><span>Workbook</span><strong>{mef.name}</strong></div><div><span>Version</span><strong>{mef.version}</strong></div><div><span>State</span><strong>{mef.workflowState.replace(/_/g, " ")}</strong></div><div><span>Conformance</span><strong>{mef.conformanceMatrix.filter((row) => row.status === "MET" || row.status === "NOT_APPLICABLE").length}/{mef.conformanceMatrix.length}</strong></div></div>
      {renderApprovalTable?.()}
    </Section>
    {renderSignCard?.()}
    {renderRoster?.()}
  </>;
}

export {
  ScopeScreen,
  HazardBasisScreen,
  EarthScienceScreen,
  SourceGroundMotionScreen,
  SiteResponseScreen,
  HazardResultsScreen,
  SecondaryHazardsScreen,
  SelResponseScreen,
  ThresholdInvestigationScreen,
  FragilityResultsScreen,
  PlantModelScreen,
  HumanReliabilityScreen,
  QuantificationIntegrationScreen,
  DraftScreen,
  ReviewScreen,
  ApprovalScreen,
  type WorkflowActions,
};
