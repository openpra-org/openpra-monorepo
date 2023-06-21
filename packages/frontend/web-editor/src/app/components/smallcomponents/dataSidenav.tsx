import {
    EuiCollapsibleNav,
    EuiCollapsibleNavGroup,
    EuiFlexGroup,
    EuiIcon,
    EuiListGroup,
    EuiSideNav,
    htmlIdGenerator,
    useEuiTheme
} from "@elastic/eui";
import {useState} from 'react'

export default function DataSidenav() {
    const {euiTheme} = useEuiTheme();

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
                            id: 'analysisNavGroup',
                            label: 'Open State Analysis',
                            icon: <EuiIcon type='branch'/>
                        },
                        {
                            id: 'specialEventsNavGroup',
                            label: 'Special Events',
                            icon: <EuiIcon type='branch'/>
                        },
                        {
                            id: 'componentReliabilityNavGroup',
                            label: 'Component Reliability',
                            icon: <EuiIcon type='branch'/>
                        },
                        {
                            id: 'initiatingEventsNavGroup',
                            label: 'Initiating Events',
                            icon: <EuiIcon type='branch'/>
                        },
                        {
                            id: 'ccfNavGroup',
                            label: 'CCF',
                            icon: <EuiIcon type='branch'/>
                        },
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