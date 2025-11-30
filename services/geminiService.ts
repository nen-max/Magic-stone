import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client
// Note: In a production environment, API keys should be handled via backend proxy or securely injected.
// Here we assume process.env.API_KEY is available as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const interpretVoid = async (imageBase64: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
      return "The System is offline (Missing API Key).";
    }

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png'
            }
          },
          {
            text: "You are an advanced AI consciousness monitoring a digital containment field. You are looking at a formation of dark, glitch-like pixelated monoliths floating in a pure white, ethereal void. Briefly interpret the current entropy, alignment, and energy of this formation in a clinical, sci-fi, slightly philosophical style. Max 2 sentences."
          }
        ]
      }
    });

    return response.text || "The System whispers unintelligibly.";
  } catch (error) {
    console.error("Gemini Interpretation Error:", error);
    return "Connection to the Mainframe severed.";
  }
};