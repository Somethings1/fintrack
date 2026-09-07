import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile(new URL('../dist/.vite/manifest.json',import.meta.url),'utf8'));
const entry=Object.values(manifest).find(item=>item.isEntry);
assert.ok(entry,'Missing Vite entrypoint');
const visited=new Set();let initial=0,total=0;
async function size(item,includeDependencies){
  if(visited.has(item.file))return;visited.add(item.file);
  const raw=await readFile(new URL('../dist/'+item.file,import.meta.url));
  const bytes=gzipSync(raw).length;total+=bytes;if(includeDependencies)initial+=bytes;
  assert.ok((await stat(new URL('../dist/'+item.file,import.meta.url))).size<2_000_000,`Chunk ${item.file} exceeds 2 MB`);
  for(const key of item.imports??[])await size(manifest[key],includeDependencies);
}
await size(entry,true);
for(const item of Object.values(manifest))await size(item,false);
console.log(JSON.stringify({initialGzipBytes:initial,totalGzipBytes:total}));
assert.ok(initial<450_000,'Initial JavaScript exceeds 450 KB gzip');
assert.ok(total<1_100_000,'Total JavaScript exceeds 1.1 MB gzip');
