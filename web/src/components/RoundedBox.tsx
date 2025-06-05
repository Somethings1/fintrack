import React from "react";
import "./RoundedBox.css";

interface RoundedBoxProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const RoundedBox: React.FC<RoundedBoxProps> = ({
    children,
    className = "",
    style,
    onClick,
}) => {
    return (
        <div
            className={`rounded-box ${className}`}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default RoundedBox;

