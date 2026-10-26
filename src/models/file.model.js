// Load mongoose package
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// SECURITY UPDATE (2026): every field now has a type, is trimmed, and has a
// max length. Before, anyone could POST a multi-megabyte "review" and fill up
// the database. Now reviews have to keep it short and sweet - like a good
// wedding toast.
// ---------------------------------------------------------------------------
const FileSchema = new mongoose.Schema({
    title: { type: String, trim: true, maxlength: 120, required: true },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    who: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    created_at: { type: Date, default: Date.now },
    deleted: { type: Boolean, default: false }
});

const File = mongoose.model('File', FileSchema);

// ---------------------------------------------------------------------------
// BUG FIX (2026): the seeding used to run automatically the moment this file
// was loaded, used `File.count()` (removed in newer Mongoose) and callbacks
// (also removed in Mongoose 7+), and `throw`-ing inside a callback would crash
// the whole server. It's now an async function that server.js calls AFTER the
// database connects, and errors are logged instead of taking the party down.
// ---------------------------------------------------------------------------
async function seedIfEmpty() {
    const count = await File.countDocuments({});
    if (count > 0) return;

    const files = require('./file.seed.json');
    await File.create(files);
    console.log('DB seeded - let the reviews roll!');
}

module.exports = File;
module.exports.seedIfEmpty = seedIfEmpty;
