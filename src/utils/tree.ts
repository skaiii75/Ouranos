export interface ProjectNode {
  name: string;      // Just the folder name, e.g., "vacances"
  path: string;      // Full path from root, e.g., "photos/vacances/"
  children: ProjectNode[];
  depth: number;
}

export const buildProjectTree = (paths: string[]): ProjectNode[] => {
  const root: ProjectNode = { name: 'root', path: '', children: [], depth: -1 };

  // Helper function to find or create nodes in the tree
  const findOrCreateNode = (parent: ProjectNode, parts: string[], currentPath: string, depth: number): void => {
    if (parts.length === 0) return;

    const [currentPart, ...remainingParts] = parts;
    const nodePath = `${currentPath}${currentPart}/`;
    
    let node = parent.children.find(child => child.path === nodePath);
    if (!node) {
      node = { name: currentPart, path: nodePath, children: [], depth };
      parent.children.push(node);
    }
    
    findOrCreateNode(node, remainingParts, nodePath, depth + 1);
  };

  // Sort paths to ensure parents are processed before children, e.g., "a/" before "a/b/"
  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));

  sortedPaths.forEach(path => {
    const parts = path.slice(0, -1).split('/'); // Remove trailing '/' and split
    findOrCreateNode(root, parts, '', 0);
  });
  
  // Sort children at each level alphabetically
  const sortChildren = (node: ProjectNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root.children;
};