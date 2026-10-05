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
  ['cocuk-giyim', 'cocuk-bebek', 'Çocuk Giyim', /\b(kids?|youth|toddler|infant|baby|children'?s?|boys?|girls?|child)\b.*\b(t-?shirt|tee|shirt|hoodie|sweatshirt|dress|pajamas?|pants|shorts|leggings|jacket|swimsuit|swimwear|set|tank|jersey|top|skirt|outfit|socks|sweater|romper|jumpsuit|vest|polo|robe|bathrobe|cardigan|capes?)\b|\b(t-?shirts?|tees?|hoodies?|sweatshirts?|dress|pajamas?|pants|shorts|jackets?|swimsuit|sets?|tops?) for (kids|toddlers?|children|boys|girls|babies|baby)\b/],

  // --- ayakkabı
  ['ayakkabi-sneaker', 'ayakkabi', 'Spor Ayakkabı', /\b(sneakers?|cleats|running shoes|canvas shoes?|high[- ]?top|low[- ]?top|shoes?|trainers|loafers|slip[- ]on)\b/, /\b(bag|shoe bag|shoelaces?|laces|tongue|label|case|charm)\b/],
  ['ayakkabi-terlik', 'ayakkabi', 'Terlik ve Sandalet', /\b(slippers?|slides?|sliders|badelatschen|flip[- ]?flops?|sandals?|clogs?|crocs)\b/, /\b(slide (sign|show)|slider)\b/],
  ['ayakkabi-bot', 'ayakkabi', 'Bot', /\b(boots?)\b/, /\b(boot (cuff|socks)|car boot|shoelaces?|laces)\b/],

  // --- giyim
  ['giyim-mayo', 'giyim', 'Mayo ve Bikini', /\b(swimsuit|swimwear|bikini|swim trunks?|board shorts?|boardshorts|bathing suit|swim (shorts|briefs?|dress|top|suit|trunks|jammer|team)|swimming trunks|jammers?|volley shorts?|rash guard|tankini|monokini|one[- ]piece swim|water ?polo (briefs?|suits?|jammers?|swimsuits?))/],
  ['giyim-ic-giyim', 'giyim', 'İç Giyim', /\b(briefs?|boxers?|underwear|panties|thongs?|g-?strings?|tanga|t-back|bra|sports? bh|bralette|lingerie|boxer briefs?)\b/, /\b(swim)/],
  ['giyim-pijama', 'giyim', 'Pijama ve Sabahlık', /\b(pajamas?|pyjamas?|pj set|sleepwear|nightgown|nightdress|night shirt|robes?|bathrobes?|lounge set|loungewear|sleep (shirt|dress|set))\b/],
  ['giyim-corap', 'giyim', 'Çorap', /\b(socks?|socken|pantyhose|stockings?)\b/, /\b(santa|christmas|xmas|holiday) stocking/],
  ['giyim-forma', 'giyim', 'Spor Forması', /\b(jersey)\b/, /\b(jersey (knit|fabric|cotton|tee|t-?shirt|short sleeve)|single jersey|jersey dress)\b/],
  ['giyim-polo', 'giyim', 'Polo Yaka', /\bpolo\b/],
  ['giyim-fermuarli-kapusonlu', 'giyim', 'Fermuarlı Kapüşonlu', /\b(zip[- ]?up|boxcut zipper|connector zipper|zip hoodie|zip hood|full[- ]zip|zipper hoodie|zip[- ]up (hooded )?sweatshirt|zip[- ]up jacket hoodie)\b/, /\b(bomber|vest|windbreaker|track jacket)\b/],
  ['giyim-kapusonlu', 'giyim', 'Kapüşonlu Sweatshirt (Hoodie)', /\b(hoodies?|hooded (sweatshirt|pullover|top)|hoody|(heavy|relax|faded|made|stencil|safety|camo|supply|premium|women's|mens?|kids) hood)\b/, /\b(hooded (towel|blanket|poncho|cape)|hoodie (towel|blanket)|towel|knob|car shift|ornament|keychain|pillow|blanket)\b/],
  ['giyim-sweatshirt', 'giyim', 'Sweatshirt', /\b(sweatshirts?|crew ?neck (sweat|pullover|fleece)|crewneck|pullover|(heavy|relax|faded|made|stencil|premium|women's|mens?) crew|fleece (crew|top)|quarter[- ]zip|1\/4[- ]?zip|1 4[- ]?zip|half[- ]zip)\b/, /\b(hoodie|hooded)\b/],
  ['giyim-hirka-kazak', 'giyim', 'Kazak ve Hırka', /\b(sweaters?|cardigans?|knit(ted)? (top|jumper)|jumper)\b/],
  ['giyim-ceket', 'giyim', 'Ceket ve Mont', /\b(jackets?|bomber|windbreaker|coat|parka|varsity|blazer|anorak|puffer|soft ?shell|shell jacket|performance shell|outerwear|shacket|coach jacket|trench|jacke|parker|parka)\b/, /\b(jacket potato|coat hanger|coaster|vest)\b/],
  ['giyim-yelek', 'giyim', 'Yelek', /\b(vest|gilet|waistcoat|bodywarmer|body warmer)\b/, /\b(tank|singlet)\b/],
  ['giyim-gomlek', 'giyim', 'Gömlek', /\b(button[- ]?(up|down)|hawaiian shirt|aloha shirt|flannel shirt|camp shirt|bowling shirt|dress shirt|oxford shirt|denim shirt|linen shirt|cuban collar|shirt jacket|work shirt|blouse)\b|\b(hawaiian|aloha|flannel|bowling|baseball)\s+shirt/],
  ['giyim-elbise', 'giyim', 'Elbise', /\b(dress|dresses|sundress|gown|maxi|midi|kaftan|caftan)\b/, /\b(dress shirt|dress socks|dresser|address)\b/],
  ['giyim-etek', 'giyim', 'Etek', /\b(skirts?|skorts?)\b/],
  ['giyim-tulum', 'giyim', 'Tulum', /\b(jumpsuit|overalls?|playsuit|romper|dungarees)\b/],
  ['giyim-tayt', 'giyim', 'Tayt', /\b(leggings?|tights|yoga pants|capri)\b/],
  ['giyim-sort', 'giyim', 'Şort', /\b(shorts|short pants|bermuda|biker shorts|(volley|running|athletic|gym|sweat|competitor|performance|bike|knit|jersey) shorts?|\d+['"″]? short)\b/, /\b(short sleeve|short-sleeve)\b(?!.*\bshorts\b)/],
  ['giyim-pantolon', 'giyim', 'Pantolon ve Eşofman Altı', /\b(pants|pant|jeans|joggers?|sweatpants?|wide leg|trousers|track pants|cargo|culottes?|palazzo|chinos|bottoms)\b/],
  ['giyim-takim', 'giyim', 'Takım', /\b(tracksuit|sweatsuit|two[- ]piece|2[- ]piece|co[- ]ord|matching set|outfit set|suit set|short set|pant set|(hawaiian|scrubs?|yoga|workout|sports?) set|uniforms?|cheerleading)\b/],
  ['giyim-crop', 'giyim', 'Crop Top', /\b(crop(ped)? (top|tee|t-?shirt|tank|hoodie|sweatshirt)?|crop|navel)\b/, /\b(hoodie|sweatshirt)\b/],
  ['giyim-atlet', 'giyim', 'Atlet ve Kolsuz', /\b(tank ?tops?|tanks?|sleeveless|singlet|camisole|cami|muscle (tee|shirt)|racerback|halter)\b/, /\b(water tank|fish tank|tank (car|truck)|halter (dress|neck dress))\b/],
  ['giyim-uzun-kollu', 'giyim', 'Uzun Kollu Tişört', /\b(long[- ]?sleeves?|ls tee|long sleeved)\b/, /\b(dress|hoodie|sweatshirt|jacket)\b/],
  ['giyim-raglan', 'giyim', 'Raglan ve Beyzbol Tişört', /\b(raglan|baseball tee|3\/4 sleeve)\b/],
  ['giyim-tisort', 'giyim', 'Tişört', /\b(t-?shirts?|tees?|t shirts?|tshirts?|crew ?neck|v[- ]?neck|short[- ]sleeves?|heavyweight|boxy|oversized|garment[- ]dyed|softstyle|ringspun|ring[- ]spun)\b/],
  ['giyim-ust', 'giyim', 'Bluz ve Üst', /\b(tops?|shirts?|blouse|tunic|bodysuit|cover[- ]?up|kimono|poncho|dolman|capes?|turtleneck|mock neck|baselayer|base layer|cloak|big ?& ?tall)\b/, /\b(shirt (box|bag)|t-?shirt (bag|box)|blankets?|throws?)\b/],
  ['giyim-onluk', 'aksesuar', 'Önlük', /\b(aprons?|schürze)\b/],

  // --- aksesuar
  ['aksesuar-ayakkabi', 'aksesuar', 'Ayakkabı Bağcığı ve Etiket', /\b(shoelaces?|shoe laces?|shoe (tongue )?labels?|shoe charms?|tongue label)\b/],
  ['aksesuar-bere', 'aksesuar', 'Bere', /\b(beanies?|knit hat|toque|winter hat)\b/],
  ['aksesuar-sapka', 'aksesuar', 'Şapka', /\b(caps?|hats?|snapback|trucker|bucket hat|visor|dad hat|fedora|sun ?hat|booney|boonie)\b/, /\b(cap sleeve|bottle cap|hubcap|caption|capacity|capri|cape|hat (box|rack))\b/],
  ['aksesuar-maske', 'aksesuar', 'Maske ve Boyunluk', /\b(face mask|face cover|mask|gaiter|neck gaiter|balaclava|eye mask|sleep mask|buff)\b/],
  ['aksesuar-esarp', 'aksesuar', 'Eşarp, Bandana ve Fular', /\b(scarf|scarves|bandanas?|shawl|stoles?|graduation (sash|lei)|braided lei|(?<!wreath )sash|handkerchief|neckerchiefs?|scrunchies|headband|hair tie|scrunchie|head ?wrap|durag|du-rag|turban)\b/],
  ['aksesuar-kravat', 'aksesuar', 'Kravat ve Papyon', /\b(neck ?ties?|neckties?|bow ?ties?|tie clip|silk ties?|ties for men)\b/],
  ['aksesuar-taki', 'aksesuar', 'Takı', /\b(necklace|pendant|bracelet|bangle|earrings?|rings?|jewelry|jewellery|anklet|charm|locket|cufflinks?|brooch)\b/, /\b(key ?ring|ring binder|ring light|ringer|o-ring|spring|string|earring holder|boxing ring)\b/],
  ['aksesuar-saat', 'aksesuar', 'Saat ve Kordon', /\b(watch ?bands?|watch strap|apple watch|i?watch|watches|wrist ?watch|smartwatch band)\b/],
  ['aksesuar-cuzdan', 'aksesuar', 'Cüzdan ve Kartlık', /\b(wallet|card holder|cardholder|card case|coin purse|passport (holder|cover)|money clip)\b/],
  ['aksesuar-anahtarlik', 'aksesuar', 'Anahtarlık', /\b(key ?chains?|key ?rings?|keyring|key fob|key tag|key holder|key case|luggage tags?|lanyard)\b/],
  ['aksesuar-rozet', 'aksesuar', 'Rozet, Pin ve Arma', /\b(pins?|enamel pin|badges?|button badge|pinback|patch|patches|emblem)\b/, /\b(pin cushion|bowling pin|hairpin|pinwheel)\b/],
  ['aksesuar-bakim', 'aksesuar', 'Ayna, Tarak ve Kişisel Bakım', /\b(compact mirror|pocket mirror|mirror|comb|hair ?brush|nail (file|cutter|clipper)|manicure|contact lens case)\b/],
  ['aksesuar-gozluk', 'aksesuar', 'Gözlük', /\b(sunglasses|glasses case|eyeglass(es)? case|eyewear)\b/],
  ['aksesuar-semsiye', 'aksesuar', 'Şemsiye', /\b(umbrella)\b/],
  ['aksesuar-eldiven', 'aksesuar', 'Eldiven', /\b(gloves?|mittens?)\b/],
  ['aksesuar-kemer', 'aksesuar', 'Kemer ve Askı', /\b(belts?|suspenders|guitar strap|camera strap)\b/, /\b(seat ?belt|belt bag)\b/],
  ['aksesuar-diger', 'aksesuar', 'Diğer Aksesuarlar', /\b(lighter (case|casing|cover)|cigarette case|arm (sleeves?|cover)|(hand|folding) fans?|hand warmer|nursing cover|barber cape|hair (clip|claw)|lighter|oversleeves?|waterproof sleeve|haircut cape|guitar (picks|plectrums)|plectrums?|bellyband|hook case|sweatbands?)\b/],

  // --- çanta
  ['canta-bez', 'canta', 'Bez Çanta (Tote)', /\b(tote|totes|shopper|shopping bag|grocery bag|canvas bag|cotton bag|jute bag|market bag|reusable bag|beach bag)\b/],
  ['canta-sirt', 'canta', 'Sırt Çantası', /\b(backpacks?|rucksack|school ?bag|book ?bag|daypack)\b/],
  ['canta-buzgulu', 'canta', 'Büzgülü Çanta', /\b(drawstring (bag|backpack|sack)|gym ?sack|cinch bag|string bag)\b/],
  ['canta-bel', 'canta', 'Bel ve Göğüs Çantası', /\b(fanny pack|waist bag|belt bag|bum bag|sling bag|chest bag|hip bag)\b/],
  ['canta-kozmetik', 'canta', 'Makyaj ve Kozmetik Çantası', /\b(makeup bag|cosmetic (bag|pouch|case)|toiletry|pencil (case|pouch|bag)|accessory pouch|zipper pouch|pouch|wash bag|travel case|dopp kit)\b/],
  ['canta-beslenme', 'canta', 'Beslenme Çantası', /\b(lunch (bag|box|tote)|cooler bag|insulated bag|bento)\b/],
  ['canta-laptop', 'canta', 'Laptop ve Tablet Kılıfı', /\b(laptop (sleeve|bag|case|cover)|macbook (sleeve|case)|tablet (sleeve|case)|ipad (sleeve|case|cover)|kindle)\b/],
  ['canta-seyahat', 'canta', 'Seyahat ve Spor Çantası', /\b(duffel|duffle|weekender|travel bag|gym bag|luggage|suitcase|packing cubes?|garment bag|sports bag)\b/, /\b(luggage tag)\b/],
  ['canta-el-omuz', 'canta', 'El ve Omuz Çantası', /\b(handbag|shoulder bag|crossbody|cross-body|messenger|clutch|purse|satchel|hobo|bucket bag|saddle bag|tote handbag|underarm bag|camera bag)\b/],
  ['canta-diger', 'canta', 'Diğer Çantalar', /\b(bags?|\w*tasche)\b/, /\b(bag clip|bean bag|tea bag|sleeping bag|punching bag|bag tag)\b/],

  // --- mutfak
  ['mutfak-kupa', 'mutfak', 'Kupa (Mug)', /\b(mugs?|tasse|coffee cup|enamel cup|camping cup|latte cup|espresso cup)\b/, /\b(mug (rug|mat|coaster)|mugshot)\b/],
  ['mutfak-termos', 'mutfak', 'Termos ve Tumbler', /\b(tumblers?|travel mug|thermos|vacuum (flask|cup|insulated)|insulated (cup|tumbler)|stanley|skinny|yeti)\b/, /\b(stanley\s*\/?\s*stella)/],
  ['mutfak-matara', 'mutfak', 'Matara ve Su Şişesi', /\b(water bottles?|bottles?|flask|hip flask|sports bottle|canteen|protein shaker|shaker (bottle|cup)|hydrapeak(?! food)|trinkflasche|flasche)\b/, /\b(bottle opener|bottle (holder|cooler|koozie|sleeve)|wine bottle bag)\b/],
  ['mutfak-bardak', 'mutfak', 'Bardak ve Kadeh', /\b(glass(es)?|stemless|corkcicle|pint|shot glass|wine glass|beer (stein|can glass)|can glass|stein|tankard|goblet|whiskey|champagne flute|cups?|sippy)\b/, /\b(clock|glasses case|sunglasses|glass (frame|print|wall art|sign|ornament|cutting board))\b/],
  ['mutfak-sogutucu', 'mutfak', 'Kutu Soğutucu (Koozie)', /\b(koozies?|can (cooler|holder|sleeve)|stubby holder|beer sleeve|bottle cooler|drink holder|beverage holder)\b/],
  ['mutfak-bardak-alti', 'mutfak', 'Bardak Altlığı', /\b(coasters?)\b/],
  ['mutfak-tabak', 'mutfak', 'Tabak ve Kase', /\b(plates?|bowls?|platter|dish|serving tray|tray)\b/, /\b(license plate|plate carrier|pet bowl|dog bowl|cat bowl|name plate|door plate)\b/],
  ['mutfak-kesme-tahtasi', 'mutfak', 'Kesme Tahtası', /\b(cutting board|chopping board|charcuterie|cheese board|serving board)\b/],
  ['mutfak-diger', 'mutfak', 'Diğer Mutfak Ürünleri', /\b(oven mitts?|pot (holders?|mat)|kitchen (towel|mat|set|drying pad)|drying (pad|mat)|coffee mat|bar (runner|mat)|egg holder|wine caddy|kitchen (insulation|\d-piece|three-piece|four-piece)|four-piece set|spatula|grill\w*|stir sticks?|wine stopper|napkins?|timer|tea box|popsicle|tea towel|placemats?|place mats?|table mats?|ironing board cover|table runners?|napkin|bottle opener|spoon|fork|knife|lunchbox|jar|teapot|kettle|chopsticks?|bento|fridge magnet|trivet)\b/],

  // --- ev
  ['ev-yastik', 'ev', 'Yastık ve Kırlent', /\b(pillows?|cushions?|\w*kissen|pillowcases?|pillow case|pillow cover|cushion cover|sham)\b/, /\b(pin cushion|pet (cushion|pillow))\b/],
  ['ev-battaniye', 'ev', 'Battaniye ve Pike', /\b(blankets?|throws?|quilt|comforter|afghan|sherpa|decke)\b|blankets?(?=\d)/, /\b(throw pillow|pet blanket|dog blanket)\b/],
  ['ev-nevresim', 'ev', 'Nevresim ve Yatak Örtüsü', /\b(duvet|beddings?|bed runners?|bed ?sheets?|fitted sheet|flat sheet|bedspread|bed set|coverlet)\b/],
  ['ev-havlu', 'ev', 'Havlu', /\b(towels?|washcloth)\b/, /\b(tea towel|kitchen towel)\b/],
  ['ev-perde', 'ev', 'Perde ve Duş Perdesi', /\b(curtains?|shower curtain|drapes?|window (panels?|valances?)|valances?|blackout)\b/],
  ['ev-hali', 'ev', 'Halı ve Paspas', /rugs?(?=\d)|\b(rugs?|carpet|doormat|door mat|floor mats?|bath mats?|prayer mats?|stair treads?|toilet (set|mat)|three-piece toilet|bathroom (set|rug)|anti-?slip [\w ]{0,20}mats?|anti-fatigue mats?|area rug|bath rug|runner rug|welcome mat)\b/, /\b(mug rug|car (floor )?mat|yoga mat|mouse ?mat)\b/],
  ['ev-masa-ortusu', 'ev', 'Masa Örtüsü', /\b(tablecloths?|table cloths?|table covers?)\b/],
  ['ev-mum', 'ev', 'Mum ve Koku', /\b(candles?|wax melt|diffuser)\b/, /\b(box|holder)\b/],
  ['ev-saat', 'ev', 'Duvar ve Masa Saati', /\b(wall clock|clock)\b/],
  ['ev-bayrak', 'ev', 'Bayrak ve Flama', /\b(flags?|banners?|pennant|bunting|garden flag|house flag)\b/],
  ['ev-sus', 'ev', 'Yılbaşı Süsü ve Ornament', /\b(ornaments?|christmas ball|bauble|tree topper|christmas stocking|stocking|advent|santa sack|christmas (sacks?|balls?|stockings?|star)|star decorations?|(christmas|xmas) (tree|decorations?|hanging)|hanging decorations?|hut hanging)\b/],
  ['ev-priz', 'ev', 'Priz ve Anahtar Kapağı', /\b(switch (cover|plate)|outlet cover|light switch)\b/],
  ['ev-lamba', 'ev', 'Lamba ve Gece Lambası', /\b(lamp|night light|nigh light|nightlight|sconces?|(ceiling|string|led|acrylic|wooden|flush mount) lights?|light covers?|led light|light box|lightbox|lantern)\b/],
  ['ev-dekor', 'ev', 'Dekoratif Obje', /\b(wind ?chimes?|wind ?spinners?|suncatchers?|standees?|vases?|music box|candle holders?|crystal award|awards?|figurines?|statues?|bookends?|money holder|celebrations? board|display (set|stand|board)|decorative bow|photo (tiles?|panels?|stand)|ceramic (photo )?tiles?|wall tiles?|slates?|table ?top display|freestanding display|model board|car clip|balloons?|backdrop|spinning|rotating|snow globe|photo holder|shelf display|arch kit|party decoration|grad(uate)? ribbon|place ?holder|hanging decor|picture stands?|wood (slice|block)|standing|photo building block|mixpix|embroidered bunny|ribbon)\b/, /\b(smartphones?|phone|bookmarks?|wreath)\b/],
  ['ev-kilif', 'ev', 'Mobilya ve Ev Örtüleri', /\b(sofa (cover|protector)|futon|couch cover|slipcover|chair (covers?|back)|seat covers? for chairs|stool covers?|wingback|dust covers?|toaster cover|appliance cover|refrigerator (handle covers?|wrap)|fridge (door )?handle covers?|door cover|loveseat|(stove|dishwasher) cover|bench covers?)\b/],
  ['ev-tabela', 'ev', 'Tabela ve Plaka', /\b(signs?|plaque|door hanger|door plate|signage|name plate|nameplate|license plate|wreath)\b/, /\b(sign(ature|ed)|design)\b/],
  ['ev-saklama', 'ev', 'Saklama ve Kutu', /\b(storage (box|basket|bin)|basket|storage (crate|case)|crate|chest\b|trash can|piggy bank|tooth box|celebration box|collection box|shoe ?box|custom boxes|luxury boxes|jewelry box|trinket|memorial box|keepsake box|gift box|tissue box|organizer|shadow box|tins?|wooden (decor )?box|pill box|pegboard)\b/],
  ['ev-buzdolabi-magneti', 'ev', 'Buzdolabı Magneti', /\b(magnets?|fridge magnet)\b/],
  ['ev-bahce', 'ev', 'Bahçe ve Dış Mekan', /\b(garden|outdoor|patio|planter|flower ?pots?|plant (pots?|marker)|propagation|parterre|windsock|mailbox|shade sail|wagons?|bird ?house|stepping stone|yard sign|hammock|cornhole)\b/, /\b(garden flag)\b/],

  // --- duvar
  ['duvar-kanvas', 'duvar', 'Kanvas Tablo', /\b(canvas (print|wall|art|painting|gallery|wrap)|stretched canvas|framed canvas|canvas)\b/, /\b(bella\s*\+?\s*canvas|canvas (bag|tote|shoes?|sneakers?|backpack|pouch|apron))\b/],
  ['duvar-cerceveli', 'duvar', 'Çerçeveli Baskı', /\b(framed (poster|print|art|photo|wall art|murals?)|framed|frames?|passepartout)\b/, /\b(frame (bag|license)|plate frames?|sunglass)\b/],
  ['duvar-poster', 'duvar', 'Poster ve Baskı', /\b(posters?|art prints?|fine art|giclee|c-types?|photo lustre|photo satin|cotton rag|foil prints?|mounted prints?|triptych|diptych|height chart|hanging picture|hahnem\w*|baryta|(decorative|hanging|wall|panel) painting|paintings?|photo (print|paper)|matte print|glossy print|print on paper|photo print|wall print)\b/, /\b(postcards?|cards?|oil painting|diamond painting|paint by|wood(en)? panel)\b/],
  ['duvar-metal', 'duvar', 'Metal Baskı', /\b(metal (photo )?(prints?|wall|art|sign|poster|panel)|aluminum (print|sign)|tin sign|tinplate|dibond|(iron|metal) (hanging |wall )?painting)\b/],
  ['duvar-akrilik', 'duvar', 'Akrilik ve Cam Baskı', /\b(acrylic (prints?|block|wall|photo|plaque|panels?|art)|glass (print|wall art|photo))\b/],
  ['duvar-ahsap', 'duvar', 'Ahşap Baskı', /\b(wood(en)? (print|wall|art|sign|plaque|panels?)|photo block)\b/],
  ['duvar-duvar-halisi', 'duvar', 'Duvar Halısı (Tapestry)', /\b(tapestry|tapestries|wall hangings?)\b/],
  ['duvar-sticker', 'duvar', 'Duvar Sticker ve Duvar Kağıdı', /\b(wall (decal|sticker|mural)|wallpaper|peel and stick|window clings?)\b/],

  // --- kırtasiye
  ['kirtasiye-sticker', 'kirtasiye', 'Sticker ve Etiket', /\b(stickers?|decals?|labels?|temporary tattoos?|tattoos?|kiss[- ]cut|die[- ]cut|vinyl|hang tags?|wooden tag|name tags?|nfc tag|acrylic tag|packaging kit|shoes? tongue)\b/, /\b(label printer)\b/],
  ['kirtasiye-defter', 'kirtasiye', 'Defter ve Ajanda', /\b(notebooks?|journals?|planners?|photo ?books?|guest ?books?|server book|book (cover|sleeve)|chore chart|routine chart|read(ing)? (tracker|counter)|note cube|sticky notes|note ?pads?|post-it|diary|notepad|sketchbook|composition book|spiral)\b/],
  ['kirtasiye-kart', 'kirtasiye', 'Tebrik Kartı ve Kartpostal', /\b(greeting cards?|postcards?|cards?|invitation|thank you card|note card|business card)\b/, /\b(card (holder|case|game|deck)|playing cards?|tarot|cardholder|cardigan|sd card)\b/],
  ['kirtasiye-takvim', 'kirtasiye', 'Takvim', /\b(calendars?)\b/],
  ['kirtasiye-ambalaj', 'kirtasiye', 'Ambalaj Kağıdı', /\b(wrapping paper|gift wrap|tissue paper)\b/],
  ['kirtasiye-kalem', 'kirtasiye', 'Kalem ve Ofis', /\b(pens?|pencils?|staplers?|bookmarks?|clipboard|binder|folder|desk (mat|pad)|stamp|eraser)\b/, /\b(pencil (case|pouch|bag)|pendant|penguin)\b/],

  // --- teknoloji
  ['teknoloji-telefon-kilifi', 'teknoloji', 'Telefon Kılıfı', /\b(phone cases?|iphone|samsung|galaxy|pixel|cell phone|(tough|snap|slim|flexi|flip|biodegradable|impact-resistant|clear|magnetic|eco) cases?|magsafe)\b/, /\b(phone (stand|holder|grip|charm|strap))\b/],
  ['teknoloji-airpods', 'teknoloji', 'Kulaklık Kılıfı', /\b(airpods?|earbuds?|true wireless|headphone case)\b/],
  ['teknoloji-mousepad', 'teknoloji', 'Mouse Pad ve Masa Matı', /\b(mouse ?pads?|mouse ?mat|desk ?mat|gaming (mats?|pad)|keyboard (mat|wrist rest)|wrist rest pad)\b/],
  ['teknoloji-tutucu', 'teknoloji', 'Telefon Tutucu ve Aksesuar', /\b(pop ?sockets?|pop grips?|phone (grip|stand|holder|charm|strap|wallet)|wireless charger|charging pad|power bank|cable|airtag|positioner|screen protector|bluetooth speaker|speaker)\b/],
  ['teknoloji-cihaz-kaplama', 'teknoloji', 'Cihaz Kaplaması', /\b(skins?|laptop skin|console skin|switch (case|skin)|switch 2|nintendo|controller|cartridge)\b/, /\b(skinny|skin care)\b/],

  // --- oyun
  ['oyun-puzzle', 'oyun', 'Yapboz (Puzzle)', /\b(puzzles?|jigsaw)\b/],
  ['oyun-kart', 'oyun', 'Oyun Kartı ve Tarot', /\b(playing cards?|card game|tarot|deck of cards|oracle cards|trading cards?|flash ?cards?)\b/],
  ['oyun-masa', 'oyun', 'Masa Oyunu', /\b(board game|mahjong|chess|dice|game board|game box|tic tac toe|domino|backgammon|poker chips?|building blocks|mixblox|magic cube|rubik|dartboard|battle mat|playmat|beer pong|memory game)\b/],
  ['oyun-pelus', 'oyun', 'Peluş ve Oyuncak', /\b(plush|stuffed|teddy|toy|doll|squishy|stress ball)\b/],
  ['oyun-sanat', 'oyun', 'Boyama ve Hobi', /\b(paint by numbers?|diamond painting|(digital )?oil painting|coloring|colouring|cross stitch|embroidery kit)\b/],

  // --- araç / spor / outdoor
  ['arac-aksesuar', 'arac-outdoor', 'Araç Aksesuarı', /\b(car (seat|floor|mats?|sun ?shade|air freshener|coaster|cover|accessor|sticker|magnet|flag|trash|armrest|auto)|handbrake|armrest (pad|cover)|seat covers? for cars|back seat cover|motorcycle|mud flaps|vehicle|head ?rest covers?|car cloth|(car|auto) (sun ?)?shades?|seat covers?|hood cover|bicycle|bike (seat|cover)|seat ?belt|steering wheel|license plate (frame|cover)|tire cover|wheel cover|headrest|windshield)\b/],
  ['spor-yoga', 'arac-outdoor', 'Yoga ve Egzersiz Matı', /\b(yoga (mats?|tile|block)|exercise mats?|fitness mats?)\b/],
  ['spor-plaj', 'arac-outdoor', 'Plaj ve Piknik', /\b(beach (towel|blanket|chair|mat)|picnic (blanket|mat)|beach)\b/],
  ['spor-golf', 'arac-outdoor', 'Golf ve Spor Ekipmanı', /\b(golf|club head cover|head cover|tennis|pickleballs?|basketballs?|lacrosse|rugby|ping pong|baseballs?\b(?! (cap|hat|tee|shirt|jersey))|football|soccer ball|softballs?|hockey|balance bike|baseball bat|skateboards?|surfboard|frisbee|kayak)\b/, /\b(baseball (cap|hat|tee|shirt|jersey))\b/],
  ['ev-diger', 'ev', 'Diğer Ev Ürünleri', /\b(knobs?|toilet seat|underpads?|window (film|privacy)|sound absorbing|fabric by (the )?yard|tape measure|fans?|room divider|folding screen|plug adapter|filters?|drawer kno\w+)\b/],
  ['spor-kamp', 'arac-outdoor', 'Kamp ve Outdoor', /\b(camping|tent|hammock|sleeping bag|cooler|fishing)\b/],
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
  // başlıkta giysi türü yazmayan boş ürün modelleri ("Gildan 5000", "Stanley/Stella Cruiser 2.0 STSU177")
  let mt = modelType(text);
  if (mt && mt.startsWith('giyim-') && /\b(baby|kids?|youth|toddler|infant)\b|\bst(tb|tk)\d|\b\d{3,5}[by]\b/.test(text)) mt = 'cocuk-giyim';
  if (mt) { const t = TYPE_BY_ID.get(mt); return { type: t.id, group: t.group, matched: 'model' }; }
  // yalnızca tek tür ürün satan üreticiler (MerchFarm: takım mayoları; başlıklar takım adı)
  const pf = { merchfarm: 'giyim-mayo' }[p.providerId];
  if (pf) { const t = TYPE_BY_ID.get(pf); return { type: t.id, group: t.group, matched: 'provider' }; }
  const fb = CATEGORY_FALLBACK[p.category];
  if (fb) { const t = TYPE_BY_ID.get(fb); return { type: t.id, group: t.group, matched: 'category' }; }
  return { type: 'diger', group: 'diger', matched: 'none' };
}

// bilinen boş ürün modellerinin türü; listede olmayan giyim markası modeli 'giyim-ust'
const STYLE = {
  'giyim-tisort': /\b(gildan (g?5000[lb]?|g?64000[lb]?|g?2000[lb]?|h000|8000b?|980|64v00|3000)|bella\s*\+?\s*canvas (3001\w*|3413|3005|6004|6400|6405|1010)|comfort colou?rs (1717|6030)|next level (3600|3900|6210|3310|6010)|lat (apparel )?(6901|3516|6101|4411)|district (clothing )?(dt6000|dt5000)|fruit of the loom (3930\w*)|american apparel (1301\w*|2001))\b/,
  'giyim-sweatshirt': /\b(gildan (g?18000b?|sf000|12000)|bella\s*\+?\s*canvas (3901|3945)|comfort colou?rs (1566|1466|1467)|next level 9000)\b/,
  'giyim-kapusonlu': /\b(independent (trading co\.? )?ind4000|gildan (g?18500b?|sf500)|bella\s*\+?\s*canvas 3719|comfort colou?rs 1567|next level 9300)\b/,
  'giyim-fermuarli-kapusonlu': /\b(gildan (g?18600)|bella\s*\+?\s*canvas 3739)\b/,
  'giyim-uzun-kollu': /\b(gildan (g?2400|g?5400|64400)|bella\s*\+?\s*canvas 3501|comfort colou?rs 6014)\b/,
  'giyim-atlet': /\b(gildan (g?64200|2200)|bella\s*\+?\s*canvas (3480|8800|6008)|comfort colou?rs 9360)\b/,
};
const APPAREL_BRANDS = /\b(gildan|bella\s*\+?\s*canvas|comfort colou?rs|next level|district|port\s*(&|and)?\s*company|independent trading|as colou?r|american apparel|champion|hanes|jerzees|lane seven|sport-?tek|anvil|tultex|shaka|awdis|fruit of the loom|russell|rabbit skins|cotton heritage|los angeles apparel|la apparel|lat apparel|stormtech|delta|carhartt|westford mill|independent)\b/;
function modelType(text) {
  for (const [type, re] of Object.entries(STYLE)) if (re.test(text)) return type;
  if (/\b(yupoong|richardson|flexfit|otto cap)\b/.test(text)) return 'aksesuar-sapka';
  if (/\bstanley\s*\/?\s*(and\s*)?stella\b/.test(text)) {
    if (/\bst(tu|tw|tk|tm|tn)\d|\b(creator|sparker|blaster|rocker|freestyler|expresser|muser|evoker|isla|mini creator)\b/.test(text)) return 'giyim-tisort';
    if (/\b(cruiser|drummer|slammer|racer|archer)\b/.test(text)) return 'giyim-kapusonlu';
    if (/\bst(su|sw|sk|sc)\d|\b(changer|matcher|roller|ledger|former|radder)\b/.test(text)) return 'giyim-sweatshirt';
    if (/\bst(jm|ju|jw)\d/.test(text)) return 'giyim-ceket';
    return 'giyim-ust';
  }
  if (APPAREL_BRANDS.test(text)) return 'giyim-ust';
  return null;
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
