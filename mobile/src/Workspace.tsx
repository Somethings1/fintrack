import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { collections, FinTrackClient, type Collection, type LedgerConfig, type LedgerRow, type Proposal, moneyText, sumAmounts, parseConfig } from '@fintrack/client';
import type { Auth } from './auth';
import { openVault, type Vault, type Draft } from './vault';
import { DraftSender } from './drafts';
import Entry from './Entry';
import Chat from './Chat';
import RecordEditor, { type EditableEntity } from './RecordEditor';
import { Button, Card, ErrorText, Field, Notice, Sheet, palette, styles } from './ui';

type Tab = 'Today' | 'Activity' | 'Plan' | 'Assistant';
type Data = Record<Collection, LedgerRow[]>;
interface Resources { api: FinTrackClient; vault: Vault }
const empty = (): Data => ({ accounts: [], savings: [], categories: [], transactions: [], subscriptions: [] });
const manualPermissions = { allowChanges: true, allowDeletes: true, includeNotes: false };

export default function Workspace({ auth, owner }: { auth: Auth; owner: string }) {
  const [resources, setResources] = useState<Resources | null>(null); const [config, setConfig] = useState<LedgerConfig | null>(null);
  const [data, setData] = useState<Data>(empty); const [drafts, setDrafts] = useState<Draft[]>([]); const [tab, setTab] = useState<Tab>('Today');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [syncing, setSyncing] = useState(false); const [lastSync, setLastSync] = useState('');
  const [entry, setEntry] = useState(false); const [selected, setSelected] = useState<LedgerRow | null>(null);
  const [editor, setEditor] = useState<{ entity: EditableEntity; row?: LedgerRow } | null>(null);
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(100); const [mutating, setMutating] = useState(false); const [active, setActive] = useState(AppState.currentState === 'active');
  const syncLock = useRef(false); const writeLock = useRef(false); const sender = useRef(new DraftSender()); const ledgerConfig = useRef<LedgerConfig | null>(null);
  useEffect(() => {
    let alive = true; let vault: Vault | undefined;
    const api = new FinTrackClient(auth.origin, owner, async () => {
      const { data, error } = await auth.supabase.auth.getSession();
      if (error || !data.session) throw new Error('Sign in again.');
      return { owner: data.session.user.id, token: data.session.access_token };
    }, () => alive);
    void openVault(auth.origin, owner).then(async store => {
      vault = store;
      if (!alive) { await store.close(); return; }
      const cached = await store.config();
      if (cached) { const cfg = parseConfig(cached); ledgerConfig.current = cfg; setConfig(cfg); }
      if (alive) setResources({ api, vault: store });
    }).catch(() => { if (alive) setError('Could not open the encrypted device store. Use a native development build with SQLCipher enabled.'); });
    return () => { alive = false; api.cancel(); void vault?.close().catch(() => undefined); };
  }, [auth, owner]);
  const loadCache = useCallback(async () => {
    if (!resources || !resources.api.current()) return;
    const values = await Promise.all(collections.map(c => resources.vault.rows(c)));
    const local = await resources.vault.drafts();
    if (!resources.api.current()) return;
    setData(Object.fromEntries(collections.map((c, i) => [c, values[i]])) as Data); setDrafts(local);
  }, [resources]);
  const refresh = useCallback(async () => {
    if (!resources || syncLock.current || !resources.api.current()) return;
    syncLock.current = true; setSyncing(true);
    try {
      const cfg = await resources.api.config();
      if (ledgerConfig.current && (cfg.currency !== ledgerConfig.current.currency || cfg.precision !== ledgerConfig.current.precision)) throw new Error('Ledger configuration changed. Do not submit drafts until this is resolved.');
      await resources.vault.setConfig(cfg); ledgerConfig.current = cfg; setConfig(cfg);
      for (const collection of collections) {
        const since = await resources.vault.watermark(collection);
        await resources.api.sync(collection, cfg, since, (rows, watermark) => resources.vault.savePage(collection, rows, watermark));
      }
      if (resources.api.current()) { setLastSync(new Date().toLocaleTimeString()); setError(''); }
    } catch (cause) { if (resources.api.current()) setError(cause instanceof Error ? cause.message : 'Connection unavailable. Showing cached data.'); }
    finally { try { await loadCache(); } catch { /* A closing or locked device store must not update a different session. */ } syncLock.current = false; if (resources.api.current()) setSyncing(false); }
  }, [resources, loadCache]);
  useEffect(() => { let current = true; void Promise.resolve().then(() => current ? loadCache() : undefined).then(() => { if (current) return refresh(); }).catch(() => { if (current) setError('Could not read device cache.'); }); return () => { current = false; }; }, [loadCache, refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active') void refresh(); else resources?.api.cancel();
    });
    return () => listener.remove();
  }, [resources, refresh]);
  const changeWriting = (value: boolean) => { writeLock.current = value; setMutating(value); };
  const sendDraft = async (draft: Draft) => {
    if (!resources || !config || writeLock.current) return;
    changeWriting(true); setNotice('');
    try { await sender.current.send(draft, resources.vault, resources.api, config); setNotice('Transaction saved. Balances are refreshed from the server.'); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Save outcome is unknown. The immutable draft was retained.'); }
    finally { changeWriting(false); await loadCache(); await refresh(); }
  };
  const saveDraft = async (draft: Draft, online: boolean) => {
    if (!resources) throw new Error('Device store is not ready.');
    await resources.vault.saveDraft(draft); await loadCache();
    if (online) await sendDraft(draft); else setNotice('Draft saved on this device only. It has not changed your ledger or balances.');
  };
  const saveProposal = async (proposal: Proposal) => {
    if (!resources || !config || writeLock.current) throw new Error('A save is already running.');
    changeWriting(true);
    try { await resources.api.confirm(proposal, config, manualPermissions); setNotice('Saved in FinTrack.'); }
    finally { changeWriting(false); await refresh(); }
  };
  const deleteTransaction = (row: LedgerRow) => Alert.alert('Delete this transaction?', 'This reverses its recorded balance effects, not a real bank payment.', [
    { text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
      if (!config || writeLock.current) return;
      const p: Proposal = { id: Crypto.randomUUID(), entity: 'transaction', operation: 'delete', recordId: row._id, recordVersion: row.lastUpdate, currency: config.currency, values: {}, references: {}, warnings: [] };
      setSelected(null); void saveProposal(p).catch(cause => setNotice(cause instanceof Error ? cause.message : 'Inspect Activity before retrying.'));
    }},
  ]);
  const logout = () => Alert.alert('Sign out and clear this device?', 'Cached records and ALL local drafts will be removed. Server records are not deleted. Submit any drafts you need first.', [
    { text: 'Keep working', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => {
      if (writeLock.current) return;
      changeWriting(true); resources?.api.cancel();
      void (async () => { await resources?.vault.clear(); const { error } = await auth.supabase.auth.signOut({ scope: 'local' }); if (error) throw error; })().catch(() => { changeWriting(false); setError('Could not complete sign-out. Retry before handing this device to someone else.'); });
    }},
  ]);
  const allAccounts = [...data.accounts, ...data.savings]; const label = (id?: string) => allAccounts.find(a => a._id === id)?.name || data.categories.find(c => c._id === id)?.name || id || '—';
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const expenses = data.transactions.filter(t => t.type === 'expense' && t.dateTime && new Date(t.dateTime) >= month && new Date(t.dateTime) < nextMonth);
  const activity = [...data.transactions].filter(t => (t.note || '').toLowerCase().includes(query.toLowerCase())).sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
  return <SafeAreaView style={styles.screen}>
    <View style={[styles.row, { paddingHorizontal: 20, paddingVertical: 10 }]}><Text accessibilityRole="header" style={styles.title}>FinTrack</Text><Button title="Sign out" secondary disabled={mutating} onPress={logout} /></View>
    {!!notice && <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}><Notice>{notice}</Notice></View>}
    {!!error && <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}><ErrorText error={error} /></View>}
    <View style={[styles.row, { paddingHorizontal: 20, paddingBottom: 8 }]}><Text style={[styles.muted, { flex: 1 }]}>{syncing ? 'Refreshing…' : lastSync ? `Last refresh ${lastSync}` : 'Cached records may be out of date.'}</Text><Button title="Refresh" secondary disabled={syncing || mutating || !resources} onPress={() => void refresh()} /></View>
    {!resources ? <ActivityIndicator accessibilityLabel="Opening encrypted records" style={{ flex: 1 }} /> : !config ? <View style={styles.content}><Notice>Connect once to load your ledger currency before recording money. Existing users sign in with the same account as the web app.</Notice></View> : tab === 'Assistant' ? <Chat api={resources.api} config={config} refresh={refresh} active={active} onWriting={changeWriting} /> : tab === 'Activity' ? <FlatList
      data={activity.slice(0, limit)} keyExtractor={row => row._id} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void refresh()} />}
      ListHeaderComponent={<><Text style={styles.heading}>Activity</Text><Field label="Search transaction notes" value={query} onChangeText={v => { setQuery(v); setLimit(100); }} maxLength={100} /></>}
      ListEmptyComponent={<Notice>No matching records. Add a transaction or refresh.</Notice>}
      ListFooterComponent={activity.length > limit ? <Button title="Show more" secondary onPress={() => setLimit(n => n + 100)} /> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${item.note || item.type} ${item.amount}`} onPress={() => setSelected(item)}><Card><Text style={styles.title}>{item.note || item.type}</Text><Text style={styles.text}>{moneyText(item.amount || '0', config)}</Text><Text style={styles.muted}>{item.dateTime ? new Date(item.dateTime).toLocaleDateString() : ''} · {label(item.category || item.sourceAccount || item.destinationAccount)}</Text></Card></Pressable>}
    /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void refresh()} />}>
      <Text accessibilityRole="header" style={styles.heading}>{tab === 'Today' ? 'Your money, today' : 'Make a plan'}</Text>
      {tab === 'Today' ? <>
        <Card><Text style={styles.muted}>Recorded account + savings balances</Text><Text selectable style={styles.large}>{moneyText(sumAmounts(allAccounts.map(a => a.balance || '0')), config)}</Text><Text style={styles.muted}>Not a live bank balance or a safe-to-spend forecast.</Text></Card>
        <Card><Text style={styles.muted}>Recorded expenses this month (device time)</Text><Text style={styles.large}>{moneyText(sumAmounts(expenses.map(t => t.amount || '0')), config)}</Text><Text style={styles.muted}>Transfers excluded.</Text></Card>
        <Text style={styles.title}>On this device</Text>
        {drafts.length === 0 && <Notice>No local drafts. Quick Add works without AI and can save offline after your first sync.</Notice>}
        {drafts.map(draft => <Card key={draft.id}><Text style={styles.title}>{String(draft.values.note || draft.values.type)}</Text><Text style={styles.text}>{moneyText(String(draft.values.amount), config)}</Text><Text style={styles.muted}>{draft.state === 'local' ? 'Draft only — not submitted.' : draft.state === 'posted' ? 'Posted to the server.' : 'Uncertain outcome — check Activity, or retry this exact entry with its original key.'}</Text>
          {draft.state !== 'posted' && <Button title={draft.state === 'uncertain' ? 'Retry exact entry' : 'Confirm and submit draft'} disabled={mutating} onPress={() => void sendDraft(draft)} />}
          {draft.state !== 'uncertain' && <Button title={draft.state === 'posted' ? 'Remove local receipt' : 'Discard local draft'} secondary disabled={mutating} onPress={() => { void resources.vault.removeDraft(draft.id).then(loadCache).catch(() => setError('Could not remove local draft.')); }} />}
        </Card>)}
        <Text style={styles.title}>Tracked upcoming payments</Text>
        {data.subscriptions.filter(s => s.isActive).sort((a, b) => (a.nextActive || '').localeCompare(b.nextActive || '')).slice(0, 5).map(s => <Card key={s._id}><Text style={styles.title}>{s.name}</Text><Text style={styles.text}>{moneyText(s.amount || '0', config)}</Text><Text style={styles.muted}>{s.nextActive ? new Date(s.nextActive).toLocaleDateString() : 'No date'} · Next tracked occurrence, not every renewal.</Text></Card>)}
      </> : <>
        <Notice>Get started by creating an account and income/expense categories. Funding savings uses transfers. Recurring schedules are managed through Assistant in this beta.</Notice>
        <Button title="New account" secondary onPress={() => setEditor({ entity: 'account' })} /><Button title="New saving goal" secondary onPress={() => setEditor({ entity: 'saving' })} /><Button title="New category / budget" secondary onPress={() => setEditor({ entity: 'category' })} />
        <Text style={styles.title}>Accounts</Text>{data.accounts.map(row => <Card key={row._id}><Text style={styles.title}>{row.name}</Text><Text style={styles.text}>{moneyText(row.balance || '0', config)}</Text><Button title={`Edit ${row.name}`} secondary onPress={() => setEditor({ entity: 'account', row })} /></Card>)}
        <Text style={styles.title}>Savings</Text>{data.savings.map(row => <Card key={row._id}><Text style={styles.title}>{row.name}</Text><Text style={styles.text}>{moneyText(row.balance || '0', config)} of {moneyText(row.goal || '0', config)}</Text><Text style={styles.muted}>{row.goalDate && !row.goalDate.startsWith('0001-') ? new Date(row.goalDate).toLocaleDateString() : 'No deadline'}</Text><Button title={`Edit goal ${row.name}`} secondary onPress={() => setEditor({ entity: 'saving', row })} /></Card>)}
        <Text style={styles.title}>Categories and monthly budgets</Text>{data.categories.map(row => <Card key={row._id}><Text style={styles.title}>{row.name} · {row.type}</Text><Text style={styles.text}>{row.budget && row.budget !== '0' ? moneyText(row.budget, config) : 'No monthly limit'}</Text><Button title={`Edit budget ${row.name}`} secondary onPress={() => setEditor({ entity: 'category', row })} /></Card>)}
      </>}
    </ScrollView>}
    <View style={[styles.row, { padding: 10, backgroundColor: palette.white, borderTopWidth: 1, borderColor: palette.line }]}>
      {(['Today', 'Activity', 'Add', 'Plan', 'Assistant'] as const).map(name => <Pressable key={name} accessibilityRole="button" accessibilityLabel={name === 'Add' ? 'Quick Add transaction' : name} accessibilityState={{ selected: name === tab, disabled: mutating }} disabled={mutating} onPress={() => { if (writeLock.current) return; if (name === 'Add') setEntry(true); else { setTab(name); setSelected(null); } }} style={{ minHeight: 48, flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: name === 'Add' ? palette.accent : name === tab ? '#E6F3F0' : palette.white }}><Text style={{ color: name === 'Add' ? palette.white : palette.ink, fontWeight: '600', fontSize: 12 }}>{name === 'Add' ? '+ Add' : name}</Text></Pressable>)}
    </View>
    {entry && config && <Entry config={config} accounts={allAccounts} categories={data.categories} save={saveDraft} close={() => setEntry(false)} />}
    {editor && config && <RecordEditor {...editor} config={config} save={saveProposal} close={() => setEditor(null)} />}
    {selected && config && <Sheet title="Transaction details" busy={mutating} close={() => setSelected(null)}><Text style={styles.large}>{moneyText(selected.amount || '0', config)}</Text><Text style={styles.text}>{selected.note || selected.type}</Text><Text style={styles.text}>From: {label(selected.sourceAccount)}{ '\n'}To: {label(selected.destinationAccount)}{ '\n'}Category: {label(selected.category)}{ '\n'}Recorded: {selected.dateTime}</Text><Text selectable style={styles.muted}>ID: {selected._id}</Text><Button title="Correct in Assistant" secondary disabled={mutating} onPress={() => { setSelected(null); setTab('Assistant'); }} /><Button title="Delete transaction" danger disabled={mutating} onPress={() => deleteTransaction(selected)} /></Sheet>}
    {!active && <View accessibilityLabel="FinTrack hidden while inactive" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.paper }}><Text style={styles.heading}>FinTrack</Text></View>}
  </SafeAreaView>;
}
