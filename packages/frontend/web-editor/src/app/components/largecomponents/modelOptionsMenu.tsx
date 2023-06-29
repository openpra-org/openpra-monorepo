import { EuiAccordion, EuiFlexGroup, EuiText } from "@elastic/eui";
import SettingsOverview from '../smallcomponents/settingDropdowns/settingsOverview'
import EditCurrentModel from "../smallcomponents/settingDropdowns/editCurrentModel";
import AdvancedSettings from "../smallcomponents/settingDropdowns/advancedSettings";

export default function(){

    const overviewLabel = (
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        </EuiFlexGroup>
    )


    return(
        < EuiFlexGroup direction='column' className='eui-scrollBar' style={{marginLeft: "10px", marginRight: "10px", marginTop: "-20px", overflow: 'auto', maxHeight: (window.innerHeight-100)}}>

                <EditCurrentModel/>
                <SettingsOverview/>
                <AdvancedSettings/>
        </EuiFlexGroup>
    )
}