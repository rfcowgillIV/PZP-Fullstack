// src/config/index.js
// This is where my application configuration stuff will go.
// This is the server code :D

// ---------------------------------------------------------------------------
// SECURITY UPDATE (2026): settings now come from environment variables first,
// with the old values as local-development defaults. That way a real server
// can point at a password-protected database without anyone editing (or
// accidentally committing) secrets into this file.
//
//   PORT          - port the web server listens on        (default 3030)
//   MONGODB_URI   - full MongoDB connection string         (default local "pzp" db)
//   ADMIN_TOKEN   - secret needed to EDIT or DELETE reviews (no default = editing off)
//
// Example:  ADMIN_TOKEN=pick-something-long MONGODB_URI=mongodb://localhost/pzp npm start
//
// Config-urations, now with 100% fewer hard-coded surprises.
// ---------------------------------------------------------------------------

module.exports = {
    appName: 'PZP Fullstack',
    port: Number(process.env.PORT) || 3030,
    db: {
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pzp',
    },
    // Left blank on purpose: if nobody sets ADMIN_TOKEN, edit/delete are locked
    // for everyone. Safe by default, like a DJ who never plays the Macarena twice.
    adminToken: process.env.ADMIN_TOKEN || '',
};
