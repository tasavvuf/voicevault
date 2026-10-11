import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema({ text: { type: String, required: true }, done: { type: Boolean, default: false } }, { _id: false });

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, required: true },
  audioPath: { type: String, required: true },
  durationMs: { type: Number, required: true, min: 0, max: 180_000 },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing', index: true },
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
