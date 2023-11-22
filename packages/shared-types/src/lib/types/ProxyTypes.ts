/**
 * An enum of various proxyTypes types.
 *
 * @enum {Object}
 */
export enum ProxyTypes {
  COLLECT_FORMULA = "CollectFormula",
  COLLECT_EXPRESSION = "CollectExpression",
  EVENT_REFERENCE = "EventReference",
  LOGICAL_EXPRESSION = "LogicalExpression",
  FLOAT = "Float",
  STRING_DISTRIBUTION = "StringDistribution",
  EXPONENTIAL_DISTRIBUTION = "ExponentialDistribution",
  LOG_NORMAL_DISTRIBUTION = "LognormalDistribution",
  WEIBULL_DISTRIBUTION = "WeibullDistribution",
  NORMAL_DISTRIBUTION = "NormalDistribution",
  UNIFORM_DISTRIBUTION = "UniformDistribution",
  NON_PARAMETRIC_DISTRIBUTION = "NonParametricDistribution",
  FORK = "Fork",
  END_STATE = "EndState",
  SEQUENCE_NOT_DEVELOPED_FURTHER = "SequenceNotDevelopedFurther", //does not actually exist
  ESD_TRANSFER = "ESDTransfer", //does not actually exist
  DESCRIPTION = "Description", //not exist
  INTERMEDIATE_PLANT_STATE = "IntermediatePlantState", //not exist
  BBN_LINK_EXPRESSION = "BBNLinkExpression",
  PARTS_FIT_EXPRESSION = "PartsFITExpression",
  DISTRIBUTION = "Distribution", // This field does not actually exist. Front end development purpose only.
}

export const ProxyTypeDisplayNames = {
  [ProxyTypes.COLLECT_FORMULA]: "Fault Tree Link",
  [ProxyTypes.COLLECT_EXPRESSION]: "Expression",
  [ProxyTypes.EVENT_REFERENCE]: "EventReference",
  [ProxyTypes.LOGICAL_EXPRESSION]: "LogicalExpression",
  [ProxyTypes.FLOAT]: "Constant",
  [ProxyTypes.STRING_DISTRIBUTION]: "Expression",
  [ProxyTypes.EXPONENTIAL_DISTRIBUTION]: "Exponential",
  [ProxyTypes.LOG_NORMAL_DISTRIBUTION]: "Lognormal",
  [ProxyTypes.WEIBULL_DISTRIBUTION]: "Weibull",
  [ProxyTypes.NORMAL_DISTRIBUTION]: "Normal",
  [ProxyTypes.UNIFORM_DISTRIBUTION]: "Uniform",
  [ProxyTypes.NON_PARAMETRIC_DISTRIBUTION]: "Non Parametric",
  [ProxyTypes.FORK]: "Fork",
  [ProxyTypes.END_STATE]: "EndState",
  [ProxyTypes.SEQUENCE_NOT_DEVELOPED_FURTHER]: "SequenceNotDevelopedFurther",
  [ProxyTypes.ESD_TRANSFER]: "ESDTransfer",
  [ProxyTypes.DESCRIPTION]: "Description",
  [ProxyTypes.INTERMEDIATE_PLANT_STATE]: "IntermediatePlantState",
  [ProxyTypes.DISTRIBUTION]: "Distribution",
  [ProxyTypes.BBN_LINK_EXPRESSION]: "Bayesian Network Link",
  [ProxyTypes.PARTS_FIT_EXPRESSION]: "Parts FIT",
};
