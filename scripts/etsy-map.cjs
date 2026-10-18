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
for (const [id, parent, label, labelTr] of EXT) {
  const pid = byPath.get(parent);
  if (!pid) throw new Error('etsy-map: üst düğüm yok ' + parent);
  const p = nodes.get(pid), pathArr = [...p.path, label];
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
  if (RE_BABY.test(text) || /\b(bebek|z[ıi]b[ıi]n)\b/.test(text)) return 'baby';
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
  'ayakkabi-terlik': [[/\bflip[- ]?flop/, S('Sandals > Flip Flops & Thongs')], [/\bslides?\b|slider/, S('Sandals > Slides', { w: 'Sandals > Slingbacks & Slides' })], [/\bslipper/, S('Slippers')], [/\bclog|croc/, S('Clogs', { w: 'Clogs & Mules > Clogs', m: 'Clogs & Mules' })], S('Sandals')],
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
  'aksesuar-taki': [[/\bname necklace|monogram|initial necklace/, 'Jewelry > Necklaces > Monogram & Name Necklaces'], [/\bcharm bracelet/, 'Jewelry > Bracelets > Charm Bracelets'], [/\blocket/, 'Jewelry > Necklaces > Lockets'], [/\bchoker/, 'Jewelry > Necklaces > Choker Necklaces'], [/\bcharm necklace|necklace.*\bcharm/, 'Jewelry > Necklaces > Charm Necklaces'], [/\bnecklace|pendant/, 'Jewelry > Necklaces > Pendant Necklaces'], [/\bstud earring/, 'Jewelry > Earrings > Stud Earrings'], [/\bhoop/, 'Jewelry > Earrings > Hoop Earrings'], [/\bearring/, 'Jewelry > Earrings > Dangle & Drop Earrings'], [/\bbangle/, 'Jewelry > Bracelets > Bangles'], [/\bbeaded bracelet/, 'Jewelry > Bracelets > Beaded Bracelets'], [/\bcuff\b/, 'Jewelry > Bracelets > Cuff Bracelets'], [/\bbracelet/, 'Jewelry > Bracelets > Chain & Link Bracelets'], [/\bsignet/, 'Jewelry > Rings > Signet Rings'], [/\bring\b|rings\b/, 'Jewelry > Rings > Statement Rings'], [/\bbrooch/, `${AC} > Pins & Clips > Brooches`], [/\bchain\b/, 'Jewelry > Necklaces > Chains'], [/\bcharm/, 'Jewelry > Necklaces > Charm Necklaces'], [/\bcuff ?links?/, `${AC} > Suit & Tie Accessories > Cuff Links & Tie Clips > Cuff Links`], 'Jewelry'],
  'aksesuar-saat': [[/\bband|strap/, 'Jewelry > Watches > Watch Bands & Straps'], [/\bpocket watch/, 'Jewelry > Watches > Pocket Watches'], 'Jewelry > Watches > Wrist Watches > Unisex Wrist Watches'],
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
  'canta-diger': [[/\b(pouch|coin purse|zipper pouch|pencil (case|pouch))\b/, `${BP} > Pouches & Coin Purses`], [/\bbeach bag/, `${BP} > Sports Bags > Beach Bags`], [/\b(gift|party|favor) bags?\b|\bpaper bags?\b/, `${PPS} > Gift Wrapping > Party & Gift Bags > Gift Bags`], [/\bshoe bag/, `${BP} > Clothing & Shoe Bags > Shoe Bags`], [/\blaundry/, `${HL} > Storage & Organization > Laundry Bags & Hampers > Laundry Bags`], [/\bdrawstring|gym|sport/, `${BP} > Sports Bags > Team Sports & Gym Bags`], [/\bdiaper/, `${BP} > Diaper Bags`], [/\bmarket|shopping|grocery/, `${BP} > Market Bags`], BP],
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
  'kirtasiye-defter': [[/\bplanner/, `${PPS} > Calendars & Planners`], [/\bnotepad|sticky note|memo pad/, `${PPS} > Stationery > Notepads`], [/\bjournal|sketchbook|diary/, 'Books, Movies & Music > Books > Blank Books > Journals & Notebooks'], [/\bphoto ?book|photobook|book\b/, 'Books, Movies & Music > Books'], 'Books, Movies & Music > Books > Blank Books > Journals & Notebooks'],
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
  'arac-aksesuar': [[/\bseat cover/, `${EA} > Car Parts & Accessories > Car Accessories > Seat Covers`], [/\bsteering/, `${EA} > Car Parts & Accessories > Car Accessories > Steering Wheel Covers`], [/\b(floor )?mats?\b/, 'pod-car-mats'], [/\bsun ?shade|windshield/, 'pod-sunshades'], [/\bcoaster/, `${EA} > Car Parts & Accessories > Car Accessories > Car Coasters`], [/\blicense plate (frame|cover)/, `${EA} > Car Parts & Accessories > Car Accessories > License Plate Covers & Frames`], [/\blicense plate/, `${EA} > Car Parts & Accessories > Car Accessories > Decorative License Plates`], [/\bair freshener/, `${EA} > Car Parts & Accessories > Car Accessories > Car Air Fresheners`], [/\bkey ?fob/, `${EA} > Car Parts & Accessories > Car Accessories > Key Fob Covers`], [/\bcharm|hanging|mirror/, `${EA} > Car Parts & Accessories > Car Accessories > Car Charms`], [/\bmagnet|decal|sticker/, `${PPS} > Stickers, Labels & Tags > Bumper Stickers`], `${EA} > Car Parts & Accessories > Car Accessories`],
  'spor-yoga': [[/\bbag/, `${BP} > Sports Bags > Yoga Bags`], `${TG} > Sports & Outdoor Recreation > Fitness & Exercise > Yoga & Pilates > Yoga`],
  'spor-plaj': [[/\btowel/, `${HL} > Bathroom > Beach Towels`], [/\bbag/, `${BP} > Sports Bags > Beach Bags`], [/\bball/, `${TG} > Sports & Outdoor Recreation > Balls`], `${TG} > Sports & Outdoor Recreation > Boating & Water Sports > Sand & Water Toys`],
  'spor-golf': [[/\bbag/, `${BP} > Sports Bags > Tennis & Golf Bags > Golf Bags`], [/\bshoe|cleat/, 'Shoes > Gender-Neutral Adult Shoes > Sneakers & Athletic Shoes > Golf Shoes & Cleats'], [/\bpolo|shirt/, "Clothing > Men's Clothing > Shirts & Tees > Polos"], [/\bhat|cap|visor/, `${AC} > Hats & Head Coverings > Hats & Caps`], `${TG} > Sports & Outdoor Recreation > Golf`],
  'spor-kamp': [[/\bhammock/, `${HL} > Outdoor & Gardening > Hammocks & Swings`], [/\bchair/, `${HL} > Outdoor & Gardening > Patio Furniture`], `${TG} > Sports & Outdoor Recreation > Camping`],
};

// çocuk giyimi: ürün kelimesinden tür, kız/erkek/bebek ayrımıyla
const KIDS = [
  [/\b(onesie|bodysuit|creeper)\b/, 'Bodysuits'], [/\b(romper|jumpsuit|footie)\b/, 'Footies & Rompers'], [/\bhoodie|hooded/, 'Hoodies & Sweatshirts > Hoodies'],
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
const GENERIC = new Set(['acrylic', 'color', 'slip', 'embroidery', 'linen', 'chain', 'display', 'oil', 'glass', 'shape', 'cover', 'block', 'vehicle', 'bone', 'table', 'card', 'game', 'light', 'paper', 'film', 'music', 'phone', 'face', 'eye', 'lip', 'nail', 'tool', 'paint', 'candy', 'coffee', 'moss', 'sculpture', 'collectible', 'animal', 'trunk', 'sleeve', 'bottom', 'top', 'set', 'pot', 'filter', 'lens', 'door', 'window', 'lock', 'hardware', 'ribbon', 'bell', 'triangle', 'whistle', 'combination', 'computer', 'keyboard', 'drum', 'guitar', 'piano', 'pedal', 'lighter', 'souvenir', 'toy', 'ball', 'sponge', 'bowl', 'tray', 'trays', 'sign', 'label', 'tag', 'box', 'bag', 'mat', 'pad', 'cloth', 'sheet']);
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

function etsyOf(p, cls) {
  const text = tx.norm([p.title, p.leafLabel].filter(Boolean).join(' '));
  const w = who(text);
  const type = (cls || tx.classify(p)).type;
  const loose = /^diger$|-diger$/.test(type);
  for (const [re, target] of OVERRIDE) {
    if (!re.test(text)) continue;
    // giysi model adları yalnızca türü bulunamamış ürünlerde ("Ringer Yoga Shorts" şort kalır)
    if (OVERRIDE_CLOTH[target]) { if (!loose) continue; return resolve(clothingPath(OVERRIDE_CLOTH[target], w)); }
    return target.startsWith('pod-') ? target : resolve(target);
  }
  let spec = TYPE_MAP[type];
  if (spec === 'KIDS') {
    const sub = KIDS.find(([re]) => re.test(text))[1];
    const ww = ['girl', 'boy', 'baby'].includes(w) ? w : 'kid';
    return resolve(clothingPath({ clothing: true, u: sub }, ww));
  }
  if (Array.isArray(spec)) spec = (spec.find(x => Array.isArray(x) && x[0].test(text)) || [null, spec[spec.length - 1]])[1];
  if (spec && typeof spec === 'object') return resolve(spec.clothing ? clothingPath(spec, w) : shoesPath(spec, w));
  // genel "Diğer" kutuları: önce başlıktan tahmin, olmazsa türün kendi düğümü
  if (!spec || /-diger$|^diger$/.test(type)) { const g = guess(text); if (g) return g; }
  if (spec) return spec.startsWith('pod-') ? spec : resolve(spec);
  return null;
}

module.exports = { nodes, byPath, resolve, etsyOf, who, EXT, fallbacks };
