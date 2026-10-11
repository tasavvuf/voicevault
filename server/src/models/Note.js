import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema({ text: { type: String, required: true }, done: { type: Boolean, default: false } }, { _id: false });

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, required: true },
  audioPath: { type: String, default: null },
  audioUrl: { type: String, default: null },
  durationMs: { type: Number, required: true, min: 0, max: 180_000 },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing', index: true },
  stage: { type: String, enum: ['queued', 'uploading', 'uploaded', 'transcribing', 'summarizing', 'embedding', 'ready', 'failed'], default: 'uploaded', index: true },
  stageMessage: { type: String, default: 'Audio uploaded. Queued for Gemini AI analysis.' },
  transcript: { type: String, default: '' },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  tags: { type: [String], default: [] },
  actionItems: { type: [actionItemSchema], default: [] },
  embedding: { type: [Number], default: [] },
  failureReason: { type: String, default: null },
}, { timestamps: true });

noteSchema.index({ userId: 1, clientId: 1 }, { unique: true });

export const Note = mongoose.model('Note', noteSchema);
