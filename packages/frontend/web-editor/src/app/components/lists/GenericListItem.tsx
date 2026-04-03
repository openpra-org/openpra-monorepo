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
  createdAt?: string;
  updatedAt?: string;
}

function GenericListItem(props: GenericListItemProps): JSX.Element {
  const { label, id, path, createdAt, updatedAt } = props;
  const timestamp = updatedAt ?? createdAt;
  const timestampMs = timestamp ? Date.parse(timestamp) : Date.now();

  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle("border-bottom", `${String(border.width.thin)} solid ${String(border.color)}`);
  const paddingLine = logicalStyle("padding-vertical", String(useEuiPaddingSize("s")));
  const customStyles = { ...borderLine, ...paddingLine };
  return (
    <EuiListGroupItem
      style={customStyles}
      icon={
        <Link to={path}>
          {}
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
              {}
              <EuiText
                size="m"
                color="default"
                grow={false}
              >
                <strong>{label.name}</strong>
              </EuiText>
            </Link>
            {}
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
                <LastActionText timestamp={timestampMs} />
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
