const express = require('express');
const router = express.Router();
const db = require('../config/pgdb'); // Import our PostgreSQL connection pool

// GET / - Display the delivery personnel management page
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM delivery_personnel ORDER BY created_at DESC');
        res.render('admin/delivery', { personnel: rows });
    } catch (err) {
        next(err);
    }
});

// POST / - Add a new delivery person
router.post('/', async (req, res, next) => {
    try {
        const { name, phone_number, vehicle_details } = req.body;
        const query = 'INSERT INTO delivery_personnel (name, phone_number, vehicle_details) VALUES ($1, $2, $3)';
        await db.query(query, [name, phone_number, vehicle_details]);
        res.redirect('/admin/delivery');
    } catch (err) {
        next(err);
    }
});

// POST /:id/verify - Toggle verification status
router.post('/:id/verify', async (req, res, next) => {
    try {
        // We need to get the current status first, then flip it
        const current = await db.query('SELECT is_verified FROM delivery_personnel WHERE id = $1', [req.params.id]);
        if (current.rows.length > 0) {
            const newStatus = !current.rows[0].is_verified;
            await db.query('UPDATE delivery_personnel SET is_verified = $1 WHERE id = $2', [newStatus, req.params.id]);
        }
        res.redirect('/admin/delivery');
    } catch (err) {
        next(err);
    }
});

// POST /:id/delete - Delete a delivery person
router.post('/:id/delete', async (req, res, next) => {
    try {
        await db.query('DELETE FROM delivery_personnel WHERE id = $1', [req.params.id]);
        res.redirect('/admin/delivery');
    } catch (err) {
        next(err);
    }
});

module.exports = router;