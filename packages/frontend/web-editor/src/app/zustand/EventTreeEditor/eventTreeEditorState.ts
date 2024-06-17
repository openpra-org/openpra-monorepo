import { EventTreeEditorState } from "./eventTreeEditorType";

export const eventTreeEditorState: EventTreeEditorState = {
  eventTreeId: "",
  nodes: [],
  edges: [],
  undoStack: [],
  redoStack: [],
  loading: true,
  saved: false,
};
