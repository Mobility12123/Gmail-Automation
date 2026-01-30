"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const logger_1 = require("./utils/logger");
const jobs_1 = require("./jobs");
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
async function startWorker() {
    try {
        await exports.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
        await (0, jobs_1.initializeJobs)();
        logger_1.logger.info('Worker started successfully');
        // Keep worker alive
        process.on('SIGTERM', async () => {
            logger_1.logger.info('SIGTERM received, shutting down worker');
            await exports.prisma.$disconnect();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            logger_1.logger.info('SIGINT received, shutting down worker');
            await exports.prisma.$disconnect();
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start worker:', error);
        process.exit(1);
    }
}
startWorker();
//# sourceMappingURL=worker.js.map