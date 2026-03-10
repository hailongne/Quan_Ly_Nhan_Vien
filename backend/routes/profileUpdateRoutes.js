// Profile update routes removed per request. Export an empty router that returns 410 for safety.
const express = require('express');
const router = express.Router();

router.use((req, res) => res.status(410).json({ message: 'This endpoint has been removed' }));

module.exports = router;
