// src/utils/yearSearch.js

/**
 * Normaliza y extrae rangos de años de un texto.
 * Soporta formatos comunes en repuestos automotrices:
 * - "2001 al 2007", "2001 a 2007", "2001-2007", "2001/2007", "2001 hasta 2007"
 * - "01 al 07", "01-07", "01/07", "98-04"
 * - "2001 al 07", "01 al 2007"
 * - "2001 en adelante", "2001+", "desde 2001"
 */
export function extractYearRangesFromText(text) {
  if (!text) return [];
  const ranges = [];
  const cleanText = String(text).toLowerCase();

  // 1. 4 dígitos a 4 dígitos: "2001 al 2007", "2001-2007", "2001 a 2007", "2001/2007", "2001 hasta 2007"
  const p1 = /\b(19\d\d|20\d\d)\s*(?:al|a|-|–|—|\/|hasta|\.\.\.|\s+al\s+|\s+a\s+)\s*(19\d\d|20\d\d)\b/g;
  let m;
  while ((m = p1.exec(cleanText)) !== null) {
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (start <= end && start >= 1950 && end <= 2099) {
      ranges.push({ start, end });
    }
  }

  // 2. 4 dígitos a 2 dígitos: "2001 al 07", "2001-07", "2001/07"
  const p2 = /\b(19\d\d|20\d\d)\s*(?:al|a|-|–|—|\/|hasta)\s*(\d{2})\b/g;
  while ((m = p2.exec(cleanText)) !== null) {
    const start = parseInt(m[1], 10);
    const endYY = parseInt(m[2], 10);
    const century = Math.floor(start / 100) * 100;
    let end = century + endYY;
    if (end < start && century === 1900) {
      end = 2000 + endYY;
    }
    if (start <= end && end <= 2099) {
      ranges.push({ start, end });
    }
  }

  // 3. 2 dígitos a 4 dígitos: "01 al 2007", "01-2007"
  const p3 = /\b(\d{2})\s*(?:al|a|-|–|—|\/|hasta)\s*(19\d\d|20\d\d)\b/g;
  while ((m = p3.exec(cleanText)) !== null) {
    const startYY = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    const century = Math.floor(end / 100) * 100;
    const start = (startYY >= 50 ? 1900 : century) + startYY;
    if (start <= end) {
      ranges.push({ start, end });
    }
  }

  // 4. 2 dígitos a 2 dígitos: "01 al 07", "01-07", "98-04"
  const p4 = /\b(\d{2})\s*(?:al|a|-|–|—|\/|hasta)\s*(\d{2})\b/g;
  while ((m = p4.exec(cleanText)) !== null) {
    const y1 = parseInt(m[1], 10);
    const y2 = parseInt(m[2], 10);
    const start = y1 >= 50 ? 1900 + y1 : 2000 + y1;
    let end = y2 >= 50 ? 1900 + y2 : 2000 + y2;
    if (end < start && y1 < 50 && y2 < 50) {
      end = 2000 + y2;
    }
    if (start <= end && start >= 1950 && end <= 2099) {
      ranges.push({ start, end });
    }
  }

  // 5. Abiertos 4 dígitos: "2001 en adelante", "2001+", "desde 2001", "2001 adelante"
  const p5 = /\b(?:desde\s+)?(19\d\d|20\d\d)\s*(?:en\s+adelante|adelante|\+|\>)\b/g;
  while ((m = p5.exec(cleanText)) !== null) {
    const start = parseInt(m[1], 10);
    ranges.push({ start, end: 2099 });
  }

  // 6. Abiertos 2 dígitos: "01 en adelante", "01+"
  const p6 = /\b(?:desde\s+)?(\d{2})\s*(?:en\s+adelante|adelante|\+)\b/g;
  while ((m = p6.exec(cleanText)) !== null) {
    const y1 = parseInt(m[1], 10);
    const start = y1 >= 50 ? 1900 + y1 : 2000 + y1;
    ranges.push({ start, end: 2099 });
  }

  return ranges;
}

/**
 * Determina si un año específico está incluido dentro del texto de un producto
 * (ya sea como texto literal o dentro de un intervalo/rango).
 */
export function isYearMatchedInText(text, targetYear) {
  if (!text || !targetYear) return false;
  const str = String(text);
  const targetNum = typeof targetYear === 'number' ? targetYear : parseInt(targetYear, 10);

  if (isNaN(targetNum)) return false;

  // 1. Coincidencia literal directa (ej: el título dice "2003")
  if (str.includes(String(targetNum))) return true;

  // Si targetNum es año ej: 2003, revisar también representación de 2 dígitos "03"
  if (targetNum >= 2000 && targetNum <= 2049) {
    const yyStr = String(targetNum).slice(2);
    const regex2d = new RegExp(`\\b${yyStr}\\b`, 'i');
    if (regex2d.test(str)) return true;
  }

  // 2. Coincidencia dentro de intervalo/rango (ej: el título dice "2001 al 2007")
  const ranges = extractYearRangesFromText(str);
  for (const r of ranges) {
    if (targetNum >= r.start && targetNum <= r.end) {
      return true;
    }
  }

  return false;
}

/**
 * Evalúa la consulta de búsqueda e identifica los términos que representan años o rangos.
 */
export function parseYearTermsFromQuery(searchQuery) {
  if (!searchQuery || !searchQuery.trim()) {
    return { textTerms: [], yearNumbers: [], queryRanges: [] };
  }

  const queryStr = searchQuery.trim();
  const ranges = extractYearRangesFromText(queryStr);

  const rawTerms = queryStr.split(/\s+/).filter(t => t.length > 0);
  const stopWords = new Set(['de', 'del', 'la', 'el', 'en', 'para', 'con', 'y', 'a', 'al', 'los', 'las', 'un', 'una', 'por', 'hasta', 'desde']);
  const significantTerms = rawTerms.filter(t => !stopWords.has(t.toLowerCase()));
  const termsToUse = significantTerms.length > 0 ? significantTerms : rawTerms;

  const textTerms = [];
  const yearNumbers = [];

  termsToUse.forEach(term => {
    const clean = term.replace(/^[^\w]+|[^\w]+$/g, '');
    const num = parseInt(clean, 10);

    // Si el término es un rango expresado como token (ej: "2001-2007", "2001/07", "01-07")
    const rangesInTerm = extractYearRangesFromText(clean);
    if (rangesInTerm.length > 0) {
      rangesInTerm.forEach(r => {
        yearNumbers.push(r.start);
        if (r.end < 2099) yearNumbers.push(r.end);
      });
      return;
    }

    // Si es un año de 4 dígitos (1950 - 2049)
    if (/^\d{4}$/.test(clean) && num >= 1950 && num <= 2049) {
      yearNumbers.push(num);
    }
    // Si es un año de 2 dígitos plausibles (ej: 03 -> 2003, 98 -> 1998)
    else if (/^\d{2}$/.test(clean) && !isNaN(num)) {
      const yearFrom2D = num >= 50 ? 1900 + num : 2000 + num;
      if (yearFrom2D >= 1970 && yearFrom2D <= 2035) {
        yearNumbers.push(yearFrom2D);
      } else {
        textTerms.push(term);
      }
    }
    else {
      textTerms.push(term);
    }
  });

  if (ranges.length > 0) {
    ranges.forEach(r => {
      yearNumbers.push(r.start);
      if (r.end < 2099) yearNumbers.push(r.end);
    });
  }

  return {
    textTerms,
    yearNumbers: [...new Set(yearNumbers)],
    queryRanges: ranges
  };
}

/**
 * Obtiene los IDs de productos compatibles con los años indicados en la búsqueda,
 * revisando tanto la compatibilidad por vehículos (vehiculo_generacion)
 * como el texto (título/descripción) para rangos de años.
 */
export async function getProductIdsMatchingYears(supabase, storeId, yearNumbers) {
  if (!yearNumbers || yearNumbers.length === 0) return [];
  
  const allMatchedSets = [];

  // 1. Cargar vehiculo_generacion para verificar anio_inicio / anio_fin (incluyendo abiertas sin anio_fin)
  let allGenerations = [];
  try {
    const { data: genData } = await supabase
      .from("vehiculo_generacion")
      .select("id, anio_inicio, anio_fin");
    allGenerations = genData || [];
  } catch (err) {
    console.error("Error consultando vehiculo_generacion:", err);
  }

  // 2. Cargar productos activos de la tienda
  let allStoreProducts = [];
  try {
    const { data: prods } = await supabase
      .from("producto")
      .select("id, name, description, sku, oem_number, part_number_fabricante")
      .eq("store", storeId)
      .eq("is_active", true);
    allStoreProducts = prods || [];
  } catch (err) {
    console.error("Error consultando catálogo para búsqueda por año:", err);
  }

  for (const year of yearNumbers) {
    const yearMatchedIds = new Set();
    const yearNum = typeof year === 'number' ? year : parseInt(year, 10);
    if (isNaN(yearNum)) continue;

    // A. Compatibilidad por vehículos vinculados en vehiculo_generacion
    const matchingGenIds = allGenerations
      .filter(g => g.anio_inicio <= yearNum && (!g.anio_fin || g.anio_fin >= yearNum))
      .map(g => g.id);

    if (matchingGenIds.length > 0) {
      try {
        const { data: compData } = await supabase
          .from("producto_compatibilidad")
          .select("producto_id")
          .in("generacion_id", matchingGenIds);

        if (compData) {
          compData.forEach((c) => yearMatchedIds.add(c.producto_id));
        }
      } catch (err) {
        console.error("Error consultando producto_compatibilidad:", err);
      }
    }

    // B. Coincidencia en el texto del producto (título, descripción, sku, oem, etc.)
    allStoreProducts.forEach((p) => {
      const fullText = `${p.name || ''} ${p.description || ''} ${p.sku || ''} ${p.oem_number || ''} ${p.part_number_fabricante || ''}`;
      if (isYearMatchedInText(fullText, yearNum)) {
        yearMatchedIds.add(p.id);
      }
    });

    allMatchedSets.push(yearMatchedIds);
  }

  if (allMatchedSets.length === 0) return [];

  // Intersección: si se buscan varios años, el producto debe coincidir con todos ellos
  let intersection = Array.from(allMatchedSets[0]);
  for (let i = 1; i < allMatchedSets.length; i++) {
    intersection = intersection.filter((id) => allMatchedSets[i].has(id));
  }

  return intersection;
}
