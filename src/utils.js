const os = require('os');

// --- Simple Logger ---
const log = {
    info: (...args) => console.log(`[INFO]`, ...args),
    warn: (...args) => console.warn(`[WARN]`, ...args),
    error: (...args) => console.error(`[ERROR]`, ...args),
    debug: (...args) => { if (process.env.DEBUG) console.log(`[DEBUG]`, ...args); }
};

// --- Network Utils ---
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// --- Score Logic ---
function calculateScore(timeLeft, maxTime, streak) {
    let base = 1000;
    const elapsed = maxTime - timeLeft;

    // Speed bonus
    if (elapsed <= 3) base += 500;
    else if (elapsed <= 7) base += 300;
    else if (elapsed <= 12) base += 100;

    // Streak multiplier
    if (streak >= 5) base = Math.round(base * 2.0);
    else if (streak >= 4) base = Math.round(base * 1.8);
    else if (streak >= 3) base = Math.round(base * 1.5);
    else if (streak >= 2) base = Math.round(base * 1.2);

    return base;
}

module.exports = { log, getLocalIp, calculateScore };
