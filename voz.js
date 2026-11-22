/* Cesta: entender lo dictado o escrito.
   - parse(texto): trocea "dos leches, pan y tomate frito para Marta" en elementos con cantidad.
   - match(nombre, productos): busca en el catálogo.
   - classify(nombre, categorias, productos): adivina la categoría de un producto nuevo; devuelve null si duda.
   Sin servicios externos: un diccionario de la compra en español y lo que ya hay en el catálogo. */
(function () {
'use strict';

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function sing(w) {
  if (w.length <= 3) return w;
  if (/ces$/.test(w)) return w.slice(0, -3) + 'z';
  if (/[lnrdj]es$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
  return w;
}
const STOP = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'para', 'con', 'en', 'y', 'e']);
// «ñoquis» y «gnoquis» se escriben distinto pero suenan igual
function words(s) { return strip(s).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/gn/g, 'n').split(/\s+/).filter(Boolean).map(sing); }
function key(s) { return words(s).filter(w => !STOP.has(w)).join(' '); }

/* ---------- trocear ---------- */
const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, par: 2, docena: 12 };
const FILL = /^(y |e |tambien |ademas |luego |hay que comprar |hay que |tenemos que comprar |necesitamos |necesito |falta |faltan |compra |comprar |apunta |anota |pon |añade |anade |mete |quiero |queremos |algo de |un poco de |unos |unas |el |la |los |las )+/;
const UNIT = /^(kilos?|kg|gramos?|g|litros?|l|paquetes?|botellas?|botes?|latas?|bolsas?|cajas?|bandejas?|barras?|tarros?|briks?|bricks?|packs?|garrafas?|rollos?|piezas?|unidades?|docenas?|medias? docenas?) (de )?/;
// Al dictar seguido no hay comas: «manzanas peras dos leches papel higiénico».
// Se trocea buscando nombres del catálogo y del diccionario; lo desconocido seguido va junto.
const QW = /^(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|par|docena|media)$/;
const UW = /^(kilos?|kg|gramos?|litros?|paquetes?|botellas?|botes?|latas?|bolsas?|cajas?|bandejas?|barras?|tarros?|briks?|bricks?|packs?|garrafas?|rollos?|piezas?|unidades?|docenas?|de|par)$/;
const VARI = /^(entera?s?|desnatad[ao]s?|semidesnatad[ao]s?|sin|light|cero|natural(es)?|grieg[ao]s?|fresc[ao]s?|rallad[ao]s?|integral(es)?|ecologic[ao]s?|bio|grandes?|pequen[ao]s?|normal(es)?|blanc[ao]s?|negr[ao]s?|tint[ao]s?|verdes?|roj[ao]s?|amarill[ao]s?|picad[ao]s?|ahumad[ao]s?|curad[ao]s?|tiern[ao]s?|cocid[ao]s?|frit[ao]s?|congelad[ao]s?|lonchas?|lonchead[ao]s?|tacos?|enter[ao]s?|mini|extra|clasic[ao]s?|original(es)?|zero|max|0)$/;
function splitRun(part, productos) {
  const ws = part.split(' ').filter(Boolean);
  if (ws.length < 2) return [part];
  const keys = new Set(productos.filter(p => p.activo !== false).map(p => key(p.nombre)));
  if (keys.has(key(part))) return [part];
  const known = (a) => { if (STOP.has(strip(a[0])) || STOP.has(strip(a[a.length - 1]))) return false; const k = key(a.join(' ')); return k && (keys.has(k) || phrases().some(ph => ph.ws.join(' ') === k)); };
  const out = []; let cur = [], pre = [], unk = false, lastKnown = false;
  const flush = () => { if (cur.length) out.push(cur.join(' ')); cur = []; unk = false; };
  for (let i = 0; i < ws.length; i++) {
    const w = strip(ws[i]);
    if ((w === 'para' || w === 'en' || w === 'del') && i + 1 < ws.length && (cur.length || out.length)) {
      if (!cur.length) cur = out.pop().split(' ');
      cur.push(ws[i], ws[i + 1]); i++; unk = false; continue;
    }
    if (QW.test(w) || (pre.length && UW.test(w))) { flush(); lastKnown = false; pre.push(ws[i]); continue; }
    let len = 0;
    for (let n = Math.min(5, ws.length - i); n >= 1; n--) if (known(ws.slice(i, i + n))) { len = n; break; }
    if (len) { flush(); cur = pre.concat(ws.slice(i, i + len)); pre = []; i += len - 1; flush(); lastKnown = true; continue; }
    // «queso de cabra», «leche entera»: solo es variante si va con «de/con/sin» o es un adjetivo típico;
    // si no, es otro producto («toallitas desatascador»)
    if (!unk && lastKnown && !pre.length && out.length && (/^(de|con|sin|al|a)$/.test(w) || VARI.test(w))) { cur = out.pop().split(' '); unk = true; lastKnown = false; cur.push(ws[i]); continue; }
    lastKnown = false;
    if (!unk) { flush(); cur = pre; pre = []; unk = true; }
    cur.push(ws[i]);
  }
  if (pre.length) cur = cur.concat(pre);
  flush();
  return out.length ? out : [part];
}
// «ajos mercadona», «arroz froiz»: el nombre de un súper o tienda sin «en» delante
function markShops(part, tiendas) {
  if (!tiendas || !tiendas.length) return part;
  const ts = tiendas.map(x => ({ n: x.nombre || x, k: key(x.nombre || x) })).filter(x => x.k);
  const ws = part.split(' ').filter(Boolean), out = [];
  for (let i = 0; i < ws.length; i++) {
    let hit = null, len = 0;
    if (STOP.has(strip(ws[i]))) { out.push(ws[i]); continue; }
    for (let n = Math.min(3, ws.length - i); n >= 1 && !hit; n--) {
      const k = key(ws.slice(i, i + n).join(' '));
      if (!k || STOP.has(k)) continue;
      hit = ts.find(t => t.k === k) || (k.length >= 4 ? ts.find(t => t.k.split(' ')[0] === k || t.k.startsWith(k + ' ')) : null);
      if (hit) len = n;
    }
    if (!hit) { out.push(ws[i]); continue; }
    const prev = out.length ? strip(out[out.length - 1]) : '';
    if (/^(en|del|de|el|la)$/.test(prev)) { while (out.length && /^(en|del|de|el|la)$/.test(strip(out[out.length - 1]))) out.pop(); }
    if (out.length) out.push('en'); 
    out.push(hit.n.replace(/\s+/g, '\u00a0'));
    i += len - 1;
  }
  return out.join(' ');
}
function parse(text, productos, tiendas) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  let parts = t.split(/\s*(?:,|;|\.|\n|\by\b(?=\s)|\be\b(?=\s+[aeiouáéíóú])|\bademás\b|\btambién\b)\s*/i).map(x => x.trim()).filter(Boolean);
  if (tiendas) parts = parts.map(x => markShops(x, tiendas));
  if (productos) parts = [].concat.apply([], parts.map(x => splitRun(x, productos)));
  const out = [];
  parts.forEach(raw => {
    let s = raw.trim(), lower = strip(s);
    // quitar muletillas al principio
    let m = lower.match(FILL);
    while (m && m[0]) { s = s.slice(m[0].length); lower = lower.slice(m[0].length); m = lower.match(FILL); }
    let qty = 1;
    // "media docena de huevos"
    if (/^media docena (de )?/.test(lower)) { qty = 6; const n = lower.match(/^media docena (de )?/)[0].length; s = s.slice(n); lower = lower.slice(n); }
    m = lower.match(/^(\d+)\s*(x\s*)?/) || lower.match(/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|un par|par|una docena|docena)\b\s*(de\s+)?/);
    if (m) {
      const w = m[1].replace(/^un par$/, 'par').replace(/^una docena$/, 'docena');
      qty = /^\d+$/.test(w) ? parseInt(w, 10) : (NUM[w] || 1);
      s = s.slice(m[0].length); lower = lower.slice(m[0].length);
    }
    const u = lower.match(UNIT);
    if (u) { s = s.slice(u[0].length); lower = lower.slice(u[0].length); }
    // "para Marta", "en Lidl", "del Mercadona", "de la frutería"
    let para = '', en = '';
    const mp = s.match(/\s+para\s+(.+?)(?=\s+(?:en|del?)\s+|$)/i); if (mp) { para = mp[1].trim(); s = s.replace(mp[0], ' '); }
    let full = '';
    const me = s.match(/\s+(?:en(?: el| la)?|del|de la)\s+([^\s].*)$/i); if (me) { en = me[1].trim(); full = s.replace(/\s+/g, ' ').trim(); s = s.slice(0, me.index); }
    s = s.replace(/\s+/g, ' ').trim().replace(/^(de|del)\s+/i, '');
    if (!s) return;
    out.push({ raw: raw, name: s, full: full || s, qty: Math.max(1, Math.min(99, qty)), para: para, en: en });
  });
  return out;
}

/* ---------- buscar en el catálogo ---------- */
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const wEq = (a, b) => a === b || (a.length >= 6 && b.length >= 6 && lev(a, b) <= 1);
// Devuelve { exact: producto | null, options: [productos] }
function match(name, productos) {
  const k = key(name); if (!k) return { exact: null, options: [] };
  const kw = k.split(' ');
  const act = productos.filter(p => p.activo !== false);
  const exact = act.filter(p => key(p.nombre) === k);
  if (exact.length) return { exact: exact[0], options: [] };
  const fuzzy = act.filter(p => { const pw = key(p.nombre).split(' '); return pw.length === kw.length && pw.every((w, i) => wEq(w, kw[i])); });
  if (fuzzy.length === 1) return { exact: fuzzy[0], options: [] };
  // "leche entera" → Leche (el catálogo está contenido en lo dicho)
  const inside = act.filter(p => { const pw = key(p.nombre).split(' '); return pw.every(w => kw.some(x => wEq(x, w))); })
    .sort((a, b) => key(b.nombre).length - key(a.nombre).length);
  // "jamón" → Jamón York, Jamón serrano… (lo dicho está contenido en el catálogo)
  const wider = act.filter(p => { const pw = key(p.nombre).split(' '); return kw.every(w => pw.some(x => wEq(x, w))); });
  // «mozzarella pizza» con «Mozzarella» en el catálogo: puede ser una variante, así que se pregunta
  const opts = []; [...fuzzy, ...wider, ...inside].forEach(p => { if (!opts.includes(p)) opts.push(p); });
  if (opts.length === 1 && wider.length === 1 && wider[0] === opts[0] && !inside.length) return { exact: null, options: opts };
  return { exact: null, options: opts.slice(0, 6) };
}

/* ---------- adivinar la categoría ---------- */
const DICT = {
  fruta: 'fruta verdura hortaliza manzana pera platano banana naranja mandarina clementina limon lima pomelo kiwi uva fresa freson cereza melon sandia piña mango aguacate melocoton nectarina paraguayo albaricoque ciruela higo granada frambuesa arandano mora caqui chirimoya papaya coco patata cebolla cebolleta ajo tomate lechuga pepino pimiento calabacin berenjena zanahoria puerro apio brocoli coliflor col repollo lombarda espinaca acelga judia verde champiñon seta rucula canonigo escarola endivia calabaza boniato batata remolacha perejil cilantro albahaca hierbabuena menta alcachofa esparrago rabano nabo jengibre guisante haba ensalada',
  frescos: 'leche yogur yogurt natilla flan gelatina cuajada queso mantequilla margarina nata huevo jamon york serrano pavo chorizo salchichon fuet lomo embutido mortadela bacon beicon panceta salchicha carne ternera cerdo pollo pechuga muslo contramuslo alita filete hamburguesa costilla solomillo higado chuleta conejo cordero cabrito picada carrillera secreto presa pescado merluza pescadilla salmon bacalao dorada lubina sardina boqueron trucha rape lenguado gallo emperador atun fresco gamba langostino mejillon calamar sepia pulpo almeja berberecho kefir requeson tofu hummus gazpacho masa pizza fresca quesito petit actimel danone',
  despensa: 'arroz pasta macarron espagueti spaghetti espiral fideo tallarin lasaña canelon lenteja garbanzo alubia judion legumbre harina azucar sal aceite tomate frito salsa mayonesa ketchup mostaza lata conserva atun bonito sardinilla mejillon en escabeche sopa caldo pure cafe te infusion manzanilla poleo cacao nesquik colacao cola cao cereal muesli avena galleta magdalena bizcocho pan tostado pan de molde pan bimbo biscote mermelada miel chocolate cacahuete crema de cacao nocilla nutella turron polvoron especia pimienta oregano comino pimenton canela levadura fruto seco almendra nuez avellana pipa patata frita snack palomita aceituna pepinillo maiz tortilla wrap tortita gelatina en polvo bolleria donut croissant envasado leche condensada leche evaporada',
  bebidas: 'agua cerveza vino tinto blanco refresco coca cola fanta sprite aquarius nestea zumo tonica gaseosa cava sidra champan bebida isotonica batido horchata vermut ron ginebra whisky licor',
  panaderia: 'pan barra baguette chapata hogaza pan integral pan de pueblo panecillo',
  congelados: 'helado congelado croqueta empanadilla varita merluza congelada pizza congelada verdura congelada guisante congelado hielo patata congelada',
  higiene: 'desodorante gel champu acondicionador mascarilla pasta de dientes dentifrico cepillo de dientes colutorio enjuague hilo dental jabon de manos jabon compresa tampon salvaslip protegeslip papel higienico toallita pañal crema hidratante body leche corporal colonia perfume cuchilla espuma de afeitar maquinilla algodon bastoncillo tirita pañuelo protector solar crema solar laca gomina tinte quitaesmalte',
  limpieza: 'desatascador desengrasante lejia fairy lavavajillas detergente suavizante friegasuelo limpiacristal amoniaco estropajo bayeta fregona escoba recogedor bolsa de basura bolsa basura papel de cocina rollo de cocina rollo cocina servilleta papel de aluminio papel aluminio film transparente papel de horno oxiaction kh7 sanytol pastilla lavavajillas abrillantador quitagrasa limpiahogar multiusos ambientador insecticida guante quitamancha cillit vileda pato wc mistol vinagre de limpieza',
  mascotas: 'pienso comida de gato comida de perro arena de gato arena gato perro lata de gato snack de perro',
  bebe: 'potito papilla leche de continuacion biberon chupete toallita de bebe'
};
const CAT_SYN = {
  fruta: ['fruta', 'verdura', 'hortaliza', 'fruteria'],
  frescos: ['fresco', 'lacteo', 'nevera', 'frigorifico', 'refrigerado', 'charcuteria'],
  carne: ['carne', 'carniceria'],
  pescado: ['pescado', 'pescaderia', 'marisco'],
  despensa: ['despensa', 'alimentacion', 'comida', 'ultramarino', 'seco', 'abarrote'],
  bebidas: ['bebida'],
  panaderia: ['pan', 'panaderia', 'bolleria'],
  congelados: ['congelado'],
  higiene: ['higiene', 'aseo', 'perfumeria', 'cuidado personal'],
  limpieza: ['limpieza', 'hogar', 'drogueria', 'casa'],
  mascotas: ['mascota', 'animal', 'perro', 'gato'],
  bebe: ['bebe', 'infantil']
};
const FALLBACK = { bebidas: 'despensa', panaderia: 'despensa', congelados: 'frescos', carne: 'frescos', pescado: 'frescos', bebe: 'higiene' };
const CARNE = new Set(words('carne ternera cerdo pollo pechuga muslo contramuslo alita filete hamburguesa costilla solomillo higado chuleta conejo cordero cabrito picada carrillera secreto presa'));
const PESCADO = new Set(words('pescado merluza pescadilla salmon bacalao dorada lubina sardina boqueron trucha rape lenguado gallo emperador gamba langostino mejillon calamar sepia pulpo almeja berberecho'));
let PHRASES = null;
function phrases() {
  if (PHRASES) return PHRASES;
  PHRASES = [];
  Object.keys(DICT).forEach(k => {
    // cada entrada es una palabra o una expresión ("pasta de dientes"): las de varias palabras se marcan con " de "
    const toks = DICT[k].split(' ');
    const list = [];
    for (let i = 0; i < toks.length; i++) {
      if (toks[i + 1] === 'de' && toks[i + 2]) { list.push(toks[i] + ' de ' + toks[i + 2]); i += 2; }
      else list.push(toks[i]);
    }
    // expresiones conocidas de dos palabras sin "de"
    list.forEach(ph => PHRASES.push({ ws: words(ph).filter(w => !STOP.has(w)), cat: k }));
  });
  ['papel higienico', 'tomate frito', 'pan tostado', 'pan bimbo', 'coca cola', 'cola cao', 'judia verde', 'pizza fresca', 'pizza congelada', 'patata frita', 'patata congelada', 'merluza congelada', 'verdura congelada', 'guisante congelado', 'crema hidratante', 'leche corporal', 'protector solar', 'crema solar', 'hilo dental', 'rollo cocina', 'bolsa basura', 'film transparente', 'pastilla lavavajillas', 'pato wc', 'arena gato', 'leche condensada', 'leche evaporada', 'atun fresco', 'fruto seco', 'gelatina en polvo', 'bebida isotonica', 'pan integral', 'cepillo de dientes', 'pasta de dientes', 'espuma de afeitar']
    .forEach(ph => {
      const cat = /congelad/.test(ph) ? 'congelados' : /^(papel higienico|crema hidratante|leche corporal|protector solar|crema solar|hilo dental|cepillo de dientes|pasta de dientes|espuma de afeitar)$/.test(ph) ? 'higiene'
        : /^(rollo cocina|bolsa basura|film transparente|pastilla lavavajillas|pato wc)$/.test(ph) ? 'limpieza' : /^arena gato$/.test(ph) ? 'mascotas'
        : /^(coca cola|bebida isotonica)$/.test(ph) ? 'bebidas' : /^(pizza fresca|atun fresco)$/.test(ph) ? 'frescos' : /^(judia verde)$/.test(ph) ? 'fruta' : /^pan integral$/.test(ph) ? 'panaderia' : 'despensa';
      PHRASES.push({ ws: words(ph).filter(w => !STOP.has(w)), cat: cat });
    });
  PHRASES = PHRASES.filter(p => p.ws.length);
  PHRASES.sort((a, b) => b.ws.length - a.ws.length);
  return PHRASES;
}
function catFor(keyName, categorias) {
  const cs = categorias.map(c => ({ c: c, n: strip(c.nombre) }));
  const find = k => { const syn = CAT_SYN[k] || [k]; const x = cs.find(o => syn.some(s => o.n.includes(s))); return x ? x.c : null; };
  return find(keyName) || (FALLBACK[keyName] ? find(FALLBACK[keyName]) : null);
}
// → { cat: categoría | null, why: 'catalogo' | 'diccionario' | null }
function classify(name, categorias, productos) {
  const ws = words(name).filter(w => !STOP.has(w));
  if (!ws.length) return { cat: null, why: null };
  // 1) Algo parecido en el catálogo ("yogur griego" → donde estén los Yogures)
  const act = (productos || []).filter(p => p.activo !== false);
  let best = null, bestScore = 0;
  act.forEach(p => {
    const pw = words(p.nombre).filter(w => !STOP.has(w));
    const score = pw.filter(w => ws.some(x => wEq(x, w))).length / Math.max(pw.length, 1);
    if (score > bestScore && pw.length && ws.some(x => wEq(x, pw[0]))) { best = p; bestScore = score; }
  });
  if (best && bestScore >= 0.99) { const c = categorias.find(x => x.id === best.categoriaId); if (c) return { cat: c, why: 'catalogo' }; }
  // 2) Diccionario (carne y pescado van a su categoría si la familia tiene una)
  if (ws.some(w => CARNE.has(w))) { const c = catFor('carne', categorias); if (c && /carn/.test(strip(c.nombre))) return { cat: c, why: 'diccionario' }; }
  if (ws.some(w => PESCADO.has(w))) { const c = catFor('pescado', categorias); if (c && /pesc|marisc/.test(strip(c.nombre))) return { cat: c, why: 'diccionario' }; }
  // primero palabras exactas; luego con una letra de diferencia (por si el dictado se equivoca)
  for (const eq of [(x, y) => x === y, wEq]) {
    for (const ph of phrases()) {
      if (ph.ws.length > ws.length) continue;
      for (let i = 0; i + ph.ws.length <= ws.length; i++) {
        if (ph.ws.every((w, j) => eq(ws[i + j], w))) {
          const c = catFor(ph.cat, categorias);
          return c ? { cat: c, why: 'diccionario' } : { cat: null, why: null };
        }
      }
    }
  }
  // 3) Por el nombre de la categoría ("comida de gato" → Mascotas)
  const byName = categorias.find(c => ws.some(w => wEq(w, sing(strip(c.nombre)))));
  if (byName) return { cat: byName, why: 'diccionario' };
  if (best && bestScore >= 0.5) { const c = categorias.find(x => x.id === best.categoriaId); if (c) return { cat: c, why: 'catalogo' }; }
  return { cat: null, why: null };
}

function findByName(list, name) {
  const k = key(name); if (!k) return null;
  return list.find(x => key(x.nombre) === k) || list.find(x => key(x.nombre).startsWith(k) || k.startsWith(key(x.nombre))) || null;
}

window.CestaVoz = { parse, match, classify, findByName, key, strip, splitRun, markShops };
})();
