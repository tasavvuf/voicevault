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
  transcriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL ?? 'gemini-flash-latest',
  chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-flash-lite-latest',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
  imagekitPublicKey: process.env.IMAGEKIT_PUBLIC_KEY?.trim() ?? '',
  imagekitPrivateKey: process.env.IMAGEKIT_PRIVATE_KEY?.trim() ?? '',
  imagekitUrlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT?.trim() ?? '',
  assertStartup() { required('MONGODB_URI'); required('JWT_SECRET'); required('GEMINI_API_KEY'); },
};
