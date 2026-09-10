import { authService } from './src/services/auth.service.ts';
import { db } from './src/config/db.ts';

async function run() {
  console.log('Testing Registration...');
  try {
    const res = await authService.register({ username: 'test_progression_1', email: 'test1@nexora.com', password: 'Password123!' });
    console.log('User registered:', res.user);
    
    // Check DB directly
    const progQuery = await db.query('SELECT * FROM player_progression WHERE user_id = ', [res.user.id]);
    console.log('Progression Row:', progQuery.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

run();
