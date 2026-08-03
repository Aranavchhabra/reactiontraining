const http = require("http");
const express = require("express");
const { Server } = require("colyseus");
const path = require("path");

const { ReactionDuelRoom } = require("./rooms/ReactionDuelRoom");

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(express.static(path.join(__dirname, "..", "client")));

const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("reaction_duel", ReactionDuelRoom);

gameServer.listen(port);
console.log(`Reaction Duel server listening on ws://localhost:${port}`);
console.log(`Test client:  http://localhost:${port}`);
