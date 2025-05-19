import React from "react";

interface BalanceProps {
  amount: number;
  type: string;
  decimals?: number; // how many decimal places to show
  locale?: string;   // optional, for international styling (default: en-US)
  currencySymbol?: string; // because "đ" might not be everyone's favorite
}

const Balance: React.FC<BalanceProps> = ({
  amount,
  type,
  decimals = 2,
  locale = "en-US",
  currencySymbol = "đ",
}) => {
  const color =
    type?.toLowerCase() === "income"
      ? "#297B32"
      : type?.toLowerCase() === "expense"
      ? "#E83838"
      : "#000";

  const formattedAmount = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = amount >= 0 ? "" : "-";

  return (
    <span style={{ color, fontWeight: 600, textAlign: "right", width: "100%", display: "inline-block" }}>
      {sign}{formattedAmount} {currencySymbol}
    </span>
  );
};

export default Balance;

