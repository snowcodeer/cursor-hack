import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { GamePhase, StoryState, Decision, TreeNode, ChatMessage, GameContextType } from '../types';
import { generateStory, generateDecisions, generateUnsettlingComment } from '../services/openaiService';
import { generateAudioBlob } from '../services/elevenlabsService';
import { generateImage, imageToDataUrl } from '../services/geminiService';
import { createTreeRoot, buildTreeFromDecisions, findNodeById } from '../utils/decisionTree';

const NARRATOR_VOICE_ID = 'goT3UYdM9bhm0n2lmKQx';

// Create a default context value to prevent null issues
const defaultContextValue: GameContextType = {
  phase: 'landing',
  storyState: null,
  chatMessages: [],
  decisionTree: null,
  endingImage: null,
  isGeneratingImage: false,
  testImage: null,
  setPhase: () => {},
  startStory: async () => {},
  makeDecision: async () => {},
  endStory: async () => {},
  replayFromNode: () => {},
  generateTestImage: async () => {},
  addChatMessage: () => {}
};

const GameContext = createContext<GameContextType>(defaultContextValue);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<GamePhase>('landing');
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [decisionTree, setDecisionTree] = useState<TreeNode | null>(null);
  const [endingImage, setEndingImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  
  const unsettlingCommentIntervalRef = useRef<number | null>(null);
  const lastUnsettlingTimeRef = useRef<number>(0);
  const previousAudioUrlRef = useRef<string | null>(null);

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

      // Wait for full story text first (don't stream to UI)
      for await (const chunk of generateStory(prompt)) {
        fullStoryText += chunk;
      }

      storyHistory.push(fullStoryText);

      // Clean up previous audio URL
      if (previousAudioUrlRef.current) {
        URL.revokeObjectURL(previousAudioUrlRef.current);
      }

      // Generate audio for the full text
      const audioBlob = await generateAudioBlob(fullStoryText.trim(), NARRATOR_VOICE_ID);
      const audioUrl = URL.createObjectURL(audioBlob);
      previousAudioUrlRef.current = audioUrl;

      // Now set state with both text and audio
      setStoryState({
        currentStory: fullStoryText,
        fullHistory: [fullStoryText],
        decisions: [],
        depth: 0,
        audioUrl
      });

      // Update tree root with initial story
      setDecisionTree(prev => prev ? {
        ...prev,
        storyState: {
          currentStory: fullStoryText,
          fullHistory: [fullStoryText],
          decisions: [],
          depth: 0,
          audioUrl
        }
      } : null);

      // Start unsettling comments
      startUnsettlingComments(fullStoryText);
    } catch (error) {
      console.error('Error starting story:', error);
      addChatMessage('Failed to generate story. Please try again.', true);
    }
  }, [addChatMessage, startUnsettlingComments, stopUnsettlingComments]);

  const makeDecision = useCallback(async (decisionText: string, availableOptions?: string[]) => {
    if (!storyState) return;

    // Store available options in the storyState before creating the decision
    // This ensures they're available when building the tree
    const storyStateWithOptions = {
      ...storyState,
      availableOptions: availableOptions || []
    };

    const decision: Decision = {
      id: `decision-${Date.now()}`,
      text: decisionText,
      timestamp: Date.now(),
      storyState: storyStateWithOptions // Include available options in decision's storyState
    };

    const newDecisions = [...storyState.decisions, decision];
    const currentStoryText = storyState.currentStory;

    try {
      // Generate new segment based on decision - start immediately
      // This runs in background while door opens
      let newSegment = '';
      const prompt = `The character chose: ${decisionText}. Continue the story from this decision.`;
      
      console.log('Starting story generation...');
      for await (const chunk of generateStory(prompt, currentStoryText)) {
        newSegment += chunk;
      }
      console.log('Story generation complete, length:', newSegment.length);

      // Clean up previous audio URL
      if (previousAudioUrlRef.current) {
        URL.revokeObjectURL(previousAudioUrlRef.current);
      }

      // Generate audio for the new segment - runs after story is ready
      console.log('Starting audio generation...');
      const audioBlob = await generateAudioBlob(newSegment.trim(), NARRATOR_VOICE_ID);
      const audioUrl = URL.createObjectURL(audioBlob);
      previousAudioUrlRef.current = audioUrl;
      console.log('Audio generation complete');

      // Full history is still tracked for the history view
      const newHistory = [...storyState.fullHistory, currentStoryText, newSegment];

      const newStoryState: StoryState = {
        currentStory: newSegment, // Fresh segment only
        fullHistory: newHistory, // Keep full history
        decisions: newDecisions,
        depth: storyState.depth + 1,
        audioUrl,
        availableOptions: availableOptions || [] // Store available options for this decision point
      };

      // Store available options in the previous story state for tree building
      const previousStoryStateWithOptions = {
        ...storyState,
        availableOptions: availableOptions || []
      };

      setStoryState(newStoryState);

      // Update decision tree with all available options
      const updatedTree = buildTreeFromDecisions(newDecisions, newHistory, previousStoryStateWithOptions);
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
    if (!storyState) {
      console.warn('Cannot end story: no story state');
      return;
    }

    try {
    stopUnsettlingComments();
      
      // Skip image generation - just show the decision tree
      setEndingImage(null);
      setIsGeneratingImage(false);
      
      // Wait for fade-out animation, then change phase
      setTimeout(() => {
        try {
          setPhase('ending');
        } catch (error) {
          console.error('Error setting phase to ending:', error);
        }
      }, 1000); // Match fade-out duration

      // Decision tree is already built and stored - just show it
      console.log('Story ended - showing decision tree');
    } catch (error) {
      console.error('Error ending story:', error);
      setIsGeneratingImage(false);
      try {
      setPhase('ending');
      } catch (setError) {
        console.error('Error setting error state:', setError);
      }
    }
  }, [storyState, stopUnsettlingComments, setPhase]);

  const replayFromNode = useCallback((nodeId: string) => {
    if (!decisionTree) {
      console.error('Cannot replay: no decision tree');
      return;
    }

    console.log('Replaying from node:', nodeId);
    const node = findNodeById(decisionTree, nodeId);
    
    if (!node) {
      console.error('Node not found:', nodeId);
      return;
    }

    if (!node.storyState) {
      console.error('Node has no storyState:', node);
      return;
    }

    console.log('Replaying story from node:', {
      id: node.id,
      depth: node.storyState.depth,
      storyPreview: node.storyState.currentStory?.substring(0, 100),
      decisionsCount: node.storyState.decisions.length
    });

    // Set the story state to this node's state
    setStoryState(node.storyState);
    // Keep the full decision tree
    setDecisionTree(decisionTree);
    // Switch back to story phase
    setPhase('story');
    setEndingImage(null);
    stopUnsettlingComments();

    // Restart unsettling comments with the current story
    if (node.storyState.currentStory) {
    startUnsettlingComments(node.storyState.currentStory);
    }
  }, [decisionTree, startUnsettlingComments, stopUnsettlingComments]);

  const generateTestImage = useCallback(async () => {
    if (!storyState) {
      console.warn('Cannot generate test image: no story state');
      addChatMessage('No story available to generate image from.', true);
      return;
    }

    try {
      setIsGeneratingImage(true);
      setTestImage(null);
      addChatMessage('Generating test image...', true);

      // Create a prompt based on the current story
      const fullStory = storyState.fullHistory.join('\n\n') || storyState.currentStory;
      const prompt = `Create a visual representation of this story: ${fullStory.substring(0, 500)}`;

      console.log('Generating test image with prompt:', prompt.substring(0, 100));
      
      const imageData = await generateImage(prompt);
      console.log('Image generated, converting to data URL...');
      
      const dataUrl = imageToDataUrl(imageData);
      console.log('Data URL created, length:', dataUrl.length);
      
      setTestImage(dataUrl);
      setIsGeneratingImage(false);
      addChatMessage('Test image generated!', true);
    } catch (error) {
      console.error('Error generating test image:', error);
      setIsGeneratingImage(false);
      addChatMessage(`Failed to generate test image: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    }
  }, [storyState, addChatMessage]);

  // Ensure value is always defined and stable
  const value: GameContextType = useMemo(() => ({
    phase,
    storyState,
    chatMessages,
    decisionTree,
    endingImage,
    isGeneratingImage,
    testImage,
    setPhase,
    startStory,
    makeDecision,
    endStory,
    replayFromNode,
    generateTestImage,
    addChatMessage
  }), [phase, storyState, chatMessages, decisionTree, endingImage, isGeneratingImage, testImage, setPhase, startStory, makeDecision, endStory, replayFromNode, generateTestImage, addChatMessage]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  // Context should always be defined now, but keep check for safety
  if (!context) {
    console.error('useGame called outside GameProvider, using default context');
    return defaultContextValue;
  }
  return context;
}
