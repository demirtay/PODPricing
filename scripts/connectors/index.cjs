// Yeni bağlayıcı kayıt defteri. public-connectors.cjs bu listeyi adapters ve collect'e ekler.
// Modüller döngüsel bağımlılık olmasın diye ilk kullanımda yüklenir (load).
'use strict';
const def = (base, file) => ({ base, load: () => require(file) });
// Ortak JSON-LD bağlayıcısını kullanan üreticiler: { id: ana sayfa }
const jsonld = { simpleprint: 'https://www.simpleprint.com/' };

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
  lumaprints: def('https://lumaprints.com/pricing/', './lumaprints.cjs'),
  ...Object.fromEntries(Object.entries(jsonld).map(([id, base]) => [id, {
    base, load: () => ({ collect: progress => require('./jsonld-sitemap.cjs').collect(id, progress) }),
  }])),
};
