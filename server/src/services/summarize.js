import { z } from 'zod';
import { getGemini } from './gemini.js';
import { config } from '../config.js';

const outputSchema = z.object({ title: z.string().min(1).max(100), summary: z.string().min(1).max(1000), tags: z.array(z.string().min(1).max(40)).max(8), actionItems: z.array(z.string().min(1).max(240)).max(12) });
const jsonSchema = { type: 'object', additionalProperties: false, required: ['title', 'summary', 'tags', 'actionItems'], properties: { title: { type: 'string' }, summary: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, actionItems: { type: 'array', items: { type: 'string' } } } };

export async function summarize(transcript) {
  const interaction = await getGemini().interactions.create({
    model: config.chatModel,
    input: `Turn this voice-note transcript into a concise, useful personal note. Do not invent facts.\n\nTranscript:\n${transcript}`,
    response_format: { type: 'text', mime_type: 'application/json', schema: jsonSchema },
  });
  const parsed = outputSchema.parse(JSON.parse(interaction.output_text ?? '{}'));
  return { ...parsed, actionItems: parsed.actionItems.map((text) => ({ text, done: false })) };
}
