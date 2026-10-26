// src/server.js
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const config = require('./config');
const router = require('./routes');
const { seedIfEmpty } = require('./models/file.model.js');

// ---------------------------------------------------------------------------
// SECURITY UPDATE (2026) - what changed in this file and why:
//
// 1. `body-parser` removed. Express has had `express.json()` built in since
//    4.16, and the old body-parser version had a denial-of-service bug
//    (CVE-2024-45590). We also cap request bodies at 10kb.
// 2. `helmet` added. It sets safe HTTP security headers (blocks clickjacking,
//    MIME sniffing, etc.). The Content-Security-Policy below allows only our
//    own files plus the jsDelivr CDN that hosts jQuery/Bootstrap/Popper.
// 3. Rate limiting on /api so one person (or bot) can't spam thousands of
//    fake reviews a minute. Spam belongs in a can, not in our reviews.
// 4. We wait for MongoDB to connect before listening, and log a clear error
//    if it can't - instead of a server that "runs" but every request hangs.
// 5. `x-powered-by` header is turned off so we don't advertise "Express"
//    to attackers.
// ---------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:'],
            // Inline onclick="" handlers were replaced with event listeners in
            // public/js/app.js, so we don't need 'unsafe-inline' anywhere.
            scriptSrcAttr: ["'none'"],
        },
    },
}));

const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));
app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,               // 100 API calls per IP per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use('/api', apiLimiter, router);

// Catch-all error handler: log details on the server, but only send a generic
// message to the browser so we never leak database internals.
// (Error handling: because sometimes the beat drops and so does the server.)
app.use(function (err, req, res, next) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function start() {
    try {
        await mongoose.connect(config.db.uri);
        console.log('Connected to MongoDB');
        await seedIfEmpty();
    } catch (err) {
        console.error('Could not connect to MongoDB. Is `mongod` running?', err.message);
        process.exit(1);
    }

    app.listen(config.port, function () {
        console.log(`${config.appName} is listening on port ${config.port}`);
        if (!config.adminToken) {
            console.log('Note: ADMIN_TOKEN is not set, so editing/deleting reviews is disabled.');
        }
    });
}

start();
