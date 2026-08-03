# Reaction Duel — Play With Friends

A multiplayer reaction-time game for you and up to 5 friends (6 total).
One person creates a room and gets a short room code; everyone else
joins with that code. Everyone hits **Ready**, then the room's **host**
(whoever created it) hits **Start Match** once everyone's in — the screen
flips to green at the same random moment for everyone, fastest tap wins,
ranked on a leaderboard.

Only the host can start the match — this stops the round from firing
the moment a random subset of people happen to be ready, which matters
once you're coordinating 5+ people.

Tested end-to-end with a 5-player simulation (see `server/test/sim_test.js`) —
create room → 4 more join by code → all ready → a non-host "start" attempt
is correctly ignored → host starts → synced "go" → leaderboard correctly
ranked fastest to slowest, false starts and no-taps sorted to the bottom.

## How it's fair

- The **server** picks the random delay and fires "go" — clients can't cheat by
  messing with their own clocks.
- Each player's reaction time = their own tap time minus the moment **they**
  personally received "go" — not the server's send time. This cancels out
  network lag differences between players (someone on worse wifi isn't
  unfairly penalized).
- Tapping before "go" = instant false start, sorted to the bottom.
- Reaction times under 80ms are flagged as implausible (auto-tappers).

## Play locally on one wifi network (fastest option, zero setup cost)

If you and your friends are in the same room / same wifi:

```bash
cd server
npm install
npm start
```

Then find your computer's local IP (e.g. `192.168.1.42` — run `ipconfig`
on Windows or `ifconfig`/`ip a` on Mac/Linux) and have everyone open:

```
http://<your-local-ip>:2567
```

on their own phone/laptop, browser tab. One person clicks **Create Room**
and reads the room code out loud; everyone else types it into **Join Room**.

This only works while everyone's on the same network and your computer
stays on and running the server.

## Play from anywhere — deploy it (free, ~5 minutes, no coding)

To let friends join from anywhere (not just your wifi), put the server
on Render's free tier:

1. Create a free account at **render.com**
2. Push this `server/` folder to a GitHub repo (or use Render's
   "Deploy from a public Git repo" if you don't want your own account —
   any public repo containing this folder works)
3. In Render: **New → Web Service** → connect that repo
4. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Deploy. Render gives you a public URL like `https://your-app.onrender.com`
6. Open that URL (not localhost) — same Create Room / Join Room flow,
   now works for anyone anywhere

Note: Render's free tier sleeps after 15 min of no traffic and takes
~30-60s to wake back up on the next request — fine for casual friend
games, just expect the first load after a break to be slow.

## Project structure

```
reaction-app/
├── server/
│   ├── index.js                    # Server entrypoint (Colyseus + Express)
│   ├── rooms/ReactionDuelRoom.js   # All game logic — matchmaking, timing, ranking
│   ├── test/sim_test.js            # Automated 5-player simulation test
│   └── package.json
└── client/
    └── index.html                  # The actual game page everyone opens
```

## Verify it yourself anytime

```bash
cd server
node test/sim_test.js
```

Spins up 5 simulated players against a running server, has them all ready
up, taps at different simulated speeds, and prints the resulting leaderboard.

## Ideas for later (not built yet — say the word if you want any of these)

- Best-of-3 rounds with a running score instead of single-round results
- A lobby "start" button for the host instead of everyone auto-readying
- Sound/haptic feedback on go and on tap
- Persistent leaderboard across sessions (currently resets each time the
  server restarts)
