import { EuiAvatar, EuiHorizontalRule, EuiSelectableOption } from "@elastic/eui";

export type WorkspaceOption = {
  label: string | JSX.Element,
  key: string | number,
  prepend?: JSX.Element,
  append?: JSX.Element | string,
  checked?: "on" | "off",
  disabled?: boolean,
  isGroupLabel?: boolean,
  data?: { [key: string]: any; }
};

export const SelectableWorkspaceOptions: EuiSelectableOption<WorkspaceOption>[] = [
  {
    label: 'Internal Events',
    key: 'internal-events',
    prepend: <EuiAvatar type="space" name="Internal Event" size="s" />,
    checked: 'on',
  },
  {
    label: 'Internal Hazards',
    key: 'internal-hazards',
    prepend: <EuiAvatar type="space" name="Internal Hazards" size="s" />,
  },
  {
    label: 'External Hazards',
    key: 'external-hazards',
    prepend: <EuiAvatar type="space" name="External Hazards" size="s" />,
  },
  {
    label: 'Full Scope',
    key: 'full-scope',
    prepend: <EuiAvatar type="space" name="Full Scope" size="s" />,
  },
  {
    label: 'Data Analysis',
    key: 'data-analysis',
    prepend: <EuiAvatar type="space" name="Data Analysis" size="s" />,
  },
  {
    label: 'Physical Security',
    key: 'physical-security',
    prepend: <EuiAvatar type="space" name="Physical Security" size="s" />,
  },
  {
    label: 'Cybersecurity',
    key: 'cybersecurity',
    prepend: <EuiAvatar type="space" name="Cyber Security" size="s" />,
  },
];
