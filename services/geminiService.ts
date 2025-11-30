// Mock responses for standalone mode
const MOCK_RESPONSES = [
  "The void resonance is stable. Geometric alignment suggests a low-entropy state.",
  "Detecting subtle gravitational fluctuations in the monolith formation. The system is watching.",
  "Visual pattern recognized: 'The Halo of Silence'. Energy levels are nominal.",
  "Anomalous data detected in the Z-axis. The stones are dreaming.",
  "Connection established. The structure maintains perfect equilibrium in the white space."
];

export const interpretVoid = async (imageBase64: string): Promise<string> => {
  // Simulate network delay for realism
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return a random mock response
  const randomIndex = Math.floor(Math.random() * MOCK_RESPONSES.length);
  return MOCK_RESPONSES[randomIndex];
};