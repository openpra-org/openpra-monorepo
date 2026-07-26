import { SEISMIC_PRA_SR_CATALOG, type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ConformanceStatus = "ok" | "warn" | "blocked" | "na";

interface SeismicConformanceItem {
  id: string;
  section: string;
  text: string;
  status: ConformanceStatus;
  meta: string;
}

interface SeismicConformanceScore {
  percent: number;
  met: number;
  applicable: number;
  warn: number;
  blocked: number;
  na: number;
}

const HLR_SECTIONS: Record<string, string> = {
  "SHA-A": "Probabilistic hazard basis (HLR-SHA-A)",
  "SHA-B": "Earth-science inputs (HLR-SHA-B)",
  "SHA-C": "Seismic source characterization (HLR-SHA-C)",
  "SHA-D": "Ground-motion characterization (HLR-SHA-D)",
  "SHA-E": "Local site response (HLR-SHA-E)",
  "SHA-F": "Hazard quantification & uncertainty (HLR-SHA-F)",
  "SHA-G": "Site-specific spectral shape (HLR-SHA-G)",
  "SHA-H": "Secondary seismic hazards (HLR-SHA-H)",
  "SHA-I": "Documentation & traceability (HLR-SHA-I)",
  "SFR-A": "Fragility-analysis scope (HLR-SFR-A)",
  "SFR-B": "Seismic response (HLR-SFR-B)",
  "SFR-C": "Fragility thresholds (HLR-SFR-C)",
  "SFR-D": "Plant investigations (HLR-SFR-D)",
  "SFR-E": "Failure mechanisms & fragility (HLR-SFR-E)",
  "SFR-F": "Documentation & traceability (HLR-SFR-F)",
  "SPR-A": "Seismic initiating events (HLR-SPR-A)",
  "SPR-B": "Plant-response model (HLR-SPR-B)",
  "SPR-C": "Seismic equipment list (HLR-SPR-C)",
  "SPR-D": "Seismic human reliability (HLR-SPR-D)",
  "SPR-E": "Integrated quantification (HLR-SPR-E)",
  "SPR-F": "Documentation & traceability (HLR-SPR-F)",
};

const SEISMIC_SR_DESCRIPTIONS: Record<string, string> = {
  "SHA-A1": "Identify the reactor site, or define and justify a bounding site that covers every site in the PRA scope",
  "SHA-A2": "Use a defined process so the hazard model represents the center, body, and range of technically defensible interpretations",
  "SHA-A3": "Use spectral acceleration, band-averaged spectral acceleration, or PGA as the common parameter for hazard and fragility",
  "SHA-A4": "Keep ground-motion parameters and frequency ranges consistent across hazard, fragility, and plant-response analyses",
  "SHA-A5": "Extend the analyzed ground-motion range far enough that truncation cannot change sequence frequencies, ranking, or insights",
  "SHA-A6": "Justify the lower-bound earthquake magnitude as incapable of damaging engineered structures or equipment below that value",
  "SHA-A7": "Justify the epsilon truncation used in ground-motion prediction so aleatory variability is represented adequately",
  "SHA-B1": "Use current geological, seismological, geophysical, and geotechnical data to develop hazard interpretations and inputs",
  "SHA-B2": "Investigate a region and data set broad enough to characterize all credible major hazard contributors and their uncertainties",
  "SHA-B3": "Use data sufficient to characterize regional ground-motion propagation, local site effects, and associated uncertainties",
  "SHA-B4": "Identify new data, models, methods, and interpretations that could affect an existing probabilistic hazard analysis",
  "SHA-B5": "Use a catalog containing historical, instrumental, and paleoseismic earthquake information",
  "SHA-C1": "Identify earthquake sources that could be major contributors to the site hazard",
  "SHA-C2": "Use a structured approach and the compiled hazard-basis and earth-science information to characterize seismic sources",
  "SHA-C3": "Use a structured approach to identify and include seismic-source modeling uncertainties",
  "SHA-C4": "Show that an existing source model includes important new knowledge without losing validity, or update the model appropriately",
  "SHA-C5": "Justify the analysis level and method used when an existing seismic-source model is updated",
  "SHA-D1": "Model credible motion mechanisms using historical and strong-motion data, justified prediction equations, and a defined reference horizon",
  "SHA-D2": "Keep the ground-motion characterization process compatible with the selected structured-analysis level",
  "SHA-D3": "Represent the full range of ground-motion uncertainty, including site-to-site variability where multiple sites are covered",
  "SHA-D4": "Evaluate important new information against existing ground-motion models and incorporate it when it can affect hazard results",
  "SHA-E1": "Include topography, surficial geology, and geotechnical properties in the site ground-motion response",
  "SHA-E2": "For a bounding-site PRA, include site-to-site variability in the local site-effects evaluation",
  "SHA-E3": "Include uncertainties in the local site-response analysis",
  "SHA-E4": "For a bounding-site PRA, include site-to-site variability in local site-response uncertainty",
  "SHA-E5": "Justify site-response inputs and methods, including material properties, bedrock depth, characterization uncertainty, and dimensionality",
  "SHA-E6": "For a bounding-site PRA, include site-to-site variability in the site-response approach and its justification",
  "SHA-F1": "Calculate mean and fractile hazard curves, uniform-hazard spectra, deaggregations, and controlling mean magnitude-distance results",
  "SHA-F2": "Produce the horizontal, vertical, and secondary-hazard results required for integrated seismic PRA quantification",
  "SHA-F3": "Use sensitivity studies to identify key probabilistic-hazard uncertainties that can affect integrated results",
  "SHA-F4": "Test key uncertainties in vertical motion, site response, and secondary-hazard evaluations for their effect on quantification",
  "SHA-G1": "Base horizontal spectral shapes on site-specific hazard results and the controlling magnitude-distance pairs at important motion levels",
  "SHA-G2": "Justify vertical-spectrum methods against the current state of knowledge",
  "SHA-H1": "Identify fault displacement and secondary hazards such as landslide, liquefaction, settlement, and earthquake-induced flooding",
  "SHA-H2": "Justify screening of identified secondary hazards using an applicable demonstrably conservative screening criterion",
  "SHA-H3": "For retained non-flood hazards, calculate hazard-parameter frequencies needed to define affected SEL-item fragilities",
  "SHA-H4": "For retained earthquake-induced flooding, satisfy the applicable external-flood hazard requirements used to define fragilities",
  "SHA-I1": "Document hazard inputs, model structure, structured process, methods, interpretations, uncertainty, secondary hazards, and results",
  "SHA-I2": "Document the hazard-analysis model uncertainties identified through sensitivity studies",
  "SHA-I3": "For a bounding-site PRA, document the bounding characteristics, site-selection basis, and applicability justification",
  "SFR-A1": "Include every SSC and associated failure mode identified by the seismic plant-response analysis in fragility scope",
  "SFR-A2": "Provide the construction, location, orientation, and demand information needed to model and justify fragility correlation",
  "SFR-B1": "Develop CC-appropriate three-direction seismic response using the spectral shapes produced by the hazard analysis",
  "SFR-B2": "Justify scaling of an existing response analysis using structural-model, foundation, and input-motion similarity",
  "SFR-B3": "Use realistic structural models that represent the important three-dimensional dynamic characteristics of plant structures",
  "SFR-B4": "For median-centered analysis, determine median structural loads and floor spectra together with response variability",
  "SFR-B5": "When SSI matters, determine median-centered response and uncertainty using soil properties appropriate to the site",
  "SFR-B6": "Use enough probabilistic-response simulations to demonstrate stable structural loads and floor spectra",
  "SFR-C1": "Define and support the basis used to identify inherently rugged components",
  "SFR-C2": "Define the basis and methods used to achieve the fragility thresholds established by the plant-response analysis",
  "SFR-D1": "Confirm that thresholded SSCs, anchorage, and supports satisfy the established ruggedness and threshold bases",
  "SFR-D2": "Use plant investigations to evaluate seismic capacity for the applicable as-designed, as-built, as-operated, or intended condition",
  "SFR-D3": "For operating plants, identify vulnerabilities with CC-appropriate realism so fragility results are not unconservative",
  "SFR-D4": "For pre-operational plants, identify vulnerabilities using design reviews, interviews, or simulations with CC-appropriate realism",
  "SFR-D5": "Evaluate functional and structural failure mechanisms, equipment anchorage, and the complete support load path",
  "SFR-D6": "Identify credible seismic-induced failures, including spray, for modeled internal-flood sources",
  "SFR-D7": "Identify credible seismic-induced failures for modeled fire-ignition sources",
  "SFR-D8": "Identify credible spatial interactions that could defeat SSC functions or credited operator actions",
  "SFR-E1": "Identify CC-appropriate structural and equipment failure mechanisms for the failure modes carried by the plant-response model",
  "SFR-E2": "For a specific-site PRA, identify CC-appropriate soil failure mechanisms such as liquefaction, instability, and settlement",
  "SFR-E3": "Determine CC-appropriate seismic fragilities using plant-specific data or justify generic data and conservative assumptions",
  "SFR-E4": "Determine contact-chatter fragilities for relays and similar devices that affect modeled SSC functions",
  "SFR-E5": "Determine fragilities for credible seismic-induced flood sources and fire-ignition sources",
  "SFR-E6": "Identify fragility model uncertainties, assumptions, and reasonable alternatives for integrated uncertainty evaluation",
  "SFR-E7": "For pre-operational PRAs, identify assumptions caused by missing as-built or as-operated details",
  "SFR-F1": "Document response analysis, thresholds, investigations, mechanisms, capacities, fragility parameters, inputs, and results",
  "SFR-F2": "Document fragility model uncertainties, related assumptions, and reasonable alternatives",
  "SFR-F3": "Document bounding-site or pre-operational assumptions and limitations caused by unavailable plant or site details",
  "SPR-A1": "Systematically identify direct seismic initiating events for every in-scope POS, reactor, and radioactive-material source",
  "SPR-A2": "Systematically identify secondary-hazard initiating events and SSC failures for every in-scope POS and radioactive source",
  "SPR-A3": "Incorporate plant-specific and industry seismic operating experience into the initiating-event evaluation",
  "SPR-A4": "Retain the identified direct, secondary, and experience-based events that cause risk-significant sequence families",
  "SPR-B1": "Use internal-events sequences and systems logic as the base model and add seismic sequences needed for multiple reactors or sources",
  "SPR-B2": "Resolve and incorporate relevant internal-events and non-seismic-hazard peer-review findings",
  "SPR-B3": "Model seismically induced SSC failures using the failure modes of interest established for the seismic PRA",
  "SPR-B4": "Model fragility correlation consistently with the fragility analysis and justify the selected correlation treatment",
  "SPR-B5": "Define a fragility threshold whose integration with hazard satisfies the applicable screening criterion",
  "SPR-B6": "Systematically model risk-significant relay contact chatter as unavailability or spurious actuation",
  "SPR-B7": "Confirm that sustained accessibility and emergency-response impacts do not invalidate assumed mission times",
  "SPR-B8": "Apply the CC-appropriate ES, SC, SY, DA, and HR requirements to new or modified seismic PRA logic",
  "SPR-B9": "Apply the CC-appropriate internal-flood scenario requirements to every retained seismic-induced internal flood",
  "SPR-B10": "Apply the CC-appropriate internal-fire plant-response requirements to retained seismic-induced ignition sources",
  "SPR-B11": "Apply the CC-appropriate external-flood hazard, fragility, and plant-response requirements to retained flooding hazards",
  "SPR-B12": "Apply the CC-appropriate other-hazard fragility and plant-response requirements to other retained secondary hazards",
  "SPR-B13": "For multi-reactor sites, represent the concurrent and shared impacts of a seismic event in the plant-response model",
  "SPR-C1": "Use the internal-events systems model as the SEL basis and include systems added for seismic initiating events",
  "SPR-C2": "Add structures, relays, passive components, panels, cabinets, and other SSCs needing seismic evaluation to the SEL",
  "SPR-C3": "Include internal-flood sources associated with identified seismic secondary-hazard events in the SEL",
  "SPR-C4": "Include internal-fire ignition sources associated with identified seismic secondary-hazard events in the SEL",
  "SPR-C5": "Include SSCs that induce, or are affected by, retained secondary-hazard initiators in the SEL",
  "SPR-C6": "Identify the fragility-analysis failure modes of interest for every SSC placed on the SEL",
  "SPR-D1": "Identify internal-events HFEs and recovery actions that remain relevant in the seismic PRA context",
  "SPR-D2": "Apply the CC-appropriate HLR-HR-E requirements to seismic human response actions",
  "SPR-D3": "Apply the CC-appropriate HLR-HR-F requirements when defining and specifying seismic HFEs",
  "SPR-D4": "Apply the HLR-HR-H requirements to recovery actions credited in the seismic model",
  "SPR-D5": "Quantify HEPs under HLR-HR-G while including seismic effects on timing, control-room, and ex-control-room actions",
  "SPR-E1": "Integrate hazard, fragility, and systems analyses to quantify seismic sequence-family frequencies per plant-year",
  "SPR-E2": "Correct or otherwise address risk overestimation caused by rare-event approximations as failure probability approaches one",
  "SPR-E3": "Use hazard discretization fine enough to demonstrate convergence of the seismic risk results",
  "SPR-E4": "Apply the specified event-sequence quantification requirements when calculating seismic sequence-family frequencies",
  "SPR-E5": "Produce CC-appropriate point estimates or mean frequencies with propagated hazard, fragility, and systems parameter uncertainty",
  "SPR-E6": "Identify plant-response model uncertainties, assumptions, and reasonable alternatives for integrated uncertainty evaluation",
  "SPR-E7": "For pre-operational PRAs, identify plant-response assumptions caused by missing as-built or as-operated details",
  "SPR-E8": "Evaluate the combined hazard, fragility, and systems assumptions and alternatives through integrated sensitivity analysis",
  "SPR-F1": "Document SEL development, base-model changes, seismic HRA influences, quantification methods, results, and risk contributors",
  "SPR-F2": "Document and explain the initiating events, sequences, basic events, and other risk-significant contributors",
  "SPR-F3": "Document plant-response model uncertainties, related assumptions, and reasonable alternatives",
  "SPR-F4": "Document pre-operational assumptions and limitations caused by missing plant or site details",
  "SPR-F5": "Document quantification limitations that could affect risk-informed applications",
};

function sectionKey(sr: string): string {
  const [technicalElement, requirement] = sr.split("-");
  return `${technicalElement ?? "S"}-${requirement?.charAt(0) ?? ""}`;
}

function plural(value: number): string {
  return value === 1 ? "" : "s";
}

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function earthScienceRequirementSatisfied(mef: SeismicPRA, sr: string): boolean {
  const inputs = mef.seismicHazardAnalysis.earthScienceInputs;
  const disciplines = new Set(inputs.dataSets.map((dataSet) => dataSet.discipline));
  const region = inputs.studyRegions[0];
  const eventTypes = new Set(inputs.earthquakeCatalog.events.map((event) => event.recordType));

  switch (sr) {
    case "SHA-B1":
      return ["GEOLOGY", "SEISMOLOGY", "GEOPHYSICS", "GEOTECHNICAL"].every((discipline) => disciplines.has(discipline as typeof inputs.dataSets[number]["discipline"]))
        && inputs.dataSets.every((dataSet) => hasText(dataSet.currentnessAssessment))
        && hasText(inputs.compilationCutoffDate)
        && hasText(inputs.subjectMatterExpertReview);
    case "SHA-B2":
      return region !== undefined
        && hasText(region.boundaryDescription)
        && hasText(region.majorContributorCoverageBasis)
        && hasText(region.uncertaintyCoverageBasis)
        && inputs.dataSets.length > 0;
    case "SHA-B3":
      return region !== undefined
        && hasText(region.regionalPropagationDataSufficiency)
        && hasText(region.localSiteEffectsDataSufficiency)
        && disciplines.has("GEOTECHNICAL")
        && disciplines.has("STRONG_MOTION");
    case "SHA-B4":
      return inputs.modelAndMethodInventory.length > 0
        && inputs.modelAndMethodInventory.every((item) => hasText(item.potentialImpactOnHazard) && hasText(item.dispositionBasis));
    case "SHA-B5":
      return ["HISTORICAL", "INSTRUMENTAL", "PALEOSEISMIC"].every((recordType) => eventTypes.has(recordType as typeof inputs.earthquakeCatalog.events[number]["recordType"]))
        && hasText(inputs.earthquakeCatalog.catalogStartDateOrAge)
        && hasText(inputs.earthquakeCatalog.catalogEndDate)
        && inputs.earthquakeCatalog.sourceReferences.length > 0;
    default:
      return true;
  }
}

function sourceAndGroundMotionRequirementSatisfied(mef: SeismicPRA, sr: string): boolean {
  const source = mef.seismicHazardAnalysis.sourceCharacterization;
  const ground = mef.seismicHazardAnalysis.groundMotionCharacterization;
  const sourceWeightsValid = source.sourceLogicTree.nodes.every((node) =>
    node.branches.length > 0 && Math.abs(node.branches.reduce((sum, branch) => sum + branch.weight, 0) - 1) < 1e-9);
  const groundWeightsValid = ground.groundMotionLogicTree.nodes.every((node) =>
    node.branches.length > 0 && Math.abs(node.branches.reduce((sum, branch) => sum + branch.weight, 0) - 1) < 1e-9);
  const modelWeightSum = ground.predictionModels.reduce((sum, model) => sum + model.logicTreeWeight, 0);

  switch (sr) {
    case "SHA-C1":
      return source.earthquakeSources.length > 0 && source.earthquakeSources.some((item) => item.majorHazardContributor);
    case "SHA-C2":
      return hasText(source.structuredApproach)
        && source.earthquakeSources.every((item) => item.sourceDataRefs.length > 0 && hasText(item.characterizationBasis));
    case "SHA-C3":
      return hasText(source.uncertaintyIdentificationMethod)
        && source.sourceLogicTree.nodes.length > 0
        && sourceWeightsValid
        && source.earthquakeSources.every((item) => item.uncertainties.length > 0);
    case "SHA-C4":
      return source.existingModelAssessments.length > 0
        && source.existingModelAssessments.every((item) =>
          item.newDataModelMethodRefs.length > 0
          && hasText(item.centerBodyRangeCoverageEvaluation)
          && hasText(item.technicalValidityEvaluation));
    case "SHA-C5":
      return source.existingModelAssessments.length > 0
        && source.existingModelAssessments.every((item) =>
          !item.updateRequired
          || (hasText(item.updateLevel) && hasText(item.updateMethod) && hasText(item.updateJustification)));
    case "SHA-D1":
      return ground.governingMechanisms.length > 0
        && hasText(ground.historicalAndInstrumentalReview)
        && ground.strongMotionDataSets.length > 0
        && ground.modelSelectionCriteria.length > 0
        && ground.predictionModels.length > 0
        && ground.referenceHorizons.length > 0
        && ground.referenceHorizons.every((item) =>
          item.shearWaveVelocity > 0 && item.density > 0 && item.dampingRatio > 0 && hasText(item.definitionBasis));
    case "SHA-D2":
      return hasText(ground.processCompatibilityBasis)
        && ground.groundMotionLogicTree.nodes.length > 0
        && groundWeightsValid;
    case "SHA-D3":
      return ground.uncertainties.length > 0
        && ground.predictionModels.every((item) => item.sigmaComponents?.total !== undefined)
        && Math.abs(modelWeightSum - 1) < 1e-9
        && hasText(ground.groundMotionLogicTree.centerBodyRangeCoverage);
    case "SHA-D4":
      return ground.existingModelAssessments.length > 0
        && ground.existingModelAssessments.every((item) =>
          item.newDataModelMethodRefs.length > 0
          && hasText(item.technicalValidityEvaluation)
          && (!item.updateRequired || (hasText(item.updateMethod) && hasText(item.updateJustification))));
    default:
      return true;
  }
}

function siteResponseRequirementApplicable(mef: SeismicPRA, sr: string): boolean {
  return !["SHA-E2", "SHA-E4", "SHA-E6"].includes(sr)
    || mef.seismicHazardAnalysis.analysisBasis.site.siteBasis === "BOUNDING_SITE";
}

function siteResponseRequirementSatisfied(mef: SeismicPRA, sr: string): boolean {
  const site = mef.seismicHazardAnalysis.siteResponseAnalysis;
  const conditions = site.topographyAndGeology;
  const propertyTypes = (layer: typeof site.profiles[number]["layers"][number]): Set<string> =>
    new Set(layer.properties.map((property) => property.propertyType));
  const profileWeights = site.profiles.reduce((sum, profile) => sum + (profile.profileWeight ?? 0), 0);
  const methodRefs = new Set(site.methods.map((method) => method.uuid));
  const inputRefs = new Set(site.inputMotions.map((input) => input.uuid));
  const profileRefs = new Set(site.profiles.map((profile) => profile.uuid));

  switch (sr) {
    case "SHA-E1":
      return site.localSiteResponseIncluded
        && hasText(conditions.topographicDescription)
        && conditions.topographicDataRefs.length > 0
        && hasText(conditions.surficialDepositDescription)
        && conditions.surficialGeologyDataRefs.length > 0
        && hasText(conditions.geologicStructureDescription)
        && conditions.geotechnicalInvestigationRefs.length > 0
        && hasText(conditions.topographicEffectsTreatment)
        && site.profiles.length > 0
        && site.profiles.every((profile) =>
          profile.layers.length > 0
          && profile.layers.every((layer) => {
            const types = propertyTypes(layer);
            return types.has("SHEAR_WAVE_VELOCITY") && types.has("DENSITY") && types.has("DAMPING");
          }));
    case "SHA-E2":
    case "SHA-E4":
    case "SHA-E6":
      return site.boundingSiteVariabilityIncluded && hasText(site.boundingSiteVariabilityTreatment);
    case "SHA-E3":
      return site.uncertainties.length > 0
        && site.amplificationResults.length > 0
        && Math.abs(profileWeights - 1) < 1e-9
        && site.amplificationResults.every((result) =>
          result.points.length > 0
          && result.points.every((point) => point.logarithmicStandardDeviation !== undefined)
          && hasText(result.uncertaintyTreatment))
        && site.uncertainties.every((uncertainty) =>
          hasText(uncertainty.description)
          && hasText(uncertainty.characterizationMethod)
          && hasText(uncertainty.propagationMethod));
    case "SHA-E5":
      return hasText(site.approachJustification)
        && hasText(site.incorporationIntoHazardMethod)
        && site.profiles.length > 0
        && site.profiles.every((profile) =>
          profile.depthToBedrock > 0
          && hasText(profile.bedrockDefinition)
          && hasText(profile.siteVariabilityBasis)
          && profile.sourceReferences.length > 0
          && profile.layers.every((layer) =>
            layer.sourceReferences.length > 0
            && layer.properties.every((property) => hasText(property.sourceReference) && hasText(property.basisAndLimitations))))
        && site.methods.length > 0
        && site.methods.every((method) =>
          hasText(method.dimensionSelectionBasis)
          && hasText(method.materialModelDescription)
          && hasText(method.verificationAndValidation)
          && hasText(method.inputLocation)
          && hasText(method.outputLocation))
        && site.inputMotions.length > 0
        && site.inputMotions.every((input) =>
          hasText(input.referenceHorizonRef)
          && hasText(input.groundMotionParameterRef)
          && input.amplitudeLevels.length > 0
          && hasText(input.selectionAndScalingBasis))
        && site.amplificationResults.every((result) =>
          methodRefs.has(result.methodRef)
          && inputRefs.has(result.inputMotionRef)
          && result.profileRefs.length > 0
          && result.profileRefs.every((profileRef) => profileRefs.has(profileRef)));
    default:
      return true;
  }
}

function hazardResultsRequirementSatisfied(mef: SeismicPRA, sr: string): boolean {
  const sha = mef.seismicHazardAnalysis;
  const quant = sha.hazardQuantification;
  const spectra = sha.responseSpectraEvaluation;
  const contributionTotal = (values: { contributionFraction: number }[]): number =>
    values.reduce((sum, value) => sum + value.contributionFraction, 0);
  const analysisAreas = new Set(
    quant.sensitivityStudies.map((study) =>
      String(study.elementSpecificProperties?.analysisArea ?? "")),
  );

  switch (sr) {
    case "SHA-F1":
      return sha.analysisBasis.groundMotionParameters.length > 0
        && sha.analysisBasis.groundMotionParameters.every((parameter) => {
          const curves = quant.hazardCurves.filter((curve) => curve.groundMotionParameterRef === parameter.uuid);
          return curves.some((curve) => curve.statistic === "MEAN" && curve.points.length > 1)
            && curves.filter((curve) => curve.statistic === "FRACTILE" && curve.points.length > 1).length >= 2;
        })
        && quant.uniformHazardSpectra.length > 0
        && quant.uniformHazardSpectra.every((spectrum) => spectrum.points.length > 1)
        && quant.deaggregations.length > 0
        && quant.deaggregations.every((deaggregation) =>
          deaggregation.meanMagnitude > 0
          && deaggregation.meanDistanceKm > 0
          && deaggregation.magnitudeDistanceBins.length > 0
          && Math.abs(contributionTotal(deaggregation.magnitudeDistanceBins) - 1) < 1e-9
          && Math.abs(contributionTotal(deaggregation.sourceContributions) - 1) < 1e-9
          && Math.abs(contributionTotal(deaggregation.groundMotionModelContributions) - 1) < 1e-9);
    case "SHA-F2": {
      const inputs = quant.seismicPraInputs;
      const intervalRefs = new Set(inputs.hazardIntervals.map((interval) => interval.uuid));
      return inputs.hazardIntervals.length > 0
        && inputs.hazardIntervals.every((interval) =>
          interval.lowerGroundMotion < interval.upperGroundMotion
          && interval.representativeGroundMotion >= interval.lowerGroundMotion
          && interval.representativeGroundMotion <= interval.upperGroundMotion
          && interval.annualFrequency > 0
          && hasText(interval.verticalMotionRef))
        && inputs.plantResponseInputRefs.every((reference) => intervalRefs.has(reference))
        && inputs.verticalMotionResultRefs.length > 0
        && inputs.secondaryHazardResultRefs.length > 0
        && spectra.horizontalSpectra.length > 0
        && spectra.verticalSpectra.length > 0
        && hasText(inputs.transferBasis)
        && inputs.consistencyChecks.length > 0;
    }
    case "SHA-F3":
      return quant.sensitivityStudies.length > 0
        && ["SOURCE", "GROUND_MOTION"].every((area) => analysisAreas.has(area))
        && quant.sensitivityStudies
          .filter((study) => ["SOURCE", "GROUND_MOTION"].includes(String(study.elementSpecificProperties?.analysisArea ?? "")))
          .every((study) => hasText(study.results) && hasText(study.impact))
        && quant.keyUncertaintyFindings.some((finding) =>
          ["SOURCE", "GROUND_MOTION"].includes(finding.analysisArea)
          && finding.sensitivityStudyRefs.length > 0
          && hasText(finding.effectOnSeismicPraQuantification));
    case "SHA-F4":
      return ["SITE_RESPONSE", "VERTICAL_MOTION", "SECONDARY_HAZARD"].every((area) => analysisAreas.has(area))
        && quant.sensitivityStudies
          .filter((study) => ["SITE_RESPONSE", "VERTICAL_MOTION", "SECONDARY_HAZARD"].includes(String(study.elementSpecificProperties?.analysisArea ?? "")))
          .every((study) => hasText(study.results) && hasText(study.impact));
    case "SHA-G1": {
      const horizontalRefs = new Set(spectra.horizontalSpectra.map((spectrum) => spectrum.uuid));
      return spectra.horizontalSpectra.length > 0
        && spectra.horizontalShapeBases.length > 0
        && spectra.horizontalShapeBases.every((basis) =>
          horizontalRefs.has(basis.spectrumRef)
          && basis.groundMotionLevel > 0
          && basis.meanMagnitude > 0
          && basis.meanDistanceKm > 0
          && basis.controllingSourceRefs.length > 0
          && basis.characteristicShapeRefs.length > 0
          && basis.usesOrBoundsCharacteristicShapes
          && hasText(basis.evaluationBasis));
    }
    case "SHA-G2": {
      const verticalRefs = new Set(spectra.verticalSpectra.map((spectrum) => spectrum.uuid));
      return spectra.verticalSpectra.length > 0
        && spectra.verticalSpectrumBases.length > 0
        && spectra.verticalSpectrumBases.every((basis) =>
          verticalRefs.has(basis.spectrumRef)
          && hasText(basis.methodDescription)
          && basis.dataAndModelRefs.length > 0
          && hasText(basis.stateOfKnowledgeAssessment)
          && hasText(basis.appropriatenessJustification));
    }
    default:
      return true;
  }
}

function secondaryHazardRequirementApplicable(
  mef: SeismicPRA,
  sr: string,
): boolean {
  const retained = mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards
    .filter((hazard) => hazard.screening.disposition === "RETAINED");
  if (sr === "SHA-H3") {
    return retained.some((hazard) =>
      hazard.hazardType !== "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING");
  }
  if (sr === "SHA-H4") {
    return retained.some((hazard) =>
      hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING");
  }
  return true;
}

function secondaryHazardRequirementSatisfied(
  mef: SeismicPRA,
  sr: string,
): boolean {
  const evaluation =
    mef.seismicHazardAnalysis.secondaryHazardEvaluation;
  const retained = evaluation.hazards.filter((hazard) =>
    hazard.screening.disposition === "RETAINED");
  const coreTypes = new Set([
    "FAULT_DISPLACEMENT",
    "LANDSLIDE",
    "SOIL_LIQUEFACTION",
    "SOIL_SETTLEMENT",
    "GROUND_FAILURE",
    "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING",
  ]);

  switch (sr) {
    case "SHA-H1":
      return evaluation.hazards.length > 0
        && [...coreTypes].every((hazardType) =>
          evaluation.hazards.some((hazard) => hazard.hazardType === hazardType))
        && hasText(evaluation.identificationMethod)
        && evaluation.siteAndRegionalHazardListSources.length > 0
        && evaluation.hazards.every((hazard) =>
          hasText(hazard.description)
          && hazard.initiatingMechanisms.length > 0
          && hazard.siteEvidenceRefs.length > 0
          && hasText(hazard.potentiallyAffectedArea));
    case "SHA-H2":
      return hasText(evaluation.screeningCriteriaReference)
        && evaluation.hazards.every((hazard) =>
          hasText(hazard.screening.methodology)
          && hasText(hazard.screening.screeningBasis)
          && hazard.screening.calculationsAndEvidenceRefs.length > 0
          && (hazard.screening.disposition === "RETAINED"
            ? hazard.screening.criterion === "NOT_SCREENED"
            : hazard.screening.criterion !== "NOT_SCREENED"
              && hazard.screening.demonstrablyConservative));
    case "SHA-H3":
      return retained
        .filter((hazard) =>
          hazard.hazardType !== "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING")
        .every((hazard) => {
          const analysis = hazard.retainedAnalysis;
          if (analysis === undefined) return false;
          const meanCurves = analysis.hazardCurves.filter((curve) =>
            curve.statistic === "MEAN" && curve.points.length > 1);
          const fractileCurves = analysis.hazardCurves.filter((curve) =>
            curve.statistic === "FRACTILE" && curve.points.length > 1);
          return hasText(analysis.hazardParameter)
            && hasText(analysis.parameterUnits)
            && analysis.affectedSeismicEquipmentListItemRefs.length > 0
            && analysis.failureMechanisms.length > 0
            && analysis.failureMechanisms.every((mechanism) =>
              hasText(mechanism.fragilityParameter)
              && hasText(mechanism.fragilityUnits))
            && meanCurves.length > 0
            && fractileCurves.length >= 2
            && hasText(analysis.calculationMethod)
            && analysis.dataAndModelRefs.length > 0
            && analysis.uncertainties.length > 0
            && analysis.outputRefs.length > 0;
        });
    case "SHA-H4":
      return retained
        .filter((hazard) =>
          hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING")
        .every((hazard) => {
          const flood = hazard.externalFloodingInterface;
          return flood !== undefined
            && hasText(flood.mechanismDescription)
            && hasText(flood.interfaceBasis)
            && flood.interfaceRequirements.length === 7
            && flood.interfaceRequirements.every((requirement) =>
              !requirement.applicable
              || ((requirement.status === "MET"
                || requirement.status === "NOT_APPLICABLE")
                && requirement.satisfiedByRefs.length > 0
                && hasText(requirement.evidence)))
            && flood.hazardParameterResultsRefs.length > 0
            && flood.fragilityFailureMechanismRefs.length > 0;
        });
    default:
      return true;
  }
}

function selAndResponseRequirementSatisfied(
  mef: SeismicPRA,
  sr: string,
): boolean {
  const spr = mef.seismicPlantResponseAnalysis;
  const sfr = mef.seismicFragilityAnalysis;
  const sel = spr.seismicEquipmentListDevelopment;
  const response = sfr.seismicResponseAnalysis;
  const equipmentRefs = new Set(sel.equipment.map((item) => item.uuid));
  const active = sel.equipment.filter((item) => item.disposition === "ACTIVE");
  const correlationGroups = new Map(
    sfr.results.correlationGroups.map((group) => [group.uuid, group]),
  );

  switch (sr) {
    case "SPR-C1":
      return hasText(sel.internalEventsSystemsModelRef)
        && sel.equipment.some((item) =>
          item.inclusionSources.includes("INTERNAL_EVENTS_SYSTEM_MODEL"))
        && sel.additionalSeismicSystemRefs.length > 0;
    case "SPR-C2":
      return sel.equipment.some((item) =>
        ["STRUCTURE", "RELAY", "PANEL", "CABINET"].includes(item.sscType)
        && item.inclusionSources.includes("ADDITIONAL_SEISMIC_SSC"));
    case "SPR-C3":
      return sel.internalFloodSourceRefs.length > 0
        && sel.internalFloodSourceRefs.every((reference) => {
          const item = sel.equipment.find((candidate) =>
            candidate.uuid === reference);
          return item?.sscType === "FLOOD_SOURCE"
            && item.inclusionSources.includes("INTERNAL_FLOOD_SOURCE");
        });
    case "SPR-C4":
      return sel.internalFireIgnitionSourceRefs.length > 0
        && sel.internalFireIgnitionSourceRefs.every((reference) => {
          const item = sel.equipment.find((candidate) =>
            candidate.uuid === reference);
          return item?.sscType === "FIRE_SOURCE"
            && item.inclusionSources.includes("INTERNAL_FIRE_IGNITION_SOURCE");
        });
    case "SPR-C5":
      return sel.secondaryHazardSscRefs.length > 0
        && sel.secondaryHazardSscRefs.every((reference) => {
          const item = sel.equipment.find((candidate) =>
            candidate.uuid === reference);
          return item?.inclusionSources.includes("SECONDARY_HAZARD") === true;
        });
    case "SPR-C6":
      return sel.equipment.length > 0
        && sel.equipment.every((item) =>
          item.failureModes.length > 0
          && item.failureModes.every((mode) =>
            hasText(mode.name)
            && hasText(mode.creditedFunction)
            && hasText(mode.failureDefinition)
            && mode.systemModelBasicEventRefs.length > 0
            && hasText(mode.consequenceDescription)));
    case "SFR-A1":
      return hasText(sfr.scope.seismicEquipmentListRef)
        && sfr.scope.includedSscRefs.length === sel.equipment.length
        && sfr.scope.includedSscRefs.every((reference) =>
          equipmentRefs.has(reference))
        && active.every((item) =>
          hasText(item.fragilityAnalysisRef ?? "")
          && item.failureModes.every((mode) =>
            mode.fragilityMechanismRefs.length > 0));
    case "SFR-A2":
      return active.every((item) =>
        item.correlationGroupRefs.length > 0
        && item.correlationGroupRefs.every((reference) => {
          const group = correlationGroups.get(reference);
          return group !== undefined
            && group.memberSscRefs.includes(item.uuid)
            && hasText(group.commonDemandBasis)
            && hasText(group.constructionSimilarity)
            && hasText(group.installationSimilarity)
            && hasText(group.locationAndOrientationSimilarity)
            && hasText(group.modelingImplementation)
            && hasText(group.justification);
        }));
    case "SFR-B1":
      return response.threeOrthogonalDirectionsUsed
        && response.hazardSpectrumRefs.length > 0
        && response.referenceEarthquakes.length > 0
        && response.referenceEarthquakes.every((earthquake) =>
          hasText(earthquake.hazardSpectrumRef)
          && hasText(earthquake.groundMotionParameterRef)
          && hasText(earthquake.controlPointRef)
          && earthquake.horizontalComponentRefs.length === 2
          && hasText(earthquake.verticalComponentRef)
          && earthquake.hazardRangeOfInterest.lowerGroundMotion
            < earthquake.hazardRangeOfInterest.upperGroundMotion);
    case "SFR-B2":
      return response.scalingEvaluations.length > 0
        && response.scalingEvaluations.every((scaling) =>
          scaling.scaleFactor > 0
          && hasText(scaling.structuralModelSimilarity)
          && hasText(scaling.foundationSimilarity)
          && hasText(scaling.inputMotionSimilarity)
          && hasText(scaling.naturalFrequencyAndModeShapeEvaluation)
          && hasText(scaling.nonlinearPhenomenaEvaluation)
          && hasText(scaling.adequacyJustification));
    case "SFR-B3":
      return response.structuralModels.length > 0
        && response.structuralModels.every((model) =>
          model.modelType.startsWith("THREE_DIMENSIONAL")
          && model.modalProperties.length > 0
          && hasText(model.stiffnessRepresentation)
          && hasText(model.massRepresentation)
          && hasText(model.dampingRepresentation)
          && hasText(model.directionalCoupling)
          && hasText(model.rotationalInertia)
          && hasText(model.diaphragmFlexibility)
          && hasText(model.torsionalEffects)
          && hasText(model.structuralCoupling)
          && hasText(model.verificationAndValidation));
    case "SFR-B4": {
      const directions = new Set(response.responseResults.map((result) =>
        result.direction));
      return response.medianCentered
        && ["X", "Y", "Z"].every((direction) => directions.has(direction as "X" | "Y" | "Z"))
        && response.responseResults.length > 0
        && response.responseResults.every((result) =>
          result.betaRandomness > 0
          && result.betaUncertainty > 0
          && hasText(result.variabilityBasis)
          && ((result.spectrumPoints?.length ?? 0) > 1
            || result.medianValue !== undefined));
    }
    case "SFR-B5":
      return response.soilStructureInteractionAnalyses.length > 0
        && response.soilStructureInteractionAnalyses.every((ssi) =>
          !ssi.applicable
          || (ssi.siteSpecific
            && ssi.strainCompatibleProperties
            && ssi.soilProfileRefs.length > 0
            && hasText(ssi.significanceAssessment)
            && hasText(ssi.method ?? "")
            && ssi.medianResponseResultRefs.length > 0
            && ssi.uncertaintyResultRefs.length > 0));
    case "SFR-B6":
      return response.probabilisticSimulations.length > 0
        && response.probabilisticSimulations.every((simulation) => {
          const final = simulation.convergenceResults.at(-1);
          return simulation.simulationCount > 0
            && simulation.inputMotionSetCount > 0
            && simulation.componentsPerSet === 3
            && simulation.convergenceResults.length > 1
            && final !== undefined
            && final.sampleCount <= simulation.simulationCount
            && simulation.stableResponsesDemonstrated
            && simulation.outputResultRefs.length > 0;
        });
    default:
      return true;
  }
}

function sectionEvidence(mef: SeismicPRA, sr: string): string {
  const sha = mef.seismicHazardAnalysis;
  const sfr = mef.seismicFragilityAnalysis;
  const spr = mef.seismicPlantResponseAnalysis;
  const earthScienceInputs = sha.earthScienceInputs;
  const studyRegion = earthScienceInputs.studyRegions[0];
  const catalogEvents = earthScienceInputs.earthquakeCatalog.events;
  if (sr === "SHA-B1") {
    const disciplines = new Set(earthScienceInputs.dataSets.map((dataSet) => dataSet.discipline));
    return `${earthScienceInputs.dataSets.length} current data sets cover ${disciplines.size} earth-science disciplines through ${earthScienceInputs.compilationCutoffDate || "an unspecified cutoff"}.`;
  }
  if (sr === "SHA-B2") {
    return studyRegion === undefined
      ? "No seismic study region has been defined."
      : `${studyRegion.name} extends ${studyRegion.radialExtentKm ?? "an unspecified distance"} km; ${studyRegion.majorContributorCoverageBasis || "major-contributor coverage is not documented"}`;
  }
  if (sr === "SHA-B3") {
    return studyRegion === undefined
      ? "Regional propagation and local site-effect data sufficiency have not been assessed."
      : `Regional propagation: ${studyRegion.regionalPropagationDataSufficiency || "not assessed"} Local site effects: ${studyRegion.localSiteEffectsDataSufficiency || "not assessed"}`;
  }
  if (sr === "SHA-B4") {
    const dispositions = new Set(earthScienceInputs.modelAndMethodInventory.map((item) => item.disposition));
    return `${earthScienceInputs.modelAndMethodInventory.length} model or method source${plural(earthScienceInputs.modelAndMethodInventory.length)} assessed across ${dispositions.size} disposition${plural(dispositions.size)}.`;
  }
  if (sr === "SHA-B5") {
    const count = (recordType: typeof catalogEvents[number]["recordType"]): number => catalogEvents.filter((event) => event.recordType === recordType).length;
    return `${count("HISTORICAL")} historical, ${count("INSTRUMENTAL")} instrumental, and ${count("PALEOSEISMIC")} paleoseismic catalog records cover ${earthScienceInputs.earthquakeCatalog.catalogStartDateOrAge} through ${earthScienceInputs.earthquakeCatalog.catalogEndDate}.`;
  }
  if (sr === "SHA-C1") {
    const majorSources = sha.sourceCharacterization.earthquakeSources.filter((source) => source.majorHazardContributor).length;
    return `${sha.sourceCharacterization.earthquakeSources.length} credible sources characterized; ${majorSources} identified as major hazard contributors.`;
  }
  if (sr === "SHA-C2") {
    const recurrenceModels = sha.sourceCharacterization.earthquakeSources.reduce((sum, source) => sum + source.magnitudeFrequencyModels.length, 0);
    return `${recurrenceModels} recurrence models use the structured source-characterization approach and linked earth-science inputs.`;
  }
  if (sr === "SHA-C3") {
    return `${sha.sourceCharacterization.sourceLogicTree.nodes.length} source logic-tree nodes produce ${sha.sourceCharacterization.sourceLogicTree.totalEndBranchCount ?? 0} weighted end branches.`;
  }
  if (sr === "SHA-C4" || sr === "SHA-C5") {
    const updated = sha.sourceCharacterization.existingModelAssessments.filter((item) => item.updateRequired).length;
    return `${sha.sourceCharacterization.existingModelAssessments.length} existing source-model assessment${plural(sha.sourceCharacterization.existingModelAssessments.length)} completed; ${updated} targeted update${plural(updated)} required.`;
  }
  if (sr === "SHA-D1") {
    return `${sha.groundMotionCharacterization.predictionModels.length} prediction models use ${sha.groundMotionCharacterization.strongMotionDataSets.length} strong-motion data sets and ${sha.groundMotionCharacterization.referenceHorizons.length} reference horizons.`;
  }
  if (sr === "SHA-D2") {
    return `${sha.groundMotionCharacterization.groundMotionLogicTree.totalEndBranchCount ?? 0} ground-motion end branches use the Step 02 structured-process basis.`;
  }
  if (sr === "SHA-D3") {
    return `${sha.groundMotionCharacterization.uncertainties.length} ground-motion uncertainties are propagated across model, median-adjustment, sigma, and reference-horizon alternatives.`;
  }
  if (sr === "SHA-D4") {
    const updated = sha.groundMotionCharacterization.existingModelAssessments.filter((item) => item.updateRequired).length;
    return `${sha.groundMotionCharacterization.existingModelAssessments.length} existing ground-motion assessment${plural(sha.groundMotionCharacterization.existingModelAssessments.length)} completed; ${updated} model update${plural(updated)} incorporated.`;
  }
  if (sr === "SHA-E1") {
    const layers = sha.siteResponseAnalysis.profiles.reduce((sum, profile) => sum + profile.layers.length, 0);
    return `${sha.siteResponseAnalysis.profiles.length} weighted profiles define ${layers} geotechnical layers with velocity, density, damping, topography, and geology inputs.`;
  }
  if (sr === "SHA-E3") {
    const points = sha.siteResponseAnalysis.amplificationResults.reduce((sum, result) => sum + result.points.length, 0);
    return `${sha.siteResponseAnalysis.uncertainties.length} site-response uncertainties are propagated through ${sha.siteResponseAnalysis.amplificationResults.length} calculations and ${points} amplification points.`;
  }
  if (sr === "SHA-E5") {
    return `${sha.siteResponseAnalysis.methods.length} justified methods and ${sha.siteResponseAnalysis.inputMotions.length} input-motion suites produce linked foundation-amplification results.`;
  }
  if (sr === "SHA-F1") {
    return `${sha.hazardQuantification.hazardCurves.length} mean and fractile curves, ${sha.hazardQuantification.uniformHazardSpectra.length} uniform-hazard spectra, and ${sha.hazardQuantification.deaggregations.length} deaggregations are calculated.`;
  }
  if (sr === "SHA-F2") {
    return `${sha.hazardQuantification.seismicPraInputs.hazardIntervals.length} non-overlapping PRA bins transfer horizontal, vertical, and retained secondary-hazard results.`;
  }
  if (sr === "SHA-F3" || sr === "SHA-F4") {
    return `${sha.hazardQuantification.sensitivityStudies.length} focused studies identify ${sha.hazardQuantification.keyUncertaintyFindings.length} uncertainty findings that can affect quantification.`;
  }
  if (sr === "SHA-G1") {
    return `${sha.responseSpectraEvaluation.horizontalShapeBases.length} horizontal shape bases use site-specific magnitude, distance, source, and characteristic-shape results.`;
  }
  if (sr === "SHA-G2") {
    return `${sha.responseSpectraEvaluation.verticalSpectrumBases.length} vertical-spectrum bases document the selected method, data, current knowledge, and applicability.`;
  }
  if (sr === "SHA-H1") {
    const types = new Set(sha.secondaryHazardEvaluation.hazards.map((hazard) => hazard.hazardType));
    return `${sha.secondaryHazardEvaluation.hazards.length} site-specific hazards cover ${types.size} secondary-hazard classes.`;
  }
  if (sr === "SHA-H2") {
    const screened = sha.secondaryHazardEvaluation.hazards.filter((hazard) => hazard.screening.disposition === "SCREENED_OUT");
    const criteria = new Set(screened.map((hazard) => hazard.screening.criterion));
    return `${screened.length} hazards are screened with ${criteria.size} conservative criterion type${plural(criteria.size)}; each retains its calculation and evidence references.`;
  }
  if (sr === "SHA-H3") {
    const analyses = sha.secondaryHazardEvaluation.hazards
      .filter((hazard) =>
        hazard.screening.disposition === "RETAINED"
        && hazard.hazardType !== "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING")
      .flatMap((hazard) => hazard.retainedAnalysis ?? []);
    const curves = analyses.reduce((sum, analysis) => sum + analysis.hazardCurves.length, 0);
    const points = analyses.reduce((sum, analysis) =>
      sum + analysis.hazardCurves.reduce((curveSum, curve) => curveSum + curve.points.length, 0), 0);
    return `${analyses.length} retained non-flood analysis${plural(analyses.length)} provide ${curves} curves and ${points} parameter-frequency points for affected SEL mechanisms.`;
  }
  if (sr === "SHA-H4") {
    const floods = sha.secondaryHazardEvaluation.hazards.filter((hazard) =>
      hazard.screening.disposition === "RETAINED"
      && hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING");
    if (floods.length === 0) {
      return "Earthquake-induced external flooding was screened out using the documented site-feasibility basis.";
    }
    const requirements = floods.flatMap((hazard) =>
      hazard.externalFloodingInterface?.interfaceRequirements ?? []);
    const complete = requirements.filter((requirement) =>
      requirement.status === "MET" || requirement.status === "NOT_APPLICABLE").length;
    return `${floods.length} retained flooding hazard${plural(floods.length)} has ${complete} of ${requirements.length} XFHA interface requirements complete.`;
  }
  switch (sectionKey(sr)) {
    case "SHA-A": {
      const parameters = sha.analysisBasis.groundMotionParameters.length;
      return `${sha.analysisBasis.structuredProcess.processType.replace(/_/g, " ")} basis with ${parameters} shared ground-motion parameter${plural(parameters)}.`;
    }
    case "SHA-B":
      return `${sha.earthScienceInputs.dataSets.length} earth-science data set${plural(sha.earthScienceInputs.dataSets.length)}, ${sha.earthScienceInputs.studyRegions.length} study region${plural(sha.earthScienceInputs.studyRegions.length)}, and ${sha.earthScienceInputs.earthquakeCatalog.events.length} catalog event${plural(sha.earthScienceInputs.earthquakeCatalog.events.length)} recorded.`;
    case "SHA-C":
      return `${sha.sourceCharacterization.earthquakeSources.length} seismic source${plural(sha.sourceCharacterization.earthquakeSources.length)} characterized with structured uncertainty treatment.`;
    case "SHA-D":
      return `${sha.groundMotionCharacterization.predictionModels.length} ground-motion prediction model${plural(sha.groundMotionCharacterization.predictionModels.length)} evaluated against the selected reference horizon.`;
    case "SHA-E":
      return `${sha.siteResponseAnalysis.profiles.length} site profile${plural(sha.siteResponseAnalysis.profiles.length)} represented in the local response analysis.`;
    case "SHA-F":
      return `${sha.hazardQuantification.hazardCurves.length} hazard curve${plural(sha.hazardQuantification.hazardCurves.length)} recorded; the quantification and uncertainty treatment are documented in the hazard-results package.`;
    case "SHA-G":
      return "Horizontal and vertical response-spectrum bases are linked to the site-specific hazard results.";
    case "SHA-H":
      return `${sha.secondaryHazardEvaluation.hazards.length} secondary hazards have site evidence and technical dispositions.`;
    case "SHA-I":
      return `${sha.documentation.dataAndModelReferences.length} hazard data/model reference${plural(sha.documentation.dataAndModelReferences.length)} documented with the hazard traceability basis.`;
    case "SFR-A":
      return `${sfr.scope.includedSscRefs.length} SSC${plural(sfr.scope.includedSscRefs.length)} included in fragility scope with ${sfr.scope.correlationGroupRefs.length} correlation-group reference${plural(sfr.scope.correlationGroupRefs.length)}.`;
    case "SFR-B":
      return `${sfr.seismicResponseAnalysis.structuralModels.length} structural model${plural(sfr.seismicResponseAnalysis.structuralModels.length)}, ${sfr.seismicResponseAnalysis.responseResults.length} response result${plural(sfr.seismicResponseAnalysis.responseResults.length)}, and ${sfr.seismicResponseAnalysis.probabilisticSimulations.length} probabilistic simulation record${plural(sfr.seismicResponseAnalysis.probabilisticSimulations.length)} documented.`;
    case "SFR-C":
      return `${sfr.thresholdProgram.inherentlyRuggedBases.length} ruggedness basis record${plural(sfr.thresholdProgram.inherentlyRuggedBases.length)} and ${sfr.thresholdProgram.thresholdMethods.length} threshold method${plural(sfr.thresholdProgram.thresholdMethods.length)} defined.`;
    case "SFR-D": {
      const findings = sfr.plantInvestigations.reduce((sum, investigation) => sum + investigation.findings.length, 0);
      return `${sfr.plantInvestigations.length} plant investigation${plural(sfr.plantInvestigations.length)} with ${findings} vulnerability finding${plural(findings)} recorded.`;
    }
    case "SFR-E":
      return `${sfr.results.failureMechanisms.length} failure mechanism${plural(sfr.results.failureMechanisms.length)} and ${sfr.results.fragilityEvaluations.length} SSC fragility evaluation${plural(sfr.results.fragilityEvaluations.length)} modeled.`;
    case "SFR-F":
      return `${sfr.documentation.dataAndCalculationRefs.length} fragility calculation reference${plural(sfr.documentation.dataAndCalculationRefs.length)} documented with the SSC-to-model traceability basis.`;
    case "SPR-A":
      return `${spr.initiatingEventIdentification.directInitiators.length} direct and ${spr.initiatingEventIdentification.secondaryHazardInitiators.length} secondary-hazard initiating event${plural(spr.initiatingEventIdentification.secondaryHazardInitiators.length)} evaluated.`;
    case "SPR-B":
      return `${spr.plantResponseModel.inducedFailures.length} induced failure${plural(spr.plantResponseModel.inducedFailures.length)} and ${spr.plantResponseModel.missionTimeAssessments.length} mission-time assessment${plural(spr.plantResponseModel.missionTimeAssessments.length)} documented in the plant-response model.`;
    case "SPR-C":
      return `${spr.seismicEquipmentListDevelopment.equipment.length} SEL item${plural(spr.seismicEquipmentListDevelopment.equipment.length)} linked through the systems-fragility coordination process.`;
    case "SPR-D":
      return `${spr.humanReliabilityModel.relevantInternalEventsHfeRefs.length} internal-events HFE${plural(spr.humanReliabilityModel.relevantInternalEventsHfeRefs.length)} reviewed and ${spr.humanReliabilityModel.humanActions.length} seismic action${plural(spr.humanReliabilityModel.humanActions.length)} modeled.`;
    case "SPR-E":
      return `${spr.quantification.hazardDiscretizations.length} hazard discretization${plural(spr.quantification.hazardDiscretizations.length)}, ${spr.quantification.eventSequenceFamilyQuantifications.length} sequence-family result${plural(spr.quantification.eventSequenceFamilyQuantifications.length)}, and ${spr.quantification.sensitivityStudies.length} sensitivity ${spr.quantification.sensitivityStudies.length === 1 ? "study" : "studies"} recorded.`;
    case "SPR-F":
      return `${spr.documentation.dataModelAndCalculationRefs.length} controlled reference${plural(spr.documentation.dataModelAndCalculationRefs.length)} documented with the initiating-event-to-quantification traceability basis.`;
    default:
      return "Evidence has not yet been recorded.";
  }
}

function statusTone(status: SeismicPRA["conformanceMatrix"][number]["status"]): ConformanceStatus {
  if (status === "MET") return "ok";
  if (status === "NOT_MET") return "blocked";
  if (status === "NOT_APPLICABLE") return "na";
  return "warn";
}

function seismicConformanceItems(mef: SeismicPRA): SeismicConformanceItem[] {
  const bySr = new Map(mef.conformanceMatrix.map((row) => [row.sr, row] as const));
  return Object.entries(SEISMIC_PRA_SR_CATALOG).map(([sr, catalog]) => {
    const row = bySr.get(sr);
    const key = sectionKey(sr);
    const inStage = catalog.stages.includes(mef.plantStage);
    const requirementApplicable = inStage
      && siteResponseRequirementApplicable(mef, sr)
      && secondaryHazardRequirementApplicable(mef, sr);
    const recordedStatus = requirementApplicable ? statusTone(row?.status ?? "PENDING_REVIEW") : "na";
    const evidenceSatisfied = earthScienceRequirementSatisfied(mef, sr)
      && sourceAndGroundMotionRequirementSatisfied(mef, sr)
      && siteResponseRequirementSatisfied(mef, sr)
      && hazardResultsRequirementSatisfied(mef, sr)
      && secondaryHazardRequirementSatisfied(mef, sr)
      && selAndResponseRequirementSatisfied(mef, sr);
    const status = recordedStatus === "ok" && !evidenceSatisfied ? "warn" : recordedStatus;
    const prefix = sr.split("-")[0] ?? "S";
    return {
      id: sr,
      section: HLR_SECTIONS[key] ?? `HLR-${key}`,
      text: `${prefix} - ${sr.slice(prefix.length + 1)}: ${SEISMIC_SR_DESCRIPTIONS[sr] ?? sr}`,
      status,
      meta: !inStage
        ? "Not applicable to current plant stage"
        : !requirementApplicable
          ? sr === "SHA-H4"
            ? "Not applicable because earthquake-induced external flooding was screened out."
            : sr === "SHA-H3"
              ? "Not applicable because no non-flood secondary hazard was retained."
              : "Not applicable to an identified-site PRA"
        : row?.evidence !== undefined && !row.evidence.includes(" is implemented in the ")
          ? row.evidence
          : sectionEvidence(mef, sr),
    };
  });
}

function groupSeismicConformance(items: SeismicConformanceItem[]): [string, SeismicConformanceItem[]][] {
  const sections = new Map<string, SeismicConformanceItem[]>();
  for (const item of items) {
    const section = sections.get(item.section) ?? [];
    section.push(item);
    sections.set(item.section, section);
  }
  return Array.from(sections.entries());
}

function seismicConformanceScore(items: SeismicConformanceItem[]): SeismicConformanceScore {
  const applicable = items.filter((item) => item.status !== "na").length;
  const met = items.filter((item) => item.status === "ok").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const na = items.filter((item) => item.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { percent, met, applicable, warn, blocked, na };
}

export {
  groupSeismicConformance,
  seismicConformanceItems,
  seismicConformanceScore,
  type SeismicConformanceItem,
  type SeismicConformanceScore,
};
