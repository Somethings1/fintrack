import React from "react";

interface BalanceProps {
  amount: number;
  type: string;
  decimals?: number;
  locale?: string;
  currencySymbol?: string;
  size?: "xs" | "s" | "m" | "l" | "xl";
  align?: "left" | "right" | "center";
}

const Balance: React.FC<BalanceProps> = ({
  amount,
  type,
  decimals = 2,
  locale = "en-US",
  currencySymbol = "đ",
  size = "s",
  align = "right"
}) => {
  const color =
    type?.toLowerCase() === "income"
      ? "#297B32"
      : type?.toLowerCase() === "expense"
      ? "#E83838"
      : "#000";

  const fontSizeMap: Record<NonNullable<BalanceProps["size"]>, string> = {
    xs: "0.75rem",  // 12px
    s: "0.875rem",  // 14px
    m: "1rem",      // 16px
    l: "1.25rem",   // 20px
    xl: "1.5rem",   // 24px
  };

  const formattedAmount = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  const sign = amount >= 0 ? "" : "-";

  return (
    <span
      style={{
        color,
        fontWeight: 600,
        fontSize: fontSizeMap[size],
        textAlign: align,
        width: align === "left" ? "auto" : "100%",
        display: "inline-block",
      }}
    >
      {sign}
      {formattedAmount} {currencySymbol}
    </span>
  );
};

export default Balance;

