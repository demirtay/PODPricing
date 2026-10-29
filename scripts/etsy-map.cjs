// Ürünleri Etsy kategori ağacına bağlar (data/etsy-taxonomy.json, 3.065 düğüm).
// 18 Eki 2026: başlık-regex türleri (pod-taxonomy) yetmiyordu — 899 ürün "Diğer", "glass" telefon kılıfları bardakta,
// kategori sayfaları sığ. Ali'nin Pazar Radarı çalışmasıyla aynı iskelet: Etsy ağacı, en derin uygun düğüm.
// etsyOf(p, cls) -> düğüm kimliği ; cls = pod-taxonomy classify() sonucu
'use strict';
const fs = require('fs');
const path = require('path');
const tx = require('./pod-taxonomy.cjs');

const RAW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'etsy-taxonomy.json'), 'utf8')).nodes;

// Etsy'nin POD için sığ kaldığı yerlere eklenen alt düğümler (Etsy düğümünün altında, kimliği pod-*)
const EXT = [
  ['pod-posters', 'Art & Collectibles > Prints', 'Posters', 'Posterler'],
  ['pod-canvas', 'Art & Collectibles > Prints', 'Canvas Prints', 'Kanvas Tablolar'],
  ['pod-framed', 'Art & Collectibles > Prints', 'Framed Prints', 'Çerçeveli Baskılar'],
  ['pod-metal', 'Art & Collectibles > Prints', 'Metal Prints', 'Metal Baskılar'],
  ['pod-acrylic', 'Art & Collectibles > Prints', 'Acrylic Prints', 'Akrilik Baskılar'],
  ['pod-wood', 'Art & Collectibles > Prints', 'Wood Prints', 'Ahşap Baskılar'],
  ['pod-flags', 'Home & Living > Outdoor & Gardening > Garden Decoration', 'Flags', 'Bayraklar'],
  ['pod-airpods', 'Electronics & Accessories > Electronics Cases', 'Earbud Cases', 'Kulaklık Kılıfları'],
  ['pod-phone-grips', 'Electronics & Accessories > Cell Phone Accessories', 'Phone Grips & Stands', 'Telefon Tutucular'],
  ['pod-car-mats', 'Electronics & Accessories > Car Parts & Accessories > Car Accessories', 'Car Floor Mats', 'Araç Paspasları'],
  ['pod-sunshades', 'Electronics & Accessories > Car Parts & Accessories > Car Accessories', 'Car Sun Shades', 'Araç Güneşlikleri'],
  ['pod-tote-bags', 'Bags & Purses > Totes', 'Canvas Tote Bags', 'Kanvas Bez Çantalar'],
];

const nodes = new Map(RAW.map(n => [n.id, { ...n }]));
const byPath = new Map(RAW.map(n => [n.path.join(' > '), n.id]));
// Etsy'de karşılığı olmayan, satıcıya satılan hizmet ve baskı malzemeleri (logo, tanıtım görseli, DTF transfer kâğıdı)
EXT.push(['pod-seller', '', 'Seller Services & Supplies', 'Satıcı Hizmet ve Malzemeleri'],
  ['pod-seller-services', 'Seller Services & Supplies', 'Branding & Design Services', 'Marka ve Tasarım Hizmetleri'],
  ['pod-seller-transfers', 'Seller Services & Supplies', 'DTF & Sublimation Supplies', 'DTF ve Süblimasyon Malzemeleri'],
  ['pod-seller-packaging', 'Seller Services & Supplies', 'Packaging & Fulfillment', 'Paketleme ve Gönderim']);
for (const [id, parent, label, labelTr] of EXT) {
  const pid = parent ? byPath.get(parent) : null;
  if (parent && !pid) throw new Error('etsy-map: üst düğüm yok ' + parent);
  const p = pid ? nodes.get(pid) : { path: [], depth: -1 }, pathArr = [...p.path, label];
  nodes.set(id, { id, label, labelTr, parentId: pid, depth: p.depth + 1, path: pathArr, ext: true });
  byPath.set(pathArr.join(' > '), id);
}

// yol -> düğüm; tam yol yoksa en yakın var olan üst düğüm (Etsy'de her cinsiyette aynı alt kategori yok)
const fallbacks = new Map(); // denetim: tam çözülemeyen yollar
function resolve(p) {
  const parts = p.split(' > ');
  while (parts.length) { const id = byPath.get(parts.join(' > ')); if (id) { if (parts.length < p.split(' > ').length) fallbacks.set(p, (fallbacks.get(p) || 0) + 1); return id; } parts.pop(); }
  throw new Error('etsy-map: yol çözülemedi ' + p);
}

// --- cinsiyet / yaş
const RE_BABY = /\b(baby|babies|infant|newborn|toddler|onesie|bodysuit|romper|bib)\b/;
const RE_KIDS = /\b(kids?|youth|children'?s?|child|juniors?|boys?|girls?|teen)\b/;
function who(text) {
  // "Women's Strap Shorts Romper" bebek değil: bebek kelimeleri yetişkin işareti yoksa geçerli
  const adult = /\b(women'?s?|womens|ladies|men'?s|mens|adults?|unisex)\b/.test(text);
  if ((RE_BABY.test(text) && (!adult || /\b(baby|infant|newborn|toddler)\b/.test(text))) || /\b(bebek|z[ıi]b[ıi]n)\b/.test(text)) return 'baby';
  if (/\b([çc]ocuk)\b/.test(text)) return 'kid';
  if (/\b(kad[ıi]n|damen)\b/.test(text)) return 'w';
  if (/\b(erkek|herren)\b/.test(text)) return 'm';
  if (/\bgirls?\b/.test(text) && !/\bboys?\b/.test(text)) return 'girl';
  if (/\bboys?\b/.test(text) && !/\bgirls?\b/.test(text)) return 'boy';
  if (RE_KIDS.test(text)) return 'kid';
  if (/\b(women'?s?|womens|ladies|lady|female|woman|feminine)\b/.test(text)) return 'w';
  if (/\b(men'?s|mens|man'?s|male)\b/.test(text) && !/\bwomen/.test(text)) return 'm';
  return 'u';
}
const ROOT = { u: 'Clothing > Gender-Neutral Adult Clothing', w: "Clothing > Women's Clothing", m: "Clothing > Men's Clothing",
  kid: "Clothing > Gender-Neutral Kids' Clothing", girl: "Clothing > Girls' Clothing", boy: "Clothing > Boys' Clothing",
  baby: "Clothing > Gender-Neutral Kids' Clothing > Gender-Neutral Baby Clothing" };
// giyim: { u: alt yol, w: ..., m: ..., kid: ... } — verilmeyen cinsiyet u'yu kullanır
const C = (u, o = {}) => ({ clothing: true, u, ...o });
const SHOE = { u: 'Shoes > Gender-Neutral Adult Shoes', w: "Shoes > Women's Shoes", m: "Shoes > Men's Shoes", kid: "Shoes > Gender-Neutral Kids' Shoes", girl: "Shoes > Girls' Shoes", boy: "Shoes > Boys' Shoes", baby: "Shoes > Gender-Neutral Kids' Shoes" };
const S = (u, o = {}) => ({ shoes: true, u, ...o });

const HL = 'Home & Living', KD = 'Home & Living > Kitchen & Dining', DW = 'Home & Living > Kitchen & Dining > Drink & Barware > Drinkware';
const HD = 'Home & Living > Home Decor', BP = 'Bags & Purses', AC = 'Accessories', EA = 'Electronics & Accessories', PPS = 'Paper & Party Supplies > Paper';
const PET = 'Pet Supplies', TG = 'Toys & Games', ART = 'Art & Collectibles > Prints';

// pod-taxonomy türü -> Etsy yolu; dizi ise [regex, yol] inceltmeleri sırayla, sonuncusu varsayılan
const TYPE_MAP = {
  'evcil-kiyafet': [[/\b(hoodie|jacket|coat|raincoat|sweater|sweatshirt)\b/, `${PET} > Pet Clothing, Accessories & Shoes > Pet Clothing > Pet Jackets & Hoodies`], [/\bbandana/, `${PET} > Pet Clothing, Accessories & Shoes > Pet Accessories > Pet Neckwear`], [/\bdress\b/, `${PET} > Pet Clothing, Accessories & Shoes > Pet Clothing > Pet Dresses`], [/\bcostume/, `${PET} > Pet Clothing, Accessories & Shoes > Pet Clothing > Pet Costumes`], `${PET} > Pet Clothing, Accessories & Shoes > Pet Clothing > Pet Tops`],
  'evcil-tasma': [[/\bharness/, `${PET} > Pet Collars & Leashes > Pet Harnesses & Backpacks`], [/\bleash/, `${PET} > Pet Collars & Leashes > Pet Leashes`], `${PET} > Pet Collars & Leashes > Pet Collars`],
  'evcil-yatak': [[/\bblanket/, `${PET} > Pet Bedding > Pet Blankets`], [/\bmat\b/, `${PET} > Pet Bedding > Pet Mats & Pads`], `${PET} > Pet Furniture > Pet Beds & Cots`],
  'evcil-mama-kabi': [[/\b(mat|placemat)\b/, `${PET} > Pet Feeding > Placemats`], `${PET} > Pet Feeding > Pet Bowls`],
  'evcil-diger': [[/\b(tag|id)\b/, `${PET} > Pet Collars & Leashes > Pet ID Tags`], [/\bcat toy/, `${PET} > Pet Toys > Cat Toys`], [/\btoy\b/, `${PET} > Pet Toys > Dog Toys`], [/\bcarrier|tote|sling/, `${PET} > Pet Carriers & Houses > Pet Totes`], [/\bpoop|waste/, `${PET} > Pet Health & Wellness > Pet Waste > Bag Holders & Scoops`], [/\bportrait/, `${PET} > Urns & Memorials > Pet Portraits`], PET],
  'bebek-body': C('Bodysuits', { forceWho: 'baby' }),
  'bebek-onluk': 'Bath & Beauty > Baby & Child Care > Bibs & Burping > Bibs',
  'bebek-battaniye': `${HL} > Bedding > Blankets & Throws > Baby Blankets`,
  'cocuk-giyim': 'KIDS',
  'ayakkabi-sneaker': [[/\bhigh[- ]?top|hi[- ]?top/, S('Sneakers & Athletic Shoes > Hi Tops')], [/\bslip[- ]?on|loafer/, S('Sneakers & Athletic Shoes > Slip Ons', { w: 'Sneakers & Athletic Shoes > Slip Ons', m: 'Loafers & Slip Ons' })], [/\bcleat|golf/, S('Sneakers & Athletic Shoes > Golf Shoes & Cleats')], S('Sneakers & Athletic Shoes > Tie Sneakers', { kid: 'Sneakers & Athletic Shoes', girl: 'Sneakers & Athletic Shoes', boy: 'Sneakers & Athletic Shoes' })],
  'ayakkabi-terlik': [[/\bslippers?\b/, S('Slippers')], [/\bflip[- ]?flop/, S('Sandals > Flip Flops & Thongs')], [/\bslides?\b|slider/, S('Sandals > Slides', { w: 'Sandals > Slingbacks & Slides' })], [/\bslipper/, S('Slippers')], [/\bclog|croc/, S('Clogs', { w: 'Clogs & Mules > Clogs', m: 'Clogs & Mules' })], S('Sandals')],
  'ayakkabi-bot': S('Boots'),
  'giyim-mayo': [[/\b(trunks?|board ?shorts?|swim shorts|jammers?)\b/, C('Swimwear', { w: 'Swimwear > Bottoms' })], [/\bbikini|tankini/, C('Swimwear', { w: 'Swimwear > Bikinis & Sets' })], [/\bone[- ]piece/, C('Swimwear', { w: 'Swimwear > One-Piece' })], [/\brash guard/, C('Swimwear', { w: 'Swimwear > Rash Guards' })], [/\bcover[- ]?up/, C('Swimwear', { w: 'Swimwear > Cover-Ups' })], C('Swimwear')],
  'giyim-ic-giyim': [[/\bboxer briefs?/, C('Underwear', { m: 'Underwear > Boxers & Briefs > Boxer Briefs', w: 'Lingerie > Panties' })], [/\bboxers?\b/, C('Underwear', { m: 'Underwear > Boxers & Briefs > Boxers', w: 'Lingerie > Panties' })], [/\bbriefs?\b/, C('Underwear', { m: 'Underwear > Boxers & Briefs > Briefs', w: 'Lingerie > Panties' })], [/\bbralette/, C('Underwear', { w: 'Lingerie > Bralettes' })], [/\bbra\b|sports? bh/, C('Sports & Fitness', { w: 'Lingerie > Bras' })], [/\bpant(ies|y)|thong|g-?string/, C('Underwear', { w: 'Lingerie > Panties' })], C('Underwear', { w: 'Lingerie' })],
  'giyim-pijama': [[/\brobe|bathrobe/, C('Pajamas & Robes > Robes', { w: 'Pajamas & Robes > Robes', m: 'Pajamas & Robes > Robes' })], [/\bnight ?(gown|dress|shirt)/, C('Pajamas & Robes > Pajamas > Tops', { w: 'Pajamas & Robes > Night Gowns & Tops' })], [/\b(pants|shorts|bottoms?)\b/, C('Pajamas & Robes > Pajamas > Sleep Shorts & Bottoms', { w: 'Pajamas & Robes > Sleep Shorts & Bottoms', m: 'Pajamas & Robes > Sleep Shorts & Bottoms' })], [/\bone[- ]?piece|onesie|jumpsuit/, C('Pajamas & Robes > Pajamas > One-Piece', { w: 'Pajamas & Robes > Rompers & One-Piece', m: 'Pajamas & Robes > One-Piece' })], C('Pajamas & Robes > Pajamas > Sets', { w: 'Pajamas & Robes > Sets', m: 'Pajamas & Robes > Sets' })],
  'giyim-corap': [[/\b(athletic|sport|crew sport|running|basketball)\b/, C('Socks & Hosiery > Athletic Socks', { m: 'Socks > Athletic Socks' })], [/\bdress socks/, C('Socks & Hosiery > Dress Socks', { m: 'Socks > Dress Socks' })], [/\bknee|thigh|stocking|pantyhose|tights/, C('Socks & Hosiery > Hosiery')], C('Socks & Hosiery > Casual Socks', { m: 'Socks > Casual Socks', kid: 'Socks & Leg Warmers > Socks' })],
  'giyim-forma': C('Sports & Fitness'),
  'giyim-polo': C('Tops & Tees > Polos', { m: 'Shirts & Tees > Polos', kid: 'Tops & Tees > Polos' }),
  'giyim-fermuarli-kapusonlu': C('Hoodies & Sweatshirts > Hoodies'),
  'giyim-kapusonlu': C('Hoodies & Sweatshirts > Hoodies'),
  'giyim-sweatshirt': C('Hoodies & Sweatshirts > Sweatshirts'),
  'giyim-hirka-kazak': [[/\bcardigan/, C('Sweaters', { w: 'Sweaters > Cardigans', m: 'Sweaters > Cardigans' })], C('Sweaters', { w: 'Sweaters > Pullover Sweaters', m: 'Sweaters > Pullover Sweaters' })],
  'giyim-ceket': C('Jackets & Coats', { w: 'Jackets & Coats', m: 'Jackets & Coats' }),
  'giyim-yelek': C('Vests'),
  'giyim-gomlek': C('Tops & Tees > Oxfords', { m: 'Shirts & Tees > Oxfords & Button Downs', w: 'Tops & Tees > Blouses', kid: 'Tops & Tees > Dress Shirts & Button Downs' }),
  'giyim-elbise': C('Dresses', { u: "Clothing > Women's Clothing > Dresses", kid: "Clothing > Girls' Clothing > Dresses" }),
  'giyim-etek': C('Skirts & Kilts', { w: 'Skirts', m: 'Kilts & Skirts', girl: 'Skirts' }),
  'giyim-tulum': C('Overalls & Coveralls', { w: 'Jumpsuits & Rompers', kid: 'Overalls' }),
  'giyim-tayt': C('Leggings'),
  'giyim-sort': C('Shorts', { w: 'Shorts & Skorts > Shorts' }),
  'giyim-pantolon': C('Pants', { w: 'Pants & Capris > Pants', girl: 'Pants & Capris' }),
  'giyim-takim': [[/\b(scrubs?|uniforms?)\b/, C('Suits', { m: 'Suits & Sport Coats > Suits', w: 'Blazers & Suits > Suits', kid: 'Clothing Sets' })], [/\bcheer/, C('Sports & Fitness')], C('Pajamas & Robes > Pajamas > Sets', { w: 'Pajamas & Robes > Sets', kid: 'Clothing Sets', girl: 'Clothing Sets', boy: 'Clothing Sets', u: 'Sports & Fitness', m: 'Sports & Fitness' })],
  'giyim-crop': C('Tops & Tees > T-shirts', { w: 'Tops & Tees > Crop & Tube Tops > Crop Tops', u: "Clothing > Women's Clothing > Tops & Tees > Crop & Tube Tops > Crop Tops" }),
  'giyim-atlet': C('Tops & Tees > Tanks', { m: 'Shirts & Tees > Tanks' }),
  'giyim-uzun-kollu': C('Tops & Tees > T-shirts', { m: 'Shirts & Tees > T-shirts' }),
  'giyim-raglan': C('Tops & Tees > T-shirts', { m: 'Shirts & Tees > T-shirts' }),
  'giyim-tisort': C('Tops & Tees > T-shirts', { m: 'Shirts & Tees > T-shirts' }),
  'giyim-ust': [[/\btunic/, C('Tops & Tees', { w: 'Tops & Tees > Tunics' })], [/\bblouse/, C('Tops & Tees', { w: 'Tops & Tees > Blouses' })], [/\bbodysuit/, C('Tops & Tees', { w: 'Bodysuits & Catsuits > Bodysuits' })], [/\bponcho|cloak|cape/, C('Ponchos')], [/\bkimono|cover[- ]?up/, C('Tops & Tees', { w: 'Swimwear > Cover-Ups' })], C('Tops & Tees', { m: 'Shirts & Tees' })],
  'giyim-onluk': `${AC} > Aprons`,
  'aksesuar-ayakkabi': [[/\bcharm/, 'Shoes > Insoles & Accessories > Shoe Charms'], 'Shoes > Insoles & Accessories > Shoelaces'],
  'aksesuar-bere': `${AC} > Hats & Head Coverings > Hats & Caps`,
  'aksesuar-sapka': `${AC} > Hats & Head Coverings > Hats & Caps`,
  'aksesuar-maske': [[/\bsleep|eye mask/, "Clothing > Women's Clothing > Pajamas & Robes > Sleep Masks & Blindfolds > Sleep Masks"], [/\bbalaclava/, `${AC} > Hats & Head Coverings > Balaclavas`], `${AC} > Face Masks & Accessories > Face Masks & Coverings`],
  'aksesuar-esarp': [[/\bbandana/, `${AC} > Scarves & Wraps > Bandanas`], [/\bhandkerchief/, `${AC} > Scarves & Wraps > Handkerchiefs`], [/\bshawl|wrap\b/, `${AC} > Scarves & Wraps > Shawls & Wraps`], `${AC} > Scarves & Wraps > Scarves`],
  'aksesuar-kravat': [[/\bbow tie/, `${AC} > Suit & Tie Accessories > Bow Ties`], `${AC} > Suit & Tie Accessories > Neckties`],
  'aksesuar-taki': [[/\b(jewe?l(le)?ry (box|case|organi[sz]er|storage)|trinket (box|dish|tray)s?|ring (box|dish))\b/, 'Jewelry > Jewelry Storage'], [/\bname necklace|monogram|initial necklace/, 'Jewelry > Necklaces > Monogram & Name Necklaces'], [/\bcharm bracelet/, 'Jewelry > Bracelets > Charm Bracelets'], [/\blocket/, 'Jewelry > Necklaces > Lockets'], [/\bchoker/, 'Jewelry > Necklaces > Choker Necklaces'], [/\bcharm necklace|necklace.*\bcharm/, 'Jewelry > Necklaces > Charm Necklaces'], [/\bnecklace|pendant/, 'Jewelry > Necklaces > Pendant Necklaces'], [/\bstud earring/, 'Jewelry > Earrings > Stud Earrings'], [/\bhoop/, 'Jewelry > Earrings > Hoop Earrings'], [/\bearring/, 'Jewelry > Earrings > Dangle & Drop Earrings'], [/\bbangle/, 'Jewelry > Bracelets > Bangles'], [/\bbeaded bracelet/, 'Jewelry > Bracelets > Beaded Bracelets'], [/\bcuff\b/, 'Jewelry > Bracelets > Cuff Bracelets'], [/\bbracelet/, 'Jewelry > Bracelets > Chain & Link Bracelets'], [/\bsignet/, 'Jewelry > Rings > Signet Rings'], [/\bring\b|rings\b/, 'Jewelry > Rings > Statement Rings'], [/\bbrooch/, `${AC} > Pins & Clips > Brooches`], [/\bchain\b/, 'Jewelry > Necklaces > Chains'], [/\bcharm/, 'Jewelry > Necklaces > Charm Necklaces'], [/\bcuff ?links?/, `${AC} > Suit & Tie Accessories > Cuff Links & Tie Clips > Cuff Links`], 'Jewelry'],
  'aksesuar-saat': [[/^(?!.*\b(strap|band) watch|.*\bwatch with\b).*\b(bands?|straps?)\b/, 'Jewelry > Watches > Watch Bands & Straps'], [/\bpocket watch/, 'Jewelry > Watches > Pocket Watches'], 'Jewelry > Watches > Wrist Watches > Unisex Wrist Watches'],
  'aksesuar-cuzdan': [[/\bcard (holder|case)|business card/, `${BP} > Wallets & Money Clips > Business Card Cases`], [/\bpassport/, `${BP} > Luggage & Travel > Passport Covers`], `${BP} > Wallets & Money Clips > Wallets`],
  'aksesuar-anahtarlik': [[/\blanyard/, `${AC} > Keychains & Lanyards > Lanyards`], [/\bbadge (holder|reel)/, `${AC} > Keychains & Lanyards > Badge Reels`], `${AC} > Keychains & Lanyards > Keychains`],
  'aksesuar-rozet': [[/\bpatch/, `${AC} > Patches & Appliques`], [/\bbadge/, `${AC} > Pins & Clips > Badges`], `${AC} > Pins & Clips > Pins & Pinback Buttons`],
  'aksesuar-bakim': [[/\bmirror/, 'Bath & Beauty > Makeup & Cosmetics > Makeup Tools & Brushes > Hand & Pocket Mirrors'], [/\bcomb|brush/, 'Bath & Beauty > Hair Care'], 'Bath & Beauty'],
  'aksesuar-gozluk': [[/\bcase/, `${AC} > Sunglasses & Eyewear > Glasses Cases`], `${AC} > Sunglasses & Eyewear`],
  'aksesuar-semsiye': `${AC} > Umbrellas & Rain Accessories`,
  'aksesuar-eldiven': `${AC} > Gloves & Sleeves > Gloves`,
  'aksesuar-kemer': `${AC} > Belts & Suspenders > Belts`,
  'aksesuar-diger': AC,
  'canta-bez': 'pod-tote-bags',
  'canta-sirt': [[/\bdrawstring/, `${BP} > Sports Bags > Team Sports & Gym Bags`], `${BP} > Backpacks`],
  'canta-buzgulu': `${BP} > Food & Insulated Bags > Lunch Bags & Boxes`,
  'canta-bel': `${BP} > Fanny Packs`,
  'canta-kozmetik': [[/\btoiletry|travel case|wash bag/, `${BP} > Cosmetic & Toiletry Storage > Toiletry Kits & Travel Cases`], `${BP} > Cosmetic & Toiletry Storage > Cosmetic Bags`],
  'canta-beslenme': `${BP} > Food & Insulated Bags > Lunch Bags & Boxes`,
  'canta-laptop': [[/\bsleeve/, `${EA} > Electronics Cases > Laptop Sleeves`], `${EA} > Electronics Cases > Laptop Bags`],
  'canta-seyahat': [[/\bduffel|duffle|weekender|gym bag/, `${BP} > Luggage & Travel > Duffel Bags`], [/\bluggage tag/, `${BP} > Luggage & Travel > Luggage Tags`], [/\bluggage cover|suitcase cover/, `${BP} > Luggage & Travel > Luggage Covers`], [/\bsuitcase|luggage|carry[- ]on/, `${BP} > Luggage & Travel > Suitcases`], `${BP} > Luggage & Travel > Overnight Bags`],
  'canta-el-omuz': [[/\bcrossbody|sling/, `${BP} > Handbags > Crossbody Bags`], [/\bclutch|evening/, `${BP} > Handbags > Clutches & Evening Bags`], [/\bwristlet/, `${BP} > Handbags > Wristlets`], [/\bhobo/, `${BP} > Handbags > Hobo Bags`], [/\bmessenger/, `${BP} > Messenger Bags`], [/\bshoulder/, `${BP} > Handbags > Shoulder Bags`], `${BP} > Handbags > Top Handle Bags`],
  'canta-diger': [[/\b(pouch|coin purse|zipper pouch|pencil)\b/, `${BP} > Pouches & Coin Purses`], [/\bbeach bag/, `${BP} > Sports Bags > Beach Bags`], [/\b(gift|party|favor) bags?\b|\bpaper bags?\b/, `${PPS} > Gift Wrapping > Party & Gift Bags > Gift Bags`], [/\bshoe bag/, `${BP} > Clothing & Shoe Bags > Shoe Bags`], [/\blaundry/, `${HL} > Storage & Organization > Laundry Bags & Hampers > Laundry Bags`], [/\bdrawstring|gym|sport/, `${BP} > Sports Bags > Team Sports & Gym Bags`], [/\bdiaper/, `${BP} > Diaper Bags`], [/\bmarket|shopping|grocery/, `${BP} > Market Bags`], BP],
  'mutfak-kupa': [[/\btravel|tumbler|insulated|40oz|lid\b/, `${DW} > Travel Mugs`], [/\bbeer stein|stein\b/, `${KD} > Drink & Barware > Barware > Steins`], `${DW} > Mugs`],
  'mutfak-termos': `${DW} > Travel Mugs`,
  'mutfak-matara': `${DW} > Water Bottles`,
  'mutfak-bardak': [[/\bwine/, `${KD} > Drink & Barware > Barware > Wine Glasses & Charms > Wine Glasses`], [/\bshot glass/, `${KD} > Drink & Barware > Barware > Shot Glasses`], [/\bpint|beer/, `${DW} > Pint Glasses`], [/\bchampagne|flute/, `${KD} > Drink & Barware > Barware > Champagne & Coupe Glasses > Champagne Glasses`], [/\bespresso|tea ?cup/, `${DW} > Tea Cups & Sets > Tea Cups`], [/\bpaper cups?|party cups?/, 'Paper & Party Supplies > Party Supplies > Party Decor > Tableware > Cups'], [/\b(stainless|insulated|\d\doz tumbler|tumbler\w* \||fruit cup|with straw)\b/, `${DW} > Travel Mugs`], `${DW} > Tumblers & Water Glasses`],
  'mutfak-sogutucu': [[/\bbottle/, `${DW} > Cozies > Bottle Cozies`], `${DW} > Cozies > Can Cozies`],
  'mutfak-bardak-alti': [[/\bcar coaster/, `${EA} > Car Parts & Accessories > Car Accessories > Car Coasters`], `${DW} > Coasters`],
  'mutfak-tabak': [[/\bbowl/, `${KD} > Dining & Serving > Bowls`], [/\btray|platter/, `${KD} > Dining & Serving > Trays & Platters > Trays`], `${KD} > Dining & Serving > Plates`],
  'mutfak-kesme-tahtasi': [[/\bcharcuterie|cheese/, `${KD} > Dining & Serving > Trays & Platters > Cheese & Charcuterie Boards`], `${KD} > Cookware > Cutting Boards`],
  'mutfak-diger': [[/\btea towel|kitchen towel|dish towel/, `${KD} > Linens > Kitchen & Tea Towels`], [/\bplacemat/, `${KD} > Linens > Table Linens > Placemats`], [/\btable runner/, `${KD} > Linens > Table Linens > Table Runners`], [/\bpot ?holder|oven mitt|oven glove/, `${KD} > Cookware > Trivets & Pot Holders > Pot Holders`], [/\btrivet/, `${KD} > Cookware > Trivets & Pot Holders > Trivets`], [/\bbottle opener/, `${KD} > Drink & Barware > Barware > Bottle Openers`], [/\bflask/, `${KD} > Drink & Barware > Barware > Flasks`], [/\b(lid|straw|topper|nameplate|boot)\b/, DW], [/\bjar|canister|storage/, `${HL} > Storage & Organization > Cabinets & Food Storage`], [/\bmagnet/, `${KD} > Kitchen Decor > Refrigerator Magnets`], [/\bnapkin/, 'Paper & Party Supplies > Party Supplies > Party Decor > Tableware > Napkins'], [/\bspoon|fork|knife|cutlery|utensil/, `${KD} > Cookware > Cutlery & Knives > Cutlery`], KD],
  'ev-yastik': [[/\bfloor (pillow|cushion)/, `${HL} > Furniture > Living Room Furniture > Floor Pillows`], [/\bpillow ?case|pillowcase|sham/, `${HL} > Bedding > Sheets & Pillowcases > Pillowcases`], [/\bchair pad|seat cushion/, `${HD} > Chair Pads`], [/\bbed pillow|sleeping pillow/, `${HL} > Bedding > Bed Pillows`], `${HD} > Throw Pillows`],
  'ev-battaniye': [[/\bweighted/, `${HL} > Bedding > Blankets & Throws > Weighted Blankets`], [/\bquilt/, `${HL} > Bedding > Blankets & Throws > Quilts`], [/\bbaby|swaddle/, `${HL} > Bedding > Blankets & Throws > Baby Blankets`], [/\bbeach towel|picnic/, `${HL} > Bathroom > Beach Towels`], `${HL} > Bedding > Blankets & Throws > Throws`],
  'ev-nevresim': [[/\bduvet/, `${HL} > Bedding > Duvet Covers`], [/\bcomforter/, `${HL} > Bedding > Comforters`], [/\bfitted/, `${HL} > Bedding > Sheets & Pillowcases > Fitted Sheets`], [/\bsheet set|bedding set/, `${HL} > Bedding > Sheets & Pillowcases > Sheet Sets`], [/\bbedspread/, `${HL} > Bedding > Bedspreads`], `${HL} > Bedding`],
  'ev-havlu': [[/\bbeach/, `${HL} > Bathroom > Beach Towels`], [/\bhooded/, `${HL} > Bathroom > Hooded Towels`], [/\b(tea|kitchen|dish) towel/, `${KD} > Linens > Kitchen & Tea Towels`], [/\bwash ?cloth|face towel/, 'Bath & Beauty > Bath Accessories > Washcloths'], `${HL} > Bathroom > Bath Towels`],
  'ev-perde': [[/\bshower/, `${HL} > Bathroom > Shower Curtains & Rings > Shower Curtains`], [/\bvalance/, `${HL} > Curtains & Window Treatments > Valances`], [/\bblind|shade/, `${HL} > Curtains & Window Treatments > Shades`], `${HL} > Curtains & Window Treatments > Curtains`],
  'ev-hali': [[/\bbath (mat|rug)/, `${HL} > Bathroom > Bath Mats & Rugs > Bath Mats`], [/\bdoor ?mat|welcome mat|entrance/, `${HL} > Floor & Rugs > Door Mats`], [/\bprayer/, `${HL} > Spirituality & Religion > Prayer Mats & Rugs`], [/\bcar (floor )?mat/, 'pod-car-mats'], [/\byoga mat/, `${TG} > Sports & Outdoor Recreation > Fitness & Exercise > Yoga & Pilates > Yoga`], [/\bmouse ?pad/, `${EA} > Computers & Peripherals > Keyboards & Mice > Mousepads`], `${HL} > Floor & Rugs > Rugs`],
  'ev-masa-ortusu': [[/\bplacemat/, `${KD} > Linens > Table Linens > Placemats`], [/\brunner/, `${KD} > Linens > Table Linens > Table Runners`], [/\bnapkin/, `${KD} > Linens > Table Linens`], `${KD} > Linens > Table Linens > Tablecloths`],
  'ev-mum': [[/\bholder/, `${HD} > Candles & Home Fragrances > Candleholders`], `${HD} > Candles & Home Fragrances > Candles > Container Candles`],
  'ev-saat': [[/\bwatch/, 'Jewelry > Watches'], `${HD} > Clocks`],
  'ev-bayrak': [[/\bbanner|bunting|garland|pennant/, 'Paper & Party Supplies > Party Supplies > Party Decor > Banners & Signs'], [/\bprayer flag/, `${HL} > Spirituality & Religion > Religious Home & Decor > Prayer Flags`], 'pod-flags'],
  'ev-sus': [[/\bornament/, `${HD} > Seasonal Decor > Ornaments`], [/\bstocking/, `${HD} > Seasonal Decor > Stockings`], [/\btree skirt/, `${HD} > Seasonal Decor > Tree Skirts`], [/\bwreath/, `${HD} > Wreaths & Door Hangers > Wreaths`], [/\bdoor hanger/, `${HD} > Wreaths & Door Hangers > Door Hangers`], [/\bsun ?catcher|window cling/, `${HD} > Wall Decor > Window Clings`], [/\bwind chime/, `${HL} > Outdoor & Gardening > Garden Decoration > Wind Chimes`], [/\bvase/, `${HD} > Home Accents > Vases`], [/\bstatue|figurine/, `${HD} > Home Accents > Statues`], [/\bpiggy bank|money box/, `${HD} > Home Accents > Piggy Banks`], [/\bbookend/, `${HD} > Home Accents > Bookends`], [/\bmirror/, `${HD} > Mirrors`], [/\bframe/, `${HD} > Picture Frames & Displays > Picture Frames`], [/\bcar (charm|hanging|mirror)|rearview/, `${EA} > Car Parts & Accessories > Car Accessories > Car Charms`], [/\bsuncatcher/, `${HD} > Wall Decor > Window Clings`], `${HD} > Home Accents`],
  'ev-priz': `${HL} > Lighting > Light Accessories > Light Switch & Outlet Covers`,
  'ev-lamba': [[/\bnight ?light/, `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Accent Lamps`], [/\bdesk lamp/, `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Desk Lamps`], [/\bfloor lamp/, `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Floor Lamps`], [/\blamp ?shade/, `${HL} > Lighting > Lamps, Shades & Bases > Lamp Shades`], [/\blantern/, `${HD} > Candles & Home Fragrances > Candleholders > Candle Lanterns`], `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Table Lamps`],
  'ev-dekor': [[/\bframe/, `${HD} > Picture Frames & Displays > Picture Frames`], [/\bphoto (block|stand|display)|display/, `${HD} > Picture Frames & Displays > Displays`], [/\btile/, `${HD} > Home Accents > Decorative Tiles`], [/\btray/, `${HD} > Decorative Storage > Decorative Trays`], [/\bbowl/, `${HD} > Decorative Storage > Decorative Bowls`], [/\bvase/, `${HD} > Home Accents > Vases`], [/\bstatue|figurine|sculpture/, `${HD} > Home Accents > Statues`], [/\bmirror/, `${HD} > Mirrors`], [/\bornament/, `${HD} > Seasonal Decor > Ornaments`], [/\bwall decal|wall sticker|mural/, `${HD} > Wall Decor > Wall Decals & Murals`], `${HD} > Home Accents`],
  'ev-kilif': [[/\bchair/, `${HD} > Chair Pads`], `${HL} > Furniture`],
  'ev-tabela': [[/\baddress|house number/, `${HD} > Wall Decor > Wall Hangings > Signs > Address Signs`], [/\bletter board/, `${HD} > Wall Decor > Wall Hangings > Signs > Letter Boards & Accessories`], [/\bmarquee|neon|led sign/, `${HD} > Wall Decor > Wall Hangings > Signs > Marquee Letters & Signs`], [/\byard sign|lawn sign/, `${HL} > Outdoor & Gardening > Garden Decoration > Yard Art`], [/\bdesk name|name plate/, `${HL} > Office > Desk Name Plates`], [/\blicense plate/, `${EA} > Car Parts & Accessories > Car Accessories > Decorative License Plates`], [/\bbanner|party sign/, 'Paper & Party Supplies > Party Supplies > Party Decor > Banners & Signs'], `${HD} > Wall Decor > Wall Hangings > Signs`],
  'ev-saklama': [[/\bbasket/, `${HL} > Storage & Organization > Baskets`], [/\bhamper|laundry/, `${HL} > Storage & Organization > Laundry Bags & Hampers > Hampers`], [/\btin\b/, `${HL} > Storage & Organization > Boxes & Bins > Tins`], [/\bjewelry box|trinket/, 'Jewelry > Jewelry Storage'], [/\bdesk|pen holder|organizer/, `${HL} > Office > Office & Desk Storage`], [/\btoy/, `${HL} > Storage & Organization > Toy Storage`], `${HL} > Storage & Organization > Boxes & Bins`],
  'ev-buzdolabi-magneti': `${KD} > Kitchen Decor > Refrigerator Magnets`,
  'ev-bahce': [[/\bflag/, 'pod-flags'], [/\bplanter|pot\b/, `${HL} > Outdoor & Gardening > Planters & Pots`], [/\bstake|marker/, `${HL} > Outdoor & Gardening > Plant Accessories > Plant Markers & Stakes`], [/\bbird ?house|bird feeder/, `${HL} > Outdoor & Gardening > Garden Decoration > Bird Feeders`], [/\bhammock/, `${HL} > Outdoor & Gardening > Hammocks & Swings`], [/\bpatio umbrella/, `${HL} > Outdoor & Gardening > Patio Furniture > Patio Umbrellas`], `${HL} > Outdoor & Gardening > Garden Decoration > Yard Art`],
  'ev-diger': HL,
  'duvar-kanvas': 'pod-canvas',
  'duvar-cerceveli': 'pod-framed',
  'duvar-poster': [[/\bmetal\b|aluminium|aluminum/, 'pod-metal'], [/\bcanvas\b/, 'pod-canvas'], [/\bacrylic\b/, 'pod-acrylic'], [/\b(photo|art) ?prints?\b|giclee|giclée|fine art/, `${ART} > Giclée`], 'pod-posters'],
  'duvar-metal': 'pod-metal',
  'duvar-akrilik': 'pod-acrylic',
  'duvar-ahsap': 'pod-wood',
  'duvar-duvar-halisi': `${HD} > Wall Decor > Wall Hangings > Tapestries`,
  'duvar-sticker': [[/\bwindow/, `${HD} > Wall Decor > Window Clings`], [/\bwallpaper/, `${HD} > Wall Decor > Wallpaper`], `${HD} > Wall Decor > Wall Decals & Murals`],
  'kirtasiye-sticker': [[/\bbumper/, `${PPS} > Stickers, Labels & Tags > Bumper Stickers`], [/\blabel/, `${PPS} > Stickers, Labels & Tags > Labels`], [/\bcling/, `${PPS} > Stickers, Labels & Tags > Clings`], [/\blaptop (skin|decal)/, `${EA} > Decals & Skins > Laptop > Laptop Decals`], [/\btag\b|hang tag/, `${PPS} > Stickers, Labels & Tags > Tags`], `${PPS} > Stickers, Labels & Tags > Stickers`],
  'kirtasiye-defter': [[/\bplanner/, `${PPS} > Calendars & Planners`], [/\bnotepad|sticky note|memo pad/, `${PPS} > Stationery > Notepads`], [/\bjournal|sketchbook|diary/, 'Books, Movies & Music > Books > Blank Books > Journals & Notebooks'], [/\bphoto ?book|\bphotobook|\bbooks?\b/, 'Books, Movies & Music > Books'], 'Books, Movies & Music > Books > Blank Books > Journals & Notebooks'],
  'kirtasiye-kart': [[/\bpostcard/, `${PPS} > Stationery > Postcards`], [/\bbusiness card/, `${PPS} > Stationery > Business & Calling Cards`], [/\binvitation/, `${PPS} > Invitations & Announcements > Invitations`], [/\bthank you/, `${PPS} > Greeting Cards > Thank You Cards`], [/\bbirthday/, `${PPS} > Greeting Cards > Birthday Cards`], [/\bchristmas|holiday/, `${PPS} > Greeting Cards > Holiday & Seasonal Cards > Christmas Cards`], [/\bnote card|flat card/, `${PPS} > Stationery > Note Cards`], [/\bbookmark/, 'Books, Movies & Music > Books > Book Accessories > Bookmarks'], [/\brecipe/, `${PPS} > Stationery > Recipe Cards`], [/\bphoto ?card|trading card|photocard/, 'Art & Collectibles > Artist Trading Cards'], `${PPS} > Greeting Cards`],
  'kirtasiye-takvim': [[/\bdesk/, `${PPS} > Calendars & Planners > Desk Calendars`], [/\badvent/, `${PPS} > Calendars & Planners > Advent Calendars`], `${PPS} > Calendars & Planners > Wall Calendars`],
  'kirtasiye-ambalaj': [[/\bwrapping paper|gift wrap/, `${PPS} > Gift Wrapping > Wrapping Paper & Furoshiki > Gift Wrap`], [/\btissue/, `${PPS} > Gift Wrapping > Tissue Paper`], [/\bgift box/, `${PPS} > Gift Wrapping > Gift Boxes`], [/\bmailer|shipping box|mailing box/, `${PPS} > Mailers & Mailing > Mailing Boxes`], [/\benvelope/, `${PPS} > Mailers & Mailing > Envelopes`], [/\bwashi|tape/, `${PPS} > Gift Wrapping > Washi Tape`], [/\bbag/, `${PPS} > Gift Wrapping > Party & Gift Bags > Gift Bags`], `${PPS} > Gift Wrapping`],
  'kirtasiye-kalem': [[/\bpencil case|pen case/, `${BP} > Pouches & Coin Purses`], `${HL} > Office > Office & School Supplies`],
  'teknoloji-telefon-kilifi': [[/\btablet|ipad|kindle/, `${EA} > Electronics Cases > Tablet & E-Reader Cases`], `${EA} > Electronics Cases > Phone Cases`],
  'teknoloji-airpods': 'pod-airpods',
  'teknoloji-mousepad': `${EA} > Computers & Peripherals > Keyboards & Mice > Mousepads`,
  'teknoloji-tutucu': [[/\bcharm|strap/, `${EA} > Cell Phone Accessories > Plugs & Charms`], 'pod-phone-grips'],
  'teknoloji-cihaz-kaplama': [[/\blaptop/, `${EA} > Decals & Skins > Laptop > Laptop Skins`], [/\bphone|iphone|samsung/, `${EA} > Decals & Skins > Phone > Phone Skins`], [/\b(switch|playstation|ps5|xbox|controller|console)\b/, `${EA} > Video Games > Parts & Modifications`], `${EA} > Decals & Skins`],
  'oyun-puzzle': [[/\b3d\b/, `${TG} > Games & Puzzles > Puzzles > 3D Puzzles`], [/\bname puzzle/, `${TG} > Games & Puzzles > Puzzles > Name Puzzles`], `${TG} > Games & Puzzles > Puzzles > Jigsaw Puzzles`],
  'oyun-kart': [[/\btarot|oracle/, 'Home & Living > Spirituality & Religion > Divination Tools > Tarot'], [/\btrading card|tcg/, `${TG} > Games & Puzzles > Card Games > Trading Card Games`], [/\bflash ?card/, `${PPS} > Stationery > Design & Templates > Flashcards`], `${TG} > Games & Puzzles > Card Games > Standard Card Decks`],
  'oyun-masa': [[/\bchess/, `${TG} > Games & Puzzles > Board Games > Chess`], [/\bbingo/, `${TG} > Games & Puzzles > Board Games > Bingo`], [/\bdice/, `${TG} > Games & Puzzles > Dice & Tile Games > Dice`], [/\bdomino/, `${TG} > Games & Puzzles > Dice & Tile Games > Tile Games > Dominoes`], [/\bdart/, `${TG} > Games & Puzzles > Game Room > Darts`], [/\bcornhole/, `${TG} > Sports & Outdoor Recreation > Lawn Games > Cornhole`], [/\bgame mat|playmat|play mat/, `${TG} > Games & Puzzles > Game Pieces`], `${TG} > Games & Puzzles > Board Games`],
  'oyun-pelus': [[/\bbear/, `${TG} > Toys > Stuffed Animals & Plushies > Bears`], [/\bcat\b/, `${TG} > Toys > Stuffed Animals & Plushies > Cats`], [/\bdog\b/, `${TG} > Toys > Stuffed Animals & Plushies > Dogs`], [/\bunicorn/, `${TG} > Toys > Stuffed Animals & Plushies > Unicorns`], [/\bdoll\b/, `${TG} > Toys > Dolls & Action Figures`], `${TG} > Toys > Stuffed Animals & Plushies`],
  'oyun-sanat': [[/\bcoloring|paint by number|diamond painting/, `${TG} > Toys > Learning & School`], `${TG} > Toys`],
  'arac-aksesuar': [[/\bseat cover/, `${EA} > Car Parts & Accessories > Car Accessories > Seat Covers`], [/\bsteering/, `${EA} > Car Parts & Accessories > Car Accessories > Steering Wheel Covers`], [/\b(floor )?mats?\b/, 'pod-car-mats'], [/\bsun ?shade|windshield/, 'pod-sunshades'], [/\bcoaster/, `${EA} > Car Parts & Accessories > Car Accessories > Car Coasters`], [/\blicense plate (frame|cover|holder)/, `${EA} > Car Parts & Accessories > Car Accessories > License Plate Covers & Frames`], [/\blicense plate/, `${EA} > Car Parts & Accessories > Car Accessories > Decorative License Plates`], [/\bair freshener/, `${EA} > Car Parts & Accessories > Car Accessories > Car Air Fresheners`], [/\bkey ?fob/, `${EA} > Car Parts & Accessories > Car Accessories > Key Fob Covers`], [/\bcharm|hanging|mirror/, `${EA} > Car Parts & Accessories > Car Accessories > Car Charms`], [/\bmagnet|decal|sticker/, `${PPS} > Stickers, Labels & Tags > Bumper Stickers`], `${EA} > Car Parts & Accessories > Car Accessories`],
  'spor-yoga': [[/\bbag/, `${BP} > Sports Bags > Yoga Bags`], `${TG} > Sports & Outdoor Recreation > Fitness & Exercise > Yoga & Pilates > Yoga`],
  // piknik örtüsü oyuncak değil; kum/su oyuncağı yalnızca "toy" yazanlar
  'spor-plaj': [[/\btowel/, `${HL} > Bathroom > Beach Towels`], [/\bbag/, `${BP} > Sports Bags > Beach Bags`], [/\bball/, `${TG} > Sports & Outdoor Recreation > Balls`], [/\btoys?\b|\bsand\b/, `${TG} > Sports & Outdoor Recreation > Boating & Water Sports > Sand & Water Toys`], [/\bpicnic|blanket|mat\b/, `${HL} > Outdoor & Gardening`], `${HL} > Outdoor & Gardening`],
  // "Golf ve Spor Ekipmanı" türü: her sporu kendi Etsy dalına
  'spor-golf': [[/\bbag/, `${BP} > Sports Bags > Tennis & Golf Bags > Golf Bags`], [/\bshoe|cleat/, 'Shoes > Gender-Neutral Adult Shoes > Sneakers & Athletic Shoes > Golf Shoes & Cleats'], [/\bpolo|shirt/, "Clothing > Men's Clothing > Shirts & Tees > Polos"], [/\bhat|cap|visor/, `${AC} > Hats & Head Coverings > Hats & Caps`],
    [/\bgolf|club head|head cover/, `${TG} > Sports & Outdoor Recreation > Golf`], [/\bbasketball/, `${TG} > Sports & Outdoor Recreation > Team Sports > Basketball`], [/\bbaseball/, `${TG} > Sports & Outdoor Recreation > Team Sports > Baseball`], [/\bsoftball/, `${TG} > Sports & Outdoor Recreation > Team Sports > Softball`],
    [/\b(soccer|football)/, `${TG} > Sports & Outdoor Recreation > Team Sports > Soccer`], [/\brugby/, `${TG} > Sports & Outdoor Recreation > Team Sports`], [/\bvolleyball/, `${TG} > Sports & Outdoor Recreation > Team Sports > Volleyball`], [/\bhockey/, `${TG} > Sports & Outdoor Recreation > Team Sports > Hockey`],
    [/\b(tennis|pickleball|ping pong|table tennis|paddle|racket|racquet)/, `${TG} > Sports & Outdoor Recreation > Racquet Sports`], [/\bskate ?board/, `${TG} > Sports & Outdoor Recreation > Skateboarding`], [/\bbike|bicycle|cycling/, `${TG} > Sports & Outdoor Recreation > Bikes & Cycling`],
    [/\b(dog|pet)\b.*\bfrisbee|frisbee.*\b(dog|pet)\b/, `${PET} > Pet Toys > Dog Toys`], [/\bfrisbee|flying disc/, `${TG} > Sports & Outdoor Recreation > Flying Toys`], `${TG} > Sports & Outdoor Recreation`],
  'spor-kamp': [[/\bhammock/, `${HL} > Outdoor & Gardening > Hammocks & Swings`], [/\bchair/, `${HL} > Outdoor & Gardening > Patio Furniture`], [/\bstubby|can cooler/, `${DW} > Cozies > Can Cozies`], [/\bcooler/, `${HL} > Outdoor & Gardening > Coolers`], `${TG} > Sports & Outdoor Recreation > Camping`],
};

// çocuk giyimi: ürün kelimesinden tür, kız/erkek/bebek ayrımıyla
// çocuk giyiminde asıl ürün kelimesinin alt kategorisi ("Kid's Crewneck T-Shirt" sweatshirt değil)
const KID_SUB = { 'giyim-tisort': 'Tops & Tees > T-shirts', 'giyim-kapusonlu': 'Hoodies & Sweatshirts > Hoodies', 'giyim-sweatshirt': 'Hoodies & Sweatshirts > Sweatshirts', 'giyim-ceket': 'Jackets & Coats', 'giyim-yelek': 'Vests', 'giyim-elbise': 'Dresses', 'giyim-etek': 'Skirts & Kilts', 'giyim-pantolon': 'Pants', 'giyim-sort': 'Shorts', 'giyim-tayt': 'Leggings', 'giyim-atlet': 'Tops & Tees > Tanks', 'giyim-polo': 'Tops & Tees > Polos', 'giyim-pijama': 'Pajamas & Robes > Pajamas', 'giyim-ust': 'Tops & Tees', 'giyim-mayo': 'Swimwear', 'giyim-corap': 'Socks & Leg Warmers > Socks', 'giyim-forma': 'Sports & Fitness' };
const KIDS = [
  [/\bone[- ]piece\b/, 'Bodysuits'],
  [/\b(onesie|bodysuit|creeper)\b/, 'Bodysuits'], [/\b(rompers?|jumpsuits?|footies?)\b/, 'Footies & Rompers'], [/\bhoodie|hooded/, 'Hoodies & Sweatshirts > Hoodies'],
  [/\bsweatshirt|crewneck|pullover/, 'Hoodies & Sweatshirts > Sweatshirts'], [/\bdress\b/, 'Dresses'], [/\bskirt/, 'Skirts & Kilts'], [/\bpajama|pyjama|sleepwear|pj\b/, 'Pajamas & Robes > Pajamas'],
  [/\brobe|bathrobe/, 'Pajamas & Robes > Robes'], [/\bleggings?/, 'Leggings'], [/\bshorts\b/, 'Shorts'], [/\b(pants|joggers?|sweatpants)\b/, 'Pants'], [/\bjacket|coat|cape/, 'Jackets & Coats'],
  [/\bswim/, 'Swimwear'], [/\bsocks?\b/, 'Socks & Leg Warmers > Socks'], [/\bsweater|cardigan/, 'Sweaters'], [/\bpolo\b/, 'Tops & Tees > Polos'], [/\btank\b/, 'Tops & Tees > Tanks'],
  [/\bjersey|uniform|sport/, 'Sports & Fitness'], [/\bvest\b/, 'Vests'], [/\b(set|outfit)\b/, 'Clothing Sets'], [/\bt-?shirt|tee\b|tees\b|shirt/, 'Tops & Tees > T-shirts'], [/./, 'Tops & Tees'],
];
// Etsy'de kız/erkek/bebek dallarında alt kategori adları farklı
const KID_FIX = { girl: { Pants: 'Pants & Capris', 'Skirts & Kilts': 'Skirts', 'Pajamas & Robes > Pajamas > Tops': 'Pajamas & Robes > Pajamas > Night Gowns & Tops', 'Socks & Hosiery > Casual Socks': 'Socks & Leg Warmers > Socks' }, boy: { 'Socks & Hosiery > Casual Socks': 'Socks & Leg Warmers > Socks' }, kid: { Dresses: "Clothing > Girls' Clothing > Dresses" } };
const BABY_FIX = { 'Sports & Fitness': 'Clothing Sets', Dresses: "Clothing > Girls' Clothing > Baby Girls' Clothing", Leggings: 'Pants', 'Tops & Tees > Tanks': 'Tops', 'Tops & Tees > Polos': 'Tops', 'Tops & Tees > T-shirts': 'Tops', 'Tops & Tees': 'Tops', 'Hoodies & Sweatshirts > Hoodies': 'Hoodies & Sweatshirts', 'Hoodies & Sweatshirts > Sweatshirts': 'Hoodies & Sweatshirts', 'Footies & Rompers': 'Bodysuits', 'Socks & Leg Warmers > Socks': 'Socks & Leg Warmers > Socks', 'Clothing Sets': 'Clothing Sets' };

function clothingPath(spec, w) {
  if (spec.forceWho) w = spec.forceWho;
  const sub = spec[w] ?? (['girl', 'boy', 'baby'].includes(w) ? spec.kid : null) ?? spec.u;
  const fixed = w === 'baby' ? (BABY_FIX[sub] || sub) : (KID_FIX[w]?.[sub] || sub);
  if (fixed.startsWith('Clothing > ')) return fixed;
  return `${ROOT[w]} > ${fixed}`;
}
function shoesPath(spec, w) {
  let sub = spec[w] ?? (['girl', 'boy', 'baby'].includes(w) ? spec.kid : null) ?? spec.u;
  // çocuk ayakkabısında Etsy'de yalnızca ana türler var
  if (['kid', 'girl', 'boy', 'baby'].includes(w)) sub = { Clogs: 'Clogs & Mules' }[sub.split(' > ')[0]] || sub.split(' > ')[0];
  return `${SHOE[w]} > ${sub}`;
}

// --- "Diğer" ürünler: başlık kelimeleri Etsy düğüm adıyla eşleşirse en derin/en uzun eşleşme
const STOP = new Set(['and', 'the', 'of', 'for', 'with', 'a', 'an', 'in', 'on', 'other', 'accessories', 'supplies', 'sets', 'set', 'kits', 'kit']);
const sing = w => w.replace(/(ies)$/, 'y').replace(/(ches|shes|xes|sses)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const words = s => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean).map(sing);
const SKIP_TOP = new Set(['Weddings', 'Craft Supplies & Tools']);
const GENERIC = new Set(['acrylic', 'accordion', 'pick', 'liner', 'herb', 'ladder', 'color', 'slip', 'embroidery', 'linen', 'chain', 'display', 'oil', 'glass', 'shape', 'cover', 'block', 'vehicle', 'bone', 'table', 'card', 'game', 'light', 'paper', 'film', 'music', 'phone', 'face', 'eye', 'lip', 'nail', 'tool', 'paint', 'candy', 'coffee', 'moss', 'sculpture', 'collectible', 'animal', 'trunk', 'sleeve', 'bottom', 'top', 'set', 'pot', 'filter', 'lens', 'door', 'window', 'lock', 'hardware', 'ribbon', 'bell', 'triangle', 'whistle', 'combination', 'computer', 'keyboard', 'drum', 'guitar', 'piano', 'pedal', 'lighter', 'souvenir', 'toy', 'ball', 'sponge', 'bowl', 'tray', 'trays', 'sign', 'label', 'tag', 'box', 'bag', 'mat', 'pad', 'cloth', 'sheet']);
const LEAF_ALTS = [];
for (const n of nodes.values()) {
  if (SKIP_TOP.has(n.path[0])) continue;
  // tek kelimelik eşleşme yalnızca adı tek parça olan düğümlerde ("Candles", "Vases"); "Acrylic & Press On Nails"
  // içindeki "Acrylic" her akrilik ürünü oje yapıyordu
  const alts = n.label.split(/\s*(?:&|,| and )\s*/);
  for (const alt of alts) {
    const ws = words(alt).filter(w => !STOP.has(w));
    if (!ws.length || (ws.length === 1 && (alts.length > 1 || ws[0].length < 4 || GENERIC.has(ws[0])))) continue;
    LEAF_ALTS.push({ id: n.id, ws, depth: n.depth });
  }
}
function guess(text) {
  const tw = new Set(words(text));
  let best = null;
  for (const a of LEAF_ALTS) {
    if (!a.ws.every(w => tw.has(w))) continue;
    const score = a.ws.length * 10 + a.depth;
    if (!best || score > best.score) best = { id: a.id, score };
  }
  return best && best.id;
}

// pod-taxonomy'nin bilinen hataları: "glass" telefon kılıfı, kılıf bardak değil
const OVERRIDE = [
  [/\b(glasses|eyeglass|sunglasses?|spectacles?) (cloth )?cases?\b/, `${AC} > Sunglasses & Eyewear > Glasses Cases`],
  [/\b(phone|iphone|samsung|galaxy|pixel|huawei|xiaomi|oneplus)\b.*\b(cases?|covers?)\b|\bcases?\b.*\b(iphone|samsung|galaxy|huawei)\b|\bphone cases?\b/, `${EA} > Electronics Cases > Phone Cases`],
  [/\bsun ?catcher\b|\bstained[- ]glass\b|\bglass award\b|\baward\b/, `${HD} > Home Accents`],
  [/\bornaments?\b/, `${HD} > Seasonal Decor > Ornaments`],
  [/\b(glass )?(chopping|cutting) boards?\b/, `${KD} > Cookware > Cutting Boards`],
  [/\b(night ?light|led light|moon light|moon lamp)\b/, `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Accent Lamps`],
  [/\bcandles?\b(?!.*\bholders?\b)/, `${HD} > Candles & Home Fragrances > Candles > Container Candles`],
  [/\b(bottle|tumbler|can) (sleeve|cooler|koozie|cozy)\b/, `${DW} > Cozies > Bottle Cozies`],
  [/\b(lipstick|lip gloss|lip balm)\b/, 'Bath & Beauty > Makeup & Cosmetics > Lips > Lip Color'],
  [/\b(shampoo|conditioner)\b/, 'Bath & Beauty > Hair Care'],
  [/\b(serum|moisturi[sz]er|cleanser|hydrator|toner|face cream|body lotion|sunscreen|sun balm)\b/, 'Bath & Beauty > Skin Care'],
  [/\b(eyeshadow|eye shadow|mascara|lash|eyeliner|brow)\b/, 'Bath & Beauty > Makeup & Cosmetics > Eyes'],
  [/\b(lip stain|lip ?liner|lip oil)\b/, 'Bath & Beauty > Makeup & Cosmetics > Lips > Lip Color'],
  [/\b(foundation|concealer|bronzer|blush|highlighter|primer|setting spray|shimmer|blender|makeup sponge)\b/, 'Bath & Beauty > Makeup & Cosmetics > Face'],
  [/\b(cologne|perfume|fragrance mist|body mist)\b/, 'Bath & Beauty > Fragrances'],
  [/\b(sun stick|tanning|essence|mucin|sea spray|skincare|skin care|self tan)\b/, 'Bath & Beauty > Skin Care'],
  [/\bfabric\b.*\(1 ?m\)|\bfabric \(|\b(jersey|minky|satin|chiffon|twill|velveteen|mesh) fabric\b/, 'Craft Supplies & Tools > Fabric & Notions > Fabric'],
  [/\bphoto ?cards?\b/, 'Art & Collectibles > Artist Trading Cards'],
  [/\b(canson|hahnem[uü]hle|moab|epson hot press|archival matte|fine art paper|aquarelle|rag photographique|platine)\b/, 'Art & Collectibles > Prints > Giclée'],
  [/\b(foam ?core|foam ?board|dibonds?|gallery boards?|art boards?|lenticular)\b/, 'Art & Collectibles > Prints'],
  [/\bcanvases\b/, 'pod-canvas'],
  [/\beasel\b/, `${HD} > Picture Frames & Displays > Displays`],
  [/\b(flower box|rose box|eternal flower|simulation flower)\b/, `${HD} > Flower Arrangements`],
  [/\bpennants?\b/, 'Paper & Party Supplies > Party Supplies > Party Decor > Banners & Signs'],
  [/\b(christmas )?baubles?\b/, `${HD} > Seasonal Decor > Ornaments`],
  [/\bmouse ?mats?\b/, `${EA} > Computers & Peripherals > Keyboards & Mice > Mousepads`],
  [/\bkeycaps?\b/, `${EA} > Computers & Peripherals > Keyboards & Mice`],
  [/\bdiaries\b|\bdiary\b/, 'Books, Movies & Music > Books > Blank Books > Journals & Notebooks'],
  [/\b(albums?|proofbooks?|layflat|photo ?books?)\b/, 'Craft Supplies & Tools > Canvas & Surfaces > Journals & Albums > Albums > Photo Albums'],
  [/\bpeignoir\b/, "Clothing > Women's Clothing > Pajamas & Robes > Robes"],
  [/\b(pareo|sarong)\b/, "Clothing > Women's Clothing > Swimwear > Cover-Ups"],
  [/\bsnapbacks?\b/, `${AC} > Hats & Head Coverings > Hats & Caps`],
  [/\bsling (pack|bag)\b|\bmatte sling\b/, `${BP} > Handbags > Crossbody Bags`],
  [/\b(everyday|hatch|penryn) pack\b|^pack$/, `${BP} > Backpacks`],
  [/\b(door ?mats?|welcome mat|fu(ss|ß)matte)\b/, `${HL} > Floor & Rugs > Door Mats`],
  [/\bcar (foot |floor |rear seat )?mats?\b/, 'pod-car-mats'],
  [/\bsunshade\b/, 'pod-sunshades'],
  [/\b(plushie|plush)\b/, `${TG} > Toys > Stuffed Animals & Plushies`],
  [/\bouija\b/, `${HL} > Spirituality & Religion > Divination Tools > Talking Boards`],
  [/\b(canasta|rummy) mat\b/, `${TG} > Games & Puzzles > Card Games`],
  [/\bgrowth chart\b/, `${HD} > Wall Decor`],
  [/\bsashes\b/, 'Weddings > Accessories > Belts & Sashes'],
  // Türkçe / Almanca başlıklar (Printiturk, Printegy, Shirtigo)
  [/\b(ti[sş][oö]rt)\b/, 'TR-TEE'], [/\bsweat\b/, 'TR-SWEAT'],
  [/\b(kupa|tasse|thermobecher)\b/, `${DW} > Mugs`], [/\bthermoflasche\b/, `${DW} > Water Bottles`],
  [/\b(sırt çantası|sirt cantasi|turnbeutel)\b/, `${BP} > Sports Bags > Team Sports & Gym Bags`], [/\b(bez çanta|bez canta)\b/, 'pod-tote-bags'],
  [/\b(önlüğü|onlugu)\b/, `${AC} > Aprons`], [/\byast[ıi]k k[ıi]l[ıi]f[ıi]\b/, `${HD} > Throw Pillows`], [/\bz[ıi]b[ıi]n\b/, "Clothing > Gender-Neutral Kids' Clothing > Gender-Neutral Baby Clothing > Bodysuits"],
  [/\bm[uü]tze\b/, `${AC} > Hats & Head Coverings > Hats & Caps`], [/\bbadehose\b/, "Clothing > Men's Clothing > Swimwear"], [/\bgeldb[oö]rse\b/, `${BP} > Wallets & Money Clips > Wallets`],
  [/\bspardose\b/, `${HD} > Home Accents > Piggy Banks`], [/\bhundehalstuch\b/, `${PET} > Pet Clothing, Accessories & Shoes > Pet Accessories > Pet Neckwear`],
  // model adıyla satılan boş tişört/hoodie'ler (Teelabs, Tshirtgang)
  [/\b(ikuka|john jr\+?) \d{3} zipper\b|\bzipper\b(?!.*\b(pouch|bag|charm)\b)/, 'ZIP'],
  [/\b(ikuka|john jr\+?|supima mercerized|promotion) ?\d{3}\b|\bround neck promotion\b|\bringer\b/, 'TEE'],
  [/\b(half|1 2|quarter|1 4)[- ]zip\b/, 'SWEAT'],
  [/\bhenley\b|\bwaffle thermal\b/, 'TEE'],
];
const OVERRIDE_CLOTH = { TEE: C('Tops & Tees > T-shirts', { m: 'Shirts & Tees > T-shirts' }), SWEAT: C('Hoodies & Sweatshirts > Sweatshirts'), ZIP: C('Hoodies & Sweatshirts > Hoodies'),
  'TR-TEE': C('Tops & Tees > T-shirts', { m: 'Shirts & Tees > T-shirts' }), 'TR-SWEAT': C('Hoodies & Sweatshirts > Sweatshirts') };

// --- asıl ürün kelimesi (18 Eki 2026 denetimi): başlığın ana kısmındaki SON ürün adı türü belirler.
// pod-taxonomy başlıktaki herhangi bir kelimeye bakıyordu: "Stand Collar Jacket" tasma, "Window Curtain (2-Piece)" takım,
// "Maxi Skirt" elbise, "Tumbler with Top Handle" bluz, "Floor Lamp Shade with Ring" yüzük oluyordu.
const WEAR = ['cocuk-giyim', 'bebek-body', 'evcil-kiyafet'];
const HEAD = [
  [/\b(t-?shirts?|tees?|tshirts?)\b/, 'giyim-tisort', ['giyim-uzun-kollu', 'giyim-raglan', 'giyim-crop', 'giyim-pijama', 'giyim-takim', 'giyim-atlet']],
  [/\bhood(ie|y|ies)\b/, 'giyim-kapusonlu', ['giyim-fermuarli-kapusonlu', 'giyim-pijama', 'giyim-takim', 'giyim-crop']],
  [/\bsweatshirts?\b/, 'giyim-sweatshirt', ['giyim-kapusonlu', 'giyim-fermuarli-kapusonlu', 'giyim-crop']],
  [/\b(jackets?|coats?|windbreakers?|parkas?|bombers?|blazers?)\b/, 'giyim-ceket', ['giyim-takim']],
  [/\bvests?\b/, 'giyim-yelek', ['giyim-mayo']],
  [/\bdress(es)?\b(?! (shirt|socks|shoes))/, 'giyim-elbise', ['giyim-pijama']],
  [/\btree skirts?\b/, `${HD} > Seasonal Decor > Tree Skirts`, []],
  [/\btable runners?\b/, `${KD} > Linens > Table Linens > Table Runners`, []],
  [/\b(hip )?flasks?\b/, `${KD} > Drink & Barware > Barware > Flasks`, []],
  [/\b(lapel|enamel|button|pinback) pins?\b/, 'aksesuar-rozet', []],
  [/\bpropane tank covers?\b|\btank covers?\b/, `${HL} > Outdoor & Gardening > Grills & Accessories`, []],
  [/\b(cell )?phone (ring|grip|holder|stand)s?\b|\bring holders?\b/, 'pod-phone-grips', []],
  [/\bbadge reels?\b/, `${AC} > Keychains & Lanyards > Badge Reels`, []],
  [/\bbridal veils?\b|\bveils?\b/, `${AC} > Hats & Head Coverings > Veils`, []],
  [/\bbookends?\b/, `${HD} > Home Accents > Bookends`, []],
  [/\bcornhole\b/, `${TG} > Sports & Outdoor Recreation > Lawn Games > Cornhole`, []],
  [/\bmahjong (mats?|tiles?|sets?|racks?)\b/, `${TG} > Games & Puzzles > Dice & Tile Games > Tile Games > Mahjong`, []],
  [/\bjewe?l(le)?ry (box(es)?|cases?|organi[sz]ers?)\b|\btrinket (box(es)?|dish(es)?|trays?)\b/, 'Jewelry > Jewelry Storage', []],
  [/\b(snapsuits?|onesies?|creepers?)\b/, 'bebek-body', ['cocuk-giyim', 'giyim-pijama']],
  [/\btoques?\b/, 'aksesuar-sapka', []],
  [/\b(power ?banks?|chargers?|charging (pad|stand|station)s?)\b/, `${EA} > Batteries & Charging > Chargers`, []],
  [/\b(christmas |santa |holiday |xmas )stockings?\b/, `${HD} > Seasonal Decor > Stockings`, []],
  [/\b(?<!tree )skirts?\b/, 'giyim-etek', []],
  [/\b(cutlery|flatware|utensils?)( sets?)?\b/, `${KD} > Cookware > Cutlery & Knives > Cutlery`, []],
  [/\bscrunchies?\b/, `${AC} > Hair Accessories > Hair Ties & Elastics`, []],
  [/\b(oven|microwave|insulated|heat[- ]resistant|bbq|grill) (gloves?|mitts?)\b|\boven mitts?\b|\bpot ?holders?\b/, `${KD} > Cookware > Trivets & Pot Holders > Pot Holders`, []],
  [/\b(travel|weekender|duffel|duffle|gym) bags?\b/, 'canta-seyahat', ['canta-sirt', 'canta-diger']],
  [/\bbags?\b/, 'canta-diger', ['canta-bez', 'canta-sirt', 'canta-buzgulu', 'canta-bel', 'canta-kozmetik', 'canta-beslenme', 'canta-laptop', 'canta-seyahat', 'canta-el-omuz', 'kirtasiye-ambalaj', 'spor-yoga', 'spor-golf', 'spor-plaj', 'ev-saklama', 'aksesuar-cuzdan', 'evcil-diger', 'mutfak-diger', 'teknoloji-telefon-kilifi']],
  [/\b(pants|joggers?|sweatpants|trousers)\b/, 'giyim-pantolon', ['giyim-pijama', 'giyim-takim']],
  [/\bshorts\b|\bshort$/, 'giyim-sort', ['giyim-pijama', 'giyim-mayo', 'giyim-ic-giyim', 'giyim-takim']],
  [/\bleggings?\b/, 'giyim-tayt', ['giyim-takim']],
  [/\btank( tops?)?s?\b/, 'giyim-atlet', ['giyim-crop', 'giyim-mayo']],
  [/\b(?<!water )polos?\b(?! (suit|brief|cap|towel))/, 'giyim-polo', ['spor-golf', 'giyim-elbise']],
  [/\b(pajamas?|pyjamas?|pj sets?|nightgowns?|robes?)\b/, 'giyim-pijama', ['giyim-takim', 'giyim-elbise']],
  [/\bshirts?\b/, 'giyim-ust', ['giyim-tisort', 'giyim-uzun-kollu', 'giyim-gomlek', 'giyim-polo', 'giyim-raglan', 'giyim-forma', 'giyim-crop', 'giyim-atlet', 'giyim-pijama', 'giyim-takim', 'giyim-mayo', 'giyim-sweatshirt', 'giyim-kapusonlu', 'spor-golf']],
  [/\bjerseys?\b/, 'giyim-forma', ['giyim-tisort', 'giyim-polo', 'giyim-atlet', 'giyim-sort', 'giyim-takim', 'giyim-uzun-kollu', 'giyim-crop']],
  [/\b(swimsuits?|bikinis?|swim trunks|swimwear|tankinis?|monokinis?)\b/, 'giyim-mayo', ['giyim-ic-giyim']],
  [/\b(face )?masks?\b/, 'aksesuar-maske', []],
  [/\b(gloves?|mittens?|mitts?)\b/, 'aksesuar-eldiven', ['mutfak-diger']],
  [/\baprons?\b/, 'giyim-onluk', []],
  [/\b(pillows?|cushions?)\b(?! ?(case|cover))/, 'ev-yastik', ['evcil-yatak']],
  [/\b(pillow ?cases?|pillow covers?|cushion covers?)\b/, 'ev-yastik', []],
  [/\b(blankets?|throws?)\b/, 'ev-battaniye', ['bebek-battaniye', 'evcil-yatak']],
  [/\btowels?\b/, 'ev-havlu', ['spor-plaj', 'mutfak-diger']],
  [/\bcurtains?\b/, 'ev-perde', []],
  [/\b(duvet( covers?)?|comforters?|bedding sets?|sheet sets?|bed sheets?)\b/, 'ev-nevresim', []],
  [/\b(rugs?|door ?mats?)\b/, 'ev-hali', []],
  [/\btote( bags?)?s?\b/, 'canta-bez', []],
  [/\bbackpacks?\b/, 'canta-sirt', []],
  [/\blunch ?(bags?|box(es)?)\b/, 'canta-beslenme', ['canta-buzgulu']],
  [/\bmugs?\b/, 'mutfak-kupa', ['mutfak-termos']],
  [/\btumblers?\b/, 'mutfak-termos', ['mutfak-kupa', 'mutfak-bardak', 'ev-mum']],
  [/\b(water )?bottles?\b(?! (opener|sleeves?|stoppers?))/, 'mutfak-matara', ['mutfak-sogutucu', 'ev-mum', 'mutfak-diger', 'duvar-poster', 'ev-dekor']],
  [/\b(lamps?|lamp ?shades?|night ?lights?)\b/, 'ev-lamba', []],
  [/\bcandle ?holders?\b|\bcandlesticks?\b|\btea ?light holders?\b/, `${HD} > Candles & Home Fragrances > Candleholders`, []],
  [/\bstickers?\b/, 'kirtasiye-sticker', ['duvar-sticker', 'arac-aksesuar']],
  [/\b(mouse ?pads?|mouse ?mats?|desk ?pads?|desk ?mats?)\b/, 'teknoloji-mousepad', []],
  [/\b(keychains?|key ?rings?)\b/, 'aksesuar-anahtarlik', []],
  [/\bluggage (hang )?tags?\b|\bbag tags?\b/, `${BP} > Luggage & Travel > Luggage Tags`, []],
  [/\blicense plate (frames?|covers?)\b/, `${EA} > Car Parts & Accessories > Car Accessories > License Plate Covers & Frames`, []],
  [/\bpencil (cases?|pouch(es)?|bags?)\b/, `${BP} > Pouches & Coin Purses`, []],
  [/\bearrings?\b/, 'Jewelry > Earrings > Dangle & Drop Earrings', []],
  [/\b(necklaces?|pendants?|bracelets?|bangles?|anklets?)\b(?! light)/, 'aksesuar-taki', []],
  [/\b(signs?|plaques?)\b/, 'ev-tabela', ['ev-dekor', 'ev-bahce']],
  [/\b(pet|dog|cat) beds?\b/, 'evcil-yatak', []],
  [/\bplace ?mats?\b/, `${KD} > Linens > Table Linens > Placemats`, []],
  [/\bbibs?\b/, 'bebek-onluk', []],
  [/\b(makeup|cosmetic|toiletry) (bags?|pouch(es)?|cases?)\b/, 'canta-kozmetik', []],
  [/\bmagnets?\b/, 'ev-buzdolabi-magneti', ['kirtasiye-sticker', 'arac-aksesuar']],
  [/\bclocks?\b/, 'ev-saat', []],
  [/\blicense plates?( holders?| frames?| covers?)?\b/, 'arac-aksesuar', []],
  [/\b(cutting|chopping|charcuterie|cheese) boards?\b/, 'mutfak-kesme-tahtasi', []],
  [/\bwallets?\b/, 'aksesuar-cuzdan', []],
  [/\b(fanny packs?|belt bags?|waist bags?|bum bags?)\b/, 'canta-bel', []],
  [/\bshoe ?laces?( tags?)?\b/, 'aksesuar-ayakkabi', []],
  [/\b(playing|poker|tarot|oracle|trading|flash|game) cards?\b/, 'oyun-kart', []],
  [/\b(greeting |folded |flat |note |gift )?cards?\b(?! (holder|case|wallet|stock))/, 'kirtasiye-kart', ['oyun-kart', 'aksesuar-cuzdan', 'kirtasiye-defter', 'oyun-masa', 'kirtasiye-takvim']],
  [/\bslippers?\b/, 'ayakkabi-terlik', []],
  [/\b(sneakers?|shoes)\b(?! (bag|lace|charm))/, 'ayakkabi-sneaker', ['ayakkabi-bot', 'ayakkabi-terlik', 'spor-golf']],
  [/\bornaments?\b/, `${HD} > Seasonal Decor > Ornaments`, []],
  [/\b(jigsaw )?puzzles?\b/, 'oyun-puzzle', []],
  [/\bposters?\b/, 'duvar-poster', []],
  [/\b(hats?|caps?|beanies?|snapbacks?)\b/, 'aksesuar-sapka', ['aksesuar-bere', 'evcil-kiyafet', 'spor-golf']],
  [/\bsocks?\b/, 'giyim-corap', []],
  [/\bcoasters?\b/, 'mutfak-bardak-alti', []],
  [/\bcalendars?\b/, 'kirtasiye-takvim', []],
  [/\b(notebooks?|journals?)\b/, 'kirtasiye-defter', []],
  [/\bflags?\b/, 'ev-bayrak', ['ev-bahce']],
  [/\btapestr(y|ies)\b/, 'duvar-duvar-halisi', []],
  [/\bumbrellas?\b/, 'aksesuar-semsiye', []],
];
const HEAD_CLOTH = new Set(HEAD.filter(([, t]) => /^giyim-/.test(t)).map(([, t]) => t));
// başlığın ana kısmı: "|", "(", " - " öncesi; "for/with ..." eki atılır
function headType(title) {
  // marka adıyla başlayanlar ("BELLA + CANVAS - Unisex Jersey Tank - 3480"): ürün kelimesi olan ilk parça
  for (const part of String(title).split(/\s[|｜(]|\s[-–]\s|｜/)) {
    const head = tx.norm(part).replace(/\b(for|with|w\/)\b.*$/, '');
    // en sondaki ürün adı; aynı yerde bitenlerden en uzunu ("makeup bag" > "bag")
    let best = null, end = -1, start = 0;
    for (const h of HEAD) {
      for (const m of head.matchAll(new RegExp(h[0].source, 'g'))) {
        const e = m.index + m[0].length;
        if (e > end || (e === end && m.index < start)) { end = e; start = m.index; best = h; }
      }
    }
    if (best) return best;
  }
  return null;
}

function etsyOf(p, cls) {
  // BurgerPrints "(US Label)" gönderim etiketi; ürün etiket değil ("Pet Feeding Mat (US Label)")
  if (/\b(us|uk|eu|au|cn|ca) label\b/i.test(p.title)) { p = { ...p, title: p.title.replace(/\s*[(-]?\s*\b(US|UK|EU|AU|CN|CA) Label\b\)?/gi, '') }; cls = tx.classify(p); }
  const text = tx.norm([p.title, p.leafLabel].filter(Boolean).join(' '));
  const w = who(text);
  let type = (cls || tx.classify(p)).type;
  // "collar" giysi yakası da olabilir ("High-collar Bodysuit", "Cuban Collar Shirt"): evcil hayvan işareti yoksa giyim
  if (type === 'evcil-tasma' && !/\b(dog|cat|pet|puppy|kitten|leash|harness)\b/.test(text)) type = 'giyim-ust';
  // "Kitchen 2-Piece Set", "Toilet Floor Mat Two-Piece Set" giyim takımı değil
  if (type === 'giyim-takim' && !/\b(shirts?|tees?|tops?|pants|shorts|jerseys?|bras?|leggings?|hoodies?|sweatshirts?|joggers?|skirts?|dress(es)?|uniforms?|tracksuits?|sweatsuits?|outfits?|pajamas?|yoga|cheer\w*|swim\w*|bikinis?|scrubs?|clothing|wear)\b/.test(text)) type = 'diger';
  // su topu mayosu polo tişört değil (MerchFarm takım mayoları)
  if (/\bwater ?polo\b/.test(text) && !/\b(t-?shirts?|tees?|hoodies?|sweatshirts?|towels?|caps?|hats?|bags?|backpacks?|shorts|jackets?|parkas?)\b/.test(text)) type = 'giyim-mayo';
  const loose = /^diger$|-diger$/.test(type);
  // telefon/gözlük kılıfı her şeyden önce ("iPhone Wallet Case" cüzdan değil)
  if (/\bair ?pods?\b|\bearbuds? case/.test(text)) return 'pod-airpods';
  if (/\bcar\b.*\b(floor |foot |trunk )?mats?\b/.test(text) && !/\b(seat cover|coaster)/.test(text)) return 'pod-car-mats';
  if (/\b(ipad|tablet|kindle|e-?reader)\b/.test(text) && /\b(cases?|covers?|folios?|sleeves?)\b/.test(text)) return resolve(`${EA} > Electronics Cases > Tablet & E-Reader Cases`);
  // Rabbit Skins bebek giyim markası, cihaz kaplaması değil
  if (/\brabbit skins\b/.test(text) && /^teknoloji-|^diger$/.test(type)) type = 'bebek-body';
  // "Women's U-Neck Yoga Romper" bebek bodysi değil
  if (type === 'bebek-body' && /\b(women'?s?|womens|ladies|men'?s|mens|adults?)\b/.test(text) && !/\b(baby|infant|newborn|toddler)\b/.test(text)) type = 'giyim-tulum';
  for (const [re, target] of OVERRIDE.slice(0, 2)) if (re.test(text)) return resolve(target);
  const h = headType(p.title);
  if (h) {
    const [, target, equiv] = h;
    const same = type === target || equiv.includes(type) || (HEAD_CLOTH.has(target) && WEAR.includes(type));
    if (!same) {
      if (target.includes(' > ')) return resolve(target);
      type = target;
    }
  }
  for (const [re, target] of h ? [] : OVERRIDE) {
    if (!re.test(text)) continue;
    // giysi model adları yalnızca türü bulunamamış ürünlerde ("Ringer Yoga Shorts" şort kalır)
    if (OVERRIDE_CLOTH[target]) { if (!loose) continue; return resolve(clothingPath(OVERRIDE_CLOTH[target], w)); }
    return target.startsWith('pod-') ? target : resolve(target);
  }
  let spec = TYPE_MAP[type];
  if (spec === 'KIDS') {
    const sub = /\bswim/.test(text) ? 'Swimwear'
      : /\b(onesie|bodysuit|creeper|romper|one[- ]piece|pajamas?|pyjamas?|sleepwear)\b/.test(text) || !h || h[1] === 'giyim-ust' ? KIDS.find(([re]) => re.test(text))[1]
      : KID_SUB[h[1]] || KIDS.find(([re]) => re.test(text))[1];
    const ww = ['girl', 'boy', 'baby'].includes(w) ? w : 'kid';
    return resolve(clothingPath({ clothing: true, u: sub }, ww));
  }
  let refined = false;
  if (Array.isArray(spec)) { const hit = spec.find(x => Array.isArray(x) && x[0].test(text)); refined = !!hit; spec = hit ? hit[1] : spec[spec.length - 1]; }
  if (spec && typeof spec === 'object') return resolve(spec.clothing ? clothingPath(spec, w) : shoesPath(spec, w));
  // genel "Diğer" kutuları: önce başlıktan tahmin, olmazsa türün kendi düğümü.
  // "Diğer Çanta" tahmini çanta dalında kalmalı ("Comforter Storage Bag" yorgan değil)
  if (!spec || (/-diger$|^diger$/.test(type) && !refined)) {
    const g = guess(text), top = spec && !spec.startsWith('pod-') ? spec.split(' > ')[0] : null;
    if (g && (!top || nodes.get(g).path[0] === top)) return g;
  }
  if (spec) return spec.startsWith('pod-') ? spec : resolve(spec);
  for (const [re, target] of LAST) {
    if (!re.test(text)) continue;
    if (typeof target === 'object') return resolve(clothingPath(target, w));
    if (OVERRIDE_CLOTH[target]) return resolve(clothingPath(OVERRIDE_CLOTH[target], w));
    return target.startsWith('pod-') ? target : resolve(target);
  }
  return null;
}

// Son kontrol (18 Eki 2026): hiçbir kurala uymayan 425 ürün tek tek okunup yazıldı
const LAST = [
  // satıcı hizmetleri ve baskı malzemeleri
  [/\b(logo (design|trace)|website hero image|branded (lifestyle image|catalog|product swatches)|color match quiz|color quiz|embroidery names|brand logo for|wecreatepopular)\b/, 'pod-seller-services'],
  [/\b(dtf|uv dtf)\b.*\b(gang )?sheets?\b|\bgang sheet|\bheat press transfer|\bsublisplash|\bprinter driver\b|\bsublimation\b.*\bblank\b/, 'pod-seller-transfers'],
  [/\b(drop shipping|premium packaging|mystery item)\b|^jana product|special for jana/, 'pod-seller-packaging'],
  // kozmetik ve kişisel bakım (Blanka, BeautyBoss)
  [/\b(beard (oil|butter|wash|growth)|grooming set|post-shave|shave oil)\b/, 'Bath & Beauty > Personal Care > Shaving & Grooming'],
  [/\b(hair clay|mousse|bounce boost)\b/, 'Bath & Beauty > Hair Care > Hair Styling'],
  [/\b(tallow|body balm|salve)\b/, 'Bath & Beauty > Skin Care > Salves & Balms'],
  [/\b(body butter|shea|hand cream|night (renewal )?creme|night cream|eye cream|emulsion|moisture blend|rose gold oil|cleansing oil|elixir|facial polish)\b/, 'Bath & Beauty > Skin Care > Moisturizers'],
  [/\b(bb cream|concealing cream|glitter dust|cheek palette)\b/, 'Bath & Beauty > Makeup & Cosmetics > Face'],
  [/\b(eyebrow gel)\b/, 'Bath & Beauty > Makeup & Cosmetics > Eyes'],
  [/\b(lip butter|lip plumper)\b/, 'Bath & Beauty > Makeup & Cosmetics > Lips'],
  [/\b(brush|tweezers|konjac sponge|blurrer)\b/, 'Bath & Beauty > Makeup & Cosmetics > Makeup Tools & Brushes > Makeup Applicators'],
  // takı
  [/\b(rope|cuban|snake bone|link) (link )?chain\b|\bchain with names\b/, 'Jewelry > Necklaces > Chains'],
  [/\bneck(lace|alce)\b|\bprojection\b/, 'Jewelry > Necklaces > Pendant Necklaces'],
  [/\bbrac?(e)?let\b|\bbraclet\b/, 'Jewelry > Bracelets > Chain & Link Bracelets'],
  [/\bmedical identification wristband\b/, 'Jewelry > Bracelets > ID & Medical Bracelets'],
  [/\b(acrylic|dual-layer|clear acrylic) charms\b/, `${AC} > Keychains & Lanyards > Zipper Charms`],
  // giyim: model adıyla satılan boşlar
  [/\byp classics 6506\b|\b(5|7)-panel\b|\bpeached cotton twill\b|\b(headwear|contractor winter) bundle\b/, `${AC} > Hats & Head Coverings > Hats & Caps`],
  [/\blat 4424\b/, "Clothing > Gender-Neutral Kids' Clothing > Gender-Neutral Baby Clothing > Bodysuits"],
  [/\b(round neck|women) (3 4 )?full sleeves\b|\bwomen'?s premium 240 bio\b|\bcontinental (ep|sa)\d+|\bparagon 100\b|\bcompetitor united crew\b|\bcasual performance lite\b|^(classic|premium|ladies|ladies premium|vintage unisex|qtees)$/, 'TEE'],
  [/\b(club fleece|smooth fleece|tie-dye fleece|ledger dry|zoodie)\b/, 'SWEAT'],
  [/\b(silky touch|b&c pu\d+)\b/, C('Tops & Tees > Polos', { m: 'Shirts & Tees > Polos' })],
  [/\b(tech-shell|rain shell)\b/, C('Jackets & Coats')],
  [/\bsweatshort\b/, C('Shorts', { w: 'Shorts & Skorts > Shorts' })],
  [/\bperformance linen look\b/, C('Tops & Tees')],
  [/\bcheerleader set\b/, C('Sports & Fitness')],
  [/\bnightwear\b/, C('Pajamas & Robes > Pajamas > Sets', { m: 'Pajamas & Robes > Sets' })],
  [/\b(two-?piece|three piece|mediterranean style|hawaiian) set\b|\bset combination\b/, C('Clothing Sets', { u: "Clothing > Women's Clothing", m: "Clothing > Men's Clothing", w: "Clothing > Women's Clothing" })],
  [/\bformal tie\b/, `${AC} > Suit & Tie Accessories > Neckties`],
  [/\bcycling headscarf\b/, `${AC} > Scarves & Wraps > Bandanas`],
  [/\bsilky-like wrap\b/, `${AC} > Scarves & Wraps > Shawls & Wraps`],
  [/\b(face ?mask|face covering)\b/, `${AC} > Face Masks & Accessories > Face Masks & Coverings`],
  [/\b(calf (cover|sleeves?))\b/, `${AC} > Gloves & Sleeves > Sleeves`],
  [/\bslip ons\b/, 'Shoes > Gender-Neutral Adult Shoes > Sneakers & Athletic Shoes > Slip Ons'],
  [/\bbommelm[uü]tze\b/, `${AC} > Hats & Head Coverings > Hats & Caps`],
  // mutfak, banyo, ev
  [/tasse\b/, `${DW} > Mugs`], [/\bfitness shaker\b/, `${DW} > Water Bottles`], [/\bmilk jug\b/, `${DW} > Pitchers & Drinking Sets > Pitchers`],
  [/\bwine chiller\b/, `${KD} > Drink & Barware > Barware > Ice Buckets`], [/\b(corkscrew|leather opener)\b/, `${KD} > Drink & Barware > Barware > Bottle Openers`],
  [/\bstubby holders?\b/, `${DW} > Cozies > Can Cozies`], [/\bpizza board\b/, `${KD} > Cookware > Cutting Boards`], [/\bcasserole carrier\b/, `${BP} > Food & Insulated Bags`],
  [/\b(insulation (pad|mat|three piece set)|heat insulation|stake mat)\b/, `${KD} > Cookware > Trivets & Pot Holders > Trivets`],
  [/\bkitchen (cloth|mat)|\bkitchen mat set\b|\bfaucet mat\b/, `${KD} > Linens > Kitchen & Tea Towels`],
  [/\btoilet\b.*\bmat|\bbathtub mat\b/, `${HL} > Bathroom > Bath Mats & Rugs > Bath Mats`],
  [/\bwash ?cloths?\b/, 'Bath & Beauty > Bath Accessories > Washcloths'],
  [/\bweight scale\b/, `${HL} > Bathroom > Bathroom Scales`],
  [/\b(floor mat|decorative mats|custom shape mat)\b/, `${HL} > Floor & Rugs > Rugs`],
  [/\bmop\b/, `${HL} > Cleaning Supplies > Buckets, Mops & Brooms`], [/\bironing mat\b/, `${HL} > Cleaning Supplies > Laundry Supplies > Ironing Board Covers`],
  [/\bbed linen\b/, `${HL} > Bedding > Sheets & Pillowcases > Sheet Sets`], [/\bthickiy|\bnap mat\b/, `${HL} > Bedding > Blankets & Throws > Throws`],
  [/\b(bedside table|storage cabinet|tv trays)\b/, `${HL} > Furniture`], [/\binflatable ottoman\b/, 'Bath & Beauty > Bath Accessories > Poufs'],
  [/\b(storage bins|medicine (box|kit)|display boxes|wood boxes|usb boxes|disk cases|pull out photo box|teeth box|letter box)\b/, `${HL} > Storage & Organization > Boxes & Bins`],
  [/\b(closet dividers|tie hanger)\b/, `${HL} > Storage & Organization > Hangers & Clothing Storage`], [/\badhesive hook\b/, `${HL} > Storage & Organization > Hooks & Fixtures`],
  [/\bmail ?box cover\b/, `${HL} > Outdoor & Gardening > Mailboxes`], [/\bprivacy screen\b/, `${HL} > Outdoor & Gardening`],
  [/\b(succulent pot)\b/, `${HL} > Outdoor & Gardening > Planters & Pots`], [/\bsolar lights?\b/, `${HL} > Lighting > Light Fixtures`],
  [/\b(pedal light|led hanging light|led base|led heart|with light|acrylic board with light)\b/, `${HL} > Lighting > Lamps, Shades & Bases > Lamps > Accent Lamps`],
  [/\bsocket panel\b/, `${HL} > Lighting > Light Accessories > Light Switch & Outlet Covers`],
  [/\b(money box|woodland animal money)\b/, `${HD} > Home Accents > Piggy Banks`],
  [/\b(snowflake decorations|christmas bells|bone hanging|hanging .*souvenirs|snowman wood hanger|christmas couplets|easter egg|wooden garland)\b/, `${HD} > Seasonal Decor > Ornaments`],
  [/\b(window decor)\b/, `${HD} > Wall Decor > Window Clings`],
  [/\b(wall panel|hanging pictures|aluminum composite panels|bamboo panels)\b/, `${HD} > Wall Decor`],
  [/\b(home wood framework|slip-in mats)\b/, `${HD} > Picture Frames & Displays > Picture Frames`],
  [/\b(crystal display shelf|support stick|bookshelf decor|number tracker display)\b/, `${HD} > Picture Frames & Displays > Displays`],
  [/\b(float wraps|gallery wraps)\b/, 'pod-canvas'], [/\b(standouts|photo proofs|mini snapshots|polaroid photo|photo board|acrylic prism|epson cold press|photo gloss)\b/, ART],
  [/\b(photo greetings|image folios|compliment slips|letterhead|diy (double thick )?sheet|stamped menu)\b/, `${PPS} > Stationery`],
  [/\b(hang ?tags?|gift tags?|embroidered tag|layers? tag|3-layer tag|gamer tag|stethoscope id tag)\b/, `${PPS} > Stickers, Labels & Tags > Tags`],
  [/\b(arched background cover|background cover|linen scroll|face stick|hand clapper|lei cord)\b/, 'Paper & Party Supplies > Party Supplies > Party Decor > Backdrops & Props'],
  [/\bmagic wrapper cloth\b/, `${PPS} > Gift Wrapping > Wrapping Paper & Furoshiki`],
  [/\b(commemorative|memorial|metal|3d relief metal) coin\b|\bmetal coin\b|\bcommemorative ticket\b/, 'Art & Collectibles > Collectibles > Coins & Money'],
  [/\bviewfinder\b/, `${TG} > Toys > Stereoscopes & Viewfinders`],
  [/\b(maze game|maze|spinner|topple tower)\b/, `${TG} > Games & Puzzles`], [/\bladder ball\b/, `${TG} > Sports & Outdoor Recreation > Lawn Games`],
  [/\b(acrylic|epoxy) chips\b/, `${TG} > Games & Puzzles > Card Games > Poker`],
  [/\b(skis|snowboard)\b/, `${TG} > Sports & Outdoor Recreation > Ice & Snow Sports`], [/\bkickboard\b/, `${TG} > Sports & Outdoor Recreation > Boating & Water Sports > Swimming & Diving`],
  [/\b(stadium seat|mouthpiece)\b/, `${TG} > Sports & Outdoor Recreation`], [/\b(rescue whistle|multi tool)\b/, `${TG} > Sports & Outdoor Recreation > Camping`],
  [/\b(macbook|surface pro|computer case)\b/, `${EA} > Electronics Cases > Laptop Sleeves`], [/\bmagnetic clear impact cases\b/, `${EA} > Electronics Cases > Phone Cases`],
  [/\bswitch base\b/, `${EA} > Video Games > Parts & Modifications`], [/\bcharging mat\b/, `${EA} > Batteries & Charging > Chargers`],
  [/\bkeyboard hand rest\b/, `${EA} > Computers & Peripherals > Keyboards & Mice`], [/\bcord case\b/, `${EA} > Cables & Cords`], [/\busb drives?\b/, `${EA} > Computers & Peripherals`],
  [/\b(phone holder|magnetic grip|airbag phone)\b/, 'pod-phone-grips'], [/\bsilicone strap\b/, 'Jewelry > Watches > Watch Bands & Straps'],
  [/\bturntable mat\b/, 'Books, Movies & Music > Music'],
  [/\b(gear (shift|lever) cover|armrest (box )?cover|anti-kick|car (vent clip|hanging trash)|vent clip|tailgate wrap)\b/, `${EA} > Car Parts & Accessories > Car Accessories`],
  [/\bcar key cover\b/, `${EA} > Car Parts & Accessories > Car Accessories > Key Fob Covers`], [/\b(window visor|window sunshades)\b/, 'pod-sunshades'],
  [/\bsofa armrest cover\b/, `${HL} > Furniture`], [/\bmixer cover\b|\bfoot warmer\b/, `${HL} > Home Appliances`],
  [/\b(bible cover)\b/, 'Books, Movies & Music > Books > Book Accessories > Book Covers'], [/\bpassport protector\b/, `${BP} > Luggage & Travel > Passport Covers`],
  [/\b(transparent satchel)\b/, `${BP} > Handbags`], [/\b(carry-all|sack)\b/, BP], [/\bcigar case\b/, `${BP} > Accessory Cases > Cigarette Cases`],
  [/\bbaby changing mat\b/, 'Bath & Beauty > Baby & Child Care > Changing Pads'], [/\bherb grinder\b/, 'Art & Collectibles > Collectibles > Tobacciana'],
  [/\b(self-inking stamps|sticky note holder|clip)\b/, `${HL} > Office > Office & School Supplies`],
  [/\b(acrylic sheet|thick acrylic|fabric sheet|felt fabric sheet|yarn holder)\b/, 'Craft Supplies & Tools'],
  [/\b(tool set|wood hammer)\b/, `${HL} > Home Improvement`],
  [/\bomamori\b/, `${HL} > Spirituality & Religion`],
  // Printonic mum hediye setleri ("Sip & Glow Box", "Hello Sunshine Gift Set")
  [/\bgift set\b|^(grad mode|dynamic duo set|done and dusted|new beginnings|sip & glow box|tassle time|dream & wander set|the tea time set)$/, `${HD} > Candles & Home Fragrances`],
  [/\btwo[- ]?piece set\b/, C('Clothing Sets', { u: "Clothing > Women's Clothing", m: "Clothing > Men's Clothing", w: "Clothing > Women's Clothing" })],
  [/s[ıi]rt [çc]antas[ıi]/, `${BP} > Sports Bags > Team Sports & Gym Bags`], [/mutfak [öo]nl[üu][ğg][üu]/, `${AC} > Aprons`], [/yast[ıi]k k[ıi]l[ıi]f[ıi]/, `${HD} > Throw Pillows`],
  [/\b(exoboard|clickit)\b/, ART], [/\binv-hp-/, `${DW} > Water Bottles`], [/\bshelf liners\b/, `${HL} > Storage & Organization`], [/\busb cases\b/, `${HL} > Storage & Organization > Boxes & Bins`],
  [/\bcolor rich pro line\b/, 'Bath & Beauty > Makeup & Cosmetics > Lips > Lip Color'], [/\bpage holder\b/, 'Books, Movies & Music > Books > Book Accessories'],
  [/\bkeych(a)?in\b/, `${AC} > Keychains & Lanyards > Keychains`], [/\brose boxes\b/, `${HD} > Flower Arrangements`],
  // geri kalan kişiye özel hediyelik objeler (kristal küre, ahşap süs, blok, figür)
  [/\b(crystal|sculpture|keepsake|wooden|acrylic|wood|blocks?|stone|heart|snowman|gingerbread|decor|hanger|portrait|line drawing|pocket hug|bundle|meter|lock|robot|grape|hologram flower|crown)\b/, `${HD} > Home Accents`],
];

module.exports = { nodes, byPath, resolve, etsyOf, who, EXT, fallbacks };
