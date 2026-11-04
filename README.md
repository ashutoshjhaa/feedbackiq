# FeedbackIQ

Review -> Issue -> Fix -> Track. MERN (plain JavaScript) + Gemini API.

## Setup
1. Server:
   cd server && npm install
   copy .env.example to .env and fill MONGO_URI, JWT_SECRET, GEMINI_API_KEY
   npm run dev
2. Client (new terminal):
   cd client && npm install && npm run dev
3. Open http://localhost:5173, register, upload sample_reviews.txt, then click "Group new negative reviews into issues".

Needs Node 18+ (uses built-in fetch).

## How it works
- Reviews are sent to Gemini in batches of 15 (one API call per batch) and come back as JSON: sentiment, topic, summary. Retry on failure.
- Negative reviews are grouped by Gemini into issues with a suggested fix.
- Marking an issue "Fixed" saves the date; negative reviews of that topic are then counted before vs after it.
- Dashboard uses MongoDB aggregation for topic counts and a 7-day vs previous 7-day spike check.
