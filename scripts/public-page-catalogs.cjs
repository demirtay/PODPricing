const fs=require('fs'),path=require('path');
// Avrupa ve İngiliz ondalık yazımlarını doğru okur: 7,95 · 1.234,50 · 7.95 · 1,234.50
function euroMinor(t){t=String(t).trim();const de=/,\d{1,2}$/.test(t),en=/\.\d{1,2}$/.test(t);const n=de?Number(t.replace(/\./g,'').replace(',','.')):en?Number(t.replace(/,/g,'')):Number(t.replace(/[.,]/g,''));return Math.round(n*100);}
const definitions={tshirtgang:{base:'https://www.tshirtgang.com',catalog:'/catalog',currency:'USD'},ogo:{base:'https://ogo.com.au',catalog:'/products/',currency:'AUD'},printegy:{base:'https://printegy.de',catalog:'/products',currency:'EUR'}};
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&nbsp;/g,' ').trim();
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return r.text();}
function schema(html){return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{try{const d=JSON.parse(m[1]);return [...(Array.isArray(d)?d:[d]),...(d['@graph']||[])];}catch{return [];}}).find(p=>p['@type']==='Product');}
function parse(id,html,url,fx){let title,image,minor,basis,sizes;
 if(id==='printegy'){
  title=clean(html.match(/class="product-item__title"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
  const info=html.slice(html.indexOf('class="product-item-info"'));
  const prices=[...info.matchAll(/class="product-item__prices-item__title"[^>]*>([\s\S]*?)<\/span>\s*<span class="product-item__prices-item__price"[^>]*>\s*([\d.,]+)(?:\s*[-–]\s*[\d.,]+)?\s*€/g)].map(m=>({label:clean(m[1]),minor:euroMinor(m[2])})).filter(p=>p.minor>0).sort((a,b)=>a.minor-b.minor);
  if(!prices.length)return null;minor=prices[0].minor;basis='Kaynak başlangıç bedeli · '+prices[0].label+' · kargo/vergi koşulları kaynakta';
  image=html.match(/<img[^>]*src="([^\"]*assets\/images\/goods\/[^\"]+)"/)?.[1];if(image)image=new URL(image,definitions[id].base+'/').href;
  sizes=clean(info.match(/class="product-item__size"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
 }else{
  const p=schema(html);if(!p)return null;const offers=Array.isArray(p.offers)?p.offers:[p.offers];const o=offers.find(o=>o?.priceCurrency===definitions[id].currency&&/InStock$/.test(o.availability));if(!o)return null;
  title=clean(p.name);image=Array.isArray(p.image)?p.image[0]:p.image;
  if(id==='tshirtgang'){const shown=html.match(/class="cat-product__price"[\s\S]*?<strong>USD\s*\$([\d,.]+)/);if(!shown)return null;minor=Math.round(Number(shown[1].replace(/,/g,''))*100);if(minor!==Math.round(Number(o.price)*100))throw Error('Görünen fiyat ve ürün şeması uyuşmuyor');basis='Kaynak From başlangıç bedeli · kargo ayrıca · renk/beden ve baskı seçimi tutarı değiştirebilir';}
  else{const shown=html.match(/class="price"[^>]*>([\s\S]*?)<\/p>/)?.[1];if(!shown)return null;const values=[...shown.matchAll(/<bdi>\s*<span[^>]*>[^<]*<\/span>\s*([\d,.]+)/g)].map(m=>Math.round(Number(m[1].replace(/,/g,''))*100));minor=Math.min(...values);if(minor!==Math.round(Number(o.price)*100))throw Error('Görünen fiyat ve ürün şeması uyuşmuyor');basis=(/Add Printing Cost/i.test(html)?'Boş ürün bedeli · baskı ücreti ayrıca':'Kaynak ürün başlangıç bedeli')+' · '+(String(o.priceSpecification?.valueAddedTaxIncluded)==='false'?'GST hariç · ':'')+'kargo ayrıca';}
 }
 if(!title||!image||!(minor>0))return null;
 const p=require('./store-connectors.cjs').normalize(id,{id:new URL(url).pathname.split('/').filter(Boolean).pop(),title,minor,image,url,sizes,basis},definitions[id].currency,fx);p.priceVerified=true;p.priceVerification='visible-product-page';return p;
}
async function collect(id,progress=()=>{}){
 const d=definitions[id],queue=[d.base+d.catalog],visited=new Set(),productUrls=new Set();
 while(queue.length){const url=queue.shift();if(visited.has(url))continue;if(visited.size>=100)throw Error('Katalog sayfalama sınırı');const h=await get(url);visited.add(url);
  for(const m of h.matchAll(/href="([^"]+)"/g)){let u;try{u=new URL(m[1].replace(/&amp;/g,'&'),d.base+'/');}catch{continue;}if(u.origin!==d.base||u.hash)continue;
   if(id==='tshirtgang'&&/^\/catalog\/[^/]+$/.test(u.pathname)){if(/^\/catalog\/(crewnecks|hats|hoodies|long-sleeves|mousepads|mugs|ornaments|other|t-shirts|tanks|tote-bags|youth)$/.test(u.pathname)){if(!visited.has(u.href)&&!queue.includes(u.href))queue.push(u.href);}else productUrls.add(u.origin+u.pathname);}
   if(id==='ogo'&&/^\/product\/[^/]+\/$/.test(u.pathname))productUrls.add(u.origin+u.pathname);
   if(id==='printegy'&&/^\/products\/(?:st\/)?[^/]+\/?$/.test(u.pathname))productUrls.add(u.origin+u.pathname);
   if((id==='ogo'&&/^\/products\/page\/\d+\/$/.test(u.pathname))||(id==='printegy'&&u.pathname==='/products'&&u.searchParams.has('page')))if(!visited.has(u.href)&&!queue.includes(u.href))queue.push(u.href);
  }
 }
 if(!productUrls.size)throw Error('Ürün bağlantıları bulunamadı');const urls=[...productUrls],products=[],pending=[],fx=await require('./store-connectors.cjs').exchange(d.currency);let cursor=0,done=0;
 await Promise.all([0,1,2].map(async()=>{while(cursor<urls.length){const url=urls[cursor++];try{const p=parse(id,await get(url),url,fx);if(p)products.push(p);else pending.push({url,reason:'Kategori sayfası veya satışta fiyatlı ürün koşulları sağlanmıyor'});}catch(e){pending.push({url,reason:e.message});}if(++done%10===0||done===urls.length)progress(done,urls.length);}}));
 fs.writeFileSync(path.join(__dirname,'../data/'+id+'-coverage.json'),JSON.stringify({checkedAt:new Date().toISOString(),pages:visited.size,discovered:urls.length,added:products.length,pending},null,2));
 if(!products.length)throw Error('Açık fiyatlı ürün bulunamadı');return {products,pages:visited.size,coverage:'public-product-pages',checkedOn:new Date().toISOString().slice(0,10)};
}
module.exports={definitions,parse,collect};
