const sampleContentKeys: Record<string, string> = {
  "Fensterplatz, wenn möglich": "windowNote",
  "Kinderwagen dabei": "strollerNote",
  "Laktosefreie Milch": "lactoseNote",
  Geburtstag: "birthdayNote",
  "Ruhiger Platz": "quietNote",
  "Kommt gelegentlich mit Hund": "dogNote",
  Vegetarisch: "vegetarianNote",
  "Süßes zum Kaffee": "sweetNote",
  Nussallergie: "nutAllergyNote",
  "Geburtstag im Oktober": "octoberBirthdayNote",
  Feiertagsreservierung: "holidayNote",
  "Filterkaffee": "filterCoffee",
  "Hafer-Cappuccino": "oatCappuccino",
  Zimtschnecke: "cinnamonRoll",
  "Heiße Schokolade": "hotChocolate",
};

export function sampleContentKey(value: string) {
  return sampleContentKeys[value];
}
