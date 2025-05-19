import React from "react";
import { colors } from "@/theme/color";

interface ProgressBarProps {
    percent: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percent }) => {
    const height = 26;
    const radius = height / 2;
    const showInside = percent >= 10;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: colors.neutral[100],
                borderRadius: radius,
                height,
                width: "100%",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Purple progress bar */}
            <div
                style={{
                    backgroundColor: colors.primary[600],
                    width: `${percent}%`,
                    height: "100%",
                    borderRadius: radius,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: showInside ? "flex-end" : "flex-start",
                    paddingRight: showInside ? 8 : 0,
                    paddingLeft: showInside ? 0 : 8,
                    transition: "width 0.3s ease",
                    whiteSpace: "nowrap",
                }}
            >
                {showInside && (
                    <span
                        style={{
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: 14,
                        }}
                    >
                        {Math.round(percent)}%
                    </span>
                )}
            </div>

            {/* Outside label */}
            {!showInside && (
                <span
                    style={{
                        color: colors.primary[600],
                        fontWeight: 500,
                        fontSize: 14,
                        marginLeft: 3,
                        whiteSpace: "nowrap",
                    }}
                >
                    {Math.round(percent)}%
                </span>
            )}
        </div>
    );
};

export default ProgressBar;

