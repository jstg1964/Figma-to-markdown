'use strict';

const { Router } = require('express');
const figmaRoutes  = require('./figma.routes');
const healthRoutes = require('./health.routes');

const router = Router();

router.use('/', healthRoutes);
router.use('/api/figma', figmaRoutes);

module.exports = router;
