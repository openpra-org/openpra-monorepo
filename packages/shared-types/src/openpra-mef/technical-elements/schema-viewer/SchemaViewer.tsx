import React, { useState } from 'react';
import { TechnicalElementTypes, TECHNICAL_ELEMENT_CODES, TechnicalElement } from '../technical-element';

interface Comment {
  text: string;
  timestamp: Date;
  author: string;
}

interface SchemaComments {
  [path: string]: Comment[];
}

export const SchemaViewer: React.FC = () => {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [comments, setComments] = useState<SchemaComments>({});
  const [newComment, setNewComment] = useState('');

  const handleAddComment = (path: string) => {
    if (!newComment.trim()) return;
    
    setComments(prev => ({
      ...prev,
      [path]: [
        ...(prev[path] || []),
        {
          text: newComment,
          timestamp: new Date(),
          author: 'User' // In a real app, this would come from auth
        }
      ]
    }));
    setNewComment('');
  };

  const renderComments = (path: string) => {
    const elementComments = comments[path] || [];
    return (
      <div className="comments-section">
        <h4>Comments</h4>
        {elementComments.map((comment, idx) => (
          <div key={idx} className="comment">
            <div className="comment-header">
              <span>{comment.author}</span>
              <span>{comment.timestamp.toLocaleString()}</span>
            </div>
            <p>{comment.text}</p>
          </div>
        ))}
        <div className="add-comment">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
          />
          <button onClick={() => handleAddComment(path)}>Add Comment</button>
        </div>
      </div>
    );
  };

  const renderSchemaTree = () => {
    return Object.entries(TECHNICAL_ELEMENT_CODES).map(([code, type]) => (
      <div
        key={code}
        className={`schema-item ${selectedElement === code ? 'selected' : ''}`}
        onClick={() => setSelectedElement(code)}
      >
        <h3>{type}</h3>
        <code>{code}</code>
        {selectedElement === code && renderComments(code)}
      </div>
    ));
  };

  return (
    <div className="schema-viewer">
      <style>{`
        .schema-viewer {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .schema-item {
          border: 1px solid #ddd;
          margin: 10px 0;
          padding: 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .schema-item:hover {
          background-color: #f5f5f5;
        }
        .schema-item.selected {
          border-color: #007bff;
          background-color: #f8f9fa;
        }
        .schema-item h3 {
          margin: 0;
          font-size: 16px;
        }
        .schema-item code {
          display: inline-block;
          margin-top: 5px;
          padding: 2px 6px;
          background: #eee;
          border-radius: 3px;
          font-size: 14px;
        }
        .comments-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .comment {
          margin: 10px 0;
          padding: 10px;
          background: #fff;
          border: 1px solid #eee;
          border-radius: 4px;
        }
        .comment-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        .add-comment {
          margin-top: 10px;
        }
        .add-comment textarea {
          width: 100%;
          min-height: 60px;
          margin-bottom: 10px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .add-comment button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .add-comment button:hover {
          background: #0056b3;
        }
      `}</style>
      <h2>Technical Elements Schema Browser</h2>
      <div className="schema-tree">
        {renderSchemaTree()}
      </div>
    </div>
  );
}; 