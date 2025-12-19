"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const logger_1 = require("hono/logger");
// Import Routes
const auth_1 = require("./lib/auth");
const habits_1 = __importDefault(require("./routes/habits"));
const logs_1 = __importDefault(require("./routes/logs"));
const exercises_1 = __importDefault(require("./routes/exercises"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const config_1 = __importDefault(require("./routes/config"));
const app = new hono_1.Hono();
// 1. Global Middleware
app.use('*', (0, logger_1.logger)());
app.use('*', (0, cors_1.cors)({
    origin: 'http://localhost:5173',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));
// 2. Auth Route (Better-Auth)
// Hono handles the raw request mapping easily
app.all('/api/auth/*', async (c) => {
    return auth_1.auth.handler(c.req.raw);
});
// 3. Application Routes
app.route('/api/habits', habits_1.default);
app.route('/api/logs', logs_1.default);
app.route('/api/exercises', exercises_1.default);
app.route('/api/config', config_1.default);
app.route("/api/exercise-sessions", sessions_1.default);
// 4. Health Check
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));
const port = 3000;
console.log(`Server is running on port ${port}`);
(0, node_server_1.serve)({
    fetch: app.fetch,
    port
});
//# sourceMappingURL=index.js.map