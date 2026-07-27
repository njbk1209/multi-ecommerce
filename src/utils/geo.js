// utils/geo.js

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula Haversine.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distancia en km
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return null;
  }

  const R = 6371; // Radio de la tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ordena una lista de sucursales según la distancia a las coordenadas del usuario.
 * @param {Array} branches 
 * @param {{ lat: number, lng: number } | null} userCoords 
 * @returns {Array} Sucursales con atributo distanceKm opcional, ordenadas de más cercana a más lejana
 */
export function sortBranchesByProximity(branches, userCoords) {
  if (!branches || branches.length === 0) return [];
  if (!userCoords || userCoords.lat == null || userCoords.lng == null) {
    return branches;
  }

  return [...branches]
    .map((b) => {
      const lat = parseFloat(b.latitud);
      const lon = parseFloat(b.longitud);
      const dist = !isNaN(lat) && !isNaN(lon)
        ? calculateDistanceKm(userCoords.lat, userCoords.lng, lat, lon)
        : null;
      return {
        ...b,
        distanceKm: dist,
      };
    })
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return 0;
    });
}
