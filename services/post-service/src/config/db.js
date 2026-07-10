import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const initDatabase = async () => {
    try {
        await prisma.$connect();
        console.log('🔌 Connected to PostgreSQL via Prisma for post-service...');
    } catch (error) {
        console.error('❌ Error connecting to database via Prisma:', error);
        process.exit(1);
    }
};

export default prisma;
