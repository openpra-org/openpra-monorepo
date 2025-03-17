# Radiological Consequence Analysis Schema Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Schema Requirements Coverage](#schema-requirements-coverage)
   1. [Release Category to Radiological Consequence (RCRE)](#release-category-to-radiological-consequence-rcre)
   2. [Atmospheric Transport and Dispersion (RCAD)](#atmospheric-transport-and-dispersion-rcad)
   3. [Dosimetry (RCDO)](#dosimetry-rcdo)
   4. [Consequence Quantification (RCQ)](#consequence-quantification-rcq)
   5. [Protective Action Parameters (RCPA)](#protective-action-parameters-rcpa)
   6. [Meteorological Data (RCME)](#meteorological-data-rcme)
3. [Sample Implementation for EBR-II](#sample-implementation-for-ebr-ii)
4. [Future Enhancements](#future-enhancements)

## Introduction

This document provides evidence that the Radiological Consequence Analysis TypeScript schema satisfies the supporting requirements for documentation as specified in the standards. The schema has been designed to capture all necessary information for a comprehensive radiological consequence analysis, with specific consideration for the unique characteristics of different reactor types including sodium-cooled fast reactors like EBR-II.

The schema enables structured documentation of:
- Release category to radiological consequence transitions
- Atmospheric transport and dispersion modeling
- Dosimetry calculations
- Consequence quantification
- Protective action parameters
- Meteorological data

## Schema Requirements Coverage

### Release Category to Radiological Consequence (RCRE)

#### RCRE-C1 Coverage

The schema includes a comprehensive structure for documenting the process used in the release category to Radiological Consequence Analysis transition.

**Traceability Matrix for RCRE-C1**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | Extends `BaseProcessDocumentation` with specific fields |
| Specify inputs | `RadiologicalConsequenceDocumentation.inputSources` | Array of input sources |
| Applied methods | `RadiologicalConsequenceDocumentation.appliedMethods` | Array of methods used |
| Results | `RadiologicalConsequenceDocumentation.resultsSummary` | Summary of analysis results |
| Address RCRE-A2 inputs | `ReleaseCategoryInputs`, `ReleaseCharacteristics` | Captures all required characteristics |
| Selected consequence metrics | `ReleaseCategoryToConsequenceAnalysis.selectedConsequenceMeasures` | Array of selected metrics |
| Bounding site assumptions | `BoundingSite.boundingJustification` | Justification for bounding site selection |

**Code Sample for RCRE Documentation**

```typescript
// Sample documentation for Release Category to Consequence Analysis
const releaseToConsequenceDoc = {
  inputSources: [
    "Source term data from Mechanistic Source Term Analysis for EBR-II",
    "EBR-II site meteorological data from 2020-2024",
    "Population distribution based on 2020 census data"
  ],
  appliedMethods: [
    "Sodium fire plume model for metallic fuel releases",
    "Gaussian plume dispersion modeling adapted for EBR-II site",
    "ICRP dosimetry methods with specific considerations for sodium activation products"
  ],
  resultsSummary: "Analysis indicates that all release categories for EBR-II meet the safety criteria with adequate margin."
};
```

### Atmospheric Transport and Dispersion (RCAD)

#### RCAD-F3 Coverage

The schema provides dedicated structures for documenting the atmospheric transport and dispersion analysis process.

**Traceability Matrix for RCAD-F3**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | General documentation structure |
| Meteorological data | `AtmosphericDispersionAnalysis.meteorologicalDataSpecification` | Reference to meteorological data |
| Atmospheric dispersion models | `AtmosphericDispersionAnalysis.dispersionModel` | Model specification |
| Plume rise models | `AtmosphericDispersionAnalysis.plumeRiseConsideration` | Plume rise considerations |
| Building wake models | `AtmosphericDispersionAnalysis.buildingWakeEffectsConsideration` | Building wake effects |
| Terrain effects models | `AtmosphericDispersionAnalysis.terrainEffectsConsideration` | Terrain effects |
| Deposition models | `AtmosphericDispersionAnalysis.depositionModeling` | Documentation of deposition modeling |
| Model limitations | `AtmosphericDispersionAnalysis.modelLimitations` | Model limitations and constraints |
| Method-specific features | `AtmosphericDispersionAnalysis.dispersionModelJustification` | Justification for chosen model |

**Code Sample for RCAD Documentation**

```typescript
// Sample documentation for Atmospheric Transport and Dispersion
const atmosphericAnalysis: AtmosphericDispersionAnalysis = {
  dispersionModel: "Modified Gaussian Plume Model with sodium fire considerations",
  dispersionModelJustification: "Appropriate for modeling both gaseous radioactive releases and sodium fire aerosols relevant to EBR-II",
  plumeRiseConsideration: "Enhanced plume rise modeling for high-temperature sodium fires using modified Briggs' equations",
  buildingWakeEffectsConsideration: "Building wake effects modeled using the PRIME algorithm with adaptations for EBR-II facility geometry",
  terrainEffectsConsideration: "Terrain effects addressed using digital elevation model with 10m resolution",
  dispersionUncertainty: {
    sources: ["Wind direction variability", "Atmospheric stability classification", "Sodium fire plume behavior"],
    assumptions: ["Neutral stability conditions as baseline", "Complete combustion of sodium"],
    alternatives: ["Lagrangian particle dispersion model for complex terrain conditions"]
  },
  depositionModeling: "Dry and wet deposition modeled with special consideration for sodium aerosols and their hygroscopic properties",
  modelLimitations: "The modified Gaussian model assumes steady-state conditions which may not fully represent rapid changes during sodium fire events"
};
```

### Dosimetry (RCDO)

#### RCDO-C1 and RCDO-C2 Coverage

The schema includes comprehensive structures for documenting the dosimetry analysis process and characterizing uncertainty in dose conversion factors.

**Traceability Matrix for RCDO-C1 & RCDO-C2**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | General documentation structure |
| Exposure pathways models | `DosimetryAnalysis.exposurePathways` | Array of exposure pathways |
| Recognized sources for DCFs | `DosimetryAnalysis.dcfSource` | DCF source documentation |
| Protection factors | `DosimetryAnalysis.shieldingConsiderations`, `DosimetryAnalysis.occupancyConsiderations` | Shielding and occupancy factors |
| Parameter uncertainty | `DosimetryAnalysis.dcfUncertainty` | Uncertainty documentation |
| Characterize DCF uncertainty | `DosimetryAnalysis.dcfParameterUncertaintyCharacterisation` | Detailed uncertainty characterization |

**Code Sample for RCDO Documentation**

```typescript
// Sample documentation for Dosimetry Analysis
const dosimetryAnalysis: DosimetryAnalysis = {
  exposurePathways: [
    "Inhalation", 
    "Ground Shine", 
    "Cloud Submersion",
    "Sodium activation product exposure"
  ],
  dcfSource: "ICRP Publication 72 with specific considerations for sodium-22 and sodium-24",
  shieldingConsiderations: "Shielding factors account for EBR-II facility structures and typical residential buildings in the vicinity",
  occupancyConsiderations: "Time-dependent occupancy factors used for facility staff and nearby population",
  dcfUncertainty: {
    sources: [
      "Age-dependent variability",
      "Biokinetic model parameters",
      "Uncertainty in sodium activation product dosimetry"
    ],
    assumptions: [
      "Adult dose coefficients used as baseline",
      "Linear energy transfer effects for activated sodium isotopes"
    ],
    alternatives: [
      "Age-specific dose coefficients",
      "Site-specific biokinetic models"
    ]
  },
  dcfParameterUncertaintyCharacterisation: "Log-normal distributions applied for DCF parameter uncertainties with increased geometric standard deviation for sodium activation products"
};
```

### Consequence Quantification (RCQ)

#### RCQ-D1 Coverage

The schema provides comprehensive structures for documenting the consequence quantification process.

**Traceability Matrix for RCQ-D1**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | General documentation structure |
| Specify inputs | `ConsequenceQuantificationAnalysis.supportingDocumentationReferences` | References to input documentation |
| Applied methods/models | `ConsequenceQuantificationAnalysis.consequenceCodesUsed` | Codes and models used |
| Results | `ConsequenceQuantificationAnalysis.eventSequenceConsequences` | Results for each sequence |
| Models and codes used | `ConsequenceQuantificationAnalysis.consequenceCodesUsed` | Documentation of codes |
| Consequence metrics | `ConsequenceQuantificationAnalysis.selectedMetrics` | Selected metrics |
| Integration of data | `ConsequenceQuantificationAnalysis.uncertaintyCharacterization` | Uncertainty characterization |
| Model limitations | `ConsequenceQuantificationAnalysis.modelAndCodeLimitations` | Limitations of models |

**Code Sample for RCQ Documentation**

```typescript
// Sample documentation for Consequence Quantification
const consequenceQuantification: ConsequenceQuantificationAnalysis = {
  selectedMetrics: ["Early Fatalities", "Latent Cancer Fatalities", "Thyroid Dose", "Sodium Exposure Effects"],
  consequenceCodesUsed: ["MACCS2 (modified for sodium coolant)", "NAFIRE (for sodium fire progression)"],
  modelAndCodeLimitations: [
    {
      code: "MACCS2",
      feature: "Atmospheric dispersion",
      limitation: "Standard implementation does not account for sodium fire thermal characteristics",
      justification: "Modified with custom plume rise and energy release models for sodium fires"
    },
    {
      feature: "Sodium aerosol deposition",
      limitation: "Simplified representation of complex chemical interactions",
      justification: "Conservative assumptions applied to bound potential consequences"
    }
  ],
  eventSequenceConsequences: [
    {
      eventSequenceFamily: "ESF-001", // LOSA scenario with primary boundary failure
      consequences: {
        "Early Fatalities": 0.02,
        "Latent Cancer Fatalities": 1.5,
        "Thyroid Dose": 0.15, // Sv
        "Sodium Exposure Effects": 0.01
      },
      meanValue: 1.5e-7,
      uncertainty: "Log-normal distribution with GSD = 3.0"
    }
  ],
  uncertaintyCharacterization: "Monte Carlo analysis with 10,000 samples used to propagate uncertainties in source term, meteorology, and dosimetry parameters",
  supportingDocumentationReferences: [
    "Section 5: EBR-II Consequence Analysis Report",
    "Appendix B: Sodium Fire Model Validation"
  ],
  healthEffectsConsidered: {
    earlyEffects: ["Acute radiation syndrome", "Chemical burns from sodium exposure"],
    latentEffects: ["Cancer", "Hereditary effects"],
    doseResponseApproach: "Linear no-threshold model with additional considerations for sodium chemical toxicity"
  }
};
```

### Protective Action Parameters (RCPA)

**Traceability Matrix for RCPA Documentation**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | General documentation structure |
| Protective actions modeled | `ProtectiveActionAnalysis.protectiveActionParameters` | Parameters for protective actions |
| Protective action parameters | `ProtectiveActionAnalysis.protectiveActionParameters` | Detailed parameters |
| Incident phases | `ProtectiveActionAnalysis.emergencyResponseTimingBases` | Timing information |
| Population distribution | `ProtectiveActionAnalysis.populationDistribution` | Population data |
| Land-use data | `ProtectiveActionAnalysis.landUseCharacteristics` | Land use information |
| Plant characteristics | `BoundingSite.characteristics` | Plant physical information |
| Parameter uncertainty | `ProtectiveActionAnalysis.protectiveActionUncertainty` | Uncertainty documentation |
| Generic references | `RadiologicalConsequenceDocumentation.supportingDocumentationReferences` | External references |

**Code Sample for RCPA Documentation**

```typescript
// Sample documentation for Protective Action Parameters
const protectiveActionAnalysis: ProtectiveActionAnalysis = {
  protectiveActionParameters: {
    evacuationDelay: "1.5 hours for general population",
    evacuationSpeed: "15 mph under normal conditions, 8 mph during adverse weather",
    shelteringEffectiveness: "60% reduction for gaseous releases, 80% for particulates",
    "naOHProtection": "Distribution of NaOH solution for sodium decontamination at assembly points"
  },
  populationDistribution: "Population data from 2020 census with seasonal adjustments for recreational areas near EBR-II",
  landUseCharacteristics: "Mixed use with agricultural (70%), residential (15%), and industrial (15%) within 10-mile radius",
  emergencyResponseTimingBases: "EBR-II emergency response plan with specific provisions for sodium fire events and specialized response teams",
  protectiveActionUncertainty: {
    sources: [
      "Evacuation timing variability",
      "Shelter-in-place effectiveness for sodium aerosols",
      "Weather-dependent evacuation routes"
    ],
    assumptions: [
      "90% compliance with evacuation orders",
      "Availability of specialized sodium response equipment"
    ],
    alternatives: [
      "Staged evacuation scenarios",
      "Enhanced sheltering with HEPA filtration"
    ]
  },
  boundingWarningTimeAssumption: "Minimum warning time of 25 minutes based on automated detection systems for sodium leaks and fires"
};
```

### Meteorological Data (RCME)

**Traceability Matrix for RCME Documentation**

| Requirement Aspect | Schema Element | Notes |
|-------------------|----------------|-------|
| Document the process | `RadiologicalConsequenceDocumentation` | General documentation structure |
| Source of data | `MeteorologicalDataAnalysis.meteorologicalDataSetDescription` | Description of data source |
| Quality assessment | Should be included in documentation | Partially covered |
| Levels of sensors | Should be included in description | Partially covered |
| Exposure of tower | Should be included in description | Partially covered |
| Calibration records | Should be included in description | Partially covered |
| Period of record | `MeteorologicalDataAnalysis.meteorologicalDataSetDescription` | Time period information |
| Percent data recovery | Should be included in description | Partially covered |
| Parameter uncertainty | `MeteorologicalDataAnalysis.parameterUncertaintyCharacterisation` | Uncertainty characterization |

**Code Sample for RCME Documentation**

```typescript
// Sample documentation for Meteorological Data
const meteorologicalData: MeteorologicalDataAnalysis = {
  parameterUncertaintyCharacterisation: "Wind direction uncertainty modeled with von Mises distribution; wind speed with Weibull distribution calibrated to site data",
  meteorologicalDataSetDescription: "Five years (2020-2024) of hourly meteorological data from the on-site 60m tower at EBR-II. Data includes wind speed and direction at 10m and 60m heights, temperature at 2m and 60m, precipitation, and stability class. Quality assessment performed quarterly with 98.7% data recovery.",
  meteorologicalFrequencyDistributionTreatment: "Stratified random sampling approach used to select 120 representative weather sequences based on seasonal and diurnal patterns",
  temporalChangesAccommodation: "Hourly meteorological data used to capture diurnal variations in wind patterns and stability conditions relevant to EBR-II site",
  timeResolution: "Hourly"
};
```

## Sample Implementation for EBR-II

Below is a simplified sample implementation for the EBR-II reactor, focusing on its unique characteristics:

```typescript
// Sample RadiologicalConsequenceAnalysis implementation for EBR-II
const ebrIIConsequenceAnalysis: RadiologicalConsequenceAnalysis = {
  "technical-element-type": TechnicalElementTypes.CONSEQUENCE_ANALYSIS,
  "technical-element-code": "RC",
  metadata: {
    version: "1.0",
    analysis_date: "2025-03-15",
    analyst: "Dr. Jane Smith",
    scopeDefinition: {
      isSpecificSite: true,
      siteReference: "SITE-EBR2",
      consequenceMetrics: ["Individual Early Fatality Risk", "Population Latent Cancer Risk", "Sodium Exposure Risk"],
      protectiveActionsModellingDegree: "Detailed modeling including specialized response for sodium fires",
      meteorologyModellingDegree: "Site-specific meteorological data with enhanced turbulence measurements",
      atmosphericDispersionModellingDegree: "Modified Gaussian plume model with sodium fire plume rise parameters",
      dosimetryModellingDegree: "Detailed dose calculations including activated sodium isotopes",
      healthEffectsModellingDegree: "Combined radiological and chemical effects modeling",
      economicFactorsModellingDegree: "Assessment including sodium cleanup costs"
    }
  },
  
  // Release Category Analysis specifically considering sodium coolant aspects
  releaseCategoryToConsequence: {
    siteInformation: {
      isBounding: false,
      siteReference: "SITE-EBR2"
    },
    releaseCategoryInputs: [
      {
        releaseCategory: "RCAT-001", // Loss of Sodium Accident (LOSA)
        releaseCharacteristics: {
          numberOfPlumes: 2, // Initial release and delayed sodium fire
          radionuclideGroupFractions: { 
            NobleGases: 0.95, 
            Iodines: 0.4,
            "ActivatedSodium": 0.85 
          },
          importantRadionuclides: ["Na-22", "Na-24", "Cs-137", "I-131", "Kr-85"],
          importantRadionuclidesJustification: "Na-22 and Na-24 are significant due to sodium coolant activation; Cs-137 and I-131 from metallic fuel; Kr-85 from gap release",
          releaseTiming: "0 hour initial, 2 hour sodium fire",
          releaseDuration: "1 hour initial, 8 hours sodium fire",
          warningTime: 0.4,
          warningTimeDescription: "24 minutes based on leak detection system",
          releaseEnergy: 3.5e9, // Higher due to sodium fire
          releaseEnergyDescription: "High - exothermic sodium fire",
          releaseHeight: 45, // Elevated due to buoyant plume
          releaseHeightDescription: "Elevated due to sodium fire thermal buoyancy"
        }
      }
    ],
    releaseCategoryAndSourceTermReviewed: true,
    selectedConsequenceMeasures: ["Individual Early Fatality Risk", "Population Latent Cancer Risk", "Sodium Exposure Risk"],
    releaseCategoryLinkageDocumentation: "See Section 4.2 of EBR-II PRA for event sequence mapping"
  },
  
  // Other required elements would follow, each with EBR-II specific considerations
  atmosphericTransportAndDispersion: { /* EBR-II specific details */ },
  dosimetry: { /* EBR-II specific details */ },
  consequenceQuantification: { /* EBR-II specific details */ },
  protectiveActionParameters: { /* EBR-II specific details */ },
  meteorologicalData: { /* EBR-II specific details */ }
};
```

This implementation highlights several key EBR-II characteristics:
1. Sodium coolant activation products (Na-22, Na-24) as important radionuclides
2. Multiple plume phases including the initial release and subsequent sodium fire
3. Higher release energy due to exothermic sodium-air reactions
4. Specialized protective actions for sodium exposure
5. Modified dispersion modeling for sodium fire plumes
6. Combined radiological and chemical effects in the health impact assessment

## Future Enhancements

While the current schema provides comprehensive coverage of the documentation requirements, several areas could be enhanced in future versions:

1. **Meteorological Data Documentation** - The schema could be extended to include more explicit fields for quality assessment, sensor levels, tower exposure, calibration records, and data recovery metrics to fully satisfy all RCME documentation requirements.

2. **Specialized Reactor Type Extensions** - Create dedicated extensions for sodium-cooled reactors like EBR-II, including specific fields for sodium fire modeling, activated coolant considerations, and metal fuel behavior.

3. **Integration with Visualization Tools** - Add schema elements to support direct integration with visualization and reporting tools for more effective communication of results.

4. **Time-Dependent Protective Actions** - Enhance the schema to better capture the evolution of protective actions through different phases of an incident, with more structured timing information.

5. **Enhanced Uncertainty Representation** - Develop more detailed structures for representing uncertainty distributions, correlation between parameters, and sensitivity analysis results.

6. **Validation Record Integration** - Add structures to document model validation studies, including comparisons with experimental data particularly for specialized phenomena like sodium fires.

7. **Cross-References to Source Term Analysis** - Strengthen the connections between radiological consequence analysis and upstream mechanistic source term analysis, particularly for non-LWR technologies.