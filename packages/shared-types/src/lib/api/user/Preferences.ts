import QuantificationConfigurations from "./QuantificationConfigurations";

export default class Preferences {
  theme?: string;
  nodeIdsVisible?: boolean | string;
  outlineVisible?: boolean | string;
  node_value_visible?: boolean | string;
  nodeDescriptionEnabled?: boolean | string;
  pageBreaksVisible?: boolean | string;
  quantificationConfigurations?: QuantificationConfigurations;
}
