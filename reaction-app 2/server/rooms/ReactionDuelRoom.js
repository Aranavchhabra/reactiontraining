const { Room } = require("colyseus");

// --- Tunables ---
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 4000;
const MIN_HUMAN_REACTION_MS = 80; // below this = physiologically implausible -> flagged
const TAP_TIMEOUT_AFTER_GO_MS = 5000; // players who never tap get resolved as "did not tap"
const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 2;

class ReactionDuelRoom extends Room {
  onCreate(options) {
    this.maxClients = MAX_PLAYERS;

    this.roomState = {
      phase: "waiting", // waiting | armed | live | resolved
      goTimestamp: 0,
      round: 1,
      hostId: "",
      leaderboard: [], // [{ id, name, reactionTimeMs, falseStart, didNotTap }] sorted best->worst
      players: {}, // sessionId -> { name, ready, reactionTimeMs, falseStart, connected }
    };

    this.armTimeoutRef = null;
    this.tapTimeoutRef = null;

    this.onMessage("ready", (client) => {
      const player = this.roomState.players[client.sessionId];
      if (!player) return;
      player.ready = true;
      this.broadcastState();
    });

    this.onMessage("start", (client) => {
      if (client.sessionId !== this.roomState.hostId) return; // only host can start
      this.tryStartRound();
    });

    this.onMessage("tap", (client, payload) => {
      this.handleTap(client, payload);
    });

    this.onMessage("rematch", () => {
      this.resetForNewRound();
    });

    console.log(`Room ${this.roomId} created`);
  }

  onJoin(client, options) {
    this.roomState.players[client.sessionId] = {
      name: (options && options.name) || `Player-${client.sessionId.slice(0, 4)}`,
      ready: false,
      reactionTimeMs: -1,
      falseStart: false,
      connected: true,
    };
    if (!this.roomState.hostId) {
      this.roomState.hostId = client.sessionId; // first joiner is host / match starter
    }
    console.log(`${this.roomState.players[client.sessionId].name} joined room ${this.roomId} (${Object.keys(this.roomState.players).length}/${MAX_PLAYERS})`);
    this.broadcastState();
  }

  onLeave(client) {
    const player = this.roomState.players[client.sessionId];
    if (player) player.connected = false;

    if (this.roomState.hostId === client.sessionId) {
      const nextHost = Object.entries(this.roomState.players).find(([id, p]) => p.connected && id !== client.sessionId);
      this.roomState.hostId = nextHost ? nextHost[0] : "";
    }

    this.clearTimers();
    if (this.roomState.phase !== "resolved") {
      this.roomState.phase = "waiting";
      this.roomState.goTimestamp = 0;
      for (const p of Object.values(this.roomState.players)) p.ready = false;
    }
    this.broadcastState();
  }

  onDispose() {
    this.clearTimers();
    console.log(`Room ${this.roomId} disposed`);
  }

  // --- Game flow ---

  tryStartRound() {
    const connectedPlayers = Object.values(this.roomState.players).filter((p) => p.connected);
    if (connectedPlayers.length < MIN_PLAYERS_TO_START) return; // need at least 2 people
    const allReady = connectedPlayers.every((p) => p.ready);
    if (!allReady) return; // host can only start once everyone has readied up
    if (this.roomState.phase !== "waiting") return;

    this.roomState.phase = "armed";
    this.roomState.goTimestamp = 0;
    this.broadcastState();

    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    this.armTimeoutRef = this.clock.setTimeout(() => this.fireGo(), delay);
  }

  fireGo() {
    const serverTime = Date.now();
    this.roomState.goTimestamp = serverTime;
    this.roomState.phase = "live";
    this.broadcast("go", { serverTime });
    this.broadcastState();

    // Safety net: resolve once the window closes even if someone never taps.
    this.tapTimeoutRef = this.clock.setTimeout(() => this.resolveRound(), TAP_TIMEOUT_AFTER_GO_MS);
  }

  handleTap(client, payload) {
    const player = this.roomState.players[client.sessionId];
    if (!player) return;

    // False start: tapped before "go" was ever fired.
    if (this.roomState.phase === "armed") {
      player.falseStart = true;
      player.reactionTimeMs = 0;
      this.broadcastState();
      this.maybeResolveEarly();
      return;
    }

    if (this.roomState.phase !== "live") return; // ignore stray taps
    if (player.reactionTimeMs !== -1) return; // already recorded

    // Client reports its OWN clientTapTime - clientReceiveTime (both client-local
    // monotonic timestamps). This isolates human reaction time and cancels out
    // one-way network latency to that specific client.
    const reported = Number(payload && payload.reactionTimeMs);
    if (!Number.isFinite(reported) || reported < 0) return;

    if (reported < MIN_HUMAN_REACTION_MS) {
      player.falseStart = true; // implausibly fast -> flag rather than trust it
      player.reactionTimeMs = reported;
    } else {
      player.reactionTimeMs = reported;
    }

    this.broadcastState();

    const connected = Object.values(this.roomState.players).filter((p) => p.connected);
    const allTapped = connected.every((p) => p.reactionTimeMs !== -1);
    if (allTapped) this.resolveRound();
  }

  // If everyone still active has now tapped/false-started, resolve immediately
  // instead of waiting for the full timeout window.
  maybeResolveEarly() {
    const connected = Object.values(this.roomState.players).filter((p) => p.connected);
    const allDone = connected.every((p) => p.reactionTimeMs !== -1);
    if (allDone) this.resolveRound();
  }

  resolveRound() {
    this.clearTimers();
    if (this.roomState.phase === "resolved") return;
    this.roomState.phase = "resolved";

    const entries = Object.entries(this.roomState.players).filter(([, p]) => p.connected);

    const ranked = entries.map(([id, p]) => ({
      id,
      name: p.name,
      reactionTimeMs: p.reactionTimeMs === -1 ? null : p.reactionTimeMs,
      falseStart: p.falseStart,
      didNotTap: p.reactionTimeMs === -1,
    }));

    // Sort: valid fast taps first (ascending time), then no-taps, then false starts last.
    ranked.sort((a, b) => {
      const rank = (x) => (x.falseStart ? 2 : x.didNotTap ? 1 : 0);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return a.reactionTimeMs - b.reactionTimeMs;
      return 0;
    });

    this.roomState.leaderboard = ranked;
    this.broadcastState();
    this.broadcast("result", { leaderboard: ranked });
  }

  resetForNewRound() {
    this.clearTimers();
    this.roomState.phase = "waiting";
    this.roomState.goTimestamp = 0;
    this.roomState.leaderboard = [];
    this.roomState.round += 1;
    for (const p of Object.values(this.roomState.players)) {
      p.ready = false;
      p.reactionTimeMs = -1;
      p.falseStart = false;
    }
    this.broadcastState();
  }

  clearTimers() {
    if (this.armTimeoutRef) {
      this.armTimeoutRef.clear();
      this.armTimeoutRef = null;
    }
    if (this.tapTimeoutRef) {
      this.tapTimeoutRef.clear();
      this.tapTimeoutRef = null;
    }
  }

  broadcastState() {
    this.broadcast("state", this.roomState);
  }
}

module.exports = { ReactionDuelRoom };
