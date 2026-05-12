import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
// In ESM, we must specify the extension for local files when using Node natively
import { countries } from "./src/data/countries.ts";

async function startServer() {
  const app = express();
  // Ensure we use the PORT provided by the environment (though hardcoded to 3000 in AI Studio, it's a good practice)
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for AI Validation
  app.post("/api/validate", async (req, res) => {
    try {
      const { input, region } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      
      const ai = new GoogleGenAI({ apiKey });

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
        if (exists) {
          return res.json({ result: text });
        }
      }
      return res.json({ result: null });
    } catch (error) {
      console.error("AI Validation error:", error);
      res.status(500).json({ error: "Validation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Dynamically load vite so it's not required in production
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: Node's process.cwd() is mostly safe, but using path resolving is better
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
