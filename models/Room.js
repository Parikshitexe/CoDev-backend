import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: {
    type: String,
    default: 'Collaborative Workspace'
  },
  documentState: { 
    type: Buffer, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model('Room', roomSchema);
