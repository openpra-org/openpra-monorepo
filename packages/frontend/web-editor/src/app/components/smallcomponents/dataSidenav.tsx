import {
    EuiCollapsibleNavGroup,
    EuiIcon,
    EuiListGroup,
    useEuiTheme
} from "@elastic/eui";

export default function DataSidenav() {
    const {euiTheme} = useEuiTheme();

    //This one is much more simple and parsable than modelSidenav, 
    //The documentation for how this structure works will be in modelSideNav, if this ends up being complicated I will copy paste it
    //They function the same and look the same, just have different datasets mostly, and there is an additional change to modelSidenav in the implementation
    //of mapping through items. 
    //we didnt use an item to import because elastic ui doesnt love when a very complicated structure such as this is passed.
    const navItems =
        {
            id: 'mainNavGroup',
            title: 'Side Nav',
            items: [
                {
                    id: 'parameterNavGroup',
                    title: 'Parameter Estimates',
                    items: [
                        {
                            id: 'specialEventsNavGroup',
                            label: 'Special Events',
                            icon: <EuiIcon type='branch'/>,
                            href: 'data/specialevents'
                        },
                        {
                            id: 'componentReliabilityNavGroup',
                            label: 'Component Reliability',
                            icon: <EuiIcon type='branch'/>,
                            href: 'data/componentreliability'
                        },
                        {
                            id: 'initiatingEventsNavGroup',
                            label: 'Initiating Events',
                            icon: <EuiIcon type='branch'/>,
                            href: 'data/initiatingevents'
                        },
                        {
                            id: 'trainUA',
                            label: 'Train UA',
                            icon: <EuiIcon type='branch'/>,
                            href: 'data/trainua'
                        },
                        {
                            id: 'ccfNavGroup',
                            label: 'CCF',
                            icon: <EuiIcon type='branch'/>,
                            href: 'data/ccf'
                        },
                    ]
                }

                // Add more items as needed
            ],
        }
        // Add more groups and items as needed
    return (
        //iterates through the parent, then the children, then the grandchildren where the clickables with icons and hrefs are.
        <EuiCollapsibleNavGroup
            key={navItems.id}
            title={navItems.title}
            style={{maxWidth: '250px', backgroundColor: euiTheme.colors.lightShade}}
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