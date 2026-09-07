import { supabase } from '@/services/authService';
import { getLedgerConfig } from '@/config/ledger';
import { ownedAvatarPath, signedAvatar } from '@/services/avatarService';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Settings, SettingsContext } from './settings-context';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const fetchSettings = useCallback(async (): Promise<Settings | null> => {
    const current = ++revision.current;
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || current !== revision.current) return null;
      const ledger = getLedgerConfig();
      const defaults: Settings = {
        id: user.id, email: user.email || '', full_name: '', avatar_path: '', avatar_url: '',
        notification_income: true, notification_expense: true, display_locale: 'en-US',
        display_currency: ledger.currency, display_floating_points: ledger.precision,
        currency_position: 'before',
      };
      const result = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (result.error || current !== revision.current) return null;
      if (!result.data) {
        const profile: Partial<Settings> = { ...defaults };
        delete profile.email; delete profile.avatar_url;
        const { error } = await supabase.from('profiles').insert(profile);
        if (error || current !== revision.current) return null;
        setSettings(defaults);
        return defaults;
      }
      const data = result.data;
      const mapped: Settings = {
        ...defaults, full_name: typeof data.full_name === 'string' ? data.full_name : '',
        avatar_path: ownedAvatarPath(data.avatar_path, user.id) ? data.avatar_path : '',
        avatar_url: await signedAvatar(data.avatar_path, user.id),
        notification_income: data.notification_income !== false,
        notification_expense: data.notification_expense !== false,
        display_locale: ['en-US','vi-VN','fr-FR','ja-JP'].includes(data.display_locale) ? data.display_locale : 'en-US',
        currency_position: data.currency_position === 'after' ? 'after' : 'before',
      };
      if (current !== revision.current) return null;
      setSettings(mapped);
      return mapped;
    } catch { return null; }
    finally { if (current === revision.current) setLoading(false); }
  }, []);

  const update = async (value: Settings): Promise<boolean> => {
    const current = ++revision.current;
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.id !== value.id || current !== revision.current) return false;
      if (value.avatar_path && !ownedAvatarPath(value.avatar_path, user.id)) return false;
      const ledger = getLedgerConfig();
      const payload = {
        full_name: (value.full_name || '').trim().slice(0, 120), avatar_path: value.avatar_path || null,
        notification_income: value.notification_income, notification_expense: value.notification_expense,
        display_locale: ['en-US','vi-VN','fr-FR','ja-JP'].includes(value.display_locale) ? value.display_locale : 'en-US',
        display_currency: ledger.currency, display_floating_points: ledger.precision,
        currency_position: value.currency_position === 'after' ? 'after' : 'before', updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('profiles').update(payload).eq('id', user.id).select('id').single();
      if (error || !data || current !== revision.current) return false;
      return !!(await fetchSettings());
    } catch { return false; }
    finally { if (current === revision.current) setLoading(false); }
  };
  useEffect(() => {
    void fetchSettings();
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { ++revision.current; setSettings(null); setLoading(false); }
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') queueMicrotask(() => { void fetchSettings(); });
    });
    // Refresh the five-minute signed URL. No signed URL is written to the profile.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void fetchSettings(); }, 240000);
    const counter = revision;
    return () => { ++counter.current; clearInterval(timer); data.subscription.unsubscribe(); };
  }, [fetchSettings]);
  return <SettingsContext.Provider value={{ settings, setSettings: update, refreshSettings: fetchSettings, loading }}>{children}</SettingsContext.Provider>;
};
