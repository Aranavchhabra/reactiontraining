const { Client } = require("colyseus.js");

async function run() {
  const client = new Client("ws://localhost:2567");

  // Player 1 creates the room (becomes host) and gets the shareable room code
  const host = await client.create("reaction_duel", { name: "Aranav" });
  const roomCode = host.roomId;
  console.log(`Room created. Code: ${roomCode}`);

  // Friends join using that code, same as they would from the client UI
  const p2 = await client.joinById(roomCode, { name: "Friend2" });
  const p3 = await client.joinById(roomCode, { name: "Friend3" });
  const p4 = await client.joinById(roomCode, { name: "Friend4" });
  const p5 = await client.joinById(roomCode, { name: "Friend5" });

  const rooms = [host, p2, p3, p4, p5];
  const delays = [420, 180, 999, 260, 310]; // simulated human reaction times (ms)
  const receiveTimes = {};

  const resultPromise = new Promise((resolve) => {
    host.onMessage("result", (payload) => resolve(payload));
  });

  rooms.forEach((r, i) => {
    r.onMessage("go", () => {
      receiveTimes[i] = Date.now();
      setTimeout(() => {
        r.send("tap", { reactionTimeMs: Date.now() - receiveTimes[i] });
      }, delays[i]);
    });
  });

  // Everyone readies up first...
  rooms.forEach((r) => r.send("ready"));
  await new Promise((res) => setTimeout(res, 300)); // give ready state a moment to propagate

  // ...then ONLY the host is allowed to start the match.
  console.log("Non-host attempts to start (should be silently ignored)...");
  p2.send("start");
  await new Promise((res) => setTimeout(res, 300));

  console.log("Host starts the match...");
  host.send("start");

  const result = await resultPromise;
  console.log(`\n5-player match resolved. Leaderboard:`);
  result.leaderboard.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} — ${p.falseStart ? "false start" : p.didNotTap ? "no tap" : p.reactionTimeMs.toFixed(1) + "ms"}`);
  });
  process.exit(0);
}

run().catch((e) => { console.error("TEST FAILED:", e); process.exit(1); });
