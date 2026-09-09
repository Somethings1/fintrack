import { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { type Answer, type FinTrackClient, type LedgerConfig, type Message, type Permissions, noPermissions } from '@fintrack/client';
import { Button, Card, ErrorText, Field, Notice, styles } from './ui';

interface Turn extends Answer { question: string; outcome?: string }
export default function Chat({ api, config, refresh, active, onWriting }: { api: FinTrackClient; config: LedgerConfig; refresh: () => Promise<void>; active: boolean; onWriting: (value: boolean) => void }) {
  const [input, setInput] = useState(''); const [consent, setConsent] = useState(false); const [scope, setScope] = useState<Permissions>(noPermissions);
  const [turns, setTurns] = useState<Turn[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false);
  const pending = useRef<AbortController | null>(null); const writing = useRef(false); const live = useRef(true); const used = useRef(new Set<string>());
  useEffect(() => { live.current = true; return () => { live.current = false; pending.current?.abort(); }; }, []);
  useEffect(() => { const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { pending.current?.abort(); setTurns([]); } }); return () => subscription.remove(); }, []);
  const clear = () => { if (writing.current) return; pending.current?.abort(); pending.current = null; setBusy(false); setTurns([]); setError(''); };
  const changeScope = (key: keyof Permissions, value: boolean) => {
    if (writing.current) return; clear(); setScope(previous => ({ ...previous, [key]: value, ...(key === 'allowChanges' && !value ? { allowDeletes: false } : {}) }));
  };
  const ask = async () => {
    if (!input.trim() || !consent || pending.current || writing.current) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    const question = input.trim(); const prior = turns.map(t => t.proposal && !t.outcome ? { ...t, outcome: 'Superseded by a newer message.' } : t);
    setTurns(prior);
    const history: Message[] = prior.flatMap(t => [{ role: 'user' as const, content: t.question }, { role: 'assistant' as const, content: t.answer + (t.outcome ? '\nApplication status (refresh records to verify): ' + t.outcome : '') }]);
    try {
      const answer = await api.ask(question, history, config, scope, controller.signal);
      if (live.current && !controller.signal.aborted) { setTurns(prev => [...prev, { question, ...answer }].slice(-8)); setInput(''); }
    } catch (cause) { if (live.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The assistant could not answer.'); }
    finally { if (pending.current === controller) { pending.current = null; if (live.current) setBusy(false); } }
  };
  const outcome = (id: string, message: string) => setTurns(prev => prev.map(t => t.proposal?.id === id ? { ...t, outcome: message } : t));
  const confirm = async (turn: Turn) => {
    const p = turn.proposal;
    if (!p || writing.current || used.current.has(p.id) || turn.outcome || busy || !consent) return;
    writing.current = true; used.current.add(p.id); setSaving(true); onWriting(true);
    try { const id = await api.confirm(p, config, scope); if (live.current) outcome(p.id, `Saved in FinTrack. Record: ${id}`); }
    catch (cause) { if (live.current) outcome(p.id, cause instanceof Error ? cause.message : 'Save outcome is unknown. Inspect Activity before trying again.'); }
    finally { writing.current = false; onWriting(false); if (live.current) setSaving(false); await refresh(); }
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Assistant</Text>
      <Notice>Ask about your finances or prepare changes. Each change needs a separate confirmation. Answers may be wrong; this app cannot move money at a bank.</Notice>
      <Card>
        <Toggle label="Share questions and relevant financial data with Google Gemini" value={consent} disabled={saving} change={value => { clear(); setConsent(value); }} />
        <Toggle label="Allow change proposals" value={scope.allowChanges} disabled={saving} change={value => changeScope('allowChanges', value)} />
        <Toggle label="Allow delete/archive proposals" value={scope.allowDeletes} disabled={saving || !scope.allowChanges} change={value => changeScope('allowDeletes', value)} />
        <Toggle label="Include stored transaction notes" value={scope.includeNotes} disabled={saving} change={value => changeScope('includeNotes', value)} />
        <Text style={styles.muted}>Chat is kept in memory. Leaving this screen, backgrounding, or changing permissions clears it. Operational usage metadata is retained by the server. Never include passwords.</Text>
      </Card>
      {turns.map((turn, index) => <Card key={turn.proposal?.id ?? index}>
        <Text style={styles.title}>You: {turn.question}</Text><Text selectable style={styles.text}>{turn.answer}</Text>
        {!!turn.runId && <Text selectable style={styles.muted}>Support reference: {turn.runId}</Text>}
        {turn.toolsUsed.length > 0 && <Text style={styles.muted}>Tools: {turn.toolsUsed.join(', ')}</Text>}
        {turn.proposal && <>
          <Text accessibilityRole="header" style={styles.title}>{turn.proposal.operation} {turn.proposal.entity}</Text>
          {!!turn.proposal.recordId && <Text selectable style={styles.muted}>Record: {turn.proposal.recordId}</Text>}
          {Object.entries(turn.proposal.operation === 'delete' ? turn.proposal.before ?? {} : turn.proposal.values).map(([key, value]) => <View key={key}>
            <Text style={styles.muted}>{key}</Text>
            {turn.proposal?.operation === 'update' && turn.proposal.before?.[key] !== undefined && turn.proposal.before[key] !== value && <Text style={styles.muted}>Before: {String(turn.proposal.before[key])}</Text>}
            <Text selectable style={styles.text}>{turn.proposal?.references[String(value)] ? `${turn.proposal.references[String(value)]} (${value})` : String(value)}</Text>
          </View>)}
          {turn.proposal.warnings.map((warning, i) => <Text key={i} style={styles.muted}>{warning}</Text>)}
          {turn.outcome ? <Text accessibilityLiveRegion="polite" style={styles.text}>{turn.outcome}</Text> : <>
            <Button title="Confirm change" disabled={busy || saving || !consent || !active} danger={turn.proposal.operation === 'delete'} onPress={() => void confirm(turn)} />
            <Button title="Discard change" secondary disabled={saving} onPress={() => outcome(turn.proposal!.id, 'Discarded. Nothing was submitted.')} />
          </>}
        </>}
      </Card>)}
      <ErrorText error={error} />
      <Field label="Message to assistant" multiline value={input} onChangeText={setInput} maxLength={1000} editable={!busy && !saving} placeholder="Record lunch, review spending, or change a budget…" />
      <Button title={busy ? 'Thinking…' : 'Ask assistant'} disabled={!consent || busy || saving || !input.trim()} onPress={() => void ask()} />
      {busy && <Button title="Stop" secondary onPress={clear} />}
      <Button title="Clear chat" secondary disabled={saving} onPress={clear} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
function Toggle({ label, value, disabled, change }: { label: string; value: boolean; disabled: boolean; change: (v: boolean) => void }) {
  return <View style={styles.row}><Text style={[styles.muted, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={change} /></View>;
}
