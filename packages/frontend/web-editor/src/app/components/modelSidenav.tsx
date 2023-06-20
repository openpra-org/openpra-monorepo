import {EuiSideNav, htmlIdGenerator, useEuiTheme} from "@elastic/eui";

export default function Sidenav() {
    const {euiTheme} = useEuiTheme();
    const navItems = [
        {
            name: 'Overview',
            id: htmlIdGenerator('modelNav')(),
            items: [
                {
                    name: 'Overview',
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: 'Event Sequences',
                    id: htmlIdGenerator('modelNav')()
                }
            ],
        },
    ];
    return (
        <EuiSideNav
            items={navItems}
            style={{backgroundColor: euiTheme.colors.darkShade}}
        />
    )
}