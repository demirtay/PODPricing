// Yeni bağlayıcı kayıt defteri. public-connectors.cjs bu listeyi adapters ve collect'e ekler.
// Modüller döngüsel bağımlılık olmasın diye ilk kullanımda yüklenir (load).
'use strict';
const def = (base, file) => ({ base, load: () => require(file) });
// Ortak JSON-LD bağlayıcısını kullanan üreticiler: { id: ana sayfa }
const jsonld = { simpleprint: 'https://www.simpleprint.com/', wooacry: 'https://wooacry.com/', whcc: 'https://www.whcc.com/', fourthwall: 'https://fourthwall.com/', customizingbox: 'https://www.customizingbox.com/', muzefab: 'https://muzefab.com/', snapwear: 'https://snapwear.pro/', viviaprint: 'https://viviaprint.com/', printonic: 'https://printonic.com/', merchfactory: 'https://www.merchfactory.in/', printiturk: 'https://www.printiturk.com/' };

module.exports = {
  printify: def('https://printify.com/app/products', './printify.cjs'),
  dreamship: def('https://dreamship.com/products', './dreamship.cjs'),
  prodigi: def('https://www.prodigi.com/products/', './prodigi.cjs'),
  gearlaunch: def('https://www.gearlaunch.com/', './gearlaunch.cjs'),
  merchone: def('https://merchone.com/', './merchone.cjs'),
  contrado: def('https://www.contrado.com/', './contrado.cjs'),
  neatopod: def('https://www.neatopod.com/', './neatopod.cjs'),
  pillowprofits: def('https://pillowprofits.com/', './pillowprofits.cjs'),
  shirtee: def('https://shirtee.cloud/', './shirtee.cjs'),
  getfuelpod: def('https://www.getfuelpod.com/', './getfuelpod.cjs'),
  printops: def('https://printops.com/', './printops.cjs'),
  finerworks: def('https://finerworks.com/products/', './finerworks.cjs'),
  sellfy: def('https://sellfy.com/pod-catalogue/', './sellfy.cjs'),
  ownprint: def('https://ownprint.co/print-on-demand-jewelry', './ownprint.cjs'),
  oneprint: def('https://oneprint.io/products', './oneprint.cjs'),
  novatomato: def('https://www.novatomato.com/', './novatomato.cjs'),
  printway: def('https://printway.io/en/all-products', './printway.cjs'),
  subliminator: def('https://app.subliminator.com/catalog', './subliminator.cjs'),
  toaddit: def('https://www.toaddit.com/allProducts', './toaddit.cjs'),
  scalablepress: def('https://scalablepress.com/catalog', './scalablepress.cjs'),
  marketprint: def('https://marketprint.de/en/catalog', './marketprint.cjs'),
  makeplayingcards: def('https://www.makeplayingcards.com/', './makeplayingcards.cjs'),
  artelo: def('https://www.artelo.com/pricing', './artelo.cjs'),
  ...Object.fromEntries(['promio', 'ecomerch'].map(id => [id, { base: require('./promio-platform.cjs').SITES[id].base + '/products', load: () => ({ collect: progress => require('./promio-platform.cjs').collect(id, progress) }) }])),
  printgenie: def('https://www.printgenie.com/products', './printgenie.cjs'),
  lumaprints: def('https://lumaprints.com/pricing/', './lumaprints.cjs'),
  shirtigo: def('https://www.shirtigo.com/', './shirtigo.cjs'),
  printmood: def('https://www.printmood.com/', './printmood.cjs'),
  inkpod: def('https://www.inkpodfulfillment.com/', './inkpod.cjs'),
  pengine: def('https://www.pengine.io/', './pengine.cjs'),
  printdropper: def('https://printdropper.com/products', './printdropper.cjs'),
  artofwhere: def('https://artofwhere.com/products', './artofwhere.cjs'),
  ...Object.fromEntries(Object.entries(require('./pricing-cards.cjs').SITES).map(([id, s]) => [id, {
    base: new URL(s.page).origin + '/', load: () => ({ collect: progress => require('./pricing-cards.cjs').collect(id, progress) }),
  }])),
  ...Object.fromEntries(Object.entries(jsonld).map(([id, base]) => [id, {
    base, load: () => ({ collect: progress => require('./jsonld-sitemap.cjs').collect(id, progress) }),
  }])),
};
