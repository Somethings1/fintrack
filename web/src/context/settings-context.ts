import { createContext,useContext } from "react";
export interface Settings {
    id?: string;
    email: string;
    full_name?: string;
    avatar_url?: string; // Ephemeral signed URL; never persisted.
    avatar_path?: string;
    notification_income: boolean;
    notification_expense: boolean;
    display_locale: string;
    display_currency: string;
    display_floating_points: number;
    currency_position: "before" | "after";
    updated_at?: Date;
}

interface SettingsContextType {
    settings: Settings | null;
    setSettings: (settings: Settings) => Promise<boolean>;
    refreshSettings: () => Promise<Settings | null>;
    loading: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};
