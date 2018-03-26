//This is where the server is gonna be at... and its gonna be lit :D
//src/server.js
const path = require('path');
const express = require('express');
const config = require('./config');

//this creates the application
const app = express();

//This tells app where to look. Specifically in the public folder for the index.html doc
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

//this tells the application what to do
app.use(function(req, res, next) {
    res.end("Hello World!");
});

//this starts the server
app.listen(config.port, function() {
    console.log(`${config.appName} is listening on port ${config.port}`);
});