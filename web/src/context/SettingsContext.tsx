import { supabase } from "@/services/authService";
import { ReactNode,useCallback,useEffect,useRef,useState } from "react";
import { Settings,SettingsContext } from "./settings-context";

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    const revision = useRef(0);
    const fetchSettings = useCallback(async (): Promise<Settings | null> => {
        const current = ++revision.current;
        setLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            setLoading(false);
            return null;
        }
        const user = userData.user;
        if (current !== revision.current) return null;

        if (!user) {
            setLoading(false);
            return null;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (current !== revision.current) return null;
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

            const profile = { ...defaultSettings };
            delete (profile as Partial<Settings>).email;
            const insertRes = await supabase.from("profiles").insert(profile);
            if (current !== revision.current) return null;

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
    }, []);
    const updateSettingsOnServer = async (newSettings: Settings): Promise<Settings | null> => {
        if (!newSettings.id) return null;

        const { error } = await supabase
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
        void fetchSettings();
        const { data } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') { ++revision.current; setSettings(null); setLoading(false); }
            else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') queueMicrotask(() => { void fetchSettings(); });
        });
        const stateRevision = revision;
        return () => { ++stateRevision.current; data.subscription.unsubscribe(); };
    }, [fetchSettings]);

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

