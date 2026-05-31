import mongoose from 'mongoose';

const userWorkspaceSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  roomId: { 
    type: String, 
    required: true 
  },
  savedAt: { 
    type: Date, 
    default: Date.now 
  }
});

userWorkspaceSchema.index({ userId: 1, roomId: 1 }, { unique: true });

export default mongoose.model('UserWorkspace', userWorkspaceSchema);
