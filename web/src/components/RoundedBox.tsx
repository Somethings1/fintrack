import React from "react";
import "./RoundedBox.css";

interface RoundedBoxProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const RoundedBox: React.FC<RoundedBoxProps> = ({ children, className = "", style }) => {
  return (
    <div className={`rounded-box ${className}`} style={style}>
      {children}
    </div>
  );
};

export default RoundedBox;

