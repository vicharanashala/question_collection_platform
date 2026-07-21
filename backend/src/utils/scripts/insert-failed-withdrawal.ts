/**
 * Temporary script to insert a FAILED withdrawal request for testing.
 * Run: npx ts-node src/scripts/insert-failed-withdrawal.ts
 */
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'question_platform',
  synchronize: false,
  logging: true,
});

async function main() {
  await ds.initialize();
  console.log('Connected to DB');

  // Get a user + wallet
  const user = await ds.query(`
    SELECT u.id as "userId", w.id as "walletId"
    FROM users u
    JOIN wallets w ON w.user_id = u.id
    LIMIT 1
  `);

  if (!user.length) {
    console.error('No user/wallet found. Make sure seed data exists.');
    await ds.destroy();
    process.exit(1);
  }

  const { userId, walletId } = user[0];
  console.log(`Using user=${userId} wallet=${walletId}`);

  const withdrawalId = uuidv4();
  const orderId = `TEST_WDR_${Date.now()}`;

  await ds.query(`
    INSERT INTO withdrawal_requests
      (id, user_id, wallet_id, amount, payout_method, payout_details,
       status, failure_reason, order_id, retry_count, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
  `, [
    withdrawalId,
    userId,
    walletId,
    1500,
    'upi',
    JSON.stringify({ upiId: 'test@upi' }),
    'failed',
    'INVALID_VPA: VPA validation failed — address format invalid',
    orderId,
    0,
  ]);

  const [row] = await ds.query('SELECT * FROM withdrawal_requests WHERE id = $1', [withdrawalId]);
  console.log('Inserted withdrawal_request:');
  console.table(row);

  await ds.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});