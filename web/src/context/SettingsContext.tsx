import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/services/authService";

export interface Settings {
    id?: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
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
    setSettings: (settings: Settings) => Promise<Boolean>;
    refreshSettings: () => Promise<void>;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async (): Promise<Settings | null> => {
        setLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            setLoading(false);
            return null;
        }
        const user = userData.user;

        if (!user) {
            setLoading(false);
            return null;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error && error.code === "PGRST116") {
            // No profile found, create default
            const defaultSettings: Settings = {
                id: user.id,
                email: user.email || "", // <-- include email fallback
                full_name: user.user_metadata?.name || "", // fallback from metadata
                avatar_url: user.user_metadata?.avatar_url || "", // fallback from metadata
                notification_income: true,
                notification_expense: true,
                display_locale: "en-US",
                display_currency: "USD",
                display_floating_points: 2,
                currency_position: "before",
                updated_at: new Date(),
            };

            const insertRes = await supabase.from("profiles").insert(defaultSettings);

            if (insertRes.error) {
                setLoading(false);
                return null;
            } else {
                setSettings(defaultSettings);
                setLoading(false);
                return defaultSettings;
            }
        } else if (data) {
            // Map with fallbacks from user metadata if missing
            const mappedSettings: Settings = {
                id: data.id,
                email: user.email || "", // <-- attach email here for UI
                full_name: data.full_name || user.user_metadata?.name || "",
                avatar_url: data.avatar_url || user.user_metadata?.avatar_url || "",
                notification_income: data.notification_income,
                notification_expense: data.notification_expense,
                display_locale: data.display_locale,
                display_currency: data.display_currency,
                display_floating_points: data.display_floating_points,
                currency_position: data.currency_position,
                updated_at: data.updated_at,
            };
            setSettings(mappedSettings);
            setLoading(false);
            return mappedSettings;
        }

        setLoading(false);
        return null;
    };
    const updateSettingsOnServer = async (newSettings: Settings): Promise<Settings | null> => {
        if (!newSettings.id) return null;
        console.log("Updating avt url");
        console.log(newSettings.avatar_url);

        const { data, error } = await supabase
            .from("profiles")
            .update({
                full_name: newSettings.full_name,
                avatar_url: newSettings.avatar_url,
                notification_income: newSettings.notification_income,
                notification_expense: newSettings.notification_expense,
                display_locale: newSettings.display_locale,
                display_currency: newSettings.display_currency,
                display_floating_points: newSettings.display_floating_points,
                currency_position: newSettings.currency_position,
                updated_at: new Date(),
            })
            .eq("id", newSettings.id)
            .single();

        if (error) {
            console.error("Failed to update settings:", error);
            return null;
        }

        return {
            ...newSettings,
        };
    };
    const setSettingsAndUpdateServer = async (newSettings: Settings) => {
        setLoading(true);
        try {
            const updatedSettings = await updateSettingsOnServer(newSettings);
            if (updatedSettings) {
                setSettings(updatedSettings);
                setLoading(false);
                return true;
            }
            setLoading(false);
            return false;
        } catch (error) {
            console.error("Failed to update settings:", error);
            setLoading(false);
            return false;
        }
    };



    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider
            value={{
                settings,
                setSettings: setSettingsAndUpdateServer,
                refreshSettings: fetchSettings,
                loading,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};

