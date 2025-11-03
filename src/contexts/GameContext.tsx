import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { GamePhase, StoryState, Decision, TreeNode, ChatMessage, GameContextType } from '../types';
import { generateStory, generateDecisions, generateUnsettlingComment, generateStorySummary } from '../services/openaiService';
import { generateImage } from '../services/geminiService';
import { createTreeRoot, buildTreeFromDecisions, findNodeById } from '../utils/decisionTree';

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<GamePhase>('landing');
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [decisionTree, setDecisionTree] = useState<TreeNode | null>(null);
  const [endingImage, setEndingImage] = useState<string | null>(null);
  
  const unsettlingCommentIntervalRef = useRef<number | null>(null);
  const lastUnsettlingTimeRef = useRef<number>(0);

  const addChatMessage = useCallback((text: string, isSystem: boolean = false) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      text,
      timestamp: Date.now(),
      isSystem
    };
    setChatMessages(prev => [...prev, message]);
  }, []);

  const startUnsettlingComments = useCallback((storyContext: string, lastDecision?: string) => {
    // Clear any existing interval
    if (unsettlingCommentIntervalRef.current) {
      clearInterval(unsettlingCommentIntervalRef.current);
    }

    // Generate unsettling comments at random intervals (30-60 seconds)
    const scheduleNext = () => {
      const delay = 30000 + Math.random() * 30000; // 30-60 seconds
      unsettlingCommentIntervalRef.current = window.setTimeout(async () => {
        try {
          const comment = await generateUnsettlingComment(storyContext, lastDecision);
          addChatMessage(comment, true);
          scheduleNext();
        } catch (error) {
          console.error('Error generating unsettling comment:', error);
          scheduleNext(); // Continue trying
        }
      }, delay);
    };

    scheduleNext();
  }, [addChatMessage]);

  const stopUnsettlingComments = useCallback(() => {
    if (unsettlingCommentIntervalRef.current) {
      clearTimeout(unsettlingCommentIntervalRef.current);
      unsettlingCommentIntervalRef.current = null;
    }
  }, []);

  const startStory = useCallback(async (prompt: string) => {
    setPhase('story');
    setStoryState({
      currentStory: '',
      fullHistory: [],
      decisions: [],
      depth: 0
    });
    setDecisionTree(createTreeRoot());
    setChatMessages([]);
    setEndingImage(null);
    stopUnsettlingComments();

    try {
      let fullStoryText = '';
      const storyHistory: string[] = [];

      // Stream the initial story
      for await (const chunk of generateStory(prompt)) {
        fullStoryText += chunk;
        setStoryState(prev => prev ? {
          ...prev,
          currentStory: fullStoryText,
          fullHistory: [fullStoryText]
        } : null);
      }

      storyHistory.push(fullStoryText);

      // Update tree root with initial story
      setDecisionTree(prev => prev ? {
        ...prev,
        storyState: {
          currentStory: fullStoryText,
          fullHistory: [fullStoryText],
          decisions: [],
          depth: 0
        }
      } : null);

      // Start unsettling comments
      startUnsettlingComments(fullStoryText);
    } catch (error) {
      console.error('Error starting story:', error);
      addChatMessage('Failed to generate story. Please try again.', true);
    }
  }, [addChatMessage, startUnsettlingComments, stopUnsettlingComments]);

  const makeDecision = useCallback(async (decisionText: string) => {
    if (!storyState) return;

    const decision: Decision = {
      id: `decision-${Date.now()}`,
      text: decisionText,
      timestamp: Date.now(),
      storyState: { ...storyState }
    };

    const newDecisions = [...storyState.decisions, decision];
    const currentStoryText = storyState.currentStory;

    try {
      // Generate new segment based on decision - fresh text, not continuation
      let newSegment = '';
      const prompt = `The character chose: ${decisionText}. Continue the story from this decision.`;
      
      for await (const chunk of generateStory(prompt, currentStoryText)) {
        newSegment += chunk;
        // Update only the current segment being displayed (fresh text)
        setStoryState(prev => prev ? {
          ...prev,
          currentStory: newSegment, // Replace, don't append
        } : null);
      }

      // Full history is still tracked for the history view
      const newHistory = [...storyState.fullHistory, currentStoryText, newSegment];

      const newStoryState: StoryState = {
        currentStory: newSegment, // Fresh segment only
        fullHistory: newHistory, // Keep full history
        decisions: newDecisions,
        depth: storyState.depth + 1
      };

      setStoryState(newStoryState);

      // Update decision tree
      const updatedTree = buildTreeFromDecisions(newDecisions, newHistory);
      setDecisionTree(updatedTree);

      // Restart unsettling comments with new context
      const fullStoryText = newHistory.join('\n\n');
      startUnsettlingComments(fullStoryText, decisionText);

    } catch (error) {
      console.error('Error making decision:', error);
      addChatMessage('Failed to continue story. Please try again.', true);
    }
  }, [storyState, addChatMessage, startUnsettlingComments]);

  const endStory = useCallback(async () => {
    if (!storyState) return;

    stopUnsettlingComments();
    setPhase('ending');

    try {
      // Generate ending image
      const decisionTexts = storyState.decisions.map(d => d.text);
      const summary = await generateStorySummary(
        storyState.currentStory,
        decisionTexts
      );

      const imageData = await generateImage(summary);
      setEndingImage(imageData);

      // Decision tree is already built and stored
    } catch (error) {
      console.error('Error ending story:', error);
      addChatMessage('Failed to generate ending. Showing decision tree.', true);
      setPhase('ending');
    }
  }, [storyState, stopUnsettlingComments, addChatMessage]);

  const replayFromNode = useCallback((nodeId: string) => {
    if (!decisionTree) return;

    const node = findNodeById(decisionTree, nodeId);
    if (!node) return;

    setStoryState(node.storyState);
    setDecisionTree(decisionTree);
    setPhase('story');
    setEndingImage(null);
    stopUnsettlingComments();

    // Restart unsettling comments
    startUnsettlingComments(node.storyState.currentStory);
  }, [decisionTree, startUnsettlingComments, stopUnsettlingComments]);

  const value: GameContextType = {
    phase,
    storyState,
    chatMessages,
    decisionTree,
    endingImage,
    setPhase,
    startStory,
    makeDecision,
    endStory,
    replayFromNode,
    addChatMessage
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
