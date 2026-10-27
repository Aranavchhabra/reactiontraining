# Deploying to Render (Step by Step)

This puts your server on the public internet so friends can join from
their own homes/data, not just your wifi. Total time: ~10 minutes,
no command line needed after the initial GitHub push.

## Prerequisites
- A free GitHub account (github.com) — for hosting the code
- A free Render account (render.com) — for running the server

---

## Step 1 — Put the code on GitHub

1. Go to **github.com**, sign in (or create a free account)
2. Click the **+** icon top-right → **New repository**
3. Name it something like `reaction-duel` → keep it **Public** or
   **Private** (either works) → click **Create repository**
4. On the new repo's page, click **uploading an existing file**
5. Drag in the entire `reaction-app` folder you downloaded from me
   (or just the `server/` and `client/` folders + `package.json` —
   you don't need `node_modules`, it gets installed automatically)
6. Scroll down, click **Commit changes**

---

## Step 2 — Create the Render web service

1. Go to **render.com**, sign in (you can sign in with your GitHub account —
   this also makes Step 3 auto-fill)
2. Click **New +** (top right) → **Web Service**
3. Connect your GitHub account if prompted, then select the
   `reaction-duel` repo you just created

---

## Step 3 — Configure the service

Fill in these exact settings:

| Field | Value |
|---|---|
| **Name** | `reaction-duel` (or anything you like) |
| **Region** | Pick whichever is closest to you/your friends |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

Leave everything else as default.

---

## Step 4 — Deploy

1. Click **Create Web Service** at the bottom
2. Render will start building — you'll see a live log; wait for it to
   say something like `Reaction Duel server listening on ws://...`
   and show a green **"Live"** status (usually 1–3 minutes)
3. At the top of the page you'll see your public URL, something like:

   ```
   https://reaction-duel.onrender.com
   ```

---

## Step 5 — Play

1. Open that URL yourself, click **Create Room**, note the room code
2. Text/WhatsApp/send the URL + room code to your 4 friends
3. Everyone opens the URL on their own phone/laptop, types their name,
   enters the room code, hits **Join Room**
4. Everyone hits **Ready**
5. You (the host) hit **Start Match**
6. Green screen = tap!

---

## One thing to know about the free tier

Render's free instances **go to sleep after 15 minutes with no traffic**
and take **~30–60 seconds to wake up** on the next request. So:
- If it's been a while since anyone used it, the first person to open
  the link that day might see a blank/loading page for up to a minute —
  that's just it waking up, not broken
- Once awake, it stays fast for everyone until it goes idle again

This doesn't cost anything and needs no maintenance from you — it just
sits there ready whenever you and your friends want to play.

## If something goes wrong

- **Build fails**: double check "Root Directory" is exactly `server`
  (not the repo root) — that's the #1 cause of failed builds here
- **Page loads but Create Room does nothing**: open the browser console
  (F12) and check for a red error — usually means the site loaded but
  couldn't reach the WebSocket; try refreshing after Render finishes
  waking up
- **Friends can't join with the room code**: room codes reset every time
  the server restarts/goes to sleep-then-wakes — make sure whoever
  created the room does so *after* everyone's ready to join right away
