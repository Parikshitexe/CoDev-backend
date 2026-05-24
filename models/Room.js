import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  isPermanent: { 
    type: Boolean, 
    default: false 
  },
  isReadOnly: {
    type: Boolean,
    default: false
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

// TTL Index: Deletes document automatically after 24 hours (86400 seconds) 
// ONLY if the room is a temporary guest room (isPermanent: false)
roomSchema.index(
  { createdAt: 1 }, 
  { expireAfterSeconds: 86400, partialFilterExpression: { isPermanent: false } }
);

export default mongoose.model('Room', roomSchema);
