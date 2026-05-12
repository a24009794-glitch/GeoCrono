import fs from 'fs';

const regions = {
  América: [
    "Antigua y Barbuda", "Argentina", "Bahamas", "Barbados", "Belice", "Bolivia", "Brasil", "Canadá", "Chile", "Colombia", "Costa Rica", "Cuba", "Dominica", "Ecuador", "El Salvador", "Estados Unidos", "Granada", "Guatemala", "Guyana", "Haití", "Honduras", "Jamaica", "México", "Nicaragua", "Panamá", "Paraguay", "Perú", "República Dominicana", "San Cristóbal y Nieves", "San Vicente y las Granadinas", "Santa Lucía", "Surinam", "Trinidad y Tobago", "Uruguay", "Venezuela"
  ],
  Europa: [
    "Albania", "Alemania", "Andorra", "Armenia", "Austria", "Azerbaiyán", "Bélgica", "Bielorrusia", "Bosnia y Herzegovina", "Bulgaria", "Chipre", "Croacia", "Dinamarca", "Eslovaquia", "Eslovenia", "España", "Estonia", "Finlandia", "Francia", "Georgia", "Grecia", "Hungría", "Irlanda", "Islandia", "Italia", "Kazajistán", "Letonia", "Liechtenstein", "Lituania", "Luxemburgo", "Macedonia del Norte", "Malta", "Moldavia", "Mónaco", "Montenegro", "Noruega", "Países Bajos", "Polonia", "Portugal", "Reino Unido", "República Checa", "Rumania", "Rusia", "San Marino", "Serbia", "Suecia", "Suiza", "Turquía", "Ucrania", "Ciudad del Vaticano"
  ],
  África: [
    "Angola", "Argelia", "Benín", "Botsuana", "Burkina Faso", "Burundi", "Cabo Verde", "Camerún", "Chad", "Comoras", "Costa de Marfil", "Egipto", "Eritrea", "Etiopía", "Gabón", "Gambia", "Ghana", "Guinea", "Guinea-Bisáu", "Guinea Ecuatorial", "Kenia", "Lesoto", "Liberia", "Libia", "Madagascar", "Malaui", "Malí", "Marruecos", "Mauricio", "Mauritania", "Mozambique", "Namibia", "Níger", "Nigeria", "República Centroafricana", "República del Congo", "República Democrática del Congo", "Ruanda", "Santo Tomé y Príncipe", "Senegal", "Seychelles", "Sierra Leona", "Somalia", "Suazilandia", "Sudáfrica", "Sudán", "Sudán del Sur", "Tanzania", "Togo", "Túnez", "Uganda", "Yibuti", "Zambia", "Zimbabue"
  ],
  Asia: [
    "Afganistán", "Arabia Saudita", "Baréin", "Bangladés", "Brunéi", "Bután", "Camboya", "Catar", "China", "Corea del Norte", "Corea del Sur", "Emiratos Árabes Unidos", "Filipinas", "India", "Indonesia", "Irak", "Irán", "Israel", "Japón", "Jordania", "Kirguistán", "Kuwait", "Laos", "Líbano", "Malasia", "Maldivas", "Mongolia", "Birmania", "Nepal", "Omán", "Pakistán", "Rusia", "Singapur", "Siria", "Sri Lanka", "Tailandia", "Tayikistán", "Timor Oriental", "Turkmenistán", "Uzbekistán", "Vietnam", "Yemen"
  ],
  Oceanía: [
    "Australia", "Fiyi", "Islas Marshall", "Islas Salomón", "Kiribati", "Micronesia", "Nauru", "Nueva Zelanda", "Palaos", "Papúa Nueva Guinea", "Samoa", "Tonga", "Tuvalu", "Vanuatu"
  ]
};

const aliases: Record<string, string[]> = {
  "Estados Unidos": ["USA", "US", "United States", "EEUU", "EUA"],
  "Reino Unido": ["UK", "United Kingdom", "Inglaterra", "Gran Bretaña", "England", "Great Britain"],
  "Rusia": ["Federación Rusa", "Russia"],
  "Emiratos Árabes Unidos": ["UAE", "EAU"],
  "República Centroafricana": ["RCA", "CAR"],
  "República Democrática del Congo": ["RDC", "DRC", "Congo Democrático", "Zaire"],
  "República del Congo": ["Congo", "Congo Brazzaville"],
  "Corea del Sur": ["South Korea", "Corea"],
  "Corea del Norte": ["North Korea"],
  "Nueva Zelanda": ["New Zealand", "NZ"],
  "Países Bajos": ["Holanda", "Netherlands"],
  "Bosnia y Herzegovina": ["Bosnia", "Bosnia Herzegovina"],
  "Antigua y Barbuda": ["Antigua"],
  "San Vicente y las Granadinas": ["San Vicente"],
  "San Cristóbal y Nieves": ["San Cristobal", "St Kitts", "Saint Kitts and Nevis"],
  "Trinidad y Tobago": ["Trinidad"],
  "Santo Tomé y Príncipe": ["Santo Tome"],
  "Papúa Nueva Guinea": ["Papua", "PNG"],
  "Macedonia del Norte": ["Macedonia"],
  "Ciudad del Vaticano": ["Vaticano", "Vatican"],
  "Arabia Saudita": ["Arabia Saudi", "Saudi Arabia"],
  "Sudáfrica": ["South Africa"],
  "Birmania": ["Myanmar"],
  "Suazilandia": ["Esuatini", "Eswatini"],
  "República Checa": ["Chequia", "Czechia", "Czech Republic"],
  "República Dominicana": ["Dominicana", "RD"],
  "El Salvador": ["Salvador"],
  "Guinea Ecuatorial": ["Guinea Ecuatorial"],
  "Costa de Marfil": ["Cote d'Ivoire", "Ivory Coast"],
  "Cabo Verde": ["Cape Verde"],
  "Timor Oriental": ["Timor Leste", "East Timor"],
  "Sri Lanka": ["Ceilán", "Ceylon"],
  "Bielorrusia": ["Belarus"],
  "Moldavia": ["Moldova"],
  "Rumania": ["Rumanía", "Romania"],
  "Kazajistán": ["Kazakhstan"],
  "Afganistán": ["Afghanistan"],
  "Irak": ["Iraq"],
  "Irán": ["Iran"],
  "Pakistán": ["Pakistan"],
  "Tayikistán": ["Tajikistan"],
  "Turkmenistán": ["Turkmenistan"],
  "Uzbekistán": ["Uzbekistan"],
  "Kirguistán": ["Kyrgyzstan"],
  "Azerbaiyán": ["Azerbaijan"],
  "Bután": ["Bhutan"],
  "Baréin": ["Bahrain"],
  "Catar": ["Qatar"],
  "Singapur": ["Singapore"],
  "Tailandia": ["Thailand"],
  "Malasia": ["Malaysia"],
  "Filipinas": ["Philippines"],
  "Japón": ["Japan"],
  "Taiwán": ["Taiwan", "Republic of China"], // Note: Taiwan is sometimes considered a country. I'll leave it out of the main list to avoid controversy, or add it to Asia. Let's not add to main list unless specified.
};

let output = `export interface Country {
  name: string;
  regions: string[];
  aliases: string[];
}

export const countries: Country[] = [
`;

const countryMap = new Map<string, { regions: Set<string>, aliases: string[] }>();

for (const [region, countryList] of Object.entries(regions)) {
  for (const country of countryList) {
    if (!countryMap.has(country)) {
      countryMap.set(country, { regions: new Set(), aliases: aliases[country] || [] });
    }
    countryMap.get(country)!.regions.add(region);
  }
}

for (const [country, data] of countryMap.entries()) {
  output += `  { name: "${country}", regions: ${JSON.stringify(Array.from(data.regions))}, aliases: ${JSON.stringify(data.aliases)} },\n`;
}

output += `];\n`;


fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/countries.ts', output);
console.log('Done');
