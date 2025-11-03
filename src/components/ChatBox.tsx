import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { SpeechToText } from '../services/elevenlabsService';
import './ChatBox.css';

interface ChatBoxProps {
  onInputMatch?: (matchedIndex: number | null) => void;
  decisions?: string[];
}

export default function ChatBox({ onInputMatch, decisions }: ChatBoxProps) {
  const { makeDecision, endStory, generateTestImage, phase } = useGame();
  const [textInputEnabled, setTextInputEnabled] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechToText, setSpeechToText] = useState<SpeechToText | null>(null);

  const findMatchingDoor = (input: string): number | null => {
    if (!decisions || decisions.length === 0) return null;
    const lowerInput = input.toLowerCase().trim();
    const matchIndex = decisions.findIndex((decision, index) => {
      if (index === decisions.length - 1 && decision === 'Make your own decision') return false;
      const lowerDecision = decision.toLowerCase();
      return lowerDecision.includes(lowerInput) || lowerInput.includes(lowerDecision);
    });
    return matchIndex >= 0 ? matchIndex : null;
  };

  useEffect(() => {
    const stt = new SpeechToText();
    setSpeechToText(stt);
    
    return () => {
      stt.stop();
    };
  }, []);

  const isEndStoryCommand = (text: string): boolean => {
    const lowerText = text.toLowerCase().trim();
    const endCommands = ['end story', 'end the story', 'finish story', 'conclude story', 'story over'];
    return endCommands.some(cmd => lowerText.includes(cmd) || lowerText === cmd.slice(0, -7));
  };

  const isImageCommand = (text: string): boolean => {
    const lowerText = text.toLowerCase().trim();
    return lowerText === 'image';
  };

  const handleStartListening = useCallback(() => {
    if (isListening) return; // Prevent multiple starts
    if (!speechToText || !speechToText.isAvailable()) {
      alert('Speech recognition is not available in your browser');
      return;
    }

    setIsListening(true);
    speechToText.start(
      (text) => {
        setIsListening(false);
        
        // Check if user wants to generate a test image
        if (phase === 'story' && isImageCommand(text)) {
          generateTestImage().catch(error => {
            console.error('Error generating test image:', error);
          });
          return;
        }
        
        // Check if user wants to end the story
        if (phase === 'story' && isEndStoryCommand(text)) {
          endStory().catch(error => {
            console.error('Error ending story:', error);
          });
          return;
        }
        
        // If in story phase, automatically make decision
        if (phase === 'story') {
          makeDecision(text);
          if (onInputMatch) onInputMatch(null);
        }
      },
      (error) => {
        console.error('Speech recognition error:', error);
        setIsListening(false);
        alert('Speech recognition error: ' + error);
      }
    );
  }, [isListening, speechToText, phase, makeDecision, endStory, generateTestImage, onInputMatch]);

  const handleStopListening = useCallback(() => {
    if (speechToText) {
      speechToText.stop();
    }
    setIsListening(false);
  }, [speechToText]);

  // Handle spacebar hold to speak
  useEffect(() => {
    if (phase !== 'story') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not already listening
      // Also prevent default if not typing in an input field
      if (e.code === 'Space' && !isListening) {
        const target = e.target as HTMLElement;
        // Don't trigger if user is typing in an input field
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        e.preventDefault();
        handleStartListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isListening) {
        e.preventDefault();
        handleStopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [phase, isListening, handleStartListening, handleStopListening]);

  const handleToggleTextInput = () => {
    setTextInputEnabled(!textInputEnabled);
    if (isListening) {
      handleStopListening();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const inputText = inputValue.trim();

    // Check if user wants to generate a test image
    if (phase === 'story' && isImageCommand(inputText)) {
      generateTestImage().catch(error => {
        console.error('Error generating test image:', error);
      });
      setInputValue('');
      if (onInputMatch) onInputMatch(null);
      return;
    }

    // Check if user wants to end the story
    if (phase === 'story' && isEndStoryCommand(inputText)) {
      endStory().catch(error => {
        console.error('Error ending story:', error);
      });
      setInputValue('');
      if (onInputMatch) onInputMatch(null);
      return;
    }

    // If we're in story phase and user typed something, treat it as a decision
    if (phase === 'story') {
      // For custom decisions, we don't have available options, so pass undefined
      makeDecision(inputText);
      setInputValue('');
      if (onInputMatch) onInputMatch(null);
    }
    
    setInputValue('');
  };

  if (phase === 'landing' || phase === 'ending') {
    return null;
  }

  return (
    <div className="chat-box">
      <div className="chat-input-container">
        <button
          className={`chat-toggle ${textInputEnabled ? 'active' : ''}`}
          onClick={handleToggleTextInput}
          title={textInputEnabled ? 'Disable text input' : 'Enable text input'}
        >
          ⌨️
        </button>

        {textInputEnabled ? (
          <form onSubmit={handleSubmit} className="chat-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Don't match on typing - only on click or submit
              }}
              placeholder="Type your decision or hold SPACE to speak..."
              className="chat-input"
            />
            <button type="submit" className="chat-submit">
              Send
            </button>
          </form>
        ) : (
          <div className="voice-input-container">
            {!isListening ? (
              <button
                className="voice-button"
                onMouseDown={handleStartListening}
                onMouseUp={handleStopListening}
                onMouseLeave={handleStopListening}
                title="Hold to speak - say your decision or 'end story'"
              >
                🎤 Hold to Speak
              </button>
            ) : (
              <button
                className="voice-button listening"
                onMouseUp={handleStopListening}
                onMouseLeave={handleStopListening}
                title="Release to stop listening"
              >
                ⏹️ Listening...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
