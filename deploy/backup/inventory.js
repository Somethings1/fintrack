// Run with mongosh --nodb --quiet --file; credentials are never shell arguments.
const connection = new Mongo(process.env.MONGO_URI);
const target = connection.getDB(process.env.BACKUP_DATABASE);
const entries = target.getCollectionInfos().sort((a,b)=>a.name.localeCompare(b.name));
if (process.env.BACKUP_REQUIRE_EMPTY === '1' && entries.length) throw new Error('Restore target is not empty');
const crypto = require('crypto');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const results = [];
for (const entry of entries) {
  if (entry.type !== 'collection' || entry.name.startsWith('system.')) throw new Error('Only application collections are supported');
  const coll = target.getCollection(entry.name);
  const digest = crypto.createHash('sha256'); let count = 0;
  coll.find().sort({_id:1}).forEach(doc => {
    digest.update(JSON.stringify(canonical(EJSON.serialize(doc,{relaxed:false})))+'\n'); count++;
  });
  const indexes = coll.getIndexes().map(({ns,v,...index})=>index).sort((a,b)=>a.name.localeCompare(b.name));
  results.push({collection:entry.name,count,sha256:digest.digest('hex'),indexes:canonical(indexes),options:canonical(entry.options)});
}
print(JSON.stringify(results));
