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
  availableOptions?: string[]; // All decision options available at this point
}

export interface TreeNode {
  id: string;
  decision: Decision | null;
  children: TreeNode[];
  storyState: StoryState;
  availableOptions?: string[]; // All decision options that were available at this point
  isChosen?: boolean; // Whether this branch was actually chosen
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export interface SavedStory {
  _id: string;
  _creationTime: number;
  title: string;
  prompt: string;
  fullHistory: string[];
  decisions: Array<{
    id: string;
    text: string;
    timestamp: number;
    depth: number;
  }>;
  decisionTree: TreeNode;
  createdAt: number;
  updatedAt: number;
}

export interface GameContextType {
  phase: GamePhase;
  storyState: StoryState | null;
  chatMessages: ChatMessage[];
  decisionTree: TreeNode | null;
  endingImage: string | null;
  isGeneratingImage: boolean;
  testImage: string | null;
  initialPrompt: string;
  setPhase: (phase: GamePhase) => void;
  startStory: (prompt: string) => void;
  makeDecision: (decisionText: string, availableOptions?: string[]) => void;
  endStory: () => void;
  replayFromNode: (nodeId: string) => void;
  generateTestImage: () => Promise<void>;
  addChatMessage: (text: string, isSystem?: boolean) => void;
  saveStory: (title: string, initialPrompt: string) => Promise<string | null>;
  loadStory: (storyId: string) => Promise<void>;
}
