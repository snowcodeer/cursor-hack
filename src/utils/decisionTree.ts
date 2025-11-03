import { TreeNode, Decision, StoryState } from '../types';

export function createTreeRoot(): TreeNode {
  return {
    id: 'root',
    decision: null,
    children: [],
    storyState: {
      currentStory: '',
      fullHistory: [],
      decisions: [],
      depth: 0
    }
  };
}

export function addDecisionToTree(
  tree: TreeNode,
  decisionPath: string[],
  decision: Decision,
  newStoryState: StoryState
): TreeNode {
  // Navigate to the correct node in the tree based on decisionPath
  let current = tree;
  
  for (const nodeId of decisionPath) {
    let child = current.children.find(c => c.id === nodeId);
    if (!child) {
      child = {
        id: nodeId,
        decision: null,
        children: [],
        storyState: current.storyState
      };
      current.children.push(child);
    }
    current = child;
  }

  // Add the new decision as a child
  const newNode: TreeNode = {
    id: `decision-${Date.now()}`,
    decision,
    children: [],
    storyState: newStoryState
  };

  current.children.push(newNode);
  return newNode;
}

export function findNodeById(tree: TreeNode, nodeId: string): TreeNode | null {
  if (tree.id === nodeId) {
    return tree;
  }

  for (const child of tree.children) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function buildTreeFromDecisions(decisions: Decision[], storyHistory: string[]): TreeNode {
  const root = createTreeRoot();
  root.storyState = {
    currentStory: storyHistory[0] || '',
    fullHistory: storyHistory,
    decisions: [],
    depth: 0
  };

  let currentNode = root;
  const path: string[] = [];

  decisions.forEach((decision, index) => {
    path.push(`step-${index}`);
    const newStoryState: StoryState = {
      currentStory: storyHistory[index + 1] || '',
      fullHistory: storyHistory.slice(0, index + 2),
      decisions: decisions.slice(0, index + 1),
      depth: index + 1
    };

    const newNode = addDecisionToTree(root, path, decision, newStoryState);
    currentNode = newNode;
  });

  return root;
}
