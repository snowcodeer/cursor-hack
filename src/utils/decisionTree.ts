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

export function buildTreeFromDecisions(
  decisions: Decision[], 
  storyHistory: string[],
  lastStateWithOptions?: StoryState
): TreeNode {
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
    // Get available options from the decision's storyState (which was the state before making this decision)
    const availableOptions = decision.storyState?.availableOptions || [];
    const chosenDecisionText = decision.text;
    
    // Find the parent node to attach children to (the node before this decision)
    let parentNode = root;
    for (const nodeId of path) {
      const found = parentNode.children.find(c => c.id === nodeId);
      if (found) {
        parentNode = found;
      }
    }
    
    // First, create the chosen node (this continues the path)
    if (availableOptions.length > 0) {
      // Create nodes for all available options at this decision point
      availableOptions.forEach((option: string) => {
        const isChosen = option === chosenDecisionText;
        
        if (isChosen) {
          // For the chosen option, create it with the actual decision and story state
          path.push(`step-${index}`);
          const newStoryState: StoryState = {
            currentStory: storyHistory[index + 1] || '',
            fullHistory: storyHistory.slice(0, index + 2),
            decisions: decisions.slice(0, index + 1),
            depth: index + 1
          };

          const newNode = addDecisionToTree(root, path, decision, newStoryState);
          newNode.isChosen = true;
          newNode.availableOptions = availableOptions;
          currentNode = newNode;
        } else {
          // For unchosen options, create placeholder nodes as siblings branching from the same parent
          // Use the parent's path (before adding step-${index}) + alternative identifier
          const parentPath = [...path]; // Path before this decision
          const placeholderPath = [...parentPath, `alt-${index}-${option.substring(0, 15).replace(/\s/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`];
          const placeholderDecision: Decision = {
            id: `decision-alt-${index}-${option.substring(0, 10)}`,
            text: option,
            timestamp: decision.timestamp,
            storyState: decision.storyState
          };
          
          // Create a placeholder story state (we don't have the actual story for this branch)
          const placeholderStoryState: StoryState = {
            currentStory: `[Path not taken: ${option}]`,
            fullHistory: [...(decision.storyState?.fullHistory || []), `[Path not taken: ${option}]`],
            decisions: decisions.slice(0, index),
            depth: index + 1
          };

          const placeholderNode = addDecisionToTree(root, placeholderPath, placeholderDecision, placeholderStoryState);
          placeholderNode.isChosen = false;
          placeholderNode.availableOptions = availableOptions;
        }
      });
    } else {
      // If no options were stored, just create the chosen path (backward compatibility)
      path.push(`step-${index}`);
      const newStoryState: StoryState = {
        currentStory: storyHistory[index + 1] || '',
        fullHistory: storyHistory.slice(0, index + 2),
        decisions: decisions.slice(0, index + 1),
        depth: index + 1
      };

      const newNode = addDecisionToTree(root, path, decision, newStoryState);
      newNode.isChosen = true;
      currentNode = newNode;
    }
  });

  // If we have the last state with options, add nodes for the current available options
  if (lastStateWithOptions?.availableOptions && lastStateWithOptions.availableOptions.length > 0) {
    const currentPath = decisions.map((_, i) => `step-${i}`);
    lastStateWithOptions.availableOptions.forEach((option: string) => {
      const isChosen = decisions.length > 0 && decisions[decisions.length - 1]?.text === option;
      
      if (!isChosen) {
        const placeholderPath = [...currentPath, `current-${option.substring(0, 10).replace(/\s/g, '-')}`];
        const placeholderDecision: Decision = {
          id: `decision-placeholder-${Date.now()}`,
          text: option,
          timestamp: Date.now(),
          storyState: lastStateWithOptions
        };
        
        const placeholderStoryState: StoryState = {
          currentStory: `[Not chosen: ${option}]`,
          fullHistory: lastStateWithOptions.fullHistory,
          decisions: decisions,
          depth: decisions.length
        };

        const placeholderNode = addDecisionToTree(root, placeholderPath, placeholderDecision, placeholderStoryState);
        placeholderNode.isChosen = false;
        placeholderNode.availableOptions = lastStateWithOptions.availableOptions;
      }
    });
  }

  return root;
}
