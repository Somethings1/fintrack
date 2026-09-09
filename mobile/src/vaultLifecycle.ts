import type { Vault } from './vault';

// A sign-out seals the handle immediately, drains an in-flight operation, then
// wipes. A late sync callback cannot repopulate a cleared account cache.
export function serialVault(store: Vault): Vault {
  let tail = Promise.resolve(); let sealed = false;
  const append = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation); tail = result.then(() => undefined, () => undefined); return result;
  };
  const run = <T>(operation: () => Promise<T>): Promise<T> => append(async () => {
    if (sealed) throw new Error('Device store is closed for this session.'); return operation();
  });
  return {
    config: () => run(() => store.config()), setConfig: value => run(() => store.setConfig(value)),
    rows: collection => run(() => store.rows(collection)), watermark: collection => run(() => store.watermark(collection)),
    savePage: (collection, rows, watermark) => run(() => store.savePage(collection, rows, watermark)),
    drafts: () => run(() => store.drafts()), saveDraft: value => run(() => store.saveDraft(value)),
    removeDraft: id => run(() => store.removeDraft(id)),
    clear: () => { sealed = true; return append(() => store.clear()); },
    close: () => { sealed = true; return append(() => store.close()); },
  };
}
