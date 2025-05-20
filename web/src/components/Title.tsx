import React from "react";

const Title: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <h1
      style={{
        fontSize: "2rem",
        fontWeight: 700,
        color: "#111827",
        marginBottom: "-0.5rem",
        display: "block",
        width: "100%",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {children}
    </h1>
  );
};

export default Title;

