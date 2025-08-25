import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { DatabaseOperations } from "./database-operations";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Please define the JWT_SECRET environment variable inside .env.local");
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: "admin" | "manager" | "user"
  department?: string
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  static async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static generateToken(user: AuthUser): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" })
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return null
    }
  }

  static async login(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
    const user = await DatabaseOperations.getUserByEmail(email)
    if (!user || !user.isActive) {
      return null
    }

    const isValidPassword = await this.comparePasswords(password, user.password)
    if (!isValidPassword) {
      return null
    }

    const authUser: AuthUser = {
      id: user._id!.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    }

    const token = this.generateToken(authUser)

    // Log successful login
    await DatabaseOperations.createAuditLog({
      userId: user._id!,
      action: "login",
      resourceType: "user",
      resourceId: user._id!,
      details: { ipAddress: "unknown" },
      success: true,
    })

    return { user: authUser, token }
  }

  static async register(userData: {
    email: string
    password: string
    name: string
    role?: "admin" | "manager" | "user"
    department?: string
  }): Promise<{ user: AuthUser; token: string } | null> {
    // Check if user already exists
    const existingUser = await DatabaseOperations.getUserByEmail(userData.email)
    if (existingUser) {
      return null
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password)

    // Create user
    const userId = await DatabaseOperations.createUser({
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      role: userData.role || "user",
      department: userData.department,
      isActive: true,
    })

    const authUser: AuthUser = {
      id: userId.toString(),
      email: userData.email,
      name: userData.name,
      role: userData.role || "user",
      department: userData.department,
    }

    const token = this.generateToken(authUser)

    // Log successful registration
    await DatabaseOperations.createAuditLog({
      userId: userId,
      action: "register",
      resourceType: "user",
      resourceId: userId,
      details: {},
      success: true,
    })

    return { user: authUser, token }
  }
}

export function verifyToken(token: string): any | null {
  return AuthService.verifyToken(token)
}
