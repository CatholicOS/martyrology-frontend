// Esri World Street Map rather than the standard OSM tiles: OSM labels each place in its local script (kanji,
// Arabic, Hangul…), which a reader of Latin and Italian place names cannot read. Esri labels in English, keyless.
export const ESRI_STREET_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, " +
  "METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, " +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
  "and the GIS User Community";
