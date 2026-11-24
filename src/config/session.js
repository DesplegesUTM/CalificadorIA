'use strict';

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'evaluadoria-secret-dev-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax',
  },
  name: 'evaluadoria.sid',
};

module.exports = { sessionConfig };
