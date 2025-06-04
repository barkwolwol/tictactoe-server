const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // socket.id => { nickname }
let rooms = {}; // roomName => { players: [socket.id], board, currentTurn, winner }

// 유저 목록 broadcast
const broadcastUserList = () => {
  const nicknames = Object.values(users).map((u) => u.nickname);
  io.emit("userList", nicknames);
};

// 방 목록 broadcast
const broadcastRoomList = () => {
  const roomNames = Object.keys(rooms);
  io.emit("roomList", roomNames);
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 닉네임 설정
  socket.on("setNickname", (nickname) => {
    users[socket.id] = { nickname };
    broadcastUserList();
  });

  // 대기실 채팅
  socket.on("lobbyMessage", (msg) => {
    const nickname = users[socket.id]?.nickname || "Unknown";
    io.emit("lobbyMessage", { nickname, msg });
  });

  // 방 생성
  socket.on("createRoom", (roomName) => {
    if (rooms[roomName]) return;
    rooms[roomName] = {
      players: [socket.id],
      board: Array(9).fill(null),
      currentTurn: "X",
    };
    socket.join(roomName);
    socket.emit("roomCreated", roomName);
    broadcastRoomList();
  });

  // 방 목록 요청
  socket.on("getRoomList", () => {
    broadcastRoomList();
  });

  // 게임 입장
  socket.on("joinRoom", (roomName) => {
    const room = rooms[roomName];
    if (!room || room.players.length >= 2) return;
    room.players.push(socket.id);
    socket.join(roomName);
    io.to(roomName).emit("startGame", roomName);
  });

  // 게임 진행
  socket.on("makeMove", ({ roomName, index }) => {
    const room = rooms[roomName];
    if (!room) return;

    const symbol = room.players[0] === socket.id ? "X" : "O";
    if (symbol !== room.currentTurn || room.board[index]) return;

    room.board[index] = symbol;
    const winner = checkWinner(room.board);

    if (winner) {
      io.to(roomName).emit("boardUpdate", { board: room.board, currentTurn: null });
      io.to(roomName).emit("gameOver", winner);
    } else {
      room.currentTurn = room.currentTurn === "X" ? "O" : "X";
      io.to(roomName).emit("boardUpdate", {
        board: room.board,
        currentTurn: room.currentTurn,
      });
    }
  });

  // 게임 채팅
  socket.on("gameMessage", ({ roomName, msg }) => {
    const nickname = users[socket.id]?.nickname || "Unknown";
    io.to(roomName).emit("gameMessage", { nickname, msg });
  });

  // 연결 종료
  socket.on("disconnect", () => {
    delete users[socket.id];
    for (const roomName in rooms) {
      const room = rooms[roomName];
      room.players = room.players.filter((id) => id !== socket.id);
      if (room.players.length === 0) delete rooms[roomName];
    }
    broadcastUserList();
    broadcastRoomList();
  });
});

const checkWinner = (b) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, bIdx, c] of lines) {
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
  }
  return b.includes(null) ? null : "draw";
};

server.listen(3002, () => console.log("Server running on port 3002"));