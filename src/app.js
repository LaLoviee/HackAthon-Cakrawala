const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Static frontend
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get(['/health', '/api/health'], (req, res) =>
  res.json({
    ok: true,
    app: 'CakraBoard Backend API',
    status: 'running',
    version: '1.0.0'
  })
);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/courses', require('./routes/course.routes'));
app.use('/api/sessions', require('./routes/session.routes'));
app.use('/api/history', require('./routes/history.routes'));

// Fallback untuk SPA jika membuka langsung lewat browser
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
