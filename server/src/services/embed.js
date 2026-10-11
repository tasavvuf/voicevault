import { getOpenAi } from './openai.js';
import { config } from '../config.js';

export async function embed(text) {
  const result = await getOpenAi().embeddings.create({ model: config.embeddingModel, input: text });
  return result.data[0].embedding;
}

export function cosineSimilarity(left, right) {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2; }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
