import {
  EuiAvatar,
  EuiText,
  EuiListGroupItem,
  logicalStyle,
  useEuiTheme,
  useEuiPaddingSize,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
} from "@elastic/eui";
import { Link } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { LastActionText } from "./LastActionText";
import { ListItemContextMenuButton } from "./ListItemAction";

//title is required, description isn't required but is typically present
export type GenericListItemProps = {
  id: number;
  label: LabelJSON;
  endpoint: string;
  deleteTypedEndpoint?: (id: number) => NonNullable<unknown>;
  deleteNestedEndpoint?: (id: number) => {};
  postFunction?: (data: Partial<TypedModelJSON>) => Promise<void>;
  deleteFunction?: (id: number) => Promise<void>;
  patchFunction?: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => Promise<void>;
  patchTypedEndpoint?: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => NonNullable<unknown>;
  patchNestedEndpoint?: (id: number, data: LabelJSON) => NonNullable<unknown>;
  users?: number[];
  path: string;
  itemName: string;
  _id?: string;
};

/**
 *
 * @param id - takes in the id number of the object
 * @param path - the path that the list item will send the user to after clicked
 * @param label - this is an optional prop that passes a labelJSON
 */
function GenericListItem(props: GenericListItemProps): JSX.Element {
  //grabs the props
  const { label, id, path, endpoint } = props;
  console.log(path)
  const settings_path = path+'/settings';

  // TODO
  //setting theming constants to be used later
  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle(
    "border-bottom",
    `${border.width.thin} solid ${border.color}`,
  );
  const paddingLine = logicalStyle(
    "padding-vertical",
    `${useEuiPaddingSize("s")}`,
  );
  const customStyles = { ...borderLine, ...paddingLine };
  return (
    <EuiListGroupItem
      style={customStyles}
      icon={
        <Link to={path}>
          {/** avatar with the abbreviation for the item, it is in a  link as is the other part so that clicks are seamless */}
          <EuiAvatar
            name={label.name ? label.name : ""}
            size="l"
            type="space"
          />
        </Link>
      }
      label={
        <EuiFlexGroup direction="row" alignItems="center" responsive={false}>
          <EuiFlexItem grow={5}>
            <Link to={path}>
              {/** this is the title for the item */}
              <EuiText size="m" color="default" grow={false}>
                <strong>{label.name}</strong>
              </EuiText>
            </Link>
            {/** this is the description for the item */}
            <EuiText size="s" color="subdued" grow={false}>
              {label.description}
            </EuiText>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiText color="subdued" textAlign="right">
              <small>
                <LastActionText action="viewed" timestamp={Date.now()} />
              </small>
            </EuiText>
          </EuiFlexItem>

          {endpoint === "event-sequence-diagram" && (
          <EuiFlexItem grow={false}>
            {/* Settings Button */}
            <Link to={settings_path}>
              <EuiButtonEmpty size="s" color="text" iconType="gear">
                Settings
              </EuiButtonEmpty>
            </Link>
          </EuiFlexItem>)}

          <EuiFlexItem grow={false}>
            <EuiFlexGroup direction="row" gutterSize="s">
              <ListItemContextMenuButton {...props} />
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
      key={id}
      size="l"
      wrapText={false}
    ></EuiListGroupItem>
  );
}
export { GenericListItem };
