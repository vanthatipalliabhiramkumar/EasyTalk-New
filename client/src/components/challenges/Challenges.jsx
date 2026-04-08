// Get user's challenge progress
app.get('/api/user-challenges', authMiddleware, async (req, res) => {
  try {
    const challenges = await allQuery(
      'SELECT * FROM user_challenges WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true, challenges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all challenges
app.get('/api/challenges', authMiddleware, async (req, res) => {
  try {
    const challenges = await allQuery('SELECT * FROM challenges ORDER BY target_value ASC');
    res.json({ success: true, challenges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start a challenge
app.post('/api/challenges/:challengeId/start', authMiddleware, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const existing = await getQuery(
      'SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ?',
      [req.user.id, challengeId]
    );
    
    if (!existing) {
      await runQuery(
        'INSERT INTO user_challenges (id, user_id, challenge_id, status, started_at) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.user.id, challengeId, 'in_progress', new Date().toISOString()]
      );
    }
    res.json({ success: true, message: 'Challenge started!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update challenge progress
app.post('/api/challenges/:challengeId/progress', authMiddleware, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { currentProgress } = req.body;
    
    const challenge = await getQuery('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    
    const isCompleted = currentProgress >= challenge.target_value;
    
    await runQuery(
      `UPDATE user_challenges SET current_progress = ?, status = ?, completed_at = ? 
       WHERE user_id = ? AND challenge_id = ?`,
      [currentProgress, isCompleted ? 'completed' : 'in_progress', 
       isCompleted ? new Date().toISOString() : null, req.user.id, challengeId]
    );
    
    if (isCompleted) {
      await runQuery(
        'UPDATE users SET points = points + ?, streak = streak + 1 WHERE id = ?',
        [challenge.points, req.user.id]
      );
    }
    
    res.json({ 
      success: true, 
      completed: isCompleted, 
      pointsEarned: isCompleted ? challenge.points : 0 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get challenge progress stats
app.get('/api/challenges/progress', authMiddleware, async (req, res) => {
  try {
    const completed = await allQuery(
      'SELECT * FROM user_challenges WHERE user_id = ? AND status = "completed"',
      [req.user.id]
    );
    
    const totalPoints = completed.reduce((sum, c) => sum + (c.score || 0), 0);
    const totalMinutes = completed.reduce((sum, c) => sum + (c.current_progress || 0), 0);
    
    // Calculate level
    let level = 'Beginner';
    if (totalPoints >= 5000) level = 'Master';
    else if (totalPoints >= 2000) level = 'Expert';
    else if (totalPoints >= 1000) level = 'Advanced';
    else if (totalPoints >= 500) level = 'Intermediate';
    else if (totalPoints >= 100) level = 'Bronze';
    
    res.json({
      success: true,
      stats: {
        totalCompleted: completed.length,
        totalPoints: totalPoints,
        currentStreak: req.user.streak || 0,
        totalMinutes: totalMinutes,
        level: level
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
