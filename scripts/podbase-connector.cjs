const fs=require('fs'),path=require('path');
const base='https://www.podbase.com';
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return r.text();}
function parse(html,url,fx){
 const upcoming=html.match(/<div class="product-upcoming-content([^"]*)"/);
 if(upcoming&&!upcoming[1].includes('w-condition-invisible'))return null;
 const title=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'');
 const price=html.match(/id="p-price"[^>]*>\s*€([\d,.]+)/);
 let image=html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1]||html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1];
 const options=html.match(/data-product-options="([^"]+)"/)?.[1];
 if(!image&&options){try{const data=JSON.parse(options.replace(/&quot;/g,'"').replace(/&amp;/g,'&'));const variants=Array.isArray(data)?data:Object.values(data).flat();image=variants.find(v=>v.cover)?.cover;}catch{}}
 if(!title||!price||!image)return null;
 const minor=Math.round(Number(price[1].replace(/,/g,''))*100);if(!(minor>0))return null;
 const p=require('./store-connectors.cjs').normalize('podbase',{id:new URL(url).pathname.split('/').pop(),title,minor,image,url,basis:'Kaynak ürün sayfasındaki Product Price · kargo ayrıca · model/ölçü seçimi tutarı değiştirebilir'},'EUR',fx);
 p.priceVerified=true;p.priceVerification='visible-product-price';return p;
}
async function collect(progress=()=>{}){
 const sitemap=await get(base+'/sitemap.xml'),urls=[...new Set([...sitemap.matchAll(/<loc>([^<]*\/custom\/[^<]*)<\/loc>/g)].map(m=>m[1]))].filter(u=>new URL(u).pathname.split('/').filter(Boolean).length===3);
 if(!urls.length)throw Error('Ürün sitemap listesi bulunamadı');
 const fx=await require('./store-connectors.cjs').exchange('EUR'),products=[],pending=[];let cursor=0,done=0;
 await Promise.all([0,1,2].map(async()=>{while(cursor<urls.length){const url=urls[cursor++];try{const p=parse(await get(url),url,fx);if(p)products.push(p);else pending.push({url,reason:'Yakında çıkacak veya açık ürün fiyatı/fotoğrafı eksik'});}catch(e){pending.push({url,reason:e.message});}progress(++done,urls.length);}}));
 fs.writeFileSync(path.join(__dirname,'../data/podbase-coverage.json'),JSON.stringify({discovered:urls.length,added:products.length,pending,checkedAt:new Date().toISOString()},null,2));
 if(!products.length)throw Error('Açık fiyatlı Podbase ürünü bulunamadı');
 return {products,pages:1,coverage:pending.length?'public-product-pages-partial':'public-product-pages',checkedOn:new Date().toISOString().slice(0,10)};
}
module.exports={parse,collect};
