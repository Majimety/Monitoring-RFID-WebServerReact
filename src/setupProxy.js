const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy /api requests to Flask backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );

  // Proxy socket.io (WebSocket) to Flask backend
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      ws: true,
    })
  );
};