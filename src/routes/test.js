import express from 'express';
const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ success: true, message: 'pong' });
});

export default router; 