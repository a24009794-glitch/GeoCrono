export interface Micronation {
  name: string;
  coordinates: [number, number];
}

export const micronations: Micronation[] = [
  // Europe
  { name: "Andorra", coordinates: [1.5218, 42.5063] },
  { name: "Mónaco", coordinates: [7.4246, 43.7384] },
  { name: "San Marino", coordinates: [12.4578, 43.9424] },
  { name: "Ciudad del Vaticano", coordinates: [12.4534, 41.9029] },
  { name: "Liechtenstein", coordinates: [9.5209, 47.1660] },
  { name: "Malta", coordinates: [14.3754, 35.9375] },
  { name: "Luxemburgo", coordinates: [6.1296, 49.8153] },

  // Americas
  { name: "Antigua y Barbuda", coordinates: [-61.8, 17.06] },
  { name: "Bahamas", coordinates: [-77.3963, 25.0343] },
  { name: "Barbados", coordinates: [-59.5432, 13.1939] },
  { name: "Dominica", coordinates: [-61.3710, 15.4150] },
  { name: "Granada", coordinates: [-61.6042, 12.1165] },
  { name: "San Cristóbal y Nieves", coordinates: [-62.7830, 17.3578] },
  { name: "San Vicente y las Granadinas", coordinates: [-61.2872, 13.2528] },
  { name: "Santa Lucía", coordinates: [-60.9789, 13.9094] },
  { name: "Trinidad y Tobago", coordinates: [-61.2225, 10.6918] },

  // Africa
  { name: "Cabo Verde", coordinates: [-23.6167, 16.5388] },
  { name: "Comoras", coordinates: [43.3333, -11.6455] },
  { name: "Mauricio", coordinates: [57.5522, -20.3484] },
  { name: "Santo Tomé y Príncipe", coordinates: [6.6131, 0.1864] },
  { name: "Seychelles", coordinates: [55.4920, -4.6796] },

  // Asia
  { name: "Baréin", coordinates: [50.5577, 26.0667] },
  { name: "Brunéi", coordinates: [114.7277, 4.5353] },
  { name: "Maldivas", coordinates: [73.2207, 3.2028] },
  { name: "Singapur", coordinates: [103.8198, 1.3521] },

  // Oceania
  { name: "Fiyi", coordinates: [178.0650, -17.7134] },
  { name: "Islas Marshall", coordinates: [171.1845, 7.1315] },
  { name: "Kiribati", coordinates: [173.0000, 1.4167] },
  { name: "Micronesia", coordinates: [158.2500, 6.9167] },
  { name: "Nauru", coordinates: [166.9315, -0.5228] },
  { name: "Palaos", coordinates: [134.5825, 7.5150] },
  { name: "Samoa", coordinates: [-172.1046, -13.7590] },
  { name: "Tonga", coordinates: [-175.1982, -21.1790] },
  { name: "Tuvalu", coordinates: [179.1940, -8.5144] },
  { name: "Vanuatu", coordinates: [166.9592, -15.3767] }
];
