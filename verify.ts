import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database.sqlite');
console.log('USERS:', db.prepare('SELECT id, name, email, canteen_id FROM users').all());
console.log('CANTEENS:', db.prepare('SELECT id, name FROM canteens').all());
