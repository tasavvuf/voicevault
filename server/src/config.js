import 'dotenv/config';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  transcriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL ?? 'gemini-3.5-transcribe',
  chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.8-flash',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-2',
  assertStartup() { required('MONGODB_URI'); required('JWT_SECRET'); required('GEMINI_API_KEY'); },
};
