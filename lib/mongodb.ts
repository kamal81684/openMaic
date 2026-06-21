import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URL;

if (!mongoUri) {
  throw new Error("Missing MONGODB_URL");
}

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export const mongoClientPromise =
  globalForMongo.mongoClientPromise ?? new MongoClient(mongoUri).connect();

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClientPromise = mongoClientPromise;
}
