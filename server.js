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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use(cors({
  origin: 'http://localhost:5173',
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


httpServer.listen(3000, ()=>{
    console.log('Server is running on port 3000');
})