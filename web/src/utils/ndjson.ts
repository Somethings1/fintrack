export interface SyncRecord {
    _id: string;
    lastUpdate: string;
    isDeleted?: boolean;
    [key: string]: unknown;
}
export interface SyncPage { latestTimestamp: string | null; nextCursor: string }

/** Parse arbitrary UTF-8 chunk boundaries with bounded buffers and explicit completion. */
export async function readSyncPage(
    stream: ReadableStream<Uint8Array>,
    onBatch: (records: SyncRecord[]) => Promise<void>,
): Promise<SyncPage> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '';
    let completed = false;
    let latest = -Infinity;
    let nextCursor = '';
    let count = 0;
    let batch: SyncRecord[] = [];
    const consume = async (line: string) => {
        if (!line.trim()) return;
        if (completed) throw new Error('Unexpected data after sync completion');
        if (line.length > 128 * 1024) throw new Error('Sync record too large');
        const record: unknown = JSON.parse(line);
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid sync record');
        if ('_syncComplete' in record) {
            if (record._syncComplete !== true || !('nextCursor' in record) || typeof record.nextCursor !== 'string' || record.nextCursor.length > 256) {
                throw new Error('Invalid sync completion marker');
            }
            completed = true;
            nextCursor = record.nextCursor;
            return;
        }
        if (!('_id' in record) || typeof record._id !== 'string' || !/^[a-f0-9]{24}$/i.test(record._id) ||
            !('lastUpdate' in record) || typeof record.lastUpdate !== 'string' || !Number.isFinite(Date.parse(record.lastUpdate))) {
            throw new Error('Invalid sync identity or timestamp');
        }
        if (++count > 500) throw new Error('Sync page exceeds its limit');
        latest = Math.max(latest, Date.parse(record.lastUpdate));
        batch.push(record as SyncRecord);
        if (batch.length >= 100) { await onBatch(batch); batch = []; }
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            let index: number;
            while ((index = buffer.indexOf('\n')) !== -1) {
                await consume(buffer.slice(0, index));
                buffer = buffer.slice(index + 1);
            }
            if (buffer.length > 128 * 1024) throw new Error('Unbounded sync buffer');
            if (done) break;
        }
        if (buffer.trim()) await consume(buffer);
        if (!completed) throw new Error('Incomplete synchronization; checkpoint was not advanced');
        if (batch.length) await onBatch(batch);
        return { latestTimestamp: Number.isFinite(latest) ? new Date(latest).toISOString() : null, nextCursor };
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
