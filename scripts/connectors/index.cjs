// Yeni bağlayıcı kayıt defteri. public-connectors.cjs bu listeyi adapters ve collect'e ekler.
// Modüller döngüsel bağımlılık olmasın diye ilk kullanımda yüklenir (load).
'use strict';
const def = (base, file) => ({ base, load: () => require(file) });
module.exports = {
  printify: def('https://printify.com/app/products', './printify.cjs'),
  dreamship: def('https://dreamship.com/products', './dreamship.cjs'),
  prodigi: def('https://www.prodigi.com/products/', './prodigi.cjs'),
};
