import mongoose, { Mongoose } from 'mongoose'

let connection: Mongoose

export const connectDB = async () => {
  if (!connection) {
    connection = await mongoose.connect(process.env.MONGO_URI ?? '', {
      bufferCommands: true,
      serverSelectionTimeoutMS: 5000
    })
    console.log('Connected to mongodb')
  }
  return connection
}
