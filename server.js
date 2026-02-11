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

const io = new Server(server, {
  cors: {
    origin: [`http://localhost:3000`, `http://${LOCAL_IP}:3000`],
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// Setup Modules
setupRoutes(app, upload, io, process.env.PORT || 3000);
setupSocket(io);

// --- Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log.info(`\n🎮 Quiz Server rodando!`);
  log.info(`📺 Host (Telão): http://localhost:${PORT}/host`);
  log.info(`📱 Jogadores (Celular): http://${LOCAL_IP}:${PORT}`);
  // Note: PIN is now generated inside gameState but logged inside socket connection usually.
  // We can log it here if we import state, but checking logs is enough.
  const { state } = require('./src/gameState');
  log.info(`🔑 PIN: ${state.game.pin}\n`);
});
