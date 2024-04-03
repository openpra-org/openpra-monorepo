import {
    useGeneratedHtmlId,
    EuiText,
    EuiFormRow,
    EuiFlexGroup,
    EuiButton,
    EuiSelect,
    EuiFlexGrid,
    EuiFlexItem,
    EuiTitle,
    EuiTextColor,
    EuiSpacer,
} from "@elastic/eui";
import { useState } from "react";
import { SettingsAccordian } from "./SettingsAccordian";

function AdvancedSettings(): JSX.Element {
    const [overviewValue, setOverviewValue] = useState("");
    const basicSelectId = useGeneratedHtmlId({ prefix: "basicSelect" });

    const options = [
        { value: "project", text: "Project" },
        { value: "subsystem", text: "Subsystem" },
        { value: "component", text: "Component" },
    ];

    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    return (
        <div>
            {(<>
                <EuiSpacer size="l" />
                <EuiTitle size="xs">
                    <h6> Model Grouping </h6>
                </EuiTitle>
                <EuiSpacer size="s" />
            </>)}
            <EuiFlexGroup direction="column" gutterSize="l">
                <EuiFlexItem>
                    <div>
                        <EuiText size="s" color="subdued">
                            The model can be grouped as a project, subsystem, or component.
                            <EuiSpacer size="s" />
                            <strong>Default: Component</strong>
                        </EuiText>
                        <EuiSpacer />
                        <EuiFormRow label="Grouping">
                            <EuiSelect
                                id={basicSelectId}
                                options={options}
                                value={overviewValue}
                                onChange={onChange}
                                fullWidth
                            />
                        </EuiFormRow>
                        <EuiFormRow fullWidth>
                            <EuiButton  color="primary">
                                Save
                            </EuiButton>
                        </EuiFormRow>
                    </div>
                </EuiFlexItem>
                <EuiFlexItem>
                    <EuiSpacer size="l" />
                    <div>
                        <EuiTitle size="xs">
                            <h6>Trash Model</h6>
                        </EuiTitle>
                        <EuiSpacer size="s" />
                        <EuiText size="s" color="subdued">
                            Once deleted, a model cannot be recovered.
                        </EuiText>
                        <EuiSpacer />
                        <EuiFormRow fullWidth>
                            <EuiButton  color="danger" fill>
                                Trash
                            </EuiButton>
                        </EuiFormRow>
                    </div>
                </EuiFlexItem>
            </EuiFlexGroup>
        </div>
    );
}

export { AdvancedSettings };
