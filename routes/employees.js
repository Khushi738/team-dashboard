const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

// All routes protected
router.use(verifyToken);

// GET /api/employees
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                e.emp_id,
                e.emp_name,
                e.designation,
                e.years_of_exp,
                e.graduation_deg,
                e.projects_completed,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'functional_area_id', ear.functional_area_id,
                            'area_name', fa.name,
                            'rating', ear.rating
                        )
                    ) FILTER (WHERE ear.functional_area_id IS NOT NULL),
                    '[]'
                ) AS areas
            FROM employees e
            LEFT JOIN employee_area_ratings ear ON e.emp_id = ear.emp_id
            LEFT JOIN functional_areas fa ON fa.id = ear.functional_area_id
            GROUP BY e.emp_id
            ORDER BY e.emp_id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /employees error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/employees/:emp_id
router.get('/:emp_id', async (req, res) => {
    const { emp_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                e.emp_id,
                e.emp_name,
                e.designation,
                e.years_of_exp,
                e.graduation_deg,
                e.projects_completed,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'functional_area_id', ear.functional_area_id,
                            'area_name', fa.name,
                            'rating', ear.rating
                        )
                    ) FILTER (WHERE ear.functional_area_id IS NOT NULL),
                    '[]'
                ) AS areas
            FROM employees e
            LEFT JOIN employee_area_ratings ear ON e.emp_id = ear.emp_id
            LEFT JOIN functional_areas fa ON fa.id = ear.functional_area_id
            WHERE e.emp_id = $1
            GROUP BY e.emp_id
        `, [emp_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('GET /employees/:emp_id error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/employees
router.post('/', async (req, res) => {
    const { emp_id, emp_name, designation, years_of_exp, graduation_deg, projects_completed, areas } = req.body;

    if (!emp_id || !emp_name || !designation || years_of_exp === undefined || !graduation_deg || projects_completed === undefined) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    if (!areas || !Array.isArray(areas) || areas.length === 0) {
        return res.status(400).json({ error: 'At least one functional area with a rating is required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            INSERT INTO employees (emp_id, emp_name, designation, years_of_exp, graduation_deg, projects_completed)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [emp_id, emp_name, designation, years_of_exp, graduation_deg, projects_completed]);

        for (const area of areas) {
            const { functional_area_id, rating } = area;
            if (!functional_area_id || rating === undefined) throw new Error('Each area must have functional_area_id and rating.');
            await client.query(`
                INSERT INTO employee_area_ratings (emp_id, functional_area_id, rating)
                VALUES ($1, $2, $3)
            `, [emp_id, functional_area_id, rating]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Employee created successfully.', emp_id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /employees error:', err.message);
        if (err.message.includes('duplicate key')) {
            return res.status(409).json({ error: 'Employee ID already exists.' });
        }
        res.status(500).json({ error: err.message || 'Server error.' });
    } finally {
        client.release();
    }
});

// PUT /api/employees/:emp_id
router.put('/:emp_id', async (req, res) => {
    const { emp_id } = req.params;
    const { emp_name, designation, years_of_exp, graduation_deg, projects_completed, areas } = req.body;

    if (!emp_name || !designation || years_of_exp === undefined || !graduation_deg || projects_completed === undefined) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query(`SELECT emp_id FROM employees WHERE emp_id = $1`, [emp_id]);
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Employee not found.' });
        }

        await client.query(`
            UPDATE employees
            SET emp_name=$1, designation=$2, years_of_exp=$3, graduation_deg=$4, projects_completed=$5, updated_at=NOW()
            WHERE emp_id=$6
        `, [emp_name, designation, years_of_exp, graduation_deg, projects_completed, emp_id]);

        if (areas && Array.isArray(areas) && areas.length > 0) {
            await client.query(`DELETE FROM employee_area_ratings WHERE emp_id=$1`, [emp_id]);
            for (const area of areas) {
                const { functional_area_id, rating } = area;
                if (!functional_area_id || rating === undefined) throw new Error('Each area must have functional_area_id and rating.');
                await client.query(`
                    INSERT INTO employee_area_ratings (emp_id, functional_area_id, rating)
                    VALUES ($1, $2, $3)
                `, [emp_id, functional_area_id, rating]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Employee updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('PUT /employees/:emp_id error:', err.message);
        res.status(500).json({ error: err.message || 'Server error.' });
    } finally {
        client.release();
    }
});

// DELETE /api/employees/:emp_id
router.delete('/:emp_id', async (req, res) => {
    const { emp_id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM employees WHERE emp_id=$1 RETURNING emp_id`, [emp_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found.' });
        }
        res.json({ message: 'Employee deleted successfully.', emp_id });
    } catch (err) {
        console.error('DELETE /employees/:emp_id error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
