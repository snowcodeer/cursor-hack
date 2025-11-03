import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useGame } from '../contexts/GameContext';
import { imageToDataUrl } from '../services/geminiService';
import './EndingView.css';

export default function EndingView() {
  const { decisionTree, endingImage, replayFromNode } = useGame();
  const [showImage, setShowImage] = useState(true);
  const [showTree, setShowTree] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endingImage && showImage) {
      setShowImage(true);
      setShowTree(false);
    }
  }, [endingImage]);

  useEffect(() => {
    if (showTree && decisionTree && svgRef.current && treeContainerRef.current) {
      drawTree();
    }
  }, [showTree, decisionTree]);

  const handleCloseImage = () => {
    setShowImage(false);
    setTimeout(() => {
      setShowTree(true);
    }, 500);
  };

  const drawTree = () => {
    if (!decisionTree || !svgRef.current || !treeContainerRef.current) return;

    // Clear previous tree
    d3.select(svgRef.current).selectAll('*').remove();

    const width = treeContainerRef.current.clientWidth;
    const height = Math.max(800, decisionTree.children.length * 200);

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, 50)`);

    // Create tree layout
    const tree = d3.tree<TreeNodeData>()
      .size([height - 100, width - 200]);

    const root = d3.hierarchy(convertToD3Node(decisionTree));
    const treeData = tree(root);

    // Draw links
    g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<any, any>()
        .x((d: any) => d.y)
        .y((d: any) => d.x))
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255, 255, 255, 0.3)')
      .attr('stroke-width', 2);

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer');

    // Draw circles for nodes
    nodes.append('circle')
      .attr('r', 8)
      .attr('fill', '#ffffff')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Add hover effects
    nodes.on('mouseenter', function(event, d: any) {
      d3.select(this).select('circle')
        .attr('r', 12)
        .attr('fill', '#ffcccc');

      // Show tooltip
      const tooltip = svg.append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${d.y},${d.x - 30})`);

      tooltip.append('rect')
        .attr('x', -100)
        .attr('y', -30)
        .attr('width', 200)
        .attr('height', 60)
        .attr('fill', 'rgba(0, 0, 0, 0.9)')
        .attr('stroke', '#ffffff')
        .attr('rx', 5);

      const decisionText = d.data.decision ? d.data.decision.text : 'Story Start';
      const truncatedText = decisionText.length > 40 ? decisionText.substring(0, 40) + '...' : decisionText;

      tooltip.append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '12px')
        .attr('dy', -10)
        .text(truncatedText);

      if (d.data.decision) {
        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255, 255, 255, 0.7)')
          .attr('font-size', '10px')
          .attr('dy', 10)
          .text(`Depth: ${d.data.depth}`);
      }
    })
    .on('mouseleave', function() {
      d3.select(this).select('circle')
        .attr('r', 8)
        .attr('fill', '#ffffff');

      svg.selectAll('.tooltip').remove();
    })
    .on('click', function(event, d: any) {
      if (d.data.id !== 'root') {
        replayFromNode(d.data.id);
      }
    });

    // Add labels
    nodes.append('text')
      .attr('dy', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .text((d: any) => {
        if (d.data.decision) {
          const text = d.data.decision.text;
          return text.length > 20 ? text.substring(0, 20) + '...' : text;
        }
        return 'Start';
      });
  };

  interface TreeNodeData {
    id: string;
    decision: any;
    depth: number;
    children?: TreeNodeData[];
  }

  const convertToD3Node = (node: any): TreeNodeData => {
    return {
      id: node.id,
      decision: node.decision,
      depth: node.storyState?.depth || 0,
      children: node.children?.map((child: any) => convertToD3Node(child)) || []
    };
  };

  if (!decisionTree) {
    return <div className="ending-view">No decision tree available</div>;
  }

  return (
    <div className="ending-view">
      {showImage && endingImage && (
        <div className="ending-image-container fade-in">
          <button className="close-image-button" onClick={handleCloseImage}>
            ×
          </button>
          <img
            src={imageToDataUrl(endingImage)}
            alt="Story ending"
            className="ending-image"
          />
        </div>
      )}

      {showTree && (
        <div className={`tree-container ${showTree ? 'fade-in' : ''}`}>
          <h2 className="tree-title">Your Story Journey</h2>
          <p className="tree-subtitle">Hover over nodes for details, click to replay from that point</p>
          <div ref={treeContainerRef} className="tree-wrapper">
            <svg ref={svgRef}></svg>
          </div>
        </div>
      )}
    </div>
  );
}

