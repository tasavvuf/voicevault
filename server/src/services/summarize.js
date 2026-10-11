import { z } from 'zod';
import { getOpenAi } from './openai.js';
import { config } from '../config.js';

const outputSchema = z.object({ title: z.string().min(1).max(100), summary: z.string().min(1).max(1000), tags: z.array(z.string().min(1).max(40)).max(8), actionItems: z.array(z.string().min(1).max(240)).max(12) });
const jsonSchema = { name: 'voice_note_analysis', strict: true, schema: { type: 'object', additionalProperties: false, required: ['title', 'summary', 'tags', 'actionItems'], properties: { title: { type: 'string' }, summary: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, actionItems: { type: 'array', items: { type: 'string' } } } } };

export async function summarize(transcript) {
  const response = await getOpenAi().chat.completions.create({
    model: config.chatModel,
    response_format: { type: 'json_schema', json_schema: jsonSchema },
    messages: [
      { role: 'system', content: 'Turn voice-note transcripts into concise, useful personal notes. Do not invent facts. Return only the requested JSON.' },
      { role: 'user', content: transcript },
    ],
  });
  const parsed = outputSchema.parse(JSON.parse(response.choices[0]?.message?.content ?? '{}'));
  return { ...parsed, actionItems: parsed.actionItems.map((text) => ({ text, done: false })) };
}
