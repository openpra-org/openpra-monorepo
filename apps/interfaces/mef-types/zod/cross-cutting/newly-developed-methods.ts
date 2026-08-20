import { z } from "zod";
import { TechnicalElementTypes } from "../../technical-element";
import type {
  EngineeringAndScienceBasis,
  MethodArtifactKind,
  MethodData,
  MethodDocumentation,
  NewlyDevelopedMethod,
  ResultsQuality,
  ScopeAndLimitations,
  TechnicalElementOverlap,
  UncertaintyCharacterization,
} from "../../cross-cutting/newly-developed-methods";
import { SRReferenceSchema } from "../core/pra-common";
import { technicalElementSchema } from "../technical-element";

export const MethodArtifactKindSchema = z.enum([
  "ANALYTICAL_METHOD",
  "TOOL",
  "SKILL",
  "SOLVER",
  "AGENT",
  "MODELING_TECHNIQUE",
]);

export const ScopeAndLimitationsSchema = z.object({
  purpose: z.string(),
  scope: z.string(),
  applicabilityConditions: z.array(z.string()),
  limitations: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EngineeringAndScienceBasisSchema = z.object({
  references: z.array(z.string()),
  rationale: z.string(),
  consistencyWithPurposeAndScope: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MethodDataSchema = z.object({
  dataKind: z.enum(["NUMERIC", "NON_NUMERIC", "MIXED"]),
  sources: z.array(z.string()),
  analysisApproach: z.string(),
  applicationApproach: z.string(),
  technicalSoundnessBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const UncertaintyCharacterizationSchema = z.object({
  uncertaintyTypes: z.array(z.string()),
  modelUncertaintySources: z.array(z.string()),
  associatedAssumptions: z.array(z.string()),
  treatmentApproach: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ResultsQualitySchema = z.object({
  reproducibilityBasis: z.string(),
  reasonablenessBasis: z.string(),
  consistencyWithAssumptionsAndData: z.string(),
  benchmarkComparisons: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MethodDocumentationSchema = z.object({
  description: z.string(),
  traceabilityBasis: z.string(),
  incorporationGuidance: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TechnicalElementOverlapSchema = z.object({
  overlappingTechnicalElementCode: z.string(),
  overlappingTechnicalElementSr: z.string(),
  overlappingNmSr: z.string(),
  resolution: z.enum(["TECHNICAL_ELEMENT_SR_TAKES_PRIORITY", "NM_SR_APPLIES", "BOTH_APPLY"]),
  rationale: z.string(),
});

export const NewlyDevelopedMethodSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.NEWLY_DEVELOPED_METHOD).shape,
  artifactKind: MethodArtifactKindSchema,
  introducedAfterFirstPeerReview: z.boolean(),
  appliedInTechnicalElementIds: z.array(z.string()),
  scopeAndLimitations: ScopeAndLimitationsSchema,
  engineeringAndScienceBasis: EngineeringAndScienceBasisSchema,
  methodData: MethodDataSchema,
  uncertaintyCharacterization: UncertaintyCharacterizationSchema,
  resultsQuality: ResultsQualitySchema,
  documentation: MethodDocumentationSchema,
  technicalElementOverlaps: z.array(TechnicalElementOverlapSchema),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertMethodArtifactKind = Expect<Equal<z.infer<typeof MethodArtifactKindSchema>, MethodArtifactKind>>;
type _AssertScopeAndLimitations = Expect<Equal<z.infer<typeof ScopeAndLimitationsSchema>, ScopeAndLimitations>>;
type _AssertEngineeringAndScienceBasis = Expect<Equal<z.infer<typeof EngineeringAndScienceBasisSchema>, EngineeringAndScienceBasis>>;
type _AssertMethodData = Expect<Equal<z.infer<typeof MethodDataSchema>, MethodData>>;
type _AssertUncertaintyCharacterization = Expect<Equal<z.infer<typeof UncertaintyCharacterizationSchema>, UncertaintyCharacterization>>;
type _AssertResultsQuality = Expect<Equal<z.infer<typeof ResultsQualitySchema>, ResultsQuality>>;
type _AssertMethodDocumentation = Expect<Equal<z.infer<typeof MethodDocumentationSchema>, MethodDocumentation>>;
type _AssertTechnicalElementOverlap = Expect<Equal<z.infer<typeof TechnicalElementOverlapSchema>, TechnicalElementOverlap>>;
type _AssertNewlyDevelopedMethod = Expect<Equal<z.infer<typeof NewlyDevelopedMethodSchema>, NewlyDevelopedMethod>>;
