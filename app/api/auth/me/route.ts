import { type NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { AuthService, type AuthUser } from '@/lib/auth';
import { type User } from '@/lib/models/user';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication token not provided' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);

    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const db = await getDatabase();
    const user = await db.collection<User>('users').findOne({ _id: new ObjectId(decoded.id) });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
    }

    const authUser: AuthUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };

    return NextResponse.json(authUser);

  } catch (error) {
    console.error('Failed to get user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
