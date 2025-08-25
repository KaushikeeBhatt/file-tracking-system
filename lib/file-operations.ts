import { DatabaseOperations } from "./database-operations"
import { ObjectId } from "mongodb"
import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

export interface UploadedFile {
  fileName: string
  originalName: string
  fileType: string
  fileSize: number
  filePath: string
  buffer: Buffer
}

export class FileOperations {
  private static uploadDir = path.join(process.cwd(), "uploads")

  static async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir)
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true })
    }
  }

  static generateFileName(originalName: string): string {
    const ext = path.extname(originalName)
    const name = path.basename(originalName, ext)
    const timestamp = Date.now()
    const random = crypto.randomBytes(8).toString("hex")
    return `${name}_${timestamp}_${random}${ext}`
  }

  static async saveFile(file: UploadedFile): Promise<string> {
    await this.ensureUploadDir()
    const fileName = this.generateFileName(file.originalName)
    const filePath = path.join(this.uploadDir, fileName)

    await fs.writeFile(filePath, file.buffer)
    return fileName
  }

  static async uploadFile(
    file: UploadedFile,
    uploadedBy: string,
    metadata: {
      department: string
      category: string
      tags: string[]
      description?: string
    },
  ): Promise<ObjectId> {
    // Save file to disk
    const fileName = await this.saveFile(file)
    const filePath = path.join("uploads", fileName)

    // Generate checksum
    const checksum = crypto.createHash("md5").update(file.buffer).digest("hex")

    // Create file record in database
    const fileId = await DatabaseOperations.createFileRecord({
      fileName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      filePath,
      uploadedBy: new ObjectId(uploadedBy),
      department: metadata.department,
      category: metadata.category,
      tags: metadata.tags,
      description: metadata.description,
      status: "pending_approval",
      metadata: {
        version: 1,
        checksum,
        accessCount: 0,
      },
    })

    // Create audit log
    await DatabaseOperations.createAuditLog({
      userId: new ObjectId(uploadedBy),
      action: "upload",
      resourceType: "file",
      resourceId: fileId,
      details: {
        fileName: file.originalName,
        fileSize: file.fileSize,
        fileType: file.fileType,
      },
      success: true,
    })

    return fileId
  }

  static async getFileBuffer(fileName: string): Promise<Buffer> {
    const filePath = path.join(this.uploadDir, fileName)
    return await fs.readFile(filePath)
  }

  static async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const db = await DatabaseOperations["getDb"]()
      const file = await db.collection("files").findOne({ _id: new ObjectId(fileId) })

      if (!file) return false

      // Delete physical file
      const filePath = path.join(process.cwd(), file.filePath)
      try {
        await fs.unlink(filePath)
      } catch (error) {
        console.error("Failed to delete physical file:", error)
      }

      // Update database record
      await db.collection("files").updateOne(
        { _id: new ObjectId(fileId) },
        {
          $set: {
            status: "archived",
            updatedAt: new Date(),
          },
        },
      )

      // Create audit log
      await DatabaseOperations.createAuditLog({
        userId: new ObjectId(userId),
        action: "delete",
        resourceType: "file",
        resourceId: new ObjectId(fileId),
        details: { fileName: file.originalName },
        success: true,
      })

      return true
    } catch (error) {
      console.error("Delete file error:", error)
      return false
    }
  }

  static async approveFile(fileId: string, approvedBy: string): Promise<boolean> {
    try {
      const db = await DatabaseOperations["getDb"]()

      await db.collection("files").updateOne(
        { _id: new ObjectId(fileId) },
        {
          $set: {
            status: "active",
            approvedBy: new ObjectId(approvedBy),
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      )

      // Create audit log
      await DatabaseOperations.createAuditLog({
        userId: new ObjectId(approvedBy),
        action: "approve",
        resourceType: "file",
        resourceId: new ObjectId(fileId),
        details: {},
        success: true,
      })

      return true
    } catch (error) {
      console.error("Approve file error:", error)
      return false
    }
  }
}
