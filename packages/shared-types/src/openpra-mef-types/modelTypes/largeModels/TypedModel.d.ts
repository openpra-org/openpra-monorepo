import { BasicModel } from "../BasicModel";

export type SemanticVersionSchema = string;

export type ID = string;

export type TypedModel2 = {
  "initiatingEvents": ID[];
  "eventSequenceDiagrams": ID[];
  "eventSequenceAnalysis": ID[];
  "functionalEvents"?: ID[];
  "eventTrees": ID[];
  "faultTrees": ID[];
  "bayesianNetworks": ID[];
  "markovChains"?: ID[];
  "bayesianEstimations"?: ID[];
  "weibullAnalysis"?: ID[];
};

export type TypedModel = BasicModel & TypedModel2