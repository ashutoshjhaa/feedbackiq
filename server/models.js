import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const User = model('User', new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
}));

export const Review = model('Review', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  text: String,
  date: { type: Date, default: Date.now },
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral'] },
  topic: String,
  summary: String,
  issue: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
}));

export const Issue = model('Issue', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  title: String,
  topic: String,
  suggestion: String,
  reviewCount: Number,
  status: { type: String, enum: ['open', 'in_progress', 'fixed'], default: 'open' },
  fixedAt: Date,
}, { timestamps: true }));
