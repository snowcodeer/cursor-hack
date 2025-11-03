import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useGame } from '../contexts/GameContext';
import HistoryView from './HistoryView';
import SaveStoryModal from './SaveStoryModal';
import './EndingView.css';

export default function EndingView() {
  const { decisionTree, replayFromNode, initialPrompt } = useGame();
  const [showTree, setShowTree] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTree && decisionTree && svgRef.current && treeContainerRef.current) {
      drawTree();
    }
  }, [showTree, decisionTree]);


  const drawTree = () => {
    if (!decisionTree || !svgRef.current || !treeContainerRef.current) return;

    // Clear previous tree
    d3.select(svgRef.current).selectAll('*').remove();

    const containerWidth = treeContainerRef.current.clientWidth;
    const containerHeight = treeContainerRef.current.clientHeight;
    
    // Calculate tree dimensions based on actual tree structure
    const calculateTreeSize = (node: any, depth: number = 0): { maxDepth: number; nodeCount: number } => {
      let maxDepth = depth;
      let nodeCount = 1;
      
      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => {
          const childSize = calculateTreeSize(child, depth + 1);
          maxDepth = Math.max(maxDepth, childSize.maxDepth);
          nodeCount += childSize.nodeCount;
        });
      }
      
      return { maxDepth, nodeCount };
    };
    
    const treeSize = calculateTreeSize(decisionTree);
    const treeHeight = Math.max(containerHeight, (treeSize.maxDepth + 1) * 150, 800);
    const treeWidth = Math.max(containerWidth, treeSize.nodeCount * 200, 1200);

    const svg = d3.select(svgRef.current)
      .attr('width', treeWidth)
      .attr('height', treeHeight)
      .style('cursor', 'grab');

    const g = svg.append('g');

    // Create zoom behavior - allow panning and zooming
    // Filter out clicks on nodes to prevent interference
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .filter((event) => {
        // Don't interfere with node clicks - allow zoom with wheel, but not on node clicks
        if (event.type === 'wheel') {
          return true;
        }
        // For mouse events, check if clicking on a node
        const target = event.target as SVGElement;
        if (target && (target.classList.contains('node') || target.closest('.node'))) {
          return false; // Don't zoom/pan when clicking nodes
        }
        return true;
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Initial transform to center the tree (top-down)
    const initialTransform = d3.zoomIdentity
      .translate(treeWidth / 2, 50)
      .scale(1);
    
    svg.call(zoom.transform, initialTransform);

    // Create tree layout - top-down (swap dimensions)
    const tree = d3.tree<TreeNodeData>()
      .size([treeWidth - 200, treeHeight - 100]) // Swap width and height for top-down
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    const root = d3.hierarchy(convertToD3Node(decisionTree));
    const treeData = tree(root);

    // Draw links - top-down (swap x and y)
    g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical<any, any>()
        .x((d: any) => d.x) // Use x for horizontal position
        .y((d: any) => d.y)) // Use y for vertical position
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');

    // Draw nodes - top-down (swap x and y)
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`) // Swap x and y for top-down
      .style('cursor', 'pointer');

    // Handle node clicks - define function before using it
    const handleNodeClick = (d: any) => {
      console.log('Node clicked:', {
        id: d.data.id,
        hasDecision: !!d.data.decision,
        hasStoryState: !!d.data.storyState,
        depth: d.data.depth,
        storyPreview: d.data.storyState?.currentStory?.substring(0, 50)
      });
      
      // Allow clicking any node including root - replay from that point
      if (d.data.id && d.data.storyState) {
        console.log('Calling replayFromNode with id:', d.data.id);
        replayFromNode(d.data.id);
      } else {
        console.warn('Node cannot be replayed - missing id or storyState', {
          id: d.data.id,
          hasStoryState: !!d.data.storyState
        });
      }
    };

    // Draw circles for nodes - make them more prominent and clickable
    nodes.append('circle')
      .attr('r', 10)
      .attr('fill', '#ffffff')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('pointer-events', 'all')
      .style('cursor', 'pointer');

    // Add click handlers directly to the node group
    // Use a simpler approach - just handle click directly
    nodes.on('click', function(event, d: any) {
      // Stop event propagation to prevent zoom/pan
      event.stopPropagation();
      event.preventDefault();
      handleNodeClick(d);
    })
    .on('mousedown', function(event) {
      // Stop mousedown from triggering zoom drag
      event.stopPropagation();
    });

    // Add hover effects
    nodes.on('mouseenter', function(event, d: any) {
      d3.select(this).select('circle')
        .attr('r', 12)
        .attr('fill', '#ffcccc');

      // Show tooltip with more details
      const storyState = d.data.storyState || {};
      const storyText = storyState.currentStory || '';
      const decisionText = d.data.decision ? d.data.decision.text : 'Story Start';
      const truncatedStory = storyText.length > 100 ? storyText.substring(0, 100) + '...' : storyText;
      
      // Calculate tooltip size based on content
      const tooltipWidth = 300;
      const tooltipHeight = d.data.decision ? 120 : 100;
      
      // Position tooltip in transformed coordinates (g group space)
      // The tooltip will be transformed along with the zoom
      // For top-down layout, swap x and y
      const tooltip = g.append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${d.x},${d.y - tooltipHeight / 2})`);

      tooltip.append('rect')
        .attr('x', -tooltipWidth / 2)
        .attr('y', -tooltipHeight / 2)
        .attr('width', tooltipWidth)
        .attr('height', tooltipHeight)
        .attr('fill', 'rgba(0, 0, 0, 0.95)')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .attr('rx', 8);

      // Decision text
      tooltip.append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('dy', -tooltipHeight / 2 + 25)
        .text(decisionText);

      // Story snippet
      if (storyText) {
        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255, 255, 255, 0.8)')
          .attr('font-size', '11px')
          .attr('dy', -tooltipHeight / 2 + 50)
          .attr('x', 0)
          .call((text: any) => {
            const words = truncatedStory.split(' ');
            let line = '';
            let lineNumber = 0;
            words.forEach((word: string) => {
              const testLine = line + word + ' ';
              if (testLine.length > 35 && line) {
                text.append('tspan')
                  .attr('x', 0)
                  .attr('dy', lineNumber === 0 ? '0' : '14')
                  .text(line);
                line = word + ' ';
                lineNumber++;
              } else {
                line = testLine;
              }
            });
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineNumber === 0 ? '0' : '14')
              .text(line.trim());
          });
      }

      // Depth info
      if (d.data.decision) {
        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255, 255, 255, 0.6)')
          .attr('font-size', '10px')
          .attr('dy', tooltipHeight / 2 - 15)
          .text(`Step ${d.data.depth} • Click to replay`);
      } else {
        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255, 255, 255, 0.6)')
          .attr('font-size', '10px')
          .attr('dy', tooltipHeight / 2 - 15)
          .text('Story Beginning');
      }
    })
    .on('mouseleave', function() {
      d3.select(this).select('circle')
        .attr('r', 10)
        .attr('fill', '#ffffff');

      g.selectAll('.tooltip').remove();
    });

    // Add labels - style differently for chosen vs unchosen paths
    // For top-down layout, labels go below the node (positive dy)
    nodes.append('text')
      .attr('dy', 20) // Position below node for top-down layout
      .attr('dx', 0) // Center horizontally
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => {
        // Highlight chosen paths, dim unchosen ones
        if (d.data.isChosen === false) {
          return 'rgba(255, 255, 255, 0.5)';
        }
        return '#ffffff';
      })
      .attr('font-size', '10px')
      .attr('font-style', (d: any) => d.data.isChosen === false ? 'italic' : 'normal')
      .text((d: any) => {
        // Show decision text or "Start" for root
        const decision = d.data.decision;
        if (decision && decision.text) {
          const text = decision.text;
          const displayText = text.length > 20 ? text.substring(0, 20) + '...' : text;
          // Add indicator for unchosen paths
          if (d.data.isChosen === false) {
            return `[Not taken] ${displayText}`;
          }
          return displayText;
        }
        // Root node or node without decision
        return 'Start';
      });
    
    // Style nodes differently based on whether they were chosen
    nodes.select('circle')
      .attr('stroke-width', (d: any) => d.data.isChosen === false ? 1 : 2)
      .attr('fill-opacity', (d: any) => d.data.isChosen === false ? 0.5 : 1)
      .attr('stroke-opacity', (d: any) => d.data.isChosen === false ? 0.5 : 1);
  };

  interface TreeNodeData {
    id: string;
    decision: any;
    depth: number;
    storyState?: any;
    children?: TreeNodeData[];
    isChosen?: boolean;
    availableOptions?: string[];
  }

  const convertToD3Node = (node: any): TreeNodeData => {
    return {
      id: node.id,
      decision: node.decision,
      depth: node.storyState?.depth || 0,
      storyState: node.storyState, // Include storyState so nodes are clickable
      isChosen: node.isChosen,
      availableOptions: node.availableOptions,
      children: node.children?.map((child: any) => convertToD3Node(child)) || []
    };
  };

  if (!decisionTree) {
    return <div className="ending-view">No decision tree available</div>;
  }

  // Auto-show tree when ending view loads
  useEffect(() => {
    if (!showTree) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        setShowTree(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTree]);

  return (
    <div className="ending-view">
      <button className="history-button" onClick={() => setShowHistory(true)} title="View Story History">
        📜
      </button>
      <button className="save-button" onClick={() => setShowSaveModal(true)} title="Save Story">
        💾
      </button>
      
      {showHistory && <HistoryView onClose={() => setShowHistory(false)} />}
      {showSaveModal && (
        <SaveStoryModal
          onClose={() => setShowSaveModal(false)}
          initialPrompt={initialPrompt}
        />
      )}
      
      {showTree && (
        <div className={`tree-container ${showTree ? 'fade-in' : ''}`}>
          <h2 className="tree-title">Your Story Journey</h2>
          <p className="tree-subtitle">
            Drag to pan • Scroll to zoom • Hover nodes for details • Click to replay from that point
          </p>
          <div ref={treeContainerRef} className="tree-wrapper">
            <svg ref={svgRef}></svg>
          </div>
        </div>
      )}
    </div>
  );
}

