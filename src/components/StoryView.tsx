import { useEffect, useState, useRef } from 'react';
import { useGame } from '../contexts/GameContext';
import { generateDecisions } from '../services/openaiService';
import Door from './Door';
import HistoryView from './HistoryView';
import './StoryView.css';

interface StoryViewProps {
  fullyOpenDoor: number | null;
  setFullyOpenDoor: (index: number | null) => void;
  decisions: string[];
  setDecisions: (decisions: string[]) => void;
}

export default function StoryView({ fullyOpenDoor, setFullyOpenDoor, decisions, setDecisions }: StoryViewProps) {
  const { storyState, makeDecision } = useGame();
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [doorsVisible, setDoorsVisible] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [isGeneratingDecisions, setIsGeneratingDecisions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<{ cancelled: boolean; timeoutId?: number }>({ cancelled: false });
  const lastStreamedLengthRef = useRef<number>(0);
  const lastStoryRef = useRef<string>('');

  useEffect(() => {
    if (!storyState) return;

    const storyText = storyState.currentStory;
    if (!storyText) return;

    // Always treat as fresh segment - reset everything
    const isNewSegment = storyText !== lastStoryRef.current;
    
    if (!isNewSegment) {
      return; // Same segment, don't re-stream
    }

    // Cancel any existing stream
    streamingRef.current.cancelled = true;
    if (streamingRef.current.timeoutId) {
      clearTimeout(streamingRef.current.timeoutId);
    }

    // Reset everything for fresh segment
    setDisplayedText('');
    setIsStreaming(true);
    setDoorsVisible(false); // Doors hidden until text finishes streaming
    setDoorsOpen(false); // Doors start closed, will crack open after streaming
    setDecisions([]);
    lastStreamedLengthRef.current = 0;
    lastStoryRef.current = storyText;

    // Stream text word by word for fresh segment
    let currentIndex = 0;
    streamingRef.current.cancelled = false;

    const stream = () => {
      if (streamingRef.current.cancelled) {
        return;
      }

      if (currentIndex >= storyText.length) {
        // Finished streaming
        setIsStreaming(false);
        lastStreamedLengthRef.current = storyText.length;
        lastStoryRef.current = storyText;
        
        // Show doors after streaming completes, then crack them open
        streamingRef.current.timeoutId = window.setTimeout(() => {
          if (!streamingRef.current.cancelled) {
            setDoorsVisible(true); // Show doors first
            // Then crack them open slightly
            streamingRef.current.timeoutId = window.setTimeout(() => {
              if (!streamingRef.current.cancelled) {
                setDoorsOpen(true); // This will crack them open
                generateDecisionOptions();
              }
            }, 300);
          }
        }, 300);
        return;
      }

      // Stream word by word for faster display
      const remainingText = storyText.slice(currentIndex);
      const spaceIndex = remainingText.indexOf(' ');
      const newlineIndex = remainingText.indexOf('\n');
      
      let nextBreak = -1;
      if (spaceIndex !== -1 && newlineIndex !== -1) {
        nextBreak = Math.min(spaceIndex, newlineIndex);
      } else if (spaceIndex !== -1) {
        nextBreak = spaceIndex;
      } else if (newlineIndex !== -1) {
        nextBreak = newlineIndex;
      }
      
      if (nextBreak !== -1) {
        // Skip to next word (including the space/newline)
        currentIndex += nextBreak + 1;
      } else {
        // Last word or remaining text
        currentIndex = storyText.length;
      }
      
      setDisplayedText(storyText.slice(0, currentIndex));
      
      streamingRef.current.timeoutId = window.setTimeout(() => {
        if (!streamingRef.current.cancelled) {
          stream();
        }
      }, 5); // Very fast streaming - words appear almost instantly
    };

    // Start streaming immediately
    stream();

    return () => {
      streamingRef.current.cancelled = true;
      if (streamingRef.current.timeoutId) {
        clearTimeout(streamingRef.current.timeoutId);
      }
    };
  }, [storyState?.currentStory]);

  const generateDecisionOptions = async () => {
    if (!storyState?.currentStory || isGeneratingDecisions) return;

    setIsGeneratingDecisions(true);
    try {
      const generatedDecisions = await generateDecisions(storyState.currentStory);
      setDecisions([...generatedDecisions, 'Make your own decision']);
    } catch (error) {
      console.error('Error generating decisions:', error);
      setDecisions([
        'Take the path through the darkness',
        'Stay and search for another way',
        'Make your own decision'
      ]);
    } finally {
      setIsGeneratingDecisions(false);
    }
  };

  const handleDoorClick = (decision: string) => {
    if (decision === 'Make your own decision') {
      // Let user input their own decision via chat
      return;
    }
    
    // Update lastStreamedLengthRef to current story length so we continue from here when new content arrives
    if (storyState?.currentStory) {
      lastStreamedLengthRef.current = storyState.currentStory.length;
    }
    
    makeDecision(decision);
    // Reset UI for next part
    setDoorsVisible(false);
    setDoorsOpen(false);
    setDecisions([]);
  };

  if (!storyState) {
    return null;
  }

  // Split displayed text into words for word-by-word fade-in
  // Split by spaces and newlines, keeping the separators
  const words = displayedText.split(/(\s+|\n)/).filter(word => word.length > 0);
  
  return (
    <div className="story-view">
      <button className="history-button" onClick={() => setShowHistory(true)} title="View Story History">
        📜
      </button>
      
      {showHistory && <HistoryView onClose={() => setShowHistory(false)} />}
      
      <div className="story-content">
        <div ref={textRef} className="story-text">
          {words.map((word, index) => {
            const isWhitespace = /^\s+$/.test(word);
            const isNewline = word === '\n';
            
            return (
              <span
                key={`${index}-${word.slice(0, 10)}`}
                className={isWhitespace || isNewline ? "story-whitespace" : "story-word"}
                style={!isWhitespace && !isNewline ? { animationDelay: `${index * 0.05}s` } : {}}
              >
                {isNewline ? <br /> : word}
              </span>
            );
          })}
        </div>

        <div className={`doors-container ${doorsVisible ? 'visible' : ''}`}>
          {[0, 1, 2].map((index) => (
            <Door
              key={index}
              index={index}
              decision={decisions[index] || ''}
              isOpen={doorsOpen && decisions.length > index}
              isFullyOpen={fullyOpenDoor === index}
              onClick={() => {
                if (decisions[index] && decisions[index] !== 'Make your own decision') {
                  setFullyOpenDoor(index);
                  // Delay the decision to allow door animation to complete
                  setTimeout(() => {
                    setFullyOpenDoor(null);
                    handleDoorClick(decisions[index]);
                  }, 600);
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
