import type { NavNode, ScopedNavScope } from './types';

/**
 * Navigation configuration grouped by scoped model context.
 *
 * Provides the left-hand navigation tree for each OpenPRA analysis scope
 * (InternalEvents, InternalHazards, ExternalHazards, FullScope).
 */

// Define individual sections with stable ids and relative paths
const POS: NavNode = {
  id: 'plant-operating-state',
  name: 'Plant Operating State Analysis',
  path: 'plant-operating-state-analysis',
  iconType: 'sparkles',
  expanded: true,
  items: [
    {
      id: 'operating-state-analysis',
      name: 'Operating State Analysis',
      path: 'operating-state-analysis',
      iconType: 'shard',
    },
  ],
};

const IE: NavNode = {
  id: 'initiating-event-analysis',
  name: 'Initiating Event Analysis',
  path: 'initiating-event-analysis',
  expanded: true,
  items: [
    {
      id: 'initiating-events',
      name: 'Initiating Events',
      path: 'initiating-events',
      iconType: 'shard',
    },
    {
      id: 'initiating-events-model-view',
      name: 'Model View',
      path: 'initiating-events-model-view',
      iconType: 'shard',
    },
    {
      id: 'heat-balance-fault-trees',
      name: 'Heat Balance fault Trees',
      path: 'heat-balance-fault-trees',
      iconType: 'tokenRepo',
    },
  ],
};

const ES: NavNode = {
  id: 'event-sequence-analysis',
  name: 'Event Sequence Analysis',
  path: 'event-sequence-analysis',
  expanded: true,
  items: [
    {
      id: 'event-sequence-analysis-item',
      name: 'Event Sequence Analysis',
      path: 'event-sequence-analysis',
      iconType: 'aggregate',
    },
    {
      id: 'event-sequence-diagrams',
      name: 'Event Sequence Diagrams',
      path: 'event-sequence-diagrams',
      iconType: 'tokenRepo',
    },
    {
      id: 'event-trees',
      name: 'Event Trees',
      path: 'event-trees',
      iconType: 'editorBold',
    },
  ],
};

const SC: NavNode = {
  id: 'success-criteria-developement',
  name: 'Success Criteria Developement',
  path: 'success-criteria-developement',
  expanded: true,
  items: [
    {
      id: 'success-criteria',
      name: 'Success Criteria',
      path: 'success-criteria',
      iconType: 'stats',
    },
    {
      id: 'functional-events',
      name: 'Functional Events',
      path: 'functional-events',
      iconType: 'tokenRepo',
    },
  ],
};

const SY: NavNode = {
  id: 'systems-analysis',
  name: 'Systems Analysis',
  path: 'systems-analysis',
  expanded: true,
  items: [
    {
      id: 'systems-analysis-item',
      name: 'Systems Analysis',
      path: 'systems-analysis',
      iconType: 'aggregate',
    },
    {
      id: 'fault-trees',
      name: 'Fault Trees',
      path: 'fault-trees',
      iconType: 'tokenRepo',
    },
    {
      id: 'bayesian-networks',
      name: 'Bayesian Networks',
      path: 'bayesian-networks',
      iconType: 'editorBold',
    },
    {
      id: 'markov-chains',
      name: 'Markov Chains',
      path: 'markov-chains',
      iconType: 'tokenShape',
    },
  ],
};

const HR: NavNode = {
  id: 'human-reliability-analysis',
  name: 'Human Reliability Analysis',
  path: 'human-reliability-analysis',
  expanded: true,
  items: [
    {
      id: 'human-reliability-analysis-item',
      name: 'Human Reliability Analysis',
      path: 'human-reliability-analysis',
      iconType: 'tokenRepo',
    },
  ],
};

const DA: NavNode = {
  id: 'data-analysis',
  name: 'Data Analysis',
  path: 'data-analysis',
  expanded: true,
  items: [
    {
      id: 'data-analysis-item',
      name: 'Data Analysis',
      path: 'data-analysis',
      iconType: 'aggregate',
    },
    {
      id: 'bayesian-estimation',
      name: 'Bayesian Estimation',
      path: 'bayesian-estimation',
      iconType: 'tokenRepo',
    },
    {
      id: 'weibull-analysis',
      name: 'Weibull Analysis',
      path: 'weibull-analysis',
      iconType: 'bolt',
    },
  ],
};

const FL: NavNode = {
  id: 'internal-flood-pra',
  name: 'Internal Flood PRA',
  path: 'internal-flood-pra',
};
const F: NavNode = {
  id: 'internal-fire-pra',
  name: 'Internal Fire PRA',
  path: 'internal-fire-pra',
};
const S: NavNode = {
  id: 'seismic-pra',
  name: 'Seismic PRA',
  path: 'seismic-pra',
};
const HS: NavNode = {
  id: 'hazards-screening-analysis',
  name: 'Hazards Screening Analysis',
  path: 'hazards-screening-analysis',
};
const W: NavNode = {
  id: 'high-winds-pra',
  name: 'High Winds PRA',
  path: 'high-winds-pra',
};
const XF: NavNode = {
  id: 'external-flooding-pra',
  name: 'External Flooding PRA',
  path: 'external-flooding-pra',
};
const O: NavNode = {
  id: 'other-hazards-pra',
  name: 'Other Hazards PRA',
  path: 'other-hazards-pra',
};

const ESQ: NavNode = {
  id: 'event-sequence-quantification',
  name: 'Event Sequence Quantification',
  path: 'event-sequence-quantification',
  expanded: true,
  items: [
    {
      id: 'event-sequence-quantification-diagrams',
      name: 'Event Sequence Quantification Diagrams',
      path: 'event-sequence-quantification-diagrams',
      iconType: 'tokenRepo',
    },
  ],
};

const MS: NavNode = {
  id: 'mechanistic-source-term-analysis',
  name: 'Mechanistic Source Term Analysis',
  path: 'mechanistic-source-term-analysis',
  expanded: true,
  items: [
    {
      id: 'mechanistic-source-terms',
      name: 'Mechanistic Source Terms',
      path: 'mechanistic-source-terms',
      iconType: 'tokenRepo',
    },
  ],
};

const RC: NavNode = {
  id: 'radiological-consequence-analysis',
  name: 'Radiological Consequence Analysis',
  path: 'radiological-consequence-analysis',
  expanded: true,
  items: [
    {
      id: 'radiological-consequence-analysis-item',
      name: 'Radiological Consequence Analysis',
      path: 'radiological-consequence-analysis',
      iconType: 'tokenRepo',
    },
  ],
};

const RI: NavNode = {
  id: 'risk-integration',
  name: 'Risk Integration',
  path: 'risk-integration',
  expanded: true,
  items: [
    {
      id: 'risk-integration-item',
      name: 'Risk Integration',
      path: 'risk-integration',
      iconType: 'tokenRepo',
    },
  ],
};

const SETTINGS: NavNode = {
  id: 'settings',
  name: 'Settings',
  path: 'settings',
  iconType: 'gear',
};

/**
 * Map of model scope to the ordered list of navigation sections displayed in the UI.
 */
export const NAV_BY_SCOPE: Record<ScopedNavScope, NavNode[]> = {
  InternalEvents: [POS, IE, ES, SC, SY, HR, DA, ESQ, MS, RC, RI, SETTINGS],
  InternalHazards: [
    POS,
    IE,
    ES,
    SC,
    SY,
    HR,
    DA,
    FL,
    F,
    HS,
    O,
    ESQ,
    MS,
    RC,
    RI,
    SETTINGS,
  ],
  ExternalHazards: [
    POS,
    IE,
    ES,
    SC,
    SY,
    HR,
    DA,
    S,
    HS,
    W,
    XF,
    O,
    ESQ,
    MS,
    RC,
    RI,
    SETTINGS,
  ],
  FullScope: [
    POS,
    IE,
    ES,
    SC,
    SY,
    HR,
    DA,
    FL,
    F,
    S,
    HS,
    W,
    XF,
    O,
    ESQ,
    MS,
    RC,
    RI,
    SETTINGS,
  ],
};

/** Re-export of the NavNode shape used by the navigation builder. */
export type { NavNode };
