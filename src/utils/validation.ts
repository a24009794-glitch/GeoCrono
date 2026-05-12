import { countries } from '../data/countries';

export const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// Prepare a flattened list of searchable items
export interface SearchableCountry {
  originalName: string;
  searchName: string;
  regions: string[];
  isAlias: boolean;
}

const searchableCountries: SearchableCountry[] = [];

countries.forEach(country => {
  searchableCountries.push({
    originalName: country.name, // We still resolve to the Spanish originalName as the primary key internally
    searchName: normalizeString(country.name),
    regions: country.regions,
    isAlias: false,
  });
  
  if (country.nameEn) {
    searchableCountries.push({
      originalName: country.name,
      searchName: normalizeString(country.nameEn),
      regions: country.regions,
      isAlias: true,
    });
  }
  
  country.aliases.forEach(alias => {
    searchableCountries.push({
      originalName: country.name,
      searchName: normalizeString(alias),
      regions: country.regions,
      isAlias: true,
    });
  });
});

// Calculate Levenshtein distance between two strings
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[a.length][b.length];
}

export const validateCountry = (input: string, region: string): string | null => {
  const normalizedInput = normalizeString(input);
  
  const validCountries = searchableCountries.filter(c => 
    region === 'Mundo' || c.regions.includes(region)
  );

  // 1. Try exact match (covers exact names and exact acronyms/aliases)
  const exactMatch = validCountries.find(c => c.searchName === normalizedInput);
  if (exactMatch) {
    return exactMatch.originalName;
  }
  
  // 2. Try max 1 letter error (Levenshtein distance === 1)
  // We only allow 1 letter error for words longer than 3 characters to avoid matching short acronyms incorrectly
  if (normalizedInput.length > 3) {
    const oneLetterMatch = validCountries.find(c => 
      c.searchName.length > 3 && levenshtein(c.searchName, normalizedInput) === 1
    );
    if (oneLetterMatch) {
      return oneLetterMatch.originalName;
    }
  }

  return null;
};
