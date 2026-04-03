const express = require('express');
const router = express.Router();
const {
  getChallenges,
  getDailyChallenge,
  startChallenge,
  submitChallenge,
  getChallengeProgress
} = require('../controllers/challengeController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getChallenges);
router.get('/daily', protect, getDailyChallenge);
router.get('/progress', protect, getChallengeProgress);
router.post('/:challengeId/start', protect, startChallenge);
router.post('/:challengeId/submit', protect, submitChallenge);

module.exports = router;