import { Position } from "reactflow";

/**
 * Represents the properties for the context menu options.
 */
export type EventSequenceContextMenuOptions = {
  /**
   * @param id option identifier
   */
  id: string;
  /**
   * @param top position of the context menu
   */
  top: number;
  /**
   * @param left position of the context menu
   */
  left: number;
  /**
   * @eventProperty onClick event of the context menu options
   */
  onClick?: () => void;
};
