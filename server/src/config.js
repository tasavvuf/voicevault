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
  openAiKey: process.env.OPENAI_API_KEY ?? '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'whisper-1',
  chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  assertStartup() { required('MONGODB_URI'); required('JWT_SECRET'); },
};
