const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let players = {};
let board = Array(9).fill(null);
let currentTurn = "X";

const checkWinner = (b) => {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]          // diagonals
  ];
  for (let [a,bIndex,c] of lines) {
    if (b[a] && b[a] === b[bIndex] && b[a] === b[c]) return b[a];
  }
  return b.includes(null) ? null : "draw";
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Assign player
  if (!Object.values(players).includes("X")) players[socket.id] = "X";
  else if (!Object.values(players).includes("O")) players[socket.id] = "O";
  else players[socket.id] = "spectator";

  const symbol = players[socket.id];
  socket.emit("playerSymbol", symbol);
  socket.emit("boardUpdate", { board, currentTurn });

  socket.on("makeMove", (index) => {
    if (symbol !== currentTurn || board[index]) return;

    board[index] = symbol;
    const winner = checkWinner(board);

    if (winner) {
      io.emit("boardUpdate", { board, currentTurn: null });
      io.emit("gameOver", winner);
    } else {
      currentTurn = currentTurn === "X" ? "O" : "X";
      io.emit("boardUpdate", { board, currentTurn });
    }
  });

  socket.on("restartGame", () => {
    board = Array(9).fill(null);
    currentTurn = "X";
    io.emit("boardUpdate", { board, currentTurn });
    io.emit("gameOver", null); // reset game result
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete players[socket.id];
  });
});

server.listen(3002, () => {
  console.log("Server is running on port 3002");
});
