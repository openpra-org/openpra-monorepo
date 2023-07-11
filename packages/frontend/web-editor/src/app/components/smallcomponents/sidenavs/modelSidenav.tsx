import {
  EuiIcon,
  EuiTreeView,
  slugify,
  EuiToken,
  useEuiTheme,
  EuiText,
  EuiHorizontalRule, logicalStyle
} from "@elastic/eui";
import React, {useState, useEffect} from 'react'
import { useNavigate } from 'react-router-dom';

interface ModelSidenavProps {
  isNavOpen: boolean;
  onNavToggle: (isOpen: boolean) => void;
}

export default function ModelSidenav({ isNavOpen, onNavToggle }: ModelSidenavProps) {

  const selectItem = (name: string) => {
    setSelectedItem(name);
  };

  const createItem = (name: string, data = {}) => {
    // NOTE: Duplicate `name` values will cause `id` collisions.
    return {
      id: slugify(name),
      name,
      isSelected: selectedItemName === name,
      onClick: () => selectItem(name),
      emphasize: true,
      ...data,
    };
  };

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

  const modelId = window.location.href.search



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

  const createTreeItem = (label: string, data = {}, depth = 0) => {
    let size : "xs" | "s" | "m" | "relative" = "relative";
    let text;
    let color: string;
    switch (depth) {
      case 0:
        text = <h5 style={{textTransform: "uppercase"}}>{label}</h5>;
        color = "primary";
        break;
      case 1:
        size = "s";
        text = <h6>{label}</h6>;
        color = euiTheme.colors.darkestShade;
        break;
      default:
        size = "xs";
        text = label;
        color = "primary";
        break;
    }
    return {
      id: slugify(label),
      label: <EuiText size={size} color={color} title={label}>{text}</EuiText>,
      ...data,
    };
  }

  const operatingStates = [
    createTreeItem("Operating States",  {}),
  ];

  const initiatingEvents = [
    createTreeItem("Initiating Event Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Initiating Events",  {
          isExpanded: true,
          children: [
            createTreeItem("Initiating Event 1", {
              icon: <EuiToken iconType="tokenInterface" />,
            }, 2),
          ],
        }, 1),
      ],
    }),
  ];

  const eventSequenceAnalysis = [
    createTreeItem("Event Sequence Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Event Sequence Diagrams", {
          isExpanded: true,
          children: [
            createTreeItem("Event Sequence 1", {
              icon: <EuiToken iconType="tokenEnumMember" />,
            }, 2),
            createTreeItem("Event Sequence 2", {
              icon: <EuiToken iconType="tokenEnumMember" />,
            }, 2),
          ],
        }, 1),
        createTreeItem("Event Trees", {
          isExpanded: true,
          children: [
            createTreeItem("Event Tree 1", {
              icon: <EuiToken iconType="tokenEnum" />,
            }, 2),
          ],
        }, 1),
      ],
    }),
  ];

  const systemsAnalysis = [
    createTreeItem("Systems Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Fault Trees", {
          isExpanded: true,
          children: [
            createTreeItem("Fault Tree 1", {
              icon: <EuiToken iconType="tokenField" />,
            }, 2),
            createTreeItem("Fault Tree 2", {
              icon: <EuiToken iconType="tokenField" />,
            }, 2),
            createTreeItem("Fault Tree 3", {
              icon: <EuiToken iconType="tokenField" />,
            }, 2),
          ],
        }, 1),
        createTreeItem("Bayesian Networks", {
          isExpanded: true,
          children: [
            createTreeItem("Bayesian Network 1", {
              icon: <EuiToken iconType="tokenPercolator" />,
            }, 2),
            createTreeItem("Bayesian Network 2", {
              icon: <EuiToken iconType="tokenPercolator" />,
            }, 2),
          ],
        }, 1),
      ],
    }),
  ];

  const HRA = [
    createTreeItem("Human Reliability Analysis",  {}),
  ];

  const dataAnalysis = [
    createTreeItem("Data Analysis",  {
      isExpanded: true,
      children: [
        createTreeItem("Gates", {
          icon: <EuiToken iconType="tokenRepo"/>,
        }, 1),
        createTreeItem("Basic Events", {
          icon: <EuiToken iconType="editorBold" shape="square"/>,
        }, 1),
        createTreeItem("CCF Groups", {
          icon: <EuiToken iconType="tokenShape" shape="square"/>,
        }, 1),
      ],
    }),
  ];

  const eventSequenceQuantification = [
    createTreeItem("Event Sequence Quantification",  {}),
  ];

  const consequence = [
    createTreeItem("Consequence Analysis",  {}),
  ];

  const riskIntegration = [
    createTreeItem("Risk Integration",  {}),
  ];

  const quantificationHistory = [
    createTreeItem("Quantification History",  {
      icon: <EuiIcon type="visAreaStacked" />,
    }),
  ];

  const globalParams = [
    createTreeItem("Global Parameters",  {
      icon: <EuiIcon type="beta" />,
    }),
  ];

  const settings = [
    createTreeItem("Settings",  {
      icon: <EuiIcon type="gear" />,
    }),
  ];

  const createTreeView = (items: any[]) => {
    return (
      <EuiTreeView
        items={items}
        aria-label="Model Sidebar"
        expandByDefault={false}
        showExpansionArrows
        display="compressed"
      />
    );
  }

  const treeItems = [
    operatingStates,
    initiatingEvents,
    eventSequenceAnalysis,
    systemsAnalysis,
    HRA,
    dataAnalysis,
    eventSequenceQuantification,
    consequence,
    riskIntegration,
    quantificationHistory,
    globalParams,
    settings,
  ];

  const createTreeViews = (items = treeItems) => {
    const viewItems: JSX.Element[] = [];

    items.forEach((item) => {
      viewItems.push(...[
        createTreeView(item),
        <EuiHorizontalRule margin="xs" />,
      ]);
    });
    return (viewItems);
  }

  return(<>{createTreeViews(treeItems)}</>);
}
