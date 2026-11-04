import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, Review, Issue } from './models.js';
import { analyzeBatch, clusterIssues, TOPICS } from './gemini.js';

const router = Router();
const DAY = 864e5;

// ---------- auth ----------
const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    req.uid = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ message: 'Login required' });
  }
}

router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6)
    return res.status(400).json({ message: 'Email and password (min 6 chars) required' });
  if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already used' });
  const user = await User.create({ email, password: await bcrypt.hash(password, 10) });
  res.json({ token: sign(user._id) });
});

router.post('/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(400).json({ message: 'Wrong email or password' });
  res.json({ token: sign(user._id) });
});

// ---------- reviews ----------
// Har line ek review. Optional format: YYYY-MM-DD,review text
function parseLines(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{4}-\d{2}-\d{2}),\s*(.*)$/);
      return m ? { date: new Date(m[1]), text: m[2] } : { date: new Date(), text: l };
    })
    .filter((r) => r.text.length > 3)
    .slice(0, 200);
}

router.post('/reviews/upload', auth, async (req, res) => {
  try {
    const items = parseLines(req.body.text || '');
    if (!items.length) return res.status(400).json({ message: 'No reviews found' });
    let saved = 0;
    for (let i = 0; i < items.length; i += 15) {
      const batch = items.slice(i, i + 15);
      const result = await analyzeBatch(batch.map((b) => b.text));
      const docs = batch.map((b, idx) => {
        const r = result.find((x) => x.i === idx) || {};
        return {
          user: req.uid,
          text: b.text,
          date: b.date,
          sentiment: ['positive', 'negative', 'neutral'].includes(r.sentiment) ? r.sentiment : 'neutral',
          topic: TOPICS.includes(r.topic) ? r.topic : 'other',
          summary: r.summary || b.text.slice(0, 60),
        };
      });
      await Review.insertMany(docs);
      saved += docs.length;
    }
    res.json({ saved });
  } catch (e) {
    res.status(500).json({ message: 'Analysis failed: ' + e.message });
  }
});

router.get('/reviews', auth, async (req, res) => {
  res.json(await Review.find({ user: req.uid }).sort({ date: -1 }).limit(100));
});

router.get('/stats', auth, async (req, res) => {
  const uid = new mongoose.Types.ObjectId(req.uid);
  const sentiment = await Review.aggregate([
    { $match: { user: uid } },
    { $group: { _id: '$sentiment', n: { $sum: 1 } } },
  ]);
  const topics = await Review.aggregate([
    { $match: { user: uid } },
    { $group: { _id: '$topic', total: { $sum: 1 }, negative: { $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } } } },
    { $sort: { negative: -1 } },
  ]);
  // spike: pichle 7 din ke negative reviews vs uske pehle ke 7 din
  const d7 = new Date(Date.now() - 7 * DAY);
  const d14 = new Date(Date.now() - 14 * DAY);
  const recent = await Review.aggregate([
    { $match: { user: uid, sentiment: 'negative', date: { $gte: d14 } } },
    { $group: { _id: '$topic', last: { $sum: { $cond: [{ $gte: ['$date', d7] }, 1, 0] } }, prev: { $sum: { $cond: [{ $lt: ['$date', d7] }, 1, 0] } } } },
  ]);
  const spikes = recent.filter((r) => r.last >= 3 && r.last >= r.prev * 1.5);
  res.json({ sentiment, topics, spikes });
});

// ---------- issues ----------
router.post('/issues/generate', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.uid, sentiment: 'negative', issue: null }).limit(150);
    if (reviews.length < 2) return res.status(400).json({ message: 'Not enough new negative reviews' });
    const groups = await clusterIssues(reviews);
    let created = 0;
    for (const g of groups) {
      const members = (g.reviews || []).map((i) => reviews[i]).filter(Boolean);
      if (!members.length) continue;
      const issue = await Issue.create({
        user: req.uid,
        title: g.title,
        topic: TOPICS.includes(g.topic) ? g.topic : 'other',
        suggestion: g.suggestion,
        reviewCount: members.length,
      });
      await Review.updateMany({ _id: { $in: members.map((m) => m._id) } }, { issue: issue._id });
      created++;
    }
    res.json({ created });
  } catch (e) {
    res.status(500).json({ message: 'Grouping failed: ' + e.message });
  }
});

router.get('/issues', auth, async (req, res) => {
  const issues = await Issue.find({ user: req.uid }).sort({ reviewCount: -1 }).lean();
  // fix hone ke baad impact: usi topic ke negative reviews, fix se pehle vs baad
  for (const i of issues) {
    if (i.status === 'fixed' && i.fixedAt) {
      const base = { user: req.uid, topic: i.topic, sentiment: 'negative' };
      i.impact = {
        before: await Review.countDocuments({ ...base, date: { $lt: i.fixedAt } }),
        after: await Review.countDocuments({ ...base, date: { $gte: i.fixedAt } }),
      };
    }
  }
  res.json(issues);
});

router.patch('/issues/:id', auth, async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'fixed'].includes(status)) return res.status(400).json({ message: 'Bad status' });
  const issue = await Issue.findOneAndUpdate(
    { _id: req.params.id, user: req.uid },
    { status, fixedAt: status === 'fixed' ? new Date() : null },
    { new: true }
  );
  res.json(issue);
});

export default router;
