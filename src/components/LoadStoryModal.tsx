import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useGame } from '../contexts/GameContext';
import './LoadStoryModal.css';

// Note: Run `npx convex dev` to generate API types
const typedApi = api as any;

interface LoadStoryModalProps {
  onClose: () => void;
}

export default function LoadStoryModal({ onClose }: LoadStoryModalProps) {
  const { loadStory } = useGame();
  const stories = useQuery(typedApi.stories.list);
  const deleteStory = useMutation(typedApi.stories.remove);

  const handleLoad = async (storyId: string) => {
    await loadStory(storyId);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, storyId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      try {
        await deleteStory({ id: storyId as any });
      } catch (error) {
        console.error('Error deleting story:', error);
        alert('Failed to delete story. Please try again.');
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="load-story-modal-overlay" onClick={onClose}>
      <div className="load-story-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="load-story-modal-close" onClick={onClose}>×</button>
        <h2>Your Saved Stories</h2>
        <div className="load-story-modal-list">
          {stories === undefined ? (
            <div className="load-story-modal-loading">Loading stories...</div>
          ) : stories === null ? (
            <div className="load-story-modal-empty">No stories found.</div>
          ) : stories.length === 0 ? (
            <div className="load-story-modal-empty">You haven't saved any stories yet.</div>
          ) : (
            stories.map((story) => (
              <div
                key={story._id}
                className="load-story-modal-item"
                onClick={() => handleLoad(story._id)}
              >
                <div className="load-story-modal-item-content">
                  <h3>{story.title}</h3>
                  <p className="load-story-modal-item-prompt">{story.prompt}</p>
                  <div className="load-story-modal-item-meta">
                    <span>{story.decisions.length} decisions</span>
                    <span>•</span>
                    <span>{formatDate(story.createdAt)}</span>
                  </div>
                </div>
                <button
                  className="load-story-modal-delete"
                  onClick={(e) => handleDelete(e, story._id)}
                  title="Delete story"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

