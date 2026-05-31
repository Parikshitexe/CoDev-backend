import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db.js';
import { YSocketIO } from 'y-socket.io/dist/server';
import { createServer} from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRouter from './routes/auth.js';
import executeRouter from './routes/execute.js';
import workspaceRouter from './routes/workspace.js';
import { setupYjsPersistence } from './yjsPersistence.js';

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
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
    const sockets = await socket.nsp.allSockets();
    if (sockets.size >= 5) {
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