export type GamePhase = 'landing' | 'story' | 'ending';

export interface Decision {
  id: string;
  text: string;
  timestamp: number;
  storyState: StoryState;
}

export interface StoryState {
  currentStory: string;
  fullHistory: string[];
  decisions: Decision[];
  depth: number;
  audioUrl?: string; // URL to audio blob for this story segment
}

export interface TreeNode {
  id: string;
  decision: Decision | null;
  children: TreeNode[];
  storyState: StoryState;
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export interface GameContextType {
  phase: GamePhase;
  storyState: StoryState | null;
  chatMessages: ChatMessage[];
  decisionTree: TreeNode | null;
  endingImage: string | null;
  setPhase: (phase: GamePhase) => void;
  startStory: (prompt: string) => void;
  makeDecision: (decisionText: string) => void;
  endStory: () => void;
  replayFromNode: (nodeId: string) => void;
  addChatMessage: (text: string, isSystem?: boolean) => void;
}
