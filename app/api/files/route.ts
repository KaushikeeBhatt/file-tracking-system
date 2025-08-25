import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/auth';
import { getDatabase } from '@/lib/mongodb';
import { FileRecord } from '@/lib/models/file';

async function handler(request: NextRequest) {
    try {
        const db = await getDatabase();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (searchParams.get('department')) filter.department = searchParams.get('department');
        if (searchParams.get('category')) filter.category = searchParams.get('category');
        if (searchParams.get('status')) filter.status = searchParams.get('status');
        if (searchParams.get('q')) {
            filter.originalName = { $regex: searchParams.get('q'), $options: 'i' };
        }

        const files = await db.collection<FileRecord>('files')
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const totalFiles = await db.collection('files').countDocuments(filter);

        return NextResponse.json({
            files,
            totalPages: Math.ceil(totalFiles / limit),
            currentPage: page,
            totalFiles
        });

    } catch (error) {
        console.error('Failed to fetch files:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export const GET = withAuth(handler);
