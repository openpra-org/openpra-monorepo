import {EuiSideNav, htmlIdGenerator, useEuiTheme} from "@elastic/eui";
import Shades from '../../assets/css/euiThemeEnums'

export default function Sidenav() {
    const shades = Shades;
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