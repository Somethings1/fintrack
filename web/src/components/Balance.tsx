import React from "react";
import { useSettings } from "@/context/SettingsContext";

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
  decimals,
  locale,
  currencySymbol,
  size = "s",
  align = "right",
}) => {
  const { settings } = useSettings();

  // Use settings or fallback defaults
  const effectiveLocale = locale || settings?.display_locale || "en-US";
  const effectiveDecimals =
    decimals !== undefined ? decimals : settings?.display_floating_points ?? 2;
  const effectiveCurrencySymbol =
    currencySymbol || settings?.display_currency || "đ";
  const currencyPosition = settings?.currency_position || "before";

  // Colors based on type
  const color =
    type?.toLowerCase() === "income"
      ? "#297B32"
      : type?.toLowerCase() === "expense"
      ? "#E83838"
      : "#000";

  const fontSizeMap: Record<NonNullable<BalanceProps["size"]>, string> = {
    xs: "0.75rem", // 12px
    s: "0.875rem", // 14px
    m: "1rem", // 16px
    l: "1.25rem", // 20px
    xl: "1.5rem", // 24px
  };

  const formattedAmount = Math.abs(amount).toLocaleString(effectiveLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: effectiveDecimals,
  });

  const sign = amount >= 0 ? "" : "-";

  // Respect currency position
  const displayValue =
    currencyPosition === "before"
      ? `${effectiveCurrencySymbol} ${sign}${formattedAmount}`
      : `${sign}${formattedAmount} ${effectiveCurrencySymbol}`;

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
      {displayValue}
    </span>
  );
};

export default Balance;

