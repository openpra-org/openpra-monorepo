import { IAdditionalIconProps } from "./additionalIconProps";

/**
 * Represents the properties of the icon.
 */
export interface IIconProps {
  /**
   * @param width - icon width
   */
  width?: string;
  /**
   * @param height - icon height
   */
  height?: string;
  /**
   * @param data - additional icon property data (in case of elliptical shape)
   */
  data?: IAdditionalIconProps;
  /**
   * @param viewBox - set view box property of the svg
   */
  viewBox?: string;
}
