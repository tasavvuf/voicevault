import fs from 'node:fs';
import { getOpenAi } from './openai.js';
import { config } from '../config.js';

export async function transcribe(audioPath) {
  const result = await getOpenAi().audio.transcriptions.create({ file: fs.createReadStream(audioPath), model: config.transcriptionModel });
  return result.text.trim();
}
