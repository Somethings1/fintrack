import React from "react";
import { colors } from "@/theme/color";

const Subtitle: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <h2
      style={{
        fontSize: "1rem",
        fontWeight: 500,
        color: colors.neutral[400],
        display: "inline",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {children}
    </h2>
  );
};

export default Subtitle;

