import {
  EuiAvatar,
  EuiText,
  EuiListGroupItem,
  logicalStyle,
  useEuiTheme,
  useEuiPaddingSize,
  EuiFlexGroup,
  EuiFlexItem,
} from "@elastic/eui";
import { Link } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LastActionText } from "./LastActionText";
import { ListItemContextMenuButton } from "./ListItemAction";

// TODO: After all nested models are converted to use Zustand
// TODO: Remove patchNestedEndpoint and replace it with patchNestedEndpointNew renamed to patchNestedEndpoint
// TODO: Remove deleteNestedEndpoint and replace it with deleteNestedEndpointNew renamed to deleteNestedEndpoint
export interface GenericListItemProps {
  id: number;
  label: LabelJSON;
  endpoint: string;
  deleteTypedEndpoint?: (id: number) => Promise<void>;
  postTypedEndpoint?: (data: Partial<TypedModelJSON>) => Promise<void>;
  patchTypedEndpoint?: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  postNestedEndpoint?: (data: NestedModelJSON) => Promise<void>;
  patchNestedEndpointNew?: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  patchNestedEndpoint?: (id: number, data: LabelJSON) => NonNullable<unknown>;
  deleteNestedEndpointNew?: (id: string) => Promise<void>;
  deleteNestedEndpoint?: (id: number) => NonNullable<unknown>;
  users?: number[] | null;
  path: string;
  itemName: string;
  _id?: string;
}

/**
 * @param props - that contains all the input props for the component
 */
function GenericListItem(props: GenericListItemProps): JSX.Element {
  const { label, id, path, endpoint } = props;

  // Constructing the full path with event-type and item-id
  const formattedEndpoint = endpoint.toLowerCase().replace(/\s+/g, '-');

  // Constructing the full path with formatted endpoint and item-id
  const fullPath = `/${formattedEndpoint}/${path}`;

  // Theming constants setup
  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle("border-bottom", `${border.width.thin} solid ${border.color}`);
  const paddingLine = logicalStyle("padding-vertical", `${useEuiPaddingSize("s")}`);
  const customStyles = { ...borderLine, ...paddingLine };

  return (
    <EuiListGroupItem
      style={customStyles}
      icon={
        <Link to={fullPath}>
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
            <Link to={fullPath}>
              <EuiText size="m" color="default" grow={false}>
                <strong>{label.name}</strong>
              </EuiText>
            </Link>
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
    />
  );
}
export { GenericListItem };
