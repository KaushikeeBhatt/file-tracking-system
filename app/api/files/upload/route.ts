import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getDatabase } from '@/lib/mongodb';
import { FileRecord } from '@/lib/models/file';
import { User } from '@/lib/models/user';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

async function handler(request: NextRequest) {
    try {
        const userHeader = request.headers.get("x-user");
        if (!userHeader) {
            return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }
        const userFromToken = JSON.parse(userHeader);

        const db = await getDatabase();

        // Fetch full user details to get department
        const currentUser = await db.collection<User>('users').findOne({ _id: new ObjectId(userFromToken.id) });
        if (!currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const description = formData.get('description') as string | null;
        const category = formData.get('category') as string | null;
        const tags = formData.get('tags') as string | null; // comma-separated

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = uniqueSuffix + '-' + file.name.replace(/\s+/g, '_');
        const filePath = path.join(uploadDir, fileName);

        await writeFile(filePath, buffer);

        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

        const newFileRecord: Omit<FileRecord, '_id'> = {
            fileName: fileName,
            originalName: file.name,
            fileType: file.type,
            fileSize: file.size,
            filePath: `/uploads/${fileName}`,
            uploadedBy: new ObjectId(userFromToken.id),
            department: currentUser.department || 'Unassigned',
            category: category || 'general',
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            description: description || '',
            status: 'pending_approval',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                version: 1,
                checksum: checksum,
                accessCount: 0,
            },
        };

        const result = await db.collection('files').insertOne(newFileRecord);

        return NextResponse.json({ message: 'File uploaded successfully', fileId: result.insertedId }, { status: 201 });

    } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const POST = withAuth(handler);
