import {SideNavTab} from "../typedModel/schemas/side-nav-tabs.schema";

export const SIDE_NAV_DATA: SideNavTab[] = [
  {title: "Initiating Event Analysis",navigateTo: "initiating-event-analysis",children: [{label: "Initiating Event Analysis",iconType: "shard",pinned: false,visible: true,navigateTo: "initiating-events"}],pinned: false,visible: true,},
  {title: "Plant Operating State Analysis",navigateTo: "plant-operating-state-analysis",children: [{label: "Operating State Analysis", iconType: "shard", pinned: false,visible: true,navigateTo: "operating-state-analysis"}],pinned: false,visible: true},
  {title: "Event Sequence Analysis",navigateTo: "event-sequence-analysis",children: [{label: "Event Sequence Analysis", iconType: "aggregate", pinned: false,visible: true,navigateTo: "event-sequence-analysis"}, {label: "Event Sequence Diagrams", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "event-sequence-diagrams"}, {label: "Event Trees", iconType: "editorBold", pinned: false,visible: true,navigateTo: "event-trees"}],pinned: false,visible: true},
  {title: "Success Criteria Development",navigateTo: "success-criteria-development",children: [{label: "Success Criteria", iconType: "stats", pinned: false,visible: true,navigateTo: "success-criteria"}, {label: "Functional Events", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "functional-events"}],pinned: false,visible: true},
  {title: "Systems Analysis",navigateTo: "systems-analysis",children: [{label: "Systems Analysis", iconType: "aggregate", pinned: false,visible: true,navigateTo: "systems-analysis"}, {label: "Fault Trees", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "fault-trees"}, {label: "Bayesian Networks", iconType: "editorBold", pinned: false,visible: true,navigateTo: "bayesian-networks"}, {label: "Markov Chains", iconType: "tokenShape", pinned: false,visible: true,navigateTo: "markov-chains"}],pinned: false,visible: true},
  {title: "Human Reliability Analysis",navigateTo: "human-reliability-analysis",children: [{label: "Human Reliability Analysis", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "human-reliability-analysis"}],pinned: false,visible: true},
  {title: "Data Analysis",navigateTo: "data-analysis",children: [{label: "Data Analysis", iconType: "aggregate", pinned: false,visible: true,navigateTo: "data-analysis"}, {label: "Bayesian Estimation", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "bayesian-estimation"}, {label: "Weibull Analysis", iconType: "bolt", pinned: false,visible: true,navigateTo: "weibull-analysis"}],pinned: false,visible: true},
  {title: "Internal Flood PRA",navigateTo: "internal-flood-pra",children: [],pinned: false,visible: true},
  {title: "Internal Fire PRA",navigateTo: "internal-fire-pra",children: [],pinned: false,visible: true},
  {title: "Seismic PRA",navigateTo: "seismic-pra",children: [],pinned: false,visible: true},
  {title: "Hazards Screening Analysis",navigateTo: "hazards-screening-analysis",children: [],pinned: false,visible: true},
  {title: "High Winds PRA",navigateTo: "high-winds-pra",children: [],pinned: false,visible: true},
  {title: "External Flooding PRA",navigateTo: "external-flooding-pra",children: [],pinned: false,visible: true},
  {title: "Other Hazards PRA",navigateTo: "other-hazards-pra",children: [],pinned: false,visible: true},
  {title: "Event Sequence Quantification",navigateTo: "event-sequence-quantification",children: [{label: "Event Sequence Quantification Diagrams", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "event-sequence-quantification-diagrams"}],pinned: false,visible: true},
  {title: "Mechanistic Source Term Analysis",navigateTo: "mechanistic-source-term-analysis",children: [{label: "Mechanistic Source Terms", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "mechanistic-source-terms"}],pinned: false,visible: true},
  {title: "Radiological Consequence Analysis",navigateTo: "radiological-consequence-analysis",children: [{label: "Radiological Consequence Analysis", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "radiological-consequence-analysis"}],pinned: false,visible: true},
  {title: "Risk Integration",navigateTo: "risk-integration",children: [{label: "Risk Integration", iconType: "tokenRepo", pinned: false,visible: true,navigateTo: "risk-integration"}],pinned: false,visible: true},

]
