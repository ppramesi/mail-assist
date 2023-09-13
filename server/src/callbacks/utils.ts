export class TrackerNode {
  constructor(
    public id: string,
    public parent: TrackerNode | null = null,
    public children: TrackerNode[] = [],
  ) {}
}

export class CallbackChainTracker {
  private nodes = new Map<string, TrackerNode>();

  add(id: string, parentId?: string) {
    const parent = parentId ? this.nodes.get(parentId) : null;
    const node = new TrackerNode(id, parent);
    if (parent) {
      parent.children.push(node);
    }

    this.nodes.set(id, node);
  }

  getChain(id: string): string[] {
    const node = this.nodes.get(id);
    if (!node) return [];

    const chain: string[] = [];
    let current: TrackerNode | null = node;
    while (current !== null) {
      chain.unshift(current.id);
      current = current.parent;
    }

    return chain;
  }

  removeNode(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;
    if (node.parent) {
      const childIdx = node.parent.children.findIndex((v) => v.id === id);
      if (childIdx > -1) {
        node.parent.children.splice(childIdx, 1);
      }
    }

    node.children.map((n) => this.removeNode(n.id));
    this.nodes.delete(id);
  }

  getRootId(id: string): string | null {
    const chain = this.getChain(id);
    return chain.length > 0 ? chain[0] : null;
  }
}
