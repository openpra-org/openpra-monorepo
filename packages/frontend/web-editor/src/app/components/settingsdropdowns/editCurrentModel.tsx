import {useState} from 'react'
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
  EuiButton,
  EuiTextColor,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiFlexGrid,
  EuiPanel,
  EuiTitle,
  useIsWithinBreakpoints,
  EuiText, EuiIcon, EuiFieldNumber
} from "@elastic/eui";
import SettingsAccordian from "./SettingsAccordian";


//a change of new item that lets you edit an item, though right now functionality for that isnt available because it requires database
export default function EditCurrentModel(){

    //this is what is in the newItem structure, will eventually be used to actually make things
    //this is also subject tyo change, probably needs a type passed in from props eventually
    const newItem = {
        title:  '',
        id: 1,
        label: {
          name: '',
          description: '',
        },
        users: [] as string[]
    }

    //use states that change things, called by functions later
  const [itemInfo, setItemInfo] =useState(newItem)

  const buttonContent = (
    <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiIcon type="dashboardApp" size="l" />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiTitle size="xs">
            <h3>General Settings</h3>
          </EuiTitle>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s">
        <p>
          <EuiTextColor color="subdued">
            Update the model name, description, and ID.
          </EuiTextColor>
        </p>
      </EuiText>
    </div>
  );
  const smallScreen = useIsWithinBreakpoints(['xs', 's', 'm']);
    return (
      <SettingsAccordian
        id="model_settings"
        buttonContent={buttonContent}
        initial={true}
      >
        <EuiFlexGrid direction="row" responsive={false} columns={smallScreen ? 1 : 2}>
          <EuiFlexItem grow={true}>
            <EuiPanel paddingSize="xl">
              <EuiTitle size="s" ><h6>Basic Information</h6></EuiTitle>
              <EuiSpacer size="s"/>
              <EuiText size="s" color="subdued">Basic model information including title, description, and ID.</EuiText>
              <EuiSpacer />
              <EuiForm component="form">
                <EuiFlexGroup>
                  <EuiFlexItem grow={true}>
                    <EuiFormRow fullWidth label="Model name">
                      <EuiFieldText
                        fullWidth
                        placeholder="Change name"
                        value={itemInfo.title}
                        onChange={(e) => setItemInfo({
                          ...itemInfo,
                          title: e.target.value
                        })}
                      />
                    </EuiFormRow>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiFormRow label="Model ID">
                      <EuiFieldNumber
                        min={1}
                        disabled={true}
                        style={{width: 60}}
                        value={itemInfo.id}
                        onChange={(e) => setItemInfo({
                          ...itemInfo,
                          id: Number(e.target.value),
                        })}
                      />
                    </EuiFormRow>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="m" />
                <EuiFormRow fullWidth label="Model description">
                  <EuiTextArea
                    resize='none'
                    fullWidth
                    value={itemInfo.label.description}
                    onChange={(e) => setItemInfo({
                      ...itemInfo,
                      label: {
                        ...itemInfo.label,
                        description: e.target.value
                      }
                    })}
                  />
                </EuiFormRow>
                <EuiSpacer size="m" />
                <EuiFormRow>
                  <EuiButton isDisabled={false} color="primary">Save</EuiButton>
                </EuiFormRow>
              </EuiForm>
            </EuiPanel>
          </EuiFlexItem>
        </EuiFlexGrid>
      </SettingsAccordian>
    )
}
