import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import './SaveStoryModal.css';

interface SaveStoryModalProps {
  onClose: () => void;
  initialPrompt: string;
}

export default function SaveStoryModal({ onClose, initialPrompt }: SaveStoryModalProps) {
  const { saveStory } = useGame();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your story');
      return;
    }

    setIsSaving(true);
    try {
      await saveStory(title, initialPrompt);
      onClose();
    } catch (error) {
      console.error('Error saving story:', error);
      alert('Failed to save story. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="save-story-modal-overlay" onClick={onClose}>
      <div className="save-story-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="save-story-modal-close" onClick={onClose}>×</button>
        <h2>Save Your Story</h2>
        <div className="save-story-modal-form">
          <label htmlFor="story-title">Story Title</label>
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your story..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
          <div className="save-story-modal-buttons">
            <button onClick={onClose} disabled={isSaving}>Cancel</button>
            <button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? 'Saving...' : 'Save Story'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

