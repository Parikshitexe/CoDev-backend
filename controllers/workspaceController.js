import Room from '../models/Room.js';
import UserWorkspace from '../models/UserWorkspace.js';

export const bookmarkWorkspace = async (req, res) => {
  try {
    const { roomId, name } = req.body ?? {};
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    if (name) {
      const links = await UserWorkspace.find({ userId: req.user?.id });
      const roomIds = links?.map(l => l?.roomId) ?? [];
      const existingRoom = await Room.findOne({ 
        roomId: { $in: roomIds }, 
        name: { $regex: `^${name?.trim()}$`, $options: 'i' } 
      });
      if (existingRoom && existingRoom.roomId !== roomId) {
        return res.status(400).json({ error: 'A workspace with this name already exists' });
      }
    }

    await Room.findOneAndUpdate(
      { roomId },
      { $setOnInsert: { name: name || 'Collaborative Workspace' } },
      { upsert: true }
    );

    await UserWorkspace.findOneAndUpdate(
      { userId: req.user?.id, roomId },
      { savedAt: new Date() },
      { upsert: true }
    );

    res.status(200).json({ message: 'Workspace bookmarked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bookmark workspace' });
  }
};

export const listWorkspaces = async (req, res) => {
  try {
    const links = await UserWorkspace.find({ userId: req.user?.id }).sort({ savedAt: -1 });
    const roomIds = links?.map(link => link?.roomId) ?? [];

    const rooms = await Room.find({ roomId: { $in: roomIds } });

    const roomsMap = new Map(rooms?.map(room => [room?.roomId, room]) ?? []);

    const workspaceList = links?.map(link => {
      const room = roomsMap.get(link?.roomId);
      return {
        roomId: link?.roomId,
        name: room?.name ?? 'Collaborative Workspace',
        language: room?.language ?? 'javascript',
        savedAt: link?.savedAt,
        createdAt: room?.createdAt ?? link?.savedAt
      };
    }) ?? [];

    res.status(200).json(workspaceList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load workspaces' });
  }
};

export const removeWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params ?? {};
    await UserWorkspace.findOneAndDelete({ userId: req.user?.id, roomId });
    res.status(200).json({ message: 'Workspace removed from dashboard' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove workspace' });
  }
};

export const renameWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params ?? {};
    const { name } = req.body ?? {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim();
    
    const links = await UserWorkspace.find({ userId: req.user?.id });
    const roomIds = links?.map(l => l?.roomId) ?? [];
    const existingRoom = await Room.findOne({ 
      roomId: { $in: roomIds }, 
      name: { $regex: `^${trimmedName}$`, $options: 'i' } 
    });
    
    if (existingRoom && existingRoom.roomId !== roomId) {
      return res.status(400).json({ error: 'A workspace with this name already exists' });
    }

    await Room.findOneAndUpdate(
      { roomId },
      { name: trimmedName }
    );

    res.status(200).json({ message: 'Workspace renamed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename workspace' });
  }
};

export const checkBookmarkStatus = async (req, res) => {
  try {
    const { roomId } = req.params ?? {};
    const bookmark = await UserWorkspace.findOne({ userId: req.user?.id, roomId });
    res.status(200).json({ bookmarked: !!bookmark });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check bookmark status' });
  }
};

export const updateWorkspaceLanguage = async (req, res) => {
  try {
    const { roomId } = req.params ?? {};
    const { language } = req.body ?? {};

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    const room = await Room.findOneAndUpdate(
      { roomId },
      { language },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Language updated successfully', room });
  } catch (err) {
    console.error('Error updating language:', err);
    res.status(500).json({ error: 'Failed to update language' });
  }
};
