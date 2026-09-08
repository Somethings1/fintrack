import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, ScrollView, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { createAuth, type Auth } from './src/auth';
import Workspace from './src/Workspace';
import { Button, Card, ErrorText, Field, Notice, styles } from './src/ui';

export default function App() {
  const [setup] = useState(() => { try { return { auth: createAuth(), error: '' }; } catch { return { auth: null, error: 'Configure the public API and Supabase settings, then rebuild the native development app. Never add service-role or Gemini keys.' }; } });
  return <SafeAreaProvider><StatusBar style="dark" />{setup.auth ? <SessionRoot auth={setup.auth} /> : <SafeAreaView style={[styles.screen, styles.content]}><Text style={styles.heading}>FinTrack setup</Text><ErrorText error={setup.error} /></SafeAreaView>}</SafeAreaProvider>;
}
function SessionRoot({ auth }: { auth: Auth }) {
  const [session, setSession] = useState<Session | null | undefined>(); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = auth.supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next); });
    void auth.supabase.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); if (error) setError('Session unavailable. Sign in again.'); } }).catch(() => { if (active) { setSession(null); setError('Could not restore the secure session.'); } });
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') auth.supabase.auth.startAutoRefresh(); else auth.supabase.auth.stopAutoRefresh(); });
    return () => { active = false; subscription.unsubscribe(); lifecycle.remove(); auth.supabase.auth.stopAutoRefresh(); };
  }, [auth]);
  if (session === undefined) return <SafeAreaView style={styles.screen}><ActivityIndicator accessibilityLabel="Restoring secure session" style={{ flex: 1 }} /></SafeAreaView>;
  if (session) return <Workspace key={session.user.id} auth={auth} owner={session.user.id} />;
  return <Login auth={auth} initialError={error} />;
}
function Login({ auth, initialError }: { auth: Auth; initialError: string }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(initialError); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (signup: boolean) => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const result = signup ? await auth.supabase.auth.signUp({ email: email.trim(), password }) : await auth.supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) { setError(signup ? 'Account creation failed. Check your email/password or use the website.' : 'Sign-in failed. Check credentials and your connection.'); return; }
      if (signup && !result.data.session) setMessage('Check your email to confirm your account, then return here to sign in.');
      setPassword('');
    } catch { setError('Authentication is temporarily unavailable.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: 'center' }]}>
    <Text accessibilityRole="header" style={styles.heading}>Your money. In your pocket.</Text><Text style={styles.text}>Sign in to the same FinTrack account you use on the web.</Text>
    <Card><Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" maxLength={256} /><ErrorText error={error} />{!!message && <Notice>{message}</Notice>}<Button title={busy ? 'Connecting…' : 'Sign in'} disabled={busy || !email || !password} onPress={() => void submit(false)} /><Button title="Create account" secondary disabled={busy || !email || password.length < 8} onPress={() => void submit(true)} /></Card>
    <Button title="Manage password on the website" secondary onPress={() => { void Linking.openURL(auth.origin + '/login').catch(() => setError('Could not open the browser.')); }} />
    <Text style={styles.muted}>The mobile beta stores an encrypted cache and drafts on this device. Sign out before sharing the device. The assistant is optional.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
