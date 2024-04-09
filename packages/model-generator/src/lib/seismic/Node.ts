/**
 * @public Represents a node in a fault tree, which could be a basic event, gate, or fault tree itself.
 */
export class Node {
  logicType: string;
  description: string;
  nodeType: string;
  name: string;
  failureModel?: string;
  library?: string;
  procedure?: string;
  id?: string;
  roomId?: string;
  correlationSet?: Set<number>;
  children: Node[];

  /**
   * @remarks Initializes a new instance of the Node class.
   * @param logicType - The logical operation type (e.g., AND, OR, BE for basic event).
   * @param description - A textual description of the node.
   * @param nodeType - The type of the node (e.g., gate, fault tree).
   * @param name - The unique name of the node.
   * @param failureModel - (Optional) The failure model associated with the node.
   * @param library - (Optional) The library where the node's procedure is defined.
   * @param procedure - (Optional) The procedure associated with the node.
   * @param id - (Optional) A unique identifier for the node.
   * @param roomId - (Optional) The identifier of the room where the node is located.
   * @param correlationSet - (Optional) A set of correlations associated with the node.
   *
   * The constructor also initializes an empty array to hold child nodes.
   */
  constructor(
    logicType: string,
    description: string,
    nodeType: string,
    name: string,
    failureModel?: string,
    library?: string,
    procedure?: string,
    id?: string,
    roomId?: string,
    correlationSet?: Set<number>,
  ) {
    this.logicType = logicType;
    this.description = description;
    this.nodeType = nodeType;
    this.name = name;
    this.failureModel = failureModel;
    this.library = library;
    this.procedure = procedure;
    this.id = id;
    this.roomId = roomId;
    this.correlationSet = correlationSet;

    this.children = [];
  }

  /**
   * @remarks Adds a child node to the current node.
   * @param childNode - The child node to be added.
   */
  addChild(childNode: Node): void {
    this.children.push(childNode);
  }
}
