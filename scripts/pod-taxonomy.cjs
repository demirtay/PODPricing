// POD Atlas ürün tipi ağacı ve sınıflandırıcı.
// Satılan POD ürünlerine göre kurulmuştur (Etsy ağacına bağlı değil).
// classify(p) -> { type, group } ; detectModel(p) -> { brand, model, key } | null
'use strict';

const GROUPS = [
  ['giyim', 'Giyim'],
  ['cocuk-bebek', 'Çocuk ve Bebek'],
  ['ayakkabi', 'Ayakkabı'],
  ['aksesuar', 'Aksesuar ve Takı'],
  ['canta', 'Çanta'],
  ['mutfak', 'Mutfak ve İçecek'],
  ['ev', 'Ev ve Yaşam'],
  ['duvar', 'Duvar Dekorasyonu'],
  ['kirtasiye', 'Kırtasiye ve Kağıt'],
  ['teknoloji', 'Telefon ve Teknoloji'],
  ['evcil', 'Evcil Hayvan'],
  ['oyun', 'Oyun ve Hobi'],
  ['arac-outdoor', 'Araç, Spor ve Outdoor'],
  ['diger', 'Diğer'],
];

// [id, grup, Türkçe ad, eşleşme, hariç]  — sıra önemlidir: özelden genele.
const T = [
  // --- evcil (önce: "dog hoodie" giyim değil)
  ['evcil-kiyafet', 'evcil', 'Evcil Hayvan Kıyafeti', /\b(dog|pet|cat|puppy)\b[^|]{0,25}\b(hoodie|shirt|t-?shirt|sweater|sweatshirt|jacket|raincoat|bandana|dress|clothes|clothing|costume|tank)|\bpet clothes\b/],
  ['evcil-tasma', 'evcil', 'Tasma ve Kayış', /\b(collar|leash|harness)\b/, /\b(polo|shirt|collared|neck)\b/],
  ['evcil-yatak', 'evcil', 'Evcil Hayvan Yatağı', /\b(pet|dog|cat)\s+(bed|mat|blanket|cushion)\b/],
  ['evcil-mama-kabi', 'evcil', 'Mama ve Su Kabı', /\b(pet|dog|cat)\s+(bowl|feeder)/],
  ['evcil-diger', 'evcil', 'Diğer Evcil Hayvan Ürünleri', /\b(pet tag|dog tag|pet id|pet toy|dog toy|cat toy|pet carrier|poop bag)/],

  // --- çocuk/bebek
  ['bebek-body', 'cocuk-bebek', 'Bebek Body ve Tulum', /\b(onesie|bodysuit|romper|baby\s+one[- ]?piece|baby\s+jumpsuit|creeper)\b/],
  ['bebek-onluk', 'cocuk-bebek', 'Bebek Önlüğü', /\b(bib|bibs)\b/],
  ['bebek-battaniye', 'cocuk-bebek', 'Bebek Battaniyesi', /\b(baby|swaddle|crib|stroller)\b.*\b(blanket|swaddle|sheet)\b|\bswaddle\b/],
  ['cocuk-giyim', 'cocuk-bebek', 'Çocuk Giyim', /\b(kids?|youth|toddler|infant|baby|children'?s?|boys?|girls?|child)\b.*\b(t-?shirt|tee|shirt|hoodie|sweatshirt|dress|pajamas?|pants|shorts|leggings|jacket|swimsuit|swimwear|set|tank|jersey|top|skirt|outfit|socks|sweater|romper|jumpsuit|vest|polo|robe|bathrobe|cardigan)\b|\b(t-?shirts?|tees?|hoodies?|sweatshirts?|dress|pajamas?|pants|shorts|jackets?|swimsuit|sets?|tops?) for (kids|toddlers?|children|boys|girls|babies|baby)\b/],

  // --- ayakkabı
  ['ayakkabi-sneaker', 'ayakkabi', 'Spor Ayakkabı', /\b(sneakers?|running shoes|canvas shoes?|high[- ]?top|low[- ]?top|shoes?|trainers|loafers|slip[- ]on)\b/, /\b(bag|shoe bag|shoelaces?|laces|tongue|label|case|charm)\b/],
  ['ayakkabi-terlik', 'ayakkabi', 'Terlik ve Sandalet', /\b(slippers?|slides?|flip[- ]?flops?|sandals?|clogs?|crocs)\b/, /\b(slide (sign|show)|slider)\b/],
  ['ayakkabi-bot', 'ayakkabi', 'Bot', /\b(boots?)\b/, /\b(boot (cuff|socks)|car boot|shoelaces?|laces)\b/],

  // --- giyim
  ['giyim-mayo', 'giyim', 'Mayo ve Bikini', /\b(swimsuit|swimwear|bikini|swim trunks?|board shorts?|boardshorts|bathing suit|swim (shorts|briefs?|dress|top|suit|trunks|jammer|team)|swimming trunks|jammers?|volley shorts?|rash guard|tankini|monokini|one[- ]piece swim)/],
  ['giyim-ic-giyim', 'giyim', 'İç Giyim', /\b(briefs?|boxers?|underwear|panties|thongs?|bra|sports? bh|bralette|lingerie|boxer briefs?)\b/, /\b(swim)/],
  ['giyim-pijama', 'giyim', 'Pijama ve Sabahlık', /\b(pajamas?|pyjamas?|pj set|sleepwear|nightgown|nightdress|night shirt|robes?|bathrobes?|lounge set|loungewear|sleep (shirt|dress|set))\b/],
  ['giyim-corap', 'giyim', 'Çorap', /\b(socks?|stockings?)\b/, /\b(santa|christmas|xmas|holiday) stocking/],
  ['giyim-forma', 'giyim', 'Spor Forması', /\b(jersey)\b/, /\b(jersey (knit|fabric|cotton|tee|t-?shirt|short sleeve)|single jersey|jersey dress)\b/],
  ['giyim-polo', 'giyim', 'Polo Yaka', /\bpolo\b/],
  ['giyim-fermuarli-kapusonlu', 'giyim', 'Fermuarlı Kapüşonlu', /\b(zip[- ]?up hoodie|zip hoodie|zip hood|full[- ]zip|zipper hoodie|zip[- ]up (hooded )?sweatshirt|zip[- ]up jacket hoodie)\b/],
  ['giyim-kapusonlu', 'giyim', 'Kapüşonlu Sweatshirt (Hoodie)', /\b(hoodies?|hooded (sweatshirt|pullover|top)|hoody|(heavy|relax|faded|made|stencil|safety|camo|supply|premium|women's|mens?|kids) hood)\b/, /\b(hooded (towel|blanket|poncho|cape)|hoodie (towel|blanket)|towel|knob|car shift|ornament|keychain|pillow|blanket)\b/],
  ['giyim-sweatshirt', 'giyim', 'Sweatshirt', /\b(sweatshirts?|crew ?neck (sweat|pullover|fleece)|crewneck|pullover|(heavy|relax|faded|made|stencil|premium|women's|mens?) crew|fleece (crew|top)|quarter[- ]zip|1\/4 zip|half[- ]zip)\b/, /\b(hoodie|hooded)\b/],
  ['giyim-hirka-kazak', 'giyim', 'Kazak ve Hırka', /\b(sweaters?|cardigans?|knit(ted)? (top|jumper)|jumper)\b/],
  ['giyim-ceket', 'giyim', 'Ceket ve Mont', /\b(jackets?|bomber|windbreaker|coat|parka|varsity|blazer|anorak|puffer|softshell|shacket|coach jacket|trench)\b/, /\b(jacket potato|coat hanger|coaster)\b/],
  ['giyim-yelek', 'giyim', 'Yelek', /\b(vest|gilet|waistcoat)\b/, /\b(tank|singlet)\b/],
  ['giyim-gomlek', 'giyim', 'Gömlek', /\b(button[- ]?(up|down)|hawaiian shirt|aloha shirt|flannel shirt|camp shirt|bowling shirt|dress shirt|oxford shirt|denim shirt|linen shirt|cuban collar|shirt jacket|work shirt|blouse)\b|\b(hawaiian|aloha|flannel|bowling|baseball)\s+shirt/],
  ['giyim-elbise', 'giyim', 'Elbise', /\b(dress|dresses|sundress|gown|maxi|midi|kaftan|caftan)\b/, /\b(dress shirt|dress socks|dresser|address)\b/],
  ['giyim-etek', 'giyim', 'Etek', /\b(skirts?|skorts?)\b/],
  ['giyim-tulum', 'giyim', 'Tulum', /\b(jumpsuit|overalls?|playsuit|romper|dungarees)\b/],
  ['giyim-tayt', 'giyim', 'Tayt', /\b(leggings?|tights|yoga pants|capri)\b/],
  ['giyim-sort', 'giyim', 'Şort', /\b(shorts|short pants|bermuda|biker shorts|(volley|running|athletic|gym|sweat) short)\b/, /\b(short sleeve|short-sleeve)\b(?!.*\bshorts\b)/],
  ['giyim-pantolon', 'giyim', 'Pantolon ve Eşofman Altı', /\b(pants|jeans|joggers?|sweatpants|trousers|track pants|cargo|culottes?|palazzo|chinos|bottoms)\b/],
  ['giyim-takim', 'giyim', 'Takım', /\b(tracksuit|sweatsuit|two[- ]piece|2[- ]piece|co[- ]ord|matching set|outfit set|suit set|short set|pant set)\b/],
  ['giyim-crop', 'giyim', 'Crop Top', /\b(crop(ped)? (top|tee|t-?shirt|tank|hoodie|sweatshirt)?|crop)\b/, /\b(hoodie|sweatshirt)\b/],
  ['giyim-atlet', 'giyim', 'Atlet ve Kolsuz', /\b(tank ?tops?|tanks?|sleeveless|singlet|camisole|cami|muscle (tee|shirt)|racerback|halter)\b/, /\b(water tank|fish tank|tank (car|truck)|halter (dress|neck dress))\b/],
  ['giyim-uzun-kollu', 'giyim', 'Uzun Kollu Tişört', /\b(long[- ]?sleeves?|ls tee|long sleeved)\b/, /\b(dress|hoodie|sweatshirt|jacket)\b/],
  ['giyim-raglan', 'giyim', 'Raglan ve Beyzbol Tişört', /\b(raglan|baseball tee|3\/4 sleeve)\b/],
  ['giyim-tisort', 'giyim', 'Tişört', /\b(t-?shirts?|tees?|t shirts?|tshirts?|crew ?neck|v[- ]?neck|short[- ]sleeves?|heavyweight|boxy|oversized|garment[- ]dyed|softstyle|ringspun|ring[- ]spun)\b/],
  ['giyim-ust', 'giyim', 'Bluz ve Üst', /\b(tops?|shirts?|blouse|tunic|bodysuit|cover[- ]?up|kimono|poncho)\b/, /\b(shirt (box|bag)|t-?shirt (bag|box))\b/],
  ['giyim-onluk', 'aksesuar', 'Önlük', /\b(apron)\b/],

  // --- aksesuar
  ['aksesuar-ayakkabi', 'aksesuar', 'Ayakkabı Bağcığı ve Etiket', /\b(shoelaces?|shoe laces?|shoe (tongue )?labels?|shoe charms?|tongue label)\b/],
  ['aksesuar-bere', 'aksesuar', 'Bere', /\b(beanies?|knit hat|toque|winter hat)\b/],
  ['aksesuar-sapka', 'aksesuar', 'Şapka', /\b(caps?|hats?|snapback|trucker|bucket hat|visor|dad hat|fedora|sun ?hat)\b/, /\b(cap sleeve|bottle cap|hubcap|caption|capacity|capri|cape|hat (box|rack))\b/],
  ['aksesuar-maske', 'aksesuar', 'Maske ve Boyunluk', /\b(face mask|mask|gaiter|neck gaiter|balaclava|eye mask|sleep mask|buff)\b/],
  ['aksesuar-esarp', 'aksesuar', 'Eşarp, Bandana ve Fular', /\b(scarf|scarves|bandanas?|shawl|headband|hair tie|scrunchie|head ?wrap|durag|du-rag|turban)\b/],
  ['aksesuar-kravat', 'aksesuar', 'Kravat ve Papyon', /\b(neck ?tie|necktie|bow ?tie|tie clip)\b/],
  ['aksesuar-taki', 'aksesuar', 'Takı', /\b(necklace|pendant|bracelet|bangle|earrings?|rings?|jewelry|jewellery|anklet|charm|locket|cufflinks?|brooch)\b/, /\b(key ?ring|ring binder|ring light|ringer|o-ring|spring|string|earring holder|boxing ring)\b/],
  ['aksesuar-saat', 'aksesuar', 'Saat ve Kordon', /\b(watch ?bands?|watch strap|apple watch|i?watch|watches|wrist ?watch|smartwatch band)\b/],
  ['aksesuar-cuzdan', 'aksesuar', 'Cüzdan ve Kartlık', /\b(wallet|card holder|cardholder|card case|coin purse|passport (holder|cover)|money clip)\b/],
  ['aksesuar-anahtarlik', 'aksesuar', 'Anahtarlık', /\b(key ?chains?|key ?rings?|keyring|key fob|key tag|key holder|luggage tags?|lanyard)\b/],
  ['aksesuar-rozet', 'aksesuar', 'Rozet, Pin ve Arma', /\b(pins?|enamel pin|badges?|button badge|pinback|patch|patches|emblem)\b/, /\b(pin cushion|bowling pin|hairpin|pinwheel)\b/],
  ['aksesuar-bakim', 'aksesuar', 'Ayna, Tarak ve Kişisel Bakım', /\b(compact mirror|pocket mirror|mirror|comb|hair ?brush|nail file|manicure)\b/],
  ['aksesuar-gozluk', 'aksesuar', 'Gözlük', /\b(sunglasses|glasses case|eyewear)\b/],
  ['aksesuar-semsiye', 'aksesuar', 'Şemsiye', /\b(umbrella)\b/],
  ['aksesuar-eldiven', 'aksesuar', 'Eldiven', /\b(gloves?|mittens?)\b/],
  ['aksesuar-kemer', 'aksesuar', 'Kemer ve Askı', /\b(belt|suspenders|guitar strap|camera strap)\b/, /\b(seat ?belt|belt bag)\b/],

  // --- çanta
  ['canta-bez', 'canta', 'Bez Çanta (Tote)', /\b(tote|totes|shopping bag|grocery bag|canvas bag|cotton bag|jute bag|market bag|reusable bag|beach bag)\b/],
  ['canta-sirt', 'canta', 'Sırt Çantası', /\b(backpacks?|rucksack|school ?bag|book ?bag|daypack)\b/],
  ['canta-buzgulu', 'canta', 'Büzgülü Çanta', /\b(drawstring (bag|backpack)|gym ?sack|cinch bag|string bag)\b/],
  ['canta-bel', 'canta', 'Bel ve Göğüs Çantası', /\b(fanny pack|waist bag|belt bag|bum bag|sling bag|chest bag|hip bag)\b/],
  ['canta-kozmetik', 'canta', 'Makyaj ve Kozmetik Çantası', /\b(makeup bag|cosmetic (bag|pouch|case)|toiletry|pencil (case|pouch|bag)|accessory pouch|zipper pouch|pouch|wash bag|travel case)\b/],
  ['canta-beslenme', 'canta', 'Beslenme Çantası', /\b(lunch (bag|box|tote)|cooler bag|insulated bag|bento)\b/],
  ['canta-laptop', 'canta', 'Laptop ve Tablet Kılıfı', /\b(laptop (sleeve|bag|case|cover)|macbook (sleeve|case)|tablet (sleeve|case)|ipad (sleeve|case|cover)|kindle)\b/],
  ['canta-seyahat', 'canta', 'Seyahat ve Spor Çantası', /\b(duffel|duffle|weekender|travel bag|gym bag|luggage|suitcase|garment bag|sports bag)\b/, /\b(luggage tag|luggage cover)\b/],
  ['canta-el-omuz', 'canta', 'El ve Omuz Çantası', /\b(handbag|shoulder bag|crossbody|cross-body|messenger|clutch|purse|satchel|hobo|bucket bag|saddle bag|tote handbag|underarm bag|camera bag)\b/],
  ['canta-diger', 'canta', 'Diğer Çantalar', /\b(bags?)\b/, /\b(bag clip|bean bag|tea bag|sleeping bag|punching bag|bag tag)\b/],

  // --- mutfak
  ['mutfak-kupa', 'mutfak', 'Kupa (Mug)', /\b(mugs?|coffee cup|enamel cup|camping cup|latte cup|espresso cup)\b/, /\b(mug (rug|mat|coaster)|mugshot)\b/],
  ['mutfak-termos', 'mutfak', 'Termos ve Tumbler', /\b(tumblers?|travel mug|thermos|vacuum (flask|cup|insulated)|insulated (cup|tumbler)|stanley|skinny|yeti)\b/, /\b(stanley\s*\/?\s*stella)/],
  ['mutfak-matara', 'mutfak', 'Matara ve Su Şişesi', /\b(water bottles?|bottles?|flask|hip flask|sports bottle|canteen)\b/, /\b(bottle opener|bottle (holder|cooler|koozie|sleeve)|wine bottle bag)\b/],
  ['mutfak-bardak', 'mutfak', 'Bardak ve Kadeh', /\b(glass(es)?|pint|shot glass|wine glass|beer (stein|can glass)|can glass|stein|tankard|goblet|whiskey|champagne flute|cups?|sippy)\b/, /\b(clock|glasses case|sunglasses|glass (frame|print|wall art|sign|ornament|cutting board))\b/],
  ['mutfak-sogutucu', 'mutfak', 'Kutu Soğutucu (Koozie)', /\b(koozies?|can (cooler|holder|sleeve)|stubby holder|beer sleeve|bottle cooler)\b/],
  ['mutfak-bardak-alti', 'mutfak', 'Bardak Altlığı', /\b(coasters?)\b/],
  ['mutfak-tabak', 'mutfak', 'Tabak ve Kase', /\b(plates?|bowls?|platter|dish|serving tray|tray)\b/, /\b(license plate|plate carrier|pet bowl|dog bowl|cat bowl|name plate|door plate)\b/],
  ['mutfak-kesme-tahtasi', 'mutfak', 'Kesme Tahtası', /\b(cutting board|chopping board|charcuterie|cheese board|serving board)\b/],
  ['mutfak-diger', 'mutfak', 'Diğer Mutfak Ürünleri', /\b(oven mitt|pot holder|kitchen towel|tea towel|placemats?|place mats?|ironing board cover|table runner|napkin|bottle opener|spoon|fork|knife|lunchbox|jar|teapot|kettle|chopsticks?|bento|fridge magnet|trivet)\b/],

  // --- ev
  ['ev-yastik', 'ev', 'Yastık ve Kırlent', /\b(pillows?|cushions?|pillowcase|pillow case|pillow cover|cushion cover|sham)\b/, /\b(pin cushion|pet (cushion|pillow))\b/],
  ['ev-battaniye', 'ev', 'Battaniye ve Pike', /\b(blankets?|throws?|quilt|comforter|afghan|sherpa)\b/, /\b(throw pillow|pet blanket|dog blanket)\b/],
  ['ev-nevresim', 'ev', 'Nevresim ve Yatak Örtüsü', /\b(duvet|bedding|bed ?sheets?|fitted sheet|flat sheet|bedspread|bed set|coverlet)\b/],
  ['ev-havlu', 'ev', 'Havlu', /\b(towels?|washcloth|bath mat)\b/, /\b(tea towel|kitchen towel)\b/],
  ['ev-perde', 'ev', 'Perde ve Duş Perdesi', /\b(curtains?|shower curtain|drapes?|window (panel|valance)|blackout)\b/],
  ['ev-hali', 'ev', 'Halı ve Paspas', /\b(rugs?|carpet|doormat|door mat|floor mats?|anti-fatigue mats?|area rug|bath rug|runner rug|welcome mat)\b/, /\b(mug rug|car (floor )?mat|yoga mat|mouse ?mat)\b/],
  ['ev-masa-ortusu', 'ev', 'Masa Örtüsü', /\b(tablecloth|table cloth|table cover)\b/],
  ['ev-mum', 'ev', 'Mum ve Koku', /\b(candles?|wax melt|diffuser)\b/, /\b(box|holder)\b/],
  ['ev-saat', 'ev', 'Duvar ve Masa Saati', /\b(wall clock|clock)\b/],
  ['ev-bayrak', 'ev', 'Bayrak ve Flama', /\b(flags?|banner|pennant|bunting|garden flag|house flag)\b/],
  ['ev-sus', 'ev', 'Yılbaşı Süsü ve Ornament', /\b(ornaments?|christmas ball|bauble|tree topper|christmas stocking|stocking|advent)\b/],
  ['ev-priz', 'ev', 'Priz ve Anahtar Kapağı', /\b(switch (cover|plate)|outlet cover|light switch)\b/],
  ['ev-lamba', 'ev', 'Lamba ve Gece Lambası', /\b(lamp|night light|nightlight|led light|light box|lightbox|lantern)\b/],
  ['ev-tabela', 'ev', 'Tabela ve Plaka', /\b(signs?|plaque|door hanger|name plate|nameplate|license plate|wreath)\b/, /\b(sign(ature|ed)|design)\b/],
  ['ev-saklama', 'ev', 'Saklama ve Kutu', /\b(storage (box|basket|bin)|basket|jewelry box|trinket|keepsake box|gift box|tissue box|organizer|shadow box|tins?|wooden (decor )?box|pill box|pegboard)\b/],
  ['ev-buzdolabi-magneti', 'ev', 'Buzdolabı Magneti', /\b(magnets?|fridge magnet)\b/],
  ['ev-bahce', 'ev', 'Bahçe ve Dış Mekan', /\b(garden|outdoor|patio|planter|flower ?pot|plant pot|bird ?house|stepping stone|yard sign|hammock|cornhole)\b/, /\b(garden flag)\b/],

  // --- duvar
  ['duvar-kanvas', 'duvar', 'Kanvas Tablo', /\b(canvas (print|wall|art|painting|gallery|wrap)|stretched canvas|framed canvas|canvas)\b/, /\b(bella\s*\+?\s*canvas|canvas (bag|tote|shoes?|sneakers?|backpack|pouch|apron))\b/],
  ['duvar-cerceveli', 'duvar', 'Çerçeveli Baskı', /\b(framed (poster|print|art|photo|wall art|murals?)|frame)\b/, /\b(frame (bag|license))\b/],
  ['duvar-poster', 'duvar', 'Poster ve Baskı', /\b(posters?|art prints?|fine art|giclee|photo (print|paper)|matte print|glossy print|print on paper|photo print|wall print)\b/, /\b(postcards?|cards?)\b/],
  ['duvar-metal', 'duvar', 'Metal Baskı', /\b(metal (print|wall|art|sign|poster)|aluminum (print|sign)|tin sign)\b/],
  ['duvar-akrilik', 'duvar', 'Akrilik ve Cam Baskı', /\b(acrylic (print|block|wall|photo|plaque|panel|art)|glass (print|wall art|photo))\b/],
  ['duvar-ahsap', 'duvar', 'Ahşap Baskı', /\b(wood(en)? (print|wall|art|sign|plaque|panel)|photo block)\b/],
  ['duvar-duvar-halisi', 'duvar', 'Duvar Halısı (Tapestry)', /\b(tapestry|tapestries|wall hanging)\b/],
  ['duvar-sticker', 'duvar', 'Duvar Sticker ve Duvar Kağıdı', /\b(wall (decal|sticker|mural)|wallpaper|peel and stick)\b/],

  // --- kırtasiye
  ['kirtasiye-sticker', 'kirtasiye', 'Sticker ve Etiket', /\b(stickers?|decals?|labels?|temporary tattoos?|tattoos?|kiss[- ]cut|die[- ]cut|vinyl)\b/, /\b(label printer)\b/],
  ['kirtasiye-defter', 'kirtasiye', 'Defter ve Ajanda', /\b(notebooks?|journals?|planner|diary|notepad|sketchbook|composition book|spiral)\b/],
  ['kirtasiye-kart', 'kirtasiye', 'Tebrik Kartı ve Kartpostal', /\b(greeting cards?|postcards?|cards?|invitation|thank you card|note card|business card)\b/, /\b(card (holder|case|game|deck)|playing cards?|tarot|cardholder|cardigan|sd card)\b/],
  ['kirtasiye-takvim', 'kirtasiye', 'Takvim', /\b(calendars?)\b/],
  ['kirtasiye-ambalaj', 'kirtasiye', 'Ambalaj Kağıdı', /\b(wrapping paper|gift wrap|tissue paper)\b/],
  ['kirtasiye-kalem', 'kirtasiye', 'Kalem ve Ofis', /\b(pens?|pencils?|bookmarks?|clipboard|binder|folder|desk (mat|pad)|stamp|eraser)\b/, /\b(pencil (case|pouch|bag)|pendant|penguin)\b/],

  // --- teknoloji
  ['teknoloji-telefon-kilifi', 'teknoloji', 'Telefon Kılıfı', /\b(phone cases?|iphone|samsung|galaxy|pixel|cell phone|tough case|snap case|slim case|flexi case|biodegradable case|magsafe)\b/, /\b(phone (stand|holder|grip|charm|strap))\b/],
  ['teknoloji-airpods', 'teknoloji', 'Kulaklık Kılıfı', /\b(airpods?|earbuds? case|headphone case)\b/],
  ['teknoloji-mousepad', 'teknoloji', 'Mouse Pad ve Masa Matı', /\b(mouse ?pads?|mouse ?mat|desk ?mat|gaming mat|keyboard mat)\b/],
  ['teknoloji-tutucu', 'teknoloji', 'Telefon Tutucu ve Aksesuar', /\b(pop ?sockets?|phone (grip|stand|holder|charm|strap|wallet)|wireless charger|charging pad|power bank|cable)\b/],
  ['teknoloji-cihaz-kaplama', 'teknoloji', 'Cihaz Kaplaması', /\b(skins?|laptop skin|console skin|switch (case|skin)|controller)\b/, /\b(skinny|skin care)\b/],

  // --- oyun
  ['oyun-puzzle', 'oyun', 'Yapboz (Puzzle)', /\b(puzzles?|jigsaw)\b/],
  ['oyun-kart', 'oyun', 'Oyun Kartı ve Tarot', /\b(playing cards?|card game|tarot|deck of cards|oracle cards|trading cards?|flash ?cards?)\b/],
  ['oyun-masa', 'oyun', 'Masa Oyunu', /\b(board game|mahjong|chess|dice|game board|domino|backgammon|poker chips?)\b/],
  ['oyun-pelus', 'oyun', 'Peluş ve Oyuncak', /\b(plush|stuffed|teddy|toy|doll|squishy|stress ball)\b/],
  ['oyun-sanat', 'oyun', 'Boyama ve Hobi', /\b(paint by numbers?|diamond painting|coloring|colouring|cross stitch|embroidery kit)\b/],

  // --- araç / spor / outdoor
  ['arac-aksesuar', 'arac-outdoor', 'Araç Aksesuarı', /\b(car (seat|floor|mat|sun ?shade|air freshener|coaster|cover|accessor|sticker|magnet|flag)|seat ?belt|steering wheel|license plate (frame|cover)|tire cover|wheel cover|headrest|windshield)\b/],
  ['spor-yoga', 'arac-outdoor', 'Yoga ve Egzersiz Matı', /\b(yoga mat|exercise mat|fitness mat)\b/],
  ['spor-plaj', 'arac-outdoor', 'Plaj ve Piknik', /\b(beach (towel|blanket|chair|mat)|picnic (blanket|mat)|beach)\b/],
  ['spor-golf', 'arac-outdoor', 'Golf ve Spor Ekipmanı', /\b(golf|club head cover|head cover|tennis|pickleball|basketball|football|soccer ball|baseball bat|skateboard|surfboard|frisbee|kayak)\b/, /\b(baseball (cap|hat|tee|shirt|jersey))\b/],
  ['spor-kamp', 'arac-outdoor', 'Kamp ve Outdoor', /\b(camping|tent|hammock|sleeping bag|cooler)\b/],
];

const TYPES = T.map(([id, group, label, re, ex]) => ({ id, group, label, re, ex }));
const TYPE_BY_ID = new Map(TYPES.map(t => [t.id, t]));
const GROUP_LABEL = new Map(GROUPS);

// Kaynağın kaba kategorisi, başlık eşleşmezse yedek tip için kullanılır.
const CATEGORY_FALLBACK = {
  clothing: 'giyim-ust', drinkware: 'mutfak-bardak', bags: 'canta-diger', phone: 'teknoloji-telefon-kilifi',
  'wall-art': 'duvar-poster', pets: 'evcil-diger', stationery: 'kirtasiye-kalem', kids: 'cocuk-giyim',
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[_|/]+/g, ' ').replace(/\s+/g, ' ');
}

function classify(p) {
  const text = norm([p.title, p.leafLabel].filter(Boolean).join(' '));
  for (const t of TYPES) {
    if (t.re.test(text) && !(t.ex && t.ex.test(text))) return { type: t.id, group: t.group, matched: 'title' };
  }
  const fb = CATEGORY_FALLBACK[p.category];
  if (fb) { const t = TYPE_BY_ID.get(fb); return { type: t.id, group: t.group, matched: 'category' }; }
  return { type: 'diger', group: 'diger', matched: 'none' };
}

// Boş ürün markaları ve model kodları: aynı model farklı üreticilerde karşılaştırılabilir.
const BRANDS = [
  ['gildan', 'Gildan', /\bgildan\b/],
  ['bella-canvas', 'Bella+Canvas', /\bbella\s*(\+|and|&)?\s*canvas\b|\bb\s*\+\s*c\b|\bbella\b/],
  ['comfort-colors', 'Comfort Colors', /\bcomfort colou?rs\b/],
  ['next-level', 'Next Level', /\bnext level\b/],
  ['district', 'District', /\bdistrict\b/],
  ['port-company', 'Port & Company', /\bport\s*(&|and)?\s*company\b/],
  ['independent-trading', 'Independent Trading Co.', /\bindependent trading\b/],
  ['as-colour', 'AS Colour', /\bas colou?r\b/],
  ['stanley-stella', 'Stanley/Stella', /\bstanley\s*\/?\s*(and\s*)?stella\b/],
  ['american-apparel', 'American Apparel', /\bamerican apparel\b/],
  ['champion', 'Champion', /\bchampion\b/],
  ['hanes', 'Hanes', /\bhanes\b/],
  ['jerzees', 'Jerzees', /\bjerzees\b/],
  ['lane-seven', 'Lane Seven', /\blane seven\b/],
  ['sport-tek', 'Sport-Tek', /\bsport-?tek\b/],
  ['anvil', 'Anvil', /\banvil\b/],
  ['tultex', 'Tultex', /\btultex\b/],
  ['shaka-wear', 'Shaka Wear', /\bshaka\b/],
  ['awdis', 'AWDis', /\bawdis\b|\bjust hoods\b/],
  ['fruit-of-the-loom', 'Fruit of the Loom', /\bfruit of the loom\b/],
  ['russell', 'Russell Athletic', /\brussell\b/],
  ['rabbit-skins', 'Rabbit Skins', /\brabbit skins\b/],
  ['yupoong', 'Yupoong / Flexfit', /\byupoong\b|\bflexfit\b/],
  ['richardson', 'Richardson', /\brichardson\b/],
  ['otto', 'Otto Cap', /\botto\b/],
  ['cotton-heritage', 'Cotton Heritage', /\bcotton heritage\b/],
  ['los-angeles-apparel', 'Los Angeles Apparel', /\blos angeles apparel\b/],
];

function detectModel(p) {
  const text = norm(p.title + ' ' + (p.aliases || []).join(' '));
  // Başlıkta ilk geçen marka esas alınır ("Fruit of the Loom 3930R / Port & Company PC54" -> Fruit of the Loom)
  const hits = BRANDS.map(([id, name, re]) => { const m = re.exec(text); return m && { id, name, m }; }).filter(Boolean).sort((a, b) => a.m.index - b.m.index);
  const CODE = /\b([a-z]{0,3}\d{3,5}[a-z]{0,4}|[a-z]{1,3}\d{2}[a-z]{0,2})\b/;
  for (const { id, name, m } of hits) {
    // marka adından sonra gelen ilk model kodu (ör. 5000, 18500, 3001cvc, h000, 1717, pc54)
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const code = CODE.exec(after) || (hits.length === 1 ? /\b([a-z]{0,3}\d{3,5}[a-z]{0,4})\b/.exec(text.slice(0, m.index)) : null);
    if (!code) { if (hits.length === 1) return { brand: id, brandName: name, model: null, key: null }; continue; }
    const model = code[1].toUpperCase();
    if (/^(19|20)\d\d$/.test(model) && !/\b(gildan|comfort)/.test(id)) continue; // yıl gibi görünen sayılar
    return { brand: id, brandName: name, model, key: `${id}-${model.toLowerCase()}` };
  }
  return null;
}

module.exports = { GROUPS, TYPES, TYPE_BY_ID, GROUP_LABEL, classify, detectModel, norm };
