const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// 방 별로 상태 관리
const rooms = {};

const checkWinner = (b) => {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,bIndex,c] of lines) {
    if (b[a] && b[a] === b[bIndex] && b[a] === b[c]) return b[a];
  }
  return b.includes(null) ? null : "draw";
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);

    // 방 상태 초기화
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        board: Array(9).fill(null),
        currentTurn: "X",
      };
    }

    const room = rooms[roomId];

    // 플레이어 배정
    if (!Object.values(room.players).includes("X")) {
      room.players[socket.id] = "X";
    } else if (!Object.values(room.players).includes("O")) {
      room.players[socket.id] = "O";
    } else {
      room.players[socket.id] = "spectator";
    }

    const symbol = room.players[socket.id];

    // 현재 유저에게 상태 전송
    socket.emit("playerSymbol", symbol);
    socket.emit("boardUpdate", {
      board: room.board,
      currentTurn: room.currentTurn,
    });

    // 게임이 끝난 상태라면 알려줌
    const winner = checkWinner(room.board);
    if (winner) socket.emit("gameOver", winner);
  });

  socket.on("makeMove", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const symbol = room.players[socket.id];
    if (symbol !== room.currentTurn || room.board[index]) return;

    room.board[index] = symbol;
    const winner = checkWinner(room.board);

    if (winner) {
      io.to(roomId).emit("boardUpdate", {
        board: room.board,
        currentTurn: null,
      });
      io.to(roomId).emit("gameOver", winner);
    } else {
      room.currentTurn = room.currentTurn === "X" ? "O" : "X";
      io.to(roomId).emit("boardUpdate", {
        board: room.board,
        currentTurn: room.currentTurn,
      });
    }
  });

  socket.on("restartGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.board = Array(9).fill(null);
    room.currentTurn = "X";
    io.to(roomId).emit("boardUpdate", {
      board: room.board,
      currentTurn: room.currentTurn,
    });
    io.to(roomId).emit("gameOver", null);
  });

  socket.on("chatMessage", ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;

    const symbol = room.players[socket.id] || "spectator";
    io.to(roomId).emit("chatMessage", { player: symbol, message });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];

        // 방에 아무도 없으면 정리
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

server.listen(3002, () => {
  console.log("Server is running on port 3002");
});
