import React from "react";
import { colors } from "../theme/color";

const Subtitle: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <h1
      style={{
        fontSize: "1rem",
        fontWeight: 500,
        color: colors.neutral[400],
        marginBottom: "1rem",
        marginTop: "-0.5rem",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {children}
    </h1>
  );
};

export default Subtitle;

