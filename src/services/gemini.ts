import { GoogleGenAI } from "@google/genai";
import { countries } from "../data/countries";

export const validateWithAI = async (input: string, region: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const validCountries = countries
      .filter(c => region === 'Mundo' || c.regions.includes(region))
      .map(c => c.name)
      .join(", ");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `You are a VERY STRICT expert in geography. The user is playing a game to name all countries in ${region}.
They typed: "${input}".
Is this a valid name, a widely recognized acronym (e.g., USA, UK, EUA), or a very minor typo (MAXIMUM 1 letter difference) for a country in ${region}?

RULES:
1. Be EXTREMELY STRICT. Do NOT accept loose associations, partial names, or completely wrong names.
2. Accept lowercase, uppercase, and missing accents.
3. Accept standard acronyms (e.g., "USA", "UK", "UAE", "RCA").
4. Accept a MAXIMUM of 1 letter error (typo) compared to the real name. If it has 2 or more letter errors, REJECT IT.
5. If it is a valid match under these strict rules, you MUST respond ONLY with the exact standard Spanish name of the country from this list: [${validCountries}].
6. If it is NOT a valid match, respond ONLY with "NO".

Do not include any other text or punctuation.`,
      config: {
        temperature: 0.0,
      }
    });

    const text = response.text?.trim();
    if (text && text !== "NO") {
      const exists = countries.find(c => c.name === text);
      if (exists) return text;
    }
    return null;
  } catch (error) {
    console.error("AI Validation error:", error);
    return null;
  }
};
