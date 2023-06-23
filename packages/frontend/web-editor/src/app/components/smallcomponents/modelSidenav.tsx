import {EuiCollapsibleNavGroup, EuiIcon, EuiListGroup, useEuiTheme } from '@elastic/eui';
import {useState, useEffect} from 'react'

interface ModelSidenavProps {
  isNavOpen: boolean;
  onNavToggle: (isOpen: boolean) => void;
}

export default function ModelSidenav({ isNavOpen, onNavToggle }: ModelSidenavProps) {
  const { euiTheme } = useEuiTheme();

  const [pageHeight, setPageHeight] = useState(window.innerHeight - 40);

  const [navHeight, setNavHeight] = useState('initial');

  const handleNavToggle = () => {
    const newNavOpenState = !isNavOpen;
    onNavToggle(newNavOpenState);
  };

  useEffect(() => {
    // Update the window size whenever the window is resized
    const handleResize = () => {
      setPageHeight(window.innerHeight - 40)
    };

    window.addEventListener('resize', handleResize);

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  //this effect makes the bar fully extend all the way down
  useEffect(() => {
    if (!isNavOpen) {
      setNavHeight(pageHeight !== null ? `${pageHeight}px` : 'initial');
    } else {
      setNavHeight('initial');
    }
  }, [pageHeight, isNavOpen]);

  /**
   * This is the list of nav items, I will do a small write up so in case I am not the one who is adding new items to it
   * the first nested layer is where the entire list of options resides, and probably shouldn't be messed with ever, except to change the name
   * the second layer hold a list of objects, but will only appear if it is given a title, otherwise, it will stay hidden
   * objects in this layer cannot have icon, on click, or href properties so this should only be used as a section container
   * between these is a white line, so make large enough containers to not have those if it is desired
   * the third later is where everything clickable is, note that it is aligned with nested items, and I can't think of a fix for this as of the tiem of writing this
   * currently the nested options are automcatically set to be out, but this can be changed easily if we decide we hate it
   */
  const navItems = {
    id: 'mainNavGroup',
    title: 'Options Menu',
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
            href: '/model/1/initiatingevents'
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
            href: 'model/1/eventtrees'
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
            href: 'model/1/gates'
          },
          {
            id: 'basicEventNavItem',
            label: 'Basic Events',
            icon: <EuiIcon type="visBarVertical" />,
            href: 'model/1/basicevents'
          },
          {
            id: 'ccfGroupsNavItem',
            label: 'CCF Groups',
            icon: <EuiIcon type="apps" />,
            href: 'model/1/ccfgroups'
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
    //loops through 1 layer, then the second, then finally displays the items with data in them
    //this has to be done right now because we couldn't find a fix to have it optionally display data in the second layer if there was no 3rd layer present
    //overflow is so things scroll correctly, the maxhieght is to adjust the nav height, 40 is the height of the header
    <EuiCollapsibleNavGroup
      className="eui-scrollBar"
      key={navItems.id}
      title={navItems.title}
      style={{overflowY: 'hidden', overflow: "overlay", height: navHeight, maxHeight: pageHeight, maxWidth: '350px', backgroundColor: euiTheme.colors.lightShade}}
      isCollapsible={true}
      initialIsOpen={true}
      onToggle={handleNavToggle}
    >

      {navItems.items.map((navGroup) => (
        <EuiCollapsibleNavGroup
          key={navGroup.id}
          title={navGroup.title}
          isCollapsible={true}
          initialIsOpen={false}
        >
          {navGroup.items ? (
            <EuiListGroup listItems={navGroup.items}/>
          ) : (
            <EuiListGroup listItems={[{ label: navGroup.label }]} />
          )}

          {/* Render sub-items */}
        </EuiCollapsibleNavGroup>
      ))}
    </EuiCollapsibleNavGroup>

  );
}
