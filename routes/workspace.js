import express from 'express';
import auth from '../middleware/auth.js';
import {
  bookmarkWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  checkBookmarkStatus,
  updateWorkspaceLanguage
} from '../controllers/workspaceController.js';

const router = express.Router();

router.post('/', auth, bookmarkWorkspace);
router.get('/', auth, listWorkspaces);
router.delete('/:roomId', auth, removeWorkspace);
router.put('/:roomId', auth, renameWorkspace);
router.get('/:roomId/status', auth, checkBookmarkStatus);
router.put('/:roomId/language', auth, updateWorkspaceLanguage);

export default router;
