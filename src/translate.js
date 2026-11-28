// Traducción al español SIN conexión (diccionario) de los textos que llegan de Transitous:
// nombres de paradas y lugares, sentidos de las líneas («Flughafen»), etc.
// No usa ninguna API ni envía datos a terceros. Solo cubre términos de transporte y de lugares habituales
// (estación, aeropuerto, calle, plaza…) y los nombres de ciudades que en español cambian (München → Múnich).
// Los nombres propios que no están en el diccionario se dejan tal cual.
// Se muestra siempre como «Original (traducción)» y solo si la traducción es distinta del original.

// Texto en minúsculas, sin acentos y con las comillas tipográficas normalizadas (para comparar claves)
const norm = (s) => {
  let t = String(s == null ? '' : s).toLowerCase().replace(/ß/g, 'ss').replace(/’/g, "'");
  try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* sin normalize: se compara tal cual */ }
  return t;
};

// ---- Diccionario: clave normalizada (una o varias palabras) → traducción ----
const MAP = Object.create(null);
let MAXLEN = 1; // nº máximo de palabras de una clave
const add = (target, sources) => sources.split('|').forEach((s) => {
  const k = norm(s).trim().replace(/\s+/g, ' ');
  if (!k) return;
  MAP[k] = target;
  MAXLEN = Math.max(MAXLEN, k.split(' ').length);
});

// Estaciones, aeropuertos y transporte (alemán, francés, italiano, portugués, catalán, neerlandés, inglés, polaco, checo)
add('estación central', 'Hauptbahnhof|Hbf|Hauptbf|Centraal Station|Central Station|Stazione Centrale|Gare Centrale|Estação Central|Estació Central|Dworzec Główny|Hlavní nádraží|Main Station');
add('estación', 'Bahnhof|Bhf|Bf|Gare|Stazione|Station|Estação|Estació|Dworzec|Nádraží|Stacja');
add('estación de largo recorrido', 'Fernbahnhof');
add('estación de autobuses', 'Busbahnhof|ZOB|Gare routière|Stazione autobus|Bus Station|Coach Station|Estação Rodoviária|Estació d\'Autobusos|Busstation');
add('estación de tren', 'Train Station|Railway Station|Railroad Station');
add('estación marítima', 'Gare maritime|Stazione marittima');
add('estación este', 'Ostbahnhof');
add('estación sur', 'Südbahnhof|Sudbahnhof|Suedbahnhof');
add('estación oeste', 'Westbahnhof');
add('estación norte', 'Nordbahnhof');
add('estación del Norte', 'Gare du Nord');
add('estación del Este', 'Gare de l\'Est');
add('aeropuerto', 'Flughafen|Aéroport|Aeroporto|Aeroport|Airport|Luchthaven|Vliegveld|Lotnisko|Letiště');
add('plaza de la estación', 'Bahnhofsvorplatz');
add('parada', 'Fermata');
add('vía', 'Gleis|Voie');
add('andén', 'Platform');

// Lugares y vías
add('calle', 'Rue|Rua|Carrer|Straat|Street|Ulica');
add('avenida', 'Avenue|Viale|Corso|Avinguda|Allee');
add('bulevar', 'Boulevard|Bulevar');
add('paseo', 'Passeig');
add('paseo marítimo', 'Lungomare');
add('plaza', 'Platz|Place|Piazza|Praça|Plaça|Square|Plein|Plac');
add('puente', 'Brücke|Pont|Ponte|Bridge|Brug');
add('puerto', 'Hafen|Port|Porto|Harbour|Harbor');
add('centro', 'Zentrum|Centre|Center|Centrum|Stadtmitte');
add('casco antiguo', 'Altstadt|Old Town|Centro Storico');
add('centro comercial', 'Einkaufszentrum|Centre commercial|Centro commerciale|Shopping Centre|Shopping Center');
add('ayuntamiento', 'Rathaus|Mairie|Hôtel de ville|Town Hall|City Hall|Câmara Municipal|Ajuntament');
add('universidad', 'Universität|Université|Università|Universidade|Universitat|University|Universiteit');
add('hospital', 'Krankenhaus|Hôpital|Ospedale|Spital');
add('iglesia', 'Kirche|Église|Chiesa|Igreja|Església|Church');
add('catedral', 'Kathedrale|Cathédrale|Cattedrale|Cathedral|Duomo');
add('castillo', 'Schloss|Burg|Château|Castello|Castelo|Castell|Castle|Kasteel');
add('museo', 'Museum|Musée|Museu');
add('parque', 'Park|Parc|Parco');
add('mercado', 'Markt|Marché|Mercato|Mercat|Market');
add('feria', 'Messe');
add('playa', 'Strand|Plage|Spiaggia|Praia|Platja|Beach');
add('lago', 'Lac|Lake');
add('río', 'Fluss|Fleuve|Fiume|River');

// Puntos cardinales en nombres de estaciones y sentidos
add('Norte', 'Nord');
add('Sur', 'Süd|Sud|Sued');
add('Este', 'Ost|Est');
add('Oeste', 'Ouest|Ovest|Oest');

// Ciudades cuyo nombre cambia en español
add('Múnich', 'München|Munchen|Munich');
add('Colonia', 'Köln|Koln|Cologne');
add('Viena', 'Wien|Vienne|Vienna');
add('Florencia', 'Firenze|Florence|Florenz');
add('Venecia', 'Venezia|Venise|Venice|Venedig');
add('Nápoles', 'Napoli|Naples|Neapel');
add('Milán', 'Milano|Milan|Mailand');
add('Turín', 'Torino|Turin');
add('Génova', 'Genova|Gênes|Genes|Genoa|Genua');
add('Padua', 'Padova|Padoue');
add('Bolonia', 'Bologna');
add('Roma', 'Rom|Rome');
add('Praga', 'Praha|Prague|Prag');
add('Varsovia', 'Warszawa|Varsovie|Warsaw|Warschau');
add('Cracovia', 'Kraków|Krakow|Cracovie|Cracow|Krakau');
add('Breslavia', 'Wrocław|Wroclaw|Breslau');
add('Bruselas', 'Bruxelles|Brussel|Brussels|Brüssel|Bruessel');
add('Amberes', 'Antwerpen|Anvers|Antwerp');
add('Gante', 'Gent|Gand|Ghent');
add('Brujas', 'Brugge|Bruges');
add('Lieja', 'Liège|Liege|Luik|Lüttich');
add('Zúrich', 'Zürich|Zurich');
add('Ginebra', 'Genève|Geneve|Geneva|Genf|Ginevra');
add('Berna', 'Bern|Berne');
add('Basilea', 'Basel|Bâle|Bale');
add('Lucerna', 'Luzern|Lucerne');
add('Fráncfort', 'Frankfurt');
add('Fráncfort del Meno', 'Frankfurt am Main');
add('Núremberg', 'Nürnberg|Nurnberg|Nuremberg');
add('Maguncia', 'Mainz');
add('Tréveris', 'Trier');
add('Aquisgrán', 'Aachen');
add('Brunswick', 'Braunschweig');
add('Berlín', 'Berlin');
add('Lisboa', 'Lisbonne|Lisbon|Lissabon');
add('Londres', 'London|Londra');
add('Edimburgo', 'Edinburgh|Édimbourg|Edimbourg');
add('París', 'Paris');
add('Marsella', 'Marseille');
add('Burdeos', 'Bordeaux');
add('Niza', 'Nice|Nizza');
add('Estrasburgo', 'Strasbourg|Straßburg|Strassburg');
add('Ruan', 'Rouen');
add('Aviñón', 'Avignon');
add('Atenas', 'Athína|Athina|Athens|Athènes|Athenes|Athen');
add('Bucarest', 'București|Bucuresti|Bucharest|Bukarest');
add('Moscú', 'Moskva|Moscow|Moskau|Moscou');
add('Kiev', 'Kyiv');
add('Estambul', 'İstanbul|Istanbul');
add('Belgrado', 'Beograd|Belgrade|Belgrad');
add('Copenhague', 'København|Kobenhavn|Copenhagen|Kopenhagen');
add('Estocolmo', 'Stockholm');
add('Gotemburgo', 'Göteborg|Goteborg|Gothenburg');
add('Ámsterdam', 'Amsterdam');
add('La Haya', 'Den Haag|La Haye|The Hague');
add('Sofía', 'Sofia');
// Nombres en euskera, catalán y gallego → nombre en castellano
add('Bilbao', 'Bilbo');
add('San Sebastián', 'Donostia');
add('Gerona', 'Girona');
add('Lérida', 'Lleida');
add('Ibiza', 'Eivissa');
add('Alicante', 'Alacant');
add('Elche', 'Elx');
add('Orense', 'Ourense');
add('La Coruña', 'A Coruña');

// Países (por si algún nombre llega en el idioma local)
add('Alemania', 'Deutschland|Allemagne|Germania|Germany');
add('Austria', 'Österreich|Osterreich|Autriche');
add('Suiza', 'Schweiz|Suisse|Svizzera|Switzerland');
add('Italia', 'Italien|Italie|Italy');
add('Francia', 'Frankreich|France');
add('España', 'Spanien|Espagne|Spagna|Spain|Espanha|Espanya');
add('Bélgica', 'Belgien|Belgique|België|Belgie|Belgio|Belgium');
add('Países Bajos', 'Niederlande|Nederland|Paesi Bassi|Netherlands|Holland');
add('Reino Unido', 'Vereinigtes Königreich|Regno Unito|United Kingdom');
add('Polonia', 'Polen|Pologne|Polska|Poland');
add('Chequia', 'Tschechien|Tchéquie|Czechia|Czech Republic|Česko|Cesko');
add('Hungría', 'Ungarn|Hongrie|Ungheria|Hungary|Magyarország');
add('Dinamarca', 'Dänemark|Danemark|Danmark|Denmark');
add('Suecia', 'Schweden|Suède|Sverige|Sweden|Svezia');
add('Noruega', 'Norwegen|Norvège|Norge|Norway|Norvegia');
add('Grecia', 'Griechenland|Grèce|Greece');
add('Turquía', 'Türkei|Turkei|Turquie|Turchia|Turkey|Türkiye');
add('Croacia', 'Kroatien|Croatie|Croazia|Croatia|Hrvatska');

// ---- Palabras: se separan las letras/números de lo demás (espacios, signos) ----
const isLetter = (ch) => ch.toLowerCase() !== ch.toUpperCase() || /[0-9]/.test(ch);
function tokenize(text) {
  const chars = Array.from(String(text));
  const out = [];
  let cur = '';
  let isW = null;
  chars.forEach((ch, i) => {
    let w = isLetter(ch);
    // El apóstrofo entre dos letras forma parte de la palabra (l'Est, d'Autobusos)
    if (!w && (ch === "'" || ch === '’') && i > 0 && i < chars.length - 1 && isLetter(chars[i - 1]) && isLetter(chars[i + 1])) w = true;
    if (isW === null || w !== isW) { if (cur) out.push({ w: isW, t: cur }); cur = ch; isW = w; } else cur += ch;
  });
  if (cur) out.push({ w: isW, t: cur });
  return out;
}

// Busca desde la posición i la clave más larga del diccionario (palabras separadas solo por espacios)
function matchAt(parts, i) {
  for (let n = MAXLEN; n >= 1; n--) {
    const words = [];
    let k = i;
    let ok = true;
    for (let c = 0; c < n; c++) {
      if (!parts[k] || !parts[k].w) { ok = false; break; }
      words.push(norm(parts[k].t));
      if (c < n - 1) {
        if (!parts[k + 1] || parts[k + 1].w || !/^\s+$/.test(parts[k + 1].t)) { ok = false; break; }
        k += 2;
      }
    }
    if (ok) {
      const target = MAP[words.join(' ')];
      if (target !== undefined) return { target, next: k + 1 };
    }
  }
  return null;
}

// Traduce al español lo que reconoce el diccionario; lo demás se deja igual. Devuelve el texto completo traducido.
export function translateEs(text) {
  const src = String(text == null ? '' : text);
  if (!src.trim()) return src;
  const parts = tokenize(src);
  let out = '';
  let first = true; // primera palabra del texto: si la traducción es un término en minúsculas, se pone en mayúscula inicial
  for (let i = 0; i < parts.length;) {
    const p = parts[i];
    if (p.w) {
      const m = matchAt(parts, i);
      if (m) {
        out += first ? m.target.charAt(0).toUpperCase() + m.target.slice(1) : m.target;
        first = false;
        i = m.next;
        continue;
      }
      first = false;
    }
    out += p.t;
    i++;
  }
  return out;
}

// «Original (traducción)»: añade la traducción entre paréntesis solo si es distinta del original
export function withEs(text) {
  const src = String(text == null ? '' : text);
  const tr = translateEs(src);
  return tr === src ? src : `${src} (${tr})`;
}
