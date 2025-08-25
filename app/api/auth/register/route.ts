import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { AuthService } from '@/lib/auth';
import { User } from '@/lib/models/user';

export async function POST(request: Request) {
  try {
    const { name, email, password, department } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const db = await getDatabase();

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const hashedPassword = await AuthService.hashPassword(password);

    const newUser: Omit<User, '_id'> = {
      name,
      email,
      password: hashedPassword,
      role: 'user', // Default role
      department: department || 'General',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);
    const createdUser = { ...newUser, _id: result.insertedId };

    // Automatically log in the user by generating a token
    const token = AuthService.generateToken(createdUser);

    const response = NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: createdUser._id.toString(),
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        department: createdUser.department,
      }
    }, { status: 201 });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
