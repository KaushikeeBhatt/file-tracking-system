import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getDatabase } from '@/lib/mongodb';
import { FileRecord } from '@/lib/models/file';
import { ObjectId } from 'mongodb';
import { unlink } from 'fs/promises';
import path from 'path';

// GET a single file
async function getFile(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = await getDatabase();
        if (!ObjectId.isValid(params.id)) {
            return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const file = await db.collection<FileRecord>('files').findOne({ _id: new ObjectId(params.id) });

        if (!file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json(file);
    } catch (error) {
        console.error('Failed to fetch file:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT (update) a file's details
async function updateFile(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = await getDatabase();
        const userFromToken = (request as any).user;

        if (!ObjectId.isValid(params.id)) {
            return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const { description, category, tags, status } = await request.json();

        if (status && !['admin', 'manager'].includes(userFromToken.role)) {
             return NextResponse.json({ error: 'Insufficient permissions to change file status' }, { status: 403 });
        }

        const updateData: any = { $set: {} };
        if (description !== undefined) updateData.$set.description = description;
        if (category) updateData.$set.category = category;
        if (tags) updateData.$set.tags = tags;
        if (status) updateData.$set.status = status;
        updateData.$set.updatedAt = new Date();
        
        const result = await db.collection('files').updateOne({ _id: new ObjectId(params.id) }, updateData);

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'File updated successfully' });
    } catch (error) {
        console.error('Failed to update file:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a file
async function deleteFile(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const db = await getDatabase();
        if (!ObjectId.isValid(params.id)) {
            return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const fileToDelete = await db.collection<FileRecord>('files').findOne({ _id: new ObjectId(params.id) });
        if (!fileToDelete) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const filePath = path.join(process.cwd(), 'public', fileToDelete.filePath);
        try {
            await unlink(filePath);
        } catch (fsError: any) {
            if (fsError.code !== 'ENOENT') {
                console.error('Failed to delete file from filesystem:', fsError);
            }
        }

        await db.collection('files').deleteOne({ _id: new ObjectId(params.id) });

        return NextResponse.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Failed to delete file:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const GET = withAuth(getFile);
export const PUT = withAuth(updateFile);
export const DELETE = withAuth(deleteFile, ['admin', 'manager']);
