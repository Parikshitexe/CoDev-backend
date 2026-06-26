import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db.js';
import { YSocketIO } from 'y-socket.io/dist/server';
import { createServer} from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import executeRouter from './routes/execute.js';
import workspaceRouter from './routes/workspace.js';
import { setupYjsPersistence } from './yjsPersistence.js';

dotenv.config();
connectDB();

const app = express();
app.set('trust proxy', 1);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(globalLimiter);
app.use('/api/auth', authRouter);
app.use('/api/execute', executeRouter);
app.use('/api/workspaces', workspaceRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }}
);

const ySocketIO = new YSocketIO(io);
ySocketIO.initialize();

ySocketIO.nsp.use(async (socket, next) => {
  try {
    const roomId = socket.handshake.auth?.roomId;
    
    // If the frontend didn't pass a roomId, we just let it connect. 
    // It can't join a document anyway without knowing its name.
    if (!roomId) {
      return next();
    }

    // Check the number of users *currently in this specific room*
    const room = socket.nsp.adapter.rooms.get(roomId);
    
    if (room && room.size >= 5) {
      return next(new Error("ROOM_FULL"));
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

setupYjsPersistence(ySocketIO);

app.get('/', (req, res)=>{
    res.status(200).json({
        message: 'Welcome to the backend server',
        success: true
    })
})

app.get('/health', (req, res)=>{
    res.status(200).json({
        message: 'Server is healthy',
        success: true
    })
})


httpServer.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000} [${process.env.NODE_ENV || 'development'}]`);
})

// Global error handler — must be defined AFTER all routes.
// Catches any error passed via next(err) and prevents unhandled crashes.
app.use((err, req, res, next) => {
    console.error('[Global Error Handler]', err?.message || err);
    // Don't expose internal error details to the client in production
    const message = process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : (err?.message || 'Unknown error');
    res.status(err?.status || 500).json({ error: message });
});