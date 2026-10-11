import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

let client;

export function getGemini() {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}
