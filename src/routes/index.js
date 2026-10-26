// src/routes/index.js
const crypto = require('crypto');
const router = require('express').Router();
const mongoose = require('mongoose');
const config = require('../config');

// ===========================================================================
// SECURITY + BUG-FIX NOTES (2026)
// ===========================================================================
// 1. Mongoose 7+ removed callback-style queries, so every route was rewritten
//    with async/await. Express 5 forwards thrown errors to the error handler in
//    server.js automatically.
//
// 2. Edit (PUT) and delete (DELETE) now require an "X-Admin-Token" header that
//    matches the ADMIN_TOKEN environment variable. Before, anyone on the internet
//    could edit or delete every review. If ADMIN_TOKEN isn't set, those routes
//    are turned off completely. Tokens are compared in constant time so attackers
//    can't guess them by measuring response speed.
//
// 3. Error responses no longer send the raw database error to the browser
//    (`res.status(500).json(err)` leaked internals). Details go to the server
//    log; the visitor gets a friendly message.
//
// 4. Bad ids like /api/file/banana now get a 400 "invalid id" instead of a
//    500 crash from Mongoose's CastError.
//
// 5. Only plain strings are accepted for each field. Someone sending
//    {"title": {"$gt": ""}} (a NoSQL-injection trick) now gets a 400.
//
// 6. BUG FIX: GET /api/file/:fileId used a variable called FILES that didn't
//    exist anywhere, so it crashed with "ReferenceError: FILES is not defined"
//    every time. It now looks the review up in MongoDB.
//
// 7. BUG FIX: DELETE ignored save errors and could reply with `undefined`.
//
// 8. Deleted reviews can no longer be edited or fetched by id.
// ===========================================================================

const File = () => mongoose.model('File');
const FIELDS = ['title', 'location', 'who', 'description'];

// Pulls only the four allowed fields out of the request, and only if they're
// strings. Anything else (objects, arrays, numbers) is rejected.
function readReview(body) {
    const review = {};
    for (const field of FIELDS) {
        const value = body ? body[field] : undefined;
        if (value === undefined || value === null) {
            review[field] = '';
        } else if (typeof value === 'string') {
            review[field] = value;
        } else {
            return { error: `"${field}" must be text.` };
        }
    }
    if (!review.title.trim()) {
        return { error: 'Please give your event a name.' };
    }
    return { review };
}

// Constant-time comparison so the token can't be guessed one character at a time.
function tokensMatch(given, expected) {
    const a = Buffer.from(String(given || ''));
    const b = Buffer.from(String(expected || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Bouncer at the door: no token, no edits. (Strictly VIP - Very Important Posts.)
function requireAdmin(req, res, next) {
    if (!config.adminToken) {
        return res.status(403).json({ message: 'Editing and deleting reviews is turned off on this server.' });
    }
    if (!tokensMatch(req.get('X-Admin-Token'), config.adminToken)) {
        return res.status(401).json({ message: 'Admin token is missing or incorrect.' });
    }
    next();
}

function validId(req, res, next) {
    if (!mongoose.isValidObjectId(req.params.fileId)) {
        return res.status(400).json({ message: 'That is not a valid review id.' });
    }
    next();
}

router.get('/doc', function (req, res) {
    res.type('text').send('Documentation https://expressjs.com/');
});

router.get('/file', async function (req, res) {
    const files = await File().find({ deleted: { $ne: true } }).sort({ created_at: 1 }).lean();
    res.json(files);
});

router.post('/file', async function (req, res) {
    const { review, error } = readReview(req.body);
    if (error) return res.status(400).json({ message: error });

    try {
        const newFile = await File().create(review);
        res.status(201).json(newFile);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'One of the fields is too long. Please shorten it and try again.' });
        }
        throw err;
    }
});

router.get('/file/:fileId', validId, async function (req, res) {
    // same as 'const fileId = req.params.fileId'
    const { fileId } = req.params;
    const file = await File().findOne({ _id: fileId, deleted: { $ne: true } }).lean();
    if (!file) {
        return res.status(404).json({ message: 'File not found' });
    }
    res.json(file);
});

router.put('/file/:fileId', requireAdmin, validId, async function (req, res) {
    const { review, error } = readReview(req.body);
    if (error) return res.status(400).json({ message: error });

    const file = await File().findOne({ _id: req.params.fileId, deleted: { $ne: true } });
    if (!file) {
        return res.status(404).json({ message: 'File not found' });
    }

    Object.assign(file, review);
    try {
        const savedFile = await file.save();
        res.json(savedFile);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'One of the fields is too long. Please shorten it and try again.' });
        }
        throw err;
    }
});

// "Soft" delete: the review is hidden, not erased, so an accidental delete can
// be undone in the database. Reviews go to a farm upstate, not the void.
router.delete('/file/:fileId', requireAdmin, validId, async function (req, res) {
    const file = await File().findOne({ _id: req.params.fileId, deleted: { $ne: true } });
    if (!file) {
        return res.status(404).json({ message: 'File not found' });
    }

    file.deleted = true;
    const doomedFile = await file.save();
    res.json(doomedFile);
});

module.exports = router;
