import { EuiCollapsibleNav, EuiCollapsibleNavGroup, EuiIcon, EuiListGroup, useEuiTheme } from '@elastic/eui';

export default function Sidenav() {
  const { euiTheme } = useEuiTheme();

  /**
   * This is the list of nav items, I will do a small write up so in case I am not the one who is adding new items to it
   * 
   */
  const navItems = {
    id: 'mainNavGroup',
    title: 'Side Nav',
    items: [
      {
        id: 'OperatingStateNavGroup',
        label: 'Operating State Analysis',
        items: [
          {
            id: 'OperatingStateNavItem',
            label: 'Operating State Analysis',
            icon: <EuiIcon type="eyeClosed" />,
          },
        ]
      },
      {
        id: 'initEventAnalysisNavGroup',
        title: 'Initiating Event Analysis',
        items: [
          {
            id: 'initEventNavGroup',
            label: 'Initiating Events',
            icon: <EuiIcon type="branch" />,
          },
        ],
      },
      {
        id: 'eventSeqAnalysisNavGroup',
        title: 'Event Sequence Analysis',
        items: [
          {
            id: 'eventSeqDiaNavGroup',
            label: 'Event Sequence Diagrams',
            icon: <EuiIcon type="branch" />,
            href: 'model/1/eventsequencediagrams',
          },
          {
            id: 'eventTreesNavGroup',
            label: 'Event Trees',
            icon: <EuiIcon type="branch" />,
          },
        ],
      },
      {
        id: 'sysAnalysisNavGroup',
        title: 'Systems Analysis',
        items: [
          {
            id: 'faultTreesNavGroup',
            label: 'Fault Trees',
            icon: <EuiIcon type="logstashIf" />,
            href: '/model/1/faulttrees',
          },
          {
            id: 'bayeNetNavGroup',
            label: 'Bayesian Networks',
            icon: <EuiIcon type="branch" />,
            href: 'model/1/bayesiannetworks',
          },
        ],
      },
      {
        id: 'humanReliabilityAnalysisNavGroup',
        label: 'Human Reliability Analysis',
        items: [
          {
            id: 'humanReliabilityAnalysisNavItem',
            label: 'Human Reliability Analysis',
            icon: <EuiIcon type="eyeClosed" />,          
          },
        ]
      },
      {
        id: 'dataAnalysisNavGroup',
        title: 'Data Analysis',
        items: [
          {
            id: 'gatesNavItem',
            label: 'Gates',
            icon: <EuiIcon type="visBarVertical" />,
          },
          {
            id: 'basicEventNavItem',
            label: 'Basic Events',
            icon: <EuiIcon type="visBarVertical" />,
          },
          {
            id: 'ccfGroupsNavItem',
            label: 'CCF Groups',
            icon: <EuiIcon type="apps" />,
          },
        ],
      },
      {
        id: 'eventSequenceQuantificationNavGroup',
        label: 'Event Sequence Quantification',
        items: [
          {
            id: 'eventSequenceQuantificationNavItem',
            label: 'Event Sequence Quantification',
            icon: <EuiIcon type="eyeClosed" />,
          }
        ]
      },
      {
        id: 'consequenceAnalysisNavGroup',
        label: 'Consequence Analysis',
        items: [
          {
            id: 'consequenceAnalysisNavItem',
            label: 'Consequence Analysis',
            icon: <EuiIcon type="eyeClosed" />,
          }
        ]
      },
      {
        id: 'riskIntegrationNavGroup',
        label: 'Risk Integration',
        items: [
          {
          id: 'riskIntegrationNavItem',
          label: 'Risk Integration',
          icon: <EuiIcon type="eyeClosed" />,
          }
        ]
      },
      {
        id: 'commonOptionsNavGroup',
        label: 'commonOptions',
        items: [
          {
            id: 'overviewNavItem',
            label: 'Overview',
            icon: <EuiIcon type="apps" />,
            href: 'model/1/overview',
          },
          {
            id: 'globalParametersNavItem',
            label: 'Global Parameters',
            icon: <EuiIcon type="database" />,
            href: 'model/1/globalParameters',
          },
          {
            id: 'quantificationHistoryNavItem',
            label: 'Quantification History',
            icon: <EuiIcon type="visBarVertical" />,
            href: 'model/1/quantificationhistory',
          },
        ]
      },
      {
        id: 'settingsNavGroup',
        label: 'Settings',
        items: [
          {
            id: 'settingsNavItem',
            label: 'Settings',
            icon: <EuiIcon type="gear" />,
            href: 'model/1/settings'
          }
        ]
      },
      // Add more items as needed
    ],
  };

  return (
    <EuiCollapsibleNavGroup
      key={navItems.id}
      title={navItems.title}
      style={{ maxWidth: '250px', backgroundColor: euiTheme.colors.lightShade }}
      isCollapsible={true}
      initialIsOpen={true}
    >
      {navItems.items.map((navGroup) => (
        <EuiCollapsibleNavGroup
          key={navGroup.id}
          title={navGroup.title}
          isCollapsible={true}
          initialIsOpen={true}
        >
          {navGroup.items ? (
            <EuiListGroup listItems={navGroup.items} />
          ) : (
            <EuiListGroup listItems={[{ label: navGroup.label }]} />
          )}

          {/* Render sub-items */}
        </EuiCollapsibleNavGroup>
      ))}
    </EuiCollapsibleNavGroup>
  );
}
