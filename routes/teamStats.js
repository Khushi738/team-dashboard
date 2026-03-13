const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// GET /api/team-stats  (public)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT projects_completed FROM team_stats WHERE id = 1`);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /team-stats error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PATCH /api/team-stats/projects-completed  (admin only)
router.patch('/projects-completed', verifyToken, async (req, res) => {
    const { action } = req.body;

    if (!action || !['increment', 'decrement'].includes(action)) {
        return res.status(400).json({ error: 'Action must be increment or decrement.' });
    }

    try {
        const result = await pool.query(
            `UPDATE team_stats
             SET projects_completed = GREATEST(0, projects_completed + $1)
             WHERE id = 1
             RETURNING projects_completed`,
            [action === 'increment' ? 1 : -1]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH /team-stats error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
