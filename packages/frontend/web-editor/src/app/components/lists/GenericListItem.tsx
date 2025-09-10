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
import { LastActionText } from "./LastActionText";
import { ListItemContextMenuButton } from "./ListItemAction";
import { NestedModel } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export interface GenericListItemProps {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  onEdit: (id: string, data: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

export function GenericListItem(props: GenericListItemProps): JSX.Element {
  const { id, name, description, endpoint, onEdit, onDelete } = props;
  const border = useEuiTheme().euiTheme.border;
  const borderLine = logicalStyle("border-bottom", `${border.width.thin} solid ${border.color}`);
  const paddingLine = logicalStyle("padding-vertical", `${useEuiPaddingSize("s")}`);
  const customStyles = { ...borderLine, ...paddingLine };

  return (
    <EuiListGroupItem
      style={customStyles}
      icon={
        <Link to={`${endpoint}/${id}`}>
          <EuiAvatar
            name={name}
            size="l"
            type="space"
          />
        </Link>
      }
      label={
        <EuiFlexGroup direction="row" alignItems="center" responsive={false}>
          <EuiFlexItem grow={5}>
            <Link to={`${endpoint}/${id}`}>
              <EuiText size="m" color="default" grow={false}>
                <strong>{name}</strong>
              </EuiText>
            </Link>
            <EuiText size="s" color="subdued" grow={false}>
              {description}
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
              <ListItemContextMenuButton
                id={id}
                name={name}
                description={description}
                endpoint={endpoint}
                onEdit={onEdit}
                onDelete={onDelete}
              />
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