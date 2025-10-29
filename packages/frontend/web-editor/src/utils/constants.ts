/** Primary accent color used across editors */
export const EDITOR_BLUE_COLOR = "#0984e3";

/** Default root node id for a new Fault Tree */
export const FAULT_TREE_ROOT_NODE_ID = "1";

// EUI Icon types
/** Wrench icon id */
export const WRENCH = "wrench";
/** Trash icon id */
export const TRASH = "trash";
/** Warning icon id */
export const WARNING = "warning";
/** Import action icon id */
export const IMPORT_ACTION = "importAction";
/** Undo action icon id */
export const EDITOR_UNDO = "editorUndo";
/** Redo action icon id */
export const EDITOR_REDO = "editorRedo";

// EUI Icon sizes
/** Small icon size */
export const SMALL = "s";
/** Medium icon size */
export const MEDIUM = "m";
/** Large icon size */
export const LARGE = "l";

// Fault Tree Node Types
/** Logical AND gate node type */
export const AND_GATE = "andGate";
/** Logical OR gate node type */
export const OR_GATE = "orGate";
/** K-out-of-N (At Least) gate node type */
export const ATLEAST_GATE = "atLeastGate";
/** Logical NOT gate node type */
export const NOT_GATE = "notGate";
/** Basic event node type */
export const BASIC_EVENT = "basicEvent";
/** Transfer gate node type */
export const TRANSFER_GATE = "transferGate";
/** House event node type */
export const HOUSE_EVENT = "houseEvent";
/** Workflow edge type */
export const WORKFLOW = "workflow";

//Fault tree node labels
/** Label for OR gate */
export const OR_GATE_LABEL = "OR Gate";
/** Label for AND gate */
export const AND_GATE_LABEL = "AND Gate";
/** Label for At Least gate */
export const ATLEAST_GATE_LABEL = "At Least Gate";
/** Label for NOT gate */
export const NOT_GATE_LABEL = "NOT Gate";
/** Label for basic event */
export const BASIC_EVENT_LABEL = "Basic Event";
/** Label for transfer gate */
export const TRANSFER_GATE_LABEL = "Transfer Gate";
/** Label for house event */
export const HOUSE_EVENT_LABEL = "House Event";

//Fault Tree validation toast types
/** Toast type: prompt when attempting to delete root node */
export const DELETE_ROOT_NODE = "delete-root-node";
/** Toast type: invalid NOT gate child */
export const NOT_GATE_CHILD = "not-gate-child";
/** Toast type: AtLeast gate requires two children */
export const ATLEAST_TWO_CHILDREN = "atleast-two-children";
/** Toast type: updating root node */
export const UPDATE_ROOT_NODE = "update-root-node";

/** Generic delete action id */
export const DELETE = "delete";
/** Menu label for updating a node type */
export const UPDATE_NODE_TYPE = "Update node type";
/** Label for node types menu */
export const NODE_TYPES = "Node type";
/** Label for delete menu section */
export const DELETE_TYPE = "Delete types";
/** Action label for deleting a node */
export const DELETE_NODE = "Delete node";
/** Action label for deleting a subtree */
export const DELETE_SUBTREE = "Delete subtree";
/** Edge source handle id */
export const SOURCE = "source";
/** Edge target handle id */
export const TARGET = "target";
/** Default width in pixels for a fault tree node */
export const FAULT_TREE_NODE_WIDTH = 250;
/** Default height in pixels for a fault tree node */
export const FAULT_TREE_NODE_HEIGHT = 165;
/** Default horizontal separation multiplier for fault tree nodes */
export const FAULT_TREE_NODE_SEPARATION = 0.75;
/** Node types considered leaves in a fault tree */
export const LEAF_NODE_TYPES: (string | undefined)[] = [BASIC_EVENT, HOUSE_EVENT, TRANSFER_GATE];
/** Node types considered logical gates */
export const LOGICAL_GATES: (string | undefined)[] = [AND_GATE, OR_GATE, ATLEAST_GATE];
