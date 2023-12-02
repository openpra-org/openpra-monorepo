import { IAdditionalIconProps } from "./additionalIconProps";

/**
 * Represents the properties of the icon.
 */
export interface IIconProps {
  /**
   * @param showText boolean flag to determine whether text within icon is to be shown
   */
  showText?: boolean;
  /**
   * @param width icon width
   */
  width?: string;
  /**
   * @param height icon height
   */
  height?: string;
  /**
   * @param data additional icon property data (in case of elliptical shape)
   */
  data?: IAdditionalIconProps;
  /**
   * @param selected boolean flag if a node is selected (to highlight a selected node)
   */
  selected: boolean;
}
