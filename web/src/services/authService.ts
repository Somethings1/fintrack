import { createClient } from "@supabase/supabase-js";


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔑 Sign in with email/password
export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
};

// 🧑‍💻 Sign up
export const signUp = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }, // This goes into the user's `user_metadata`
        },
    });
    if (error) throw error;

    if (data.user?.identities?.length === 0) {
        throw new Error("Email already in use");
    }

    return data;
};

// 🚪 Logout
export const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Wipe everything
    localStorage.clear();
    sessionStorage.clear();

    indexedDB.deleteDatabase("FinanceTracker");
};

// 🧠 Get current user
export const getCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
};

// 🧙 Sign in with Google
export const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin + "/home"; // Or wherever you want to redirect

    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: redirectUrl, // This will redirect after successful login
            queryParams: {
                prompt: "select_account",
            },
        },
    });

    if (error) throw error;
};

export const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "http://localhost:5173/update-password",
    });
    if (error) throw error;
};
