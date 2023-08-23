export class Node {
  constructor(
    public id: string,
    public parent: Node | null = null,
    public children: Node[] = [],
  ) {}
}

export class CallbackChainTracker {
  private nodes = new Map<string, Node>();

  add(id: string, parentId?: string) {
    const parent = parentId ? this.nodes.get(parentId) : null;
    const node = new Node(id, parent);
    if (parent) {
      parent.children.push(node);
    }

    this.nodes.set(id, node);
  }

  getChain(id: string): string[] {
    const node = this.nodes.get(id);
    if (!node) return [];

    const chain: string[] = [];
    let current: Node | null = node;
    while (current !== null) {
      chain.unshift(current.id);
      current = current.parent;
    }

    return chain;
  }

  removeNode(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;

    node.children?.map((n) => this.removeNode(n.id));
    this.nodes.delete(id);
  }

  getRootId(id: string): string | null {
    const chain = this.getChain(id);
    return chain.length > 0 ? chain[0] : null;
  }
}
