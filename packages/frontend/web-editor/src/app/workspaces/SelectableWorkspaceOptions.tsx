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


//Each item in object checks the url to determine if it will have the 'checked' property
//This prevents the page from defaulting to the Internal Events workspace whenever the page is refreshed (wouldn't change the url just which icon was in the top left)
//Just having the 'checked' property will make that option the default when the page is refreshed
export const SelectableWorkspaceOptions: EuiSelectableOption<WorkspaceOption>[] = [
  {
    label: 'Internal Events',
    key: 'internal-events',
    prepend: <EuiAvatar type="space" name="Internal Event" size="s" />,
    ...((window.location.pathname.split('/')[1] === 'internal-events' || !window.location.pathname.split('/')[1]) && {checked: 'on'}),
  }, //This one ^ checks if the url is an internal-events url or if there isn't one (login page)
  {
    label: 'Internal Hazards',
    key: 'internal-hazards',
    prepend: <EuiAvatar type="space" name="Internal Hazards" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'internal-hazards' && {checked: 'on'}),
  },
  {
    label: 'External Hazards',
    key: 'external-hazards',
    prepend: <EuiAvatar type="space" name="External Hazards" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'external-hazards' && {checked: 'on'}),
  },
  {
    label: 'Full Scope',
    key: 'full-scope',
    prepend: <EuiAvatar type="space" name="Full Scope" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'full-scope' && {checked: 'on'}),
  },
  {
    label: 'Data Analysis',
    key: 'data-analysis',
    prepend: <EuiAvatar type="space" name="Data Analysis" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'data-analysis' && {checked: 'on'}),
  },
  {
    label: 'Physical Security',
    key: 'physical-security',
    prepend: <EuiAvatar type="space" name="Physical Security" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'physical-security' && {checked: 'on'}),
  },
  {
    label: 'Cybersecurity',
    key: 'cybersecurity',
    prepend: <EuiAvatar type="space" name="Cyber Security" size="s" />,
    ...(window.location.pathname.split('/')[1] === 'cybersecurity' && {checked: 'on'}),
  },
];
