require('dotenv').config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const questions = require("./questions.json");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const MAX_TIME = 15;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing VITE_DISCORD_CLIENT_ID or CLIENT_SECRET env vars");
  process.exit(1);
}

// Use native fetch from global (Node 18+)
const fetch = global.fetch;

if (!fetch) {
  console.error("Global fetch not found — please upgrade Node.js to 18+");
  process.exit(1);
}

// Daily leaderboard reset functionality
const dailyScores = new Map(); // userId -> { score: number, lastReset: Date }
const DAILY_RESET_HOUR = 0; // Reset at midnight UTC

function getCurrentDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function resetDailyScoresIfNeeded() {
  const currentDay = getCurrentDay();
  
  for (const [userId, userData] of dailyScores.entries()) {
    if (userData.lastReset < currentDay) {
      dailyScores.set(userId, { score: 0, lastReset: currentDay });
      console.log(`Reset daily score for user ${userId}`);
    }
  }
}

// Reset scores every hour to catch any missed resets
setInterval(resetDailyScoresIfNeeded, 60 * 60 * 1000);

function getDailyScore(userId) {
  const currentDay = getCurrentDay();
  const userData = dailyScores.get(userId);
  
  if (!userData || userData.lastReset < currentDay) {
    dailyScores.set(userId, { score: 0, lastReset: currentDay });
    return 0;
  }
  
  return userData.score;
}

function addDailyScore(userId, points) {
  const currentDay = getCurrentDay();
  const userData = dailyScores.get(userId) || { score: 0, lastReset: currentDay };
  
  if (userData.lastReset < currentDay) {
    userData.score = 0;
    userData.lastReset = currentDay;
  }
  
  userData.score += points;
  dailyScores.set(userId, userData);
  return userData.score;
}

// POST /api/token -- exchange `code` (from embedded SDK) for an access_token
app.post("/api/token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "missing code" });

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: "https://your-cloudflare-tunnel-url.trycloudflare.com",  // Update this with your actual tunnel URL
  });

  try {
    const resp = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await resp.json();
    return res.json(json); // contains access_token etc
  } catch (err) {
    console.error("Error fetching token:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// /api/me (server helper): return user info from access token
app.get("/api/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "missing auth" });
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const resp = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return res.status(401).json({ error: "invalid token" });
    const user = await resp.json();
    res.json(user);
  } catch (err) {
    console.error("Error fetching /api/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// API endpoint to get daily leaderboard
app.get("/api/leaderboard", (req, res) => {
  const leaderboard = Array.from(dailyScores.entries())
    .map(([userId, data]) => ({
      userId,
      score: data.score,
      lastReset: data.lastReset
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100); // Top 100 players
  
  res.json(leaderboard);
});

// API endpoint to get user's daily score
app.get("/api/user/:userId/score", (req, res) => {
  const { userId } = req.params;
  const score = getDailyScore(userId);
  res.json({ userId, score });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // tighten in prod
});

// simple in-memory rooms object (replace with DB for production)
const rooms = {}; // roomId -> { players: {userId: {id,name,score}}, currentQuestion, selections, hostSocketId, timer }

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing token"));
    // validate token with Discord
    const resp = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return next(new Error("Invalid Discord token"));
    const user = await resp.json();
    socket.data.user = user;
    return next();
  } catch (err) {
    return next(new Error("Auth error"));
  }
});

function pickRandomQuestion(room) {
  if (!questions || !questions.length) return null;
  const usedQuestions = room.usedQuestions || [];
  const availableQuestions = questions.filter(q => !usedQuestions.includes(q.question));
  
  if (availableQuestions.length === 0) {
    // Reset used questions if all have been used
    room.usedQuestions = [];
    return questions[Math.floor(Math.random() * questions.length)];
  }
  
  const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  room.usedQuestions = [...usedQuestions, question.question];
  return question;
}

function computeScores(room) {
  if (!room.currentQuestion) return;
  
  const correctAnswer = room.currentQuestion.answer;
  const correctIndex = room.currentQuestion.options.findIndex(opt => opt.startsWith(correctAnswer));
  
  for (const [uid, player] of Object.entries(room.players)) {
    const selection = room.selections[uid];
    if (selection === correctIndex) {
      const timeLeft = Math.max(0, MAX_TIME - Math.floor((Date.now() - room.currentQuestion.startTime) / 1000));
      const bonusFactor = Math.max(1, Math.floor(timeLeft / 3)); // Bonus for quick answers
      
      // Add to both room score and daily score
      room.players[uid].score = (room.players[uid].score || 0) + bonusFactor;
      addDailyScore(uid, bonusFactor);
    }
  }
}

io.on("connection", (socket) => {
  const user = socket.data.user;
  const roomId = socket.handshake.auth.roomId || "default-room";

  // ensure room exists
  if (!rooms[roomId]) {
    rooms[roomId] = { 
      players: {}, 
      selections: {}, 
      currentQuestion: null, 
      hostSocketId: socket.id, 
      timer: null, 
      scores: {},
      usedQuestions: []
    };
  }

  // add player with daily score
  const dailyScore = getDailyScore(user.id);
  rooms[roomId].players[user.id] = { 
    id: user.id, 
    name: user.username, 
    score: rooms[roomId].players[user.id]?.score ?? dailyScore, 
    socketId: socket.id,
    dailyScore: dailyScore
  };
  rooms[roomId].scores = Object.fromEntries(Object.entries(rooms[roomId].players).map(([id, p]) => [id, p.score || 0]));

  socket.join(roomId);

  // notify this socket of their id
  socket.emit("you_joined", { playerId: user.id });

  // broadcast room state
  const playersList = Object.values(rooms[roomId].players).map((p) => ({ 
    id: p.id, 
    name: p.name, 
    score: p.score || 0,
    dailyScore: p.dailyScore || 0
  }));
  io.to(roomId).emit("room_state", { players: playersList, scores: rooms[roomId].scores });

  // events
  socket.on("start_game", ({ roomId: r }) => {
    const room = rooms[r];
    if (!room) return;
    // only host (first connected) may start
    if (room.hostSocketId !== socket.id) return;
    const q = pickRandomQuestion(r);
    if (!q) return;
    room.currentQuestion = { ...q, startTime: Date.now(), maxTime: MAX_TIME };
    room.selections = {};
    // broadcast start
    io.to(r).emit("question_started", { 
      question: { 
        id: q.id, 
        question: q.question, 
        options: q.options,
        answer: q.answer 
      }, 
      startTime: room.currentQuestion.startTime, 
      maxTime: room.currentQuestion.maxTime 
    });
    // set timer to finish
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      // compute result and broadcast show_result
      computeScores(room);
      room.scores = Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p.score || 0]));
      io.to(r).emit("show_result", { 
        correctIndex: room.currentQuestion.options.findIndex(opt => opt.startsWith(room.currentQuestion.answer)), 
        scores: room.scores, 
        selections: room.selections 
      });
      room.currentQuestion = null;
      room.selections = {};
      room.timer = null;
      // broadcast room_state scores update
      io.to(r).emit("room_state", { players: Object.values(room.players), scores: room.scores });
    }, MAX_TIME * 1000);
  });

  socket.on("select_option", ({ roomId: r, optionIndex }) => {
    const room = rooms[r];
    if (!room || !room.currentQuestion) return;
    room.selections[user.id] = optionIndex;
    io.to(r).emit("player_selected", { playerId: user.id, optionIndex });

    // if all players have answered => resolve early
    const connectedPlayerCount = Object.keys(room.players).length;
    const answeredCount = Object.keys(room.selections).length;
    if (answeredCount >= connectedPlayerCount) {
      if (room.timer) clearTimeout(room.timer);
      // compute immediately
      computeScores(room);
      room.scores = Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p.score || 0]));
      io.to(r).emit("show_result", { 
        correctIndex: room.currentQuestion.options.findIndex(opt => opt.startsWith(room.currentQuestion.answer)), 
        scores: room.scores, 
        selections: room.selections 
      });
      room.currentQuestion = null;
      room.selections = {};
      room.timer = null;
      // update room state
      io.to(r).emit("room_state", { players: Object.values(room.players), scores: room.scores });
    }
  });

  socket.on("submit_card_answer", ({ roomId: r, answer }) => {
    const room = rooms[r];
    if (!room || !room.currentQuestion || !room.currentQuestion.isCard) return;
    
    const correctAnswer = room.currentQuestion.cardName;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    if (isCorrect) {
      room.selections[user.id] = true;
      const timeLeft = Math.max(0, MAX_TIME - Math.floor((Date.now() - room.currentQuestion.startTime) / 1000));
      const bonusFactor = Math.max(1, Math.floor(timeLeft / 3));
      
      room.players[user.id].score = (room.players[user.id].score || 0) + bonusFactor;
      addDailyScore(user.id, bonusFactor);
    }
    
    io.to(r).emit("player_selected", { playerId: user.id, isCorrect, answer });
    
    // Check if all players have answered correctly
    const connectedPlayerCount = Object.keys(room.players).length;
    const answeredCount = Object.keys(room.selections).length;
    if (answeredCount >= connectedPlayerCount) {
      if (room.timer) clearTimeout(room.timer);
      room.scores = Object.fromEntries(Object.entries(room.players).map(([id, p]) => [id, p.score || 0]));
      io.to(r).emit("show_result", { 
        correctAnswer: room.currentQuestion.cardName,
        scores: room.scores, 
        selections: room.selections 
      });
      room.currentQuestion = null;
      room.selections = {};
      room.timer = null;
      io.to(r).emit("room_state", { players: Object.values(room.players), scores: room.scores });
    }
  });

  // when someone disconnects, remove from room
  socket.on("disconnect", () => {
    const room = rooms[roomId];
    if (!room) return;
    delete room.players[user.id];
    delete room.scores[user.id];

    // if host left, reassign host to the next socket in the room
    if (room.hostSocketId === socket.id) {
      const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) ?? []);
      room.hostSocketId = sockets.length > 0 ? sockets[0] : null;
    }

    io.to(roomId).emit("room_state", { players: Object.values(room.players), scores: room.scores });
  });
});

const frontendPath = path.join(__dirname, "../client/dist");
app.use(express.static(frontendPath));

// Catch-all: send back index.html for any unknown route
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

server.listen(PORT, () => {
  console.log("Server listening on", PORT);
  console.log("Daily leaderboard reset enabled");
});
