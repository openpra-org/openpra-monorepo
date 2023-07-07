import {EuiCollapsibleNavGroup, EuiIcon, EuiListGroup, EuiSideNav, useEuiTheme} from '@elastic/eui';
import {useState, useEffect} from 'react'
import SideNavBase from "./sidenavtemplate/sideNavBase";
import { useNavigate } from 'react-router-dom';

interface DataSidenavProps {
  isNavOpen: boolean;
  onNavToggle: (isOpen: boolean) => void;
}

export default function DataSidenav({ isNavOpen, onNavToggle }: DataSidenavProps) {
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

  //this effect makes the bar fully extend all the way down yay!
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

  //This one is much more simple and parsable than modelSidenav, 
    //The documentation for how this structure works will be in modelSideNav, if this ends up being complicated I will copy paste it
    //They function the same and look the same, just have different datasets mostly, and there is an additional change to modelSidenav in the implementation
    //of mapping through items. 
    //we didnt use an item to import because elastic ui doesnt love when a very complicated structure such as this is passed.
    const navItems = [

                {
                    id: 'parameterNavGroup',
                    name: 'Parameter Estimates',
                    icon: <EuiIcon type='branch'/>,
                    items: [
                        {
                            id: 'specialEventsNavGroup',
                            name: 'Special Events',
                            onClick: () => handleNavItemClick('/data/specialevents'),
                        },
                        {
                            id: 'componentReliabilityNavGroup',
                            name: 'Component Reliability',
                            onClick: () => handleNavItemClick('/data/componentreliability'),
                        },
                        {
                            id: 'initiatingEventsNavGroup',
                            name: 'Initiating Events',
                            onClick: () => handleNavItemClick('/data/initiatingevents'),
                        },
                        {
                            id: 'trainUA',
                            name: 'Train UA',
                            onClick: () => handleNavItemClick('/data/trainua'),
                        },
                        {
                            id: 'ccfNavGroup',
                            name: 'CCF',
                            onClick: () => handleNavItemClick('/data/ccf'),
                        },
                    ]
                }
                // Add more items as needed
            ]

        // Add more groups and items as needed
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
          initialIsOpen={true}
        >
          {navGroup.items ? (
            <EuiListGroup listItems={navGroup.items}/>
          ) : (
            <EuiListGroup listItems={[{ label: navGroup.title }]} />
          )}

          {/* Render sub-items }
        </EuiCollapsibleNavGroup>
      ))}
    </EuiCollapsibleNavGroup>

  );
*/
    return(
        <EuiSideNav
            items={navItems}
            style={{backgroundColor: euiTheme.colors.lightShade, padding: "10px", height: window.innerHeight - 40, width: '260px'}}
        />
    )
}
