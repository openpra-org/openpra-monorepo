import {EuiFlexGroup} from "@elastic/eui";
import EditCurrentModel from "../settingsdropdowns/editCurrentModel";
import AdvancedSettings from "../settingsdropdowns/advancedSettings";
import SettingsOverview from "../settingsdropdowns/settingsOverview";



export default function(){

    const overviewLabel = (
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        </EuiFlexGroup>
    )


    return (
        < EuiFlexGroup direction='column' className='eui-scrollBar' style={{
            marginLeft: "10px",
            marginRight: "10px",
            marginTop: "-20px",
            overflow: 'auto',
            maxHeight: (window.innerHeight - 100)
        }}>
            <EditCurrentModel/>
            <SettingsOverview/>
            <AdvancedSettings/>
        </EuiFlexGroup>
    );
}