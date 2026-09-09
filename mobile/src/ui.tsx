import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = { ink: '#12263A', muted: '#566777', paper: '#F3F6F8', white: '#FFFFFF', accent: '#087F72', line: '#DCE5E9', danger: '#AE2937' };
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper }, content: { padding: 20, gap: 16, paddingBottom: 32 },
  card: { backgroundColor: palette.white, padding: 18, borderRadius: 18, gap: 10, borderWidth: 1, borderColor: palette.line },
  heading: { color: palette.ink, fontSize: 28, fontWeight: '700' }, title: { color: palette.ink, fontSize: 19, fontWeight: '600' },
  text: { color: palette.ink, fontSize: 16, lineHeight: 23 }, muted: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  large: { color: palette.ink, fontSize: 32, fontWeight: '700' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  button: { minHeight: 48, backgroundColor: palette.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: '600' }, input: { minHeight: 50, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: palette.ink },
  notice: { backgroundColor: '#E6F3F0', borderRadius: 12, padding: 14 }, error: { color: palette.danger, fontSize: 15, lineHeight: 21 },
});
export function Button({ title, onPress, disabled = false, secondary = false, danger = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line }, danger && { backgroundColor: palette.danger }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={[styles.buttonText, secondary && !danger && { color: palette.ink }]}>{title}</Text></Pressable>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.muted}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} style={styles.input} {...props} /></View>;
}
export function Notice({ children }: { children: ReactNode }) { return <View style={styles.notice}><Text style={styles.muted}>{children}</Text></View>; }
export function ErrorText({ error }: { error: string }) { return error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null; }
export function Sheet({ title, children, close, busy = false }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) close(); }}><SafeAreaView style={styles.screen}><View style={[styles.row, { padding: 20 }]}><Text accessibilityRole="header" style={[styles.title, { flex: 1 }]}>{title}</Text><Button title="Close" secondary disabled={busy} onPress={close} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView></Modal>;
}
export interface Choice { id: string; name: string }
export function Picker({ label, value, options, onChange }: { label: string; value: string; options: Choice[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState('');
  return <View style={{ gap: 6 }}><Text style={styles.muted}>{label}</Text><Button secondary title={`${label}: ${options.find(v => v.id === value)?.name ?? 'Choose'}`} onPress={() => setOpen(true)} />
    {open && <Sheet title={label} close={() => setOpen(false)}><Field label="Filter choices" value={filter} onChangeText={setFilter} maxLength={100} />{options.filter(v => v.name.toLowerCase().includes(filter.toLowerCase())).map(option => <Button secondary key={option.id} title={option.name} onPress={() => { onChange(option.id); setOpen(false); setFilter(''); }} />)}{options.length === 0 && <Text style={styles.muted}>Create one in Plan first.</Text>}</Sheet>}
  </View>;
}
