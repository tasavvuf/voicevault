import { getGemini } from './gemini.js';
import { config } from '../config.js';

export async function transcribe(audioPath) {
  const gemini = getGemini();
  const audioFile = await gemini.files.upload({ file: audioPath, config: { mimeType: 'audio/m4a' } });
  try {
    const interaction = await gemini.interactions.create({
      model: config.transcriptionModel,
      input: [{ type: 'audio', uri: audioFile.uri, mime_type: audioFile.mimeType }],
      generation_config: { transcription_config: { mode: 'smart' } },
    });
    const transcript = interaction.output_text?.trim();
    if (!transcript) throw new Error('Gemini did not return a transcript.');
    return transcript;
  } finally {
    if (audioFile.name) await gemini.files.delete({ name: audioFile.name }).catch(() => {});
  }
}
