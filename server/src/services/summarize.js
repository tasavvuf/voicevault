import { z } from 'zod';
import { getGemini } from './gemini.js';
import { config } from '../config.js';

const outputSchema = z.object({ title: z.string().min(1).max(100), summary: z.string().min(1).max(1000), tags: z.array(z.string().min(1).max(40)).max(8), actionItems: z.array(z.string().min(1).max(240)).max(12) });
const jsonSchema = { type: 'object', additionalProperties: false, required: ['title', 'summary', 'tags', 'actionItems'], properties: { title: { type: 'string' }, summary: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, actionItems: { type: 'array', items: { type: 'string' } } } };

export async function summarize(transcript) {
  const interaction = await getGemini().interactions.create({
    model: config.chatModel,
    system_instruction: `You are an elite personal knowledge synthesis AI.
Your purpose is to turn spoken voice-note transcripts into high-clarity structured notes.
RULES:
1. Title: Generate a concise, meaningful title (3-7 words) summarizing the main subject.
2. Summary: Write a clear 2-4 sentence executive summary of the core content and takeaways.
3. Tags: 2-5 lowercase topical categorization tags (e.g. ["work", "ideas", "planning"]).
4. Action Items: Extract concrete actionable tasks, to-dos, or promises mentioned in the speech. Each task must start with an action verb (e.g. "Call David back tomorrow"). If no tasks exist, return an empty array.
5. Strictly adhere to the requested JSON schema. Never include conversational chatter.`,
    input: `Synthesize the following voice-note transcript into a structured personal note according to the requested JSON schema:\n\nTranscript:\n${transcript}`,
    response_format: { type: 'text', mime_type: 'application/json', schema: jsonSchema },
    generation_config: {
      temperature: 0.2,
    },
  });
  const parsed = outputSchema.parse(JSON.parse(interaction.output_text ?? '{}'));
  return { ...parsed, actionItems: parsed.actionItems.map((text) => ({ text, done: false })) };
}
