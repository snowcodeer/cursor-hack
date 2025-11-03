import { useEffect, useState } from 'react';
import './Door.css';

interface DoorProps {
  decision: string;
  isOpen: boolean;
  isFullyOpen: boolean;
  onClick: () => void;
  index: number;
}

export default function Door({ decision, isOpen, isFullyOpen, onClick, index }: DoorProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`door-container door-${index}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`door fade-in ${isOpen && !isFullyOpen ? 'door-cracked' : ''} ${isFullyOpen ? 'door-open' : ''} ${isHovered ? 'door-hover' : ''}`}>
        <div className="door-frame">
          <div className="door-panel"></div>
        </div>
      </div>
      {(isOpen || isFullyOpen) && decision && (
        <div className={`door-decision ${(isOpen || isFullyOpen) ? 'fade-in' : ''}`}>
          <p>{decision}</p>
        </div>
      )}
    </div>
  );
}
