# FeedbackIQ

**AI customer review analyzer.** Upload customer reviews, and FeedbackIQ tells you what people are unhappy about, groups the complaints into issues, and shows whether your fix actually worked.

**Live demo:** https://feedbackiq-sable.vercel.app
**Backend API:** https://feedbackiq-q794.onrender.com
**Code:** https://github.com/ashutoshjhaa/feedbackiq

> Note: The backend runs on a free server. If nobody used it for a while, the first request can take 30-60 seconds to wake up. Please wait a little on first login.

---

## The problem

Companies get hundreds of reviews. Nobody has time to read them all. A one-time chat with an AI can summarize reviews, but it cannot keep track of problems over time. FeedbackIQ turns reviews into a simple loop:

**Review -> Issue -> Fix -> Track**

## Features

- **Login and register** with JWT authentication.
- **Upload reviews** by pasting text or choosing a file (one review per line, optional date like `2026-10-21, review text`).
- **AI analysis** with Gemini API: sentiment (positive, negative, neutral), topic (delivery, price, quality, support, app, other) and a short summary for every review.
- **Issue grouping:** negative reviews about the same problem are grouped into one issue, with a suggested fix.
- **Fix tracking:** mark an issue as Open, In progress or Fixed. After a fix, the app shows how many negative reviews of that topic came before and after.
- **Dashboard:** total reviews, sentiment counts and negative reviews by topic.
- **Spike alert:** warns you when negative reviews of a topic grow quickly compared to the previous week.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React (Vite), plain CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| AI | Google Gemini API |
| Auth | JWT, bcrypt |
| Hosting | Vercel (frontend), Render (backend) |

## How it works

1. You upload reviews. The server sends them to Gemini in **batches of 15**, so one API call handles many reviews. If a call fails, the server retries automatically.
2. Gemini returns **structured JSON** (sentiment, topic, summary). The server saves it in MongoDB.
3. When you click "Group new negative reviews into issues", Gemini groups similar complaints and suggests one fix for each group.
4. The dashboard uses **MongoDB aggregation pipelines** to count reviews by topic and to compare this week with last week for spike alerts.
5. When you mark an issue as Fixed, the date is saved. Later reviews of the same topic are counted as "after fix".

## Project structure

```
feedbackiq/
  client/          React app (Vite)
    src/
      App.jsx      All pages: login, dashboard, upload, issues
      api.js       Small helper to call the backend
  server/          Express API
    server.js      App setup and database connection
    routes.js      Auth, reviews, stats and issues routes
    models.js      Mongoose models (User, Review, Issue)
    gemini.js      Gemini API calls with retry
  sample_reviews.txt
```

## Run it on your computer

You need Node.js 18 or newer, a MongoDB Atlas database and a Gemini API key.

**1. Backend**
```
cd server
npm install
```
Create a file named `.env` inside the `server` folder:
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=any_long_random_text
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
```
Then start it:
```
npm run dev
```

**2. Frontend** (in a new terminal)
```
cd client
npm install
npm run dev
```
Open the link shown in the terminal (usually http://localhost:5173).

**3. Try it**
Register, upload the text from `sample_reviews.txt`, check the Dashboard, then open the Issues tab and click "Group new negative reviews into issues".

## Environment variables

**Backend (Render)**

| Name | Meaning |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret used to sign login tokens |
| `GEMINI_API_KEY` | Your Gemini API key |
| `GEMINI_MODEL` | Gemini model name |
| `CLIENT_URL` | Frontend URL, so only your site can call the API |

**Frontend (Vercel)**

| Name | Meaning |
|---|---|
| `VITE_API_URL` | Backend URL ending with `/api` |

Never put real keys or passwords in GitHub. The `.env` file is ignored by git.

## Ideas for the future

- Create a GitHub issue from an app issue with one click
- Fetch app store reviews automatically on a schedule
- Email or Slack alerts for spikes
- Charts for trends over time

## Author

**Ashutosh Jha** - MERN Stack Developer
GitHub: https://github.com/ashutoshjhaa