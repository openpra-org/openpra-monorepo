import {EuiCollapsibleNavGroup, EuiIcon, EuiListGroup, EuiSideNav, useEuiTheme} from '@elastic/eui';
import {useState, useEffect} from 'react'
import { useNavigate } from 'react-router-dom';

interface ModelSidenavProps {
  isNavOpen: boolean;
  onNavToggle: (isOpen: boolean) => void;
}

export default function ModelSidenav({ isNavOpen, onNavToggle }: ModelSidenavProps) {
  const { euiTheme } = useEuiTheme();

  const [pageHeight, setPageHeight] = useState(window.innerHeight - 40);

  const [navHeight, setNavHeight] = useState('initial');
  const [selectedItemName, setSelectedItem] = useState('Time stuff');

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

  //uses navigate
  const navigate = useNavigate();

  //on clicking the card automatically sets the page this thing is on in the history
  //so it can be navigated to
  const handleNavItemClick = (page: string) => {
    navigate(page);
  };

  /**
   * This is the list of nav items, I will do a small write up so in case I am not the one who is adding new items to it
   * the first nested layer is where the entire list of options resides, and probably shouldn't be messed with ever, except to change the name
   * the second layer hold a list of objects, but will only appear if it is given a title, otherwise, it will stay hidden
   * objects in this layer cannot have icon, on click, or href properties so this should only be used as a section container
   * between these is a white line, so make large enough containers to not have those if it is desired
   * the third later is where everything clickable is, note that it is aligned with nested items, and I can't think of a fix for this as of the tiem of writing this
   * currently the nested options are automcatically set to be out, but this can be changed easily if we decide we hate it
   */
  const navItems = [
      {
            id: 'OperatingStateNavItem',
            name: 'Operating State Analysis',
            icon: <EuiIcon type="eyeClosed" />,
      },
      {
            id: 'initEventNavGroup',
            name: 'Initiating Events',
            icon: <EuiIcon type="branch" />,
            onClick: () => handleNavItemClick('/model/1/initiatingevents'),
      },
      {
        id: 'eventSeqAnalysisNavGroup',
        name: 'Event Sequence Analysis',
        icon: <EuiIcon type="branch" />,
        items: [
          {
            id: 'eventSeqDiaNavGroup',
            name: 'Event Sequence Diagrams',
            onClick: () => handleNavItemClick('/model/1/eventsequencediagrams'),
          },
          {
            id: 'eventTreesNavGroup',
            name: 'Event Trees',
            onClick: () => handleNavItemClick('/model/1/eventtrees'),
          },
        ],
      },
      {
        id: 'sysAnalysisNavGroup',
        name: 'Systems Analysis',
        icon: <EuiIcon type="logstashIf" />,
        items: [
          {
            id: 'faultTreesNavGroup',
            name: 'Fault Trees',
            onClick: () => handleNavItemClick('/model/1/faulttrees'),
          },
          {
            id: 'bayeNetNavGroup',
            name: 'Bayesian Networks',
            onClick: () => handleNavItemClick('/model/1/bayesiannetworks'),
          },
        ],
      },
      {
        id: 'humanReliabilityAnalysisNavItem',
        name: 'Human Reliability Analysis',
        icon: <EuiIcon type="eyeClosed" />,
      },
      {
        id: 'dataAnalysisNavGroup',
        name: 'Data Analysis',
        icon: <EuiIcon type="visBarVertical" />,
        items: [
          {
            id: 'gatesNavItem',
            name: 'Gates',
            onClick: () => handleNavItemClick('/model/1/gates'),
          },
          {
            id: 'basicEventNavItem',
            name: 'Basic Events',
            onClick: () => handleNavItemClick('/model/1/basicevents'),
          },
          {
            id: 'ccfGroupsNavItem',
            name: 'CCF Groups',
            onClick: () => handleNavItemClick('/model/1/ccfgroups'),
          },
        ],
      },
          {
            id: 'eventSequenceQuantificationNavItem',
            name: 'Event Sequence Quantification',
            icon: <EuiIcon type="eyeClosed" />,
          },
          {
            id: 'consequenceAnalysisNavItem',
            name: 'Consequence Analysis',
            icon: <EuiIcon type="eyeClosed" />,
          },
          {
          id: 'riskIntegrationNavItem',
          name: 'Risk Integration',
          icon: <EuiIcon type="eyeClosed" />,
          },
          {
            id: 'overviewNavItem',
            name: 'Overview',
            icon: <EuiIcon type="apps" />,
            onClick: () => handleNavItemClick('/model/1/overview'),
          },
          {
            id: 'globalParametersNavItem',
            name: 'Global Parameters',
            icon: <EuiIcon type="database" />,
            onClick: () => handleNavItemClick('/model/1/globalParameters'),
          },
          {
            id: 'quantificationHistoryNavItem',
            name: 'Quantification History',
            icon: <EuiIcon type="visBarVertical" />,
            onClick: () => handleNavItemClick('/model/1/quantificationhistory'),
          },
          {
            id: 'settingsNavItem',
            name: 'Settings',
            icon: <EuiIcon type="gear" />,
            onClick: () => handleNavItemClick('/model/1/settings'),
          },
  ];
/*
  return (
    //loops through 1 layer, then the second, then finally displays the items with data in them
    //this has to be done right now because we couldn't find a fix to have it optionally display data in the second layer if there was no 3rd layer present
    //overflow is so things scroll correctly, the maxhieght is to adjust the nav height, 40 is the height of the header
    <EuiCollapsibleNavGroup
      className="eui-scrollBar"
      key={navItems.id}
      title={navItems.title}
      style={{overflowY: 'hidden', overflow: "overlay", height: navHeight, maxHeight: pageHeight, width: '335px', backgroundColor: euiTheme.colors.lightShade}}
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
          style={{borderBottom: 'solid', borderColor: euiTheme.colors.mediumShade}}
        >
          {navGroup.items ? (
            <EuiListGroup listItems={navGroup.items}/>
          ) : (
            <EuiListGroup listItems={[{ label: navGroup.label }]} />
          )}

          {/* Render sub-items }
        </EuiCollapsibleNavGroup>
      ))}
    </EuiCollapsibleNavGroup>

  );*/
  return(
      <EuiSideNav
        items={navItems}
      />
  )
}
