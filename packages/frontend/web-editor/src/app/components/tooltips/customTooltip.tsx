import React from "react";

// Tooltip Component
interface TooltipProps {
  content: string;
  children: React.ReactNode; // The element that the tooltip is attached to
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="custom-tooltip">
      {children}
      <span className="tooltip-text">{content}</span>
      <style>
        {`
          .custom-tooltip {
            position: relative;
            display: inline-block;
            cursor: pointer;
          }
          .custom-tooltip .tooltip-text {
            visibility: hidden;
            background-color: rgba(0, 119, 204, 0.2);
            color: #006bb8;
            text-align: center;
            border-radius: 6px;
            padding: 4px 6px;
            position: absolute;
            z-index: 1000;
            bottom: 70%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.6rem;
            font-weight: 500;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          .custom-tooltip .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -3px;
            border-width: 3px;
            border-style: solid;
            border-color: rgba(0, 119, 204, 0.2) transparent transparent transparent;
          }
          .custom-tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
          }
        `}
      </style>
    </div>
  );
};

export default Tooltip;
