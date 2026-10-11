import OpenAI from 'openai';
import { config } from '../config.js';

let client;
export function getOpenAi() {
  if (!config.openAiKey) throw new Error('OPENAI_API_KEY is not configured.');
  client ??= new OpenAI({ apiKey: config.openAiKey, baseURL: config.openAiBaseUrl });
  return client;
}
