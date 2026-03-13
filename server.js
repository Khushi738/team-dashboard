const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean)
}));
app.use(express.json());

// DB connection (runs on startup)
require('./config/db');

// API Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/team-stats', require('./routes/teamStats'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Team Dashboard API is running.' });
});

// Serve frontend (must be AFTER api routes)
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
