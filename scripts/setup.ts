import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDatabase, closeDatabase } from '../lib/mongodb';
import bcrypt from 'bcryptjs';
import type { Db } from 'mongodb';

async function setupDatabase() {
  let db: Db;
  try {
    db = await getDatabase();
    console.log('[v1] Setting up MongoDB collections and indexes...');

    const collections = ['users', 'files', 'file_versions', 'audit_logs', 'notifications', 'user_sessions'];
    for (const collectionName of collections) {
      const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
      if (!collectionExists) {
        await db.createCollection(collectionName);
        console.log(`[v1] Created collection: ${collectionName}`);
      }
    }

    console.log('[v1] Creating indexes...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('files').createIndex({ uploadedBy: 1 });
    await db.collection('files').createIndex({ createdAt: -1 });
    await db.collection('audit_logs').createIndex({ timestamp: -1 });

    console.log('[v1] Setting up default admin user...');
    await db.collection('users').deleteOne({ email: 'admin@filetracking.com' });

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await db.collection('users').insertOne({
      email: 'admin@filetracking.com',
      password: hashedPassword,
      name: 'System Administrator',
      role: 'admin',
      department: 'IT',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    });
    console.log('[v1] Created default admin user (admin@filetracking.com / admin123)');

    console.log('[v1] Database setup completed successfully!');
  } catch (error) {
    console.error('[v1] Database setup failed:', error);
    throw error;
  } finally {
    await closeDatabase();
    console.log('[v1] Database connection closed.');
  }
}

setupDatabase();
