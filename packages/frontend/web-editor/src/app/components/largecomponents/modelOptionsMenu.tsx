import { EuiAccordion, EuiFlexGroup, EuiFlexItem, EuiText } from "@elastic/eui";
import ModelItemsList from "./modelItemsList";


export default function(){

    const overviewLabel = (
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        </EuiFlexGroup>
    )

    return(
        < div style={{marginLeft: "10px", marginRight: "10px", marginTop: "-20px"}}>
            <EuiAccordion
            id="accordion11"
            arrowDisplay="right"
            buttonContent=<h1>Overview</h1>
            paddingSize="s">
                <ModelItemsList/>
            </EuiAccordion>
            <EuiAccordion
            id="accordion11"
            arrowDisplay="right"
            buttonContent="General"
            paddingSize="s">
                <EuiText>
                    <p>
                    Any content inside of <strong>EuiAccordion</strong> will appear here.
                    </p>
                </EuiText>
            </EuiAccordion>
            <EuiAccordion
            id="accordion11"
            arrowDisplay="right"
            buttonContent="Permissions"
            paddingSize="s">
                <EuiText>
                    <p>
                    Any content inside of <strong>EuiAccordion</strong> will appear here.
                    </p>
                </EuiText>
            </EuiAccordion>
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