// Validate source records before updating the local public catalogue.
const fs=require('node:fs'),path=require('node:path');
function validate(c){
 if(!Array.isArray(c.providers)||!Array.isArray(c.categories)||!Array.isArray(c.families)||!Array.isArray(c.products))throw Error('Katalog bölümleri eksik.');
 for(const key of ['providers','categories','families','products']){const ids=new Set();for(const item of c[key]){if(typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Geçersiz veya tekrar kimlik: '+key);ids.add(item.id);}}
 for(const p of c.providers){const url=new URL(p.homepage);if(url.protocol!=='https:')throw Error('Üretici bağlantısı HTTPS olmalı.');}
 for(const f of c.families)if(!c.categories.some(x=>x.id===f.category))throw Error('Ürün grubu kategorisi bulunamadı.');
 for(const p of c.products){
  const provider=c.providers.find(x=>x.id===p.providerId),family=c.families.find(x=>x.id===p.family);
  if(!provider||!family||family.category!==p.category)throw Error('Ürün ilişkileri geçersiz: '+p.id);
  if(!Number.isSafeInteger(p.baseMinor)||p.baseMinor<0||p.currency!=='USD')throw Error('Fiyat tam sayı USD sent olmalı: '+p.id);
  for(const key of ['title','sizes','priceBasis','sourceUrl','checkedOn'])if(typeof p[key]!=='string'||!p[key].trim())throw Error('Eksik alan: '+key);
  if(!Array.isArray(p.aliases)||p.aliases.some(x=>typeof x!=='string'))throw Error('Arama adları geçersiz.');
  const url=new URL(p.sourceUrl),host=new URL(provider.homepage).hostname.replace(/^www\./,'');
  if(url.protocol!=='https:'||url.username||url.password||!(url.hostname===host||url.hostname.endsWith('.'+host)))throw Error('Kaynak üreticinin resmi alanında olmalı: '+p.id);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.checkedOn)||new Date(p.checkedOn+'T00:00:00Z').toISOString().slice(0,10)!==p.checkedOn)throw Error('Kontrol tarihi geçersiz.');
  if(p.shipping!=null){if(typeof p.shipping!=='object'||Array.isArray(p.shipping))throw Error('Kargo alanı geçersiz.');for(const amount of Object.values(p.shipping))if(!Number.isSafeInteger(amount)||amount<0)throw Error('Kargo tutarı geçersiz.');}
 }
 return c;
}
function merge(c,batch){if(!Array.isArray(batch.products))throw Error('Aktarımda products listesi gerekli.');const next=JSON.parse(JSON.stringify(c));const ids=new Set();for(const record of batch.products){if(ids.has(record.id))throw Error('Aktarımda tekrar kimlik.');ids.add(record.id);const index=next.products.findIndex(x=>x.id===record.id);if(index===-1)next.products.push(record);else next.products[index]=record;}return validate(next);}
if(require.main===module){try{const root=path.resolve(__dirname,'..'),filename=path.join(root,'data/catalog.json'),c=JSON.parse(fs.readFileSync(filename,'utf8')),input=process.argv[2];const next=input?merge(c,JSON.parse(fs.readFileSync(input,'utf8'))):validate(c);if(input){fs.writeFileSync(filename,JSON.stringify(next,null,2)+'\n');fs.writeFileSync(path.join(root,'dist/catalog.js'),'// Source-backed catalogue snapshot.\nglobalThis.POD_CATALOG = '+JSON.stringify(next,null,2)+';\n');}console.log(next.products.length+' kaynaklı ürün kaydı doğrulandı.');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={validate,merge};
