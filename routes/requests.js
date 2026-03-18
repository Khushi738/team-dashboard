const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

router.post('/', async (req, res) => {
    const { emp_id, role } = req.user;
    if (role !== 'employee') return res.status(403).json({ error: 'Only employees can submit requests.' });
    const { field_name, old_value, new_value, area_ratings, note } = req.body;
    if (!field_name || !new_value) return res.status(400).json({ error: 'field_name and new_value are required.' });
    try {
        const result = await pool.query(
            `INSERT INTO update_requests (emp_id, field_name, old_value, new_value, area_ratings, note)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [emp_id, field_name, old_value || '', new_value, area_ratings ? JSON.stringify(area_ratings) : null, note || null]
        );
        res.status(201).json({ message: 'Request submitted.', request: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/mine', async (req, res) => {
    const { emp_id, role } = req.user;
    if (role !== 'employee') return res.status(403).json({ error: 'Employees only.' });
    try {
        const result = await pool.query(
            `SELECT r.*, e.emp_name as reviewed_by_name
             FROM update_requests r
             LEFT JOIN employees e ON e.emp_id = r.reviewed_by
             WHERE r.emp_id = $1
             ORDER BY r.requested_at DESC`, [emp_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/count', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    try {
        const result = await pool.query(`SELECT COUNT(*) FROM update_requests WHERE status = 'pending'`);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    try {
        const result = await pool.query(
            `SELECT r.*, e.emp_name, e.designation
             FROM update_requests r
             JOIN employees e ON e.emp_id = r.emp_id
             ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.requested_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.patch('/:id', async (req, res) => {
    const { role, emp_id: adminId } = req.user;
    if (role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
    const { id } = req.params;
    const { action, reject_reason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const reqResult = await client.query(`SELECT * FROM update_requests WHERE id = $1`, [id]);
        if (reqResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found.' }); }
        const updateReq = reqResult.rows[0];
        if (updateReq.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already reviewed.' }); }
        if (action === 'approve') {
            const field = updateReq.field_name;
            if (field === 'area_ratings' && updateReq.area_ratings) {
                const ratings = typeof updateReq.area_ratings === 'string' ? JSON.parse(updateReq.area_ratings) : updateReq.area_ratings;
                await client.query(`DELETE FROM employee_area_ratings WHERE emp_id = $1`, [updateReq.emp_id]);
                for (const r of ratings) {
                    await client.query(`INSERT INTO employee_area_ratings (emp_id, functional_area_id, rating) VALUES ($1, $2, $3)`, [updateReq.emp_id, r.functional_area_id, r.rating]);
                }
            } else {
                const allowed = ['designation', 'years_of_exp', 'projects_completed', 'graduation_deg'];
                if (allowed.includes(field)) {
                    await client.query(`UPDATE employees SET ${field} = $1, updated_at = NOW() WHERE emp_id = $2`, [updateReq.new_value, updateReq.emp_id]);
                }
            }
        }
        await client.query(`UPDATE update_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW(), reject_reason=$3 WHERE id=$4`,
            [action === 'approve' ? 'approved' : 'rejected', adminId, reject_reason || null, id]);
        await client.query('COMMIT');
        res.json({ message: `Request ${action}d successfully.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Server error.' });
    } finally {
        client.release();
    }
});

module.exports = router;
