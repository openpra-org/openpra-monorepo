import {EuiCollapsibleNav, EuiCollapsibleNavGroup, EuiIcon, EuiListGroup, useEuiTheme} from '@elastic/eui';

export default function Sidenav() {
  const {euiTheme} = useEuiTheme();

  const navItems =
      {
        id: 'mainNavGroup',
        title: 'Side Nav',
        items: [
          {
            id: 'initEventAnalysisNavGroup',
            title: 'Initiating Event Analysis',
            items: [
              {
                id: 'initEventNavGroup',
                label: 'Initiating Events',
                icon: <EuiIcon type='branch'/>
              },
            ]
          },
          {
            id: 'eventSeqAnalysisNavGroup',
            label: 'Event Sequence Analysis',
            items: [
              {
                id: 'eventSeqDiaNavGroup',
                label: 'Event Sequence Diagrams',
                icon: <EuiIcon type='branch'/>
              },
              {
                id: 'eventTreesNavGroup',
                label: 'Event Trees',
                icon: <EuiIcon type='branch' />
              }
            ]
          },
          {
            id: 'sysAnalysisNavGroup',
            label: 'Systems Analysis',
            items: [
              {
                id: 'faultTreesNavGroup',
                label: 'Fault Trees',
                icon: <EuiIcon type='logstashIf' />
              },
              {
                id: 'bayeNetNavGroup',
                label: 'Bayesian Networks',
                icon: <EuiIcon type='branch' />
              }
            ]
          },
          {
            id: 'dataAnalysisNavGroup',
            label: 'Data Analysis',
            items: [
              {
                id: 'gatesNavItem',
                label: 'Gates'
              }
            ]
          }

          // Add more items as needed
        ],
      }
  // Add more groups and items as needed
  return (
      <EuiCollapsibleNavGroup
          key={navItems.id}
          title={navItems.title}
          style={{maxWidth: '250px', backgroundColor: euiTheme.colors.mediumShade}}
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
              <EuiListGroup listItems={navGroup.items} />

              {/* Render sub-items */}

            </EuiCollapsibleNavGroup>
        ))}
      </EuiCollapsibleNavGroup>
  )
}
