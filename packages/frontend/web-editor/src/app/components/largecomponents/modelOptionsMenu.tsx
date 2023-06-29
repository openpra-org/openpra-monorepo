import { EuiAccordion, EuiFlexGroup, EuiFlexItem, EuiText } from "@elastic/eui";
import ModelItemsList from "./modelItemsList";
import SettingsOverview from '../smallcomponents/settingDropdowns/settingsOverview'

export default function(){

    const overviewLabel = (
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        </EuiFlexGroup>
    )


    return(
        < div style={{marginLeft: "10px", marginRight: "10px", marginTop: "-20px"}}>

                <SettingsOverview/>

                <EuiText>
                    <p>
                    General
                    </p>
                </EuiText>

                <EuiText>
                    <p>
                    Permissions
                    </p>
                </EuiText>
            <EuiAccordion
            id="accordion11"
            arrowDisplay="right"
            buttonContent="Advanced"
            paddingSize="s">
                <EuiText>
                    <p>
                    Any content inside of <strong>EuiAccordion</strong> will appear here.
                    </p>
                </EuiText>
            </EuiAccordion>
        </div>
    )
}