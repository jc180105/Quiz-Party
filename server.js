const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { log, getLocalIp } = require('./src/utils');
const setupRoutes = require('./src/routes');
const setupSocket = require('./src/socket');

// --- Configure Multer (Uploads) ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'), false);
    }
  }
});

// --- Setup Server ---
const app = express();
const server = http.createServer(app);
const LOCAL_IP = getLocalIp();
const FRONTEND_URL = process.env.FRONTEND_URL || '';

// CORS Origins (Dev + Prod)
const allowedOrigins = [
  `http://localhost:3000`,
  `http://${LOCAL_IP}:3000`,
];
if (FRONTEND_URL) allowedOrigins.push(FRONTEND_URL);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// Health Check (Railway monitoring)
app.get('/api/health', (req, res) => {
  const { state } = require('./src/gameState');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    players: state.game.players.size,
    phase: state.game.phase,
    questions: state.questions.length
  });
});

// Setup Modules
setupRoutes(app, upload, io, process.env.PORT || 3000);
setupSocket(io);

// --- Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  log.info(`\n🎮 Quiz Server rodando na porta ${PORT}`);
  if (FRONTEND_URL) {
    log.info(`🌐 Frontend: ${FRONTEND_URL}`);
  } else {
    log.info(`📺 Host: http://localhost:${PORT}/host`);
    log.info(`📱 Jogadores: http://${LOCAL_IP}:${PORT}`);
  }
  const { state } = require('./src/gameState');
  log.info(`🔑 PIN: ${state.game.pin}\n`);
});
