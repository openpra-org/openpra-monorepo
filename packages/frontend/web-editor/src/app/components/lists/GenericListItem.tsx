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
  //grabs the props
  const { label, id, path } = props;

  // TODO
  //setting theming constants to be used later
  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle("border-bottom", `${String(border.width.thin)} solid ${String(border.color)}`);
  const paddingLine = logicalStyle("padding-vertical", String(useEuiPaddingSize("s")));
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
        <EuiFlexGroup
          direction="row"
          alignItems="center"
          responsive={false}
        >
          <EuiFlexItem grow={5}>
            <Link to={path}>
              {/** this is the title for the item */}
              <EuiText
                size="m"
                color="default"
                grow={false}
              >
                <strong>{label.name}</strong>
              </EuiText>
            </Link>
            {/** this is the description for the item */}
            <EuiText
              size="s"
              color="subdued"
              grow={false}
            >
              {label.description}
            </EuiText>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiText
              color="subdued"
              textAlign="right"
            >
              <small>
                <LastActionText
                  action="viewed"
                  timestamp={Date.now()}
                />
              </small>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup
              direction="row"
              gutterSize="s"
            >
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
