"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = exports.db = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const drizzle_orm_1 = require("drizzle-orm");
const postgres_1 = __importDefault(require("postgres"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
    throw new Error('🔴 DIRECT_URL environment variable is not set.');
}
// SSL configuration for Supabase
const client = (0, postgres_1.default)(connectionString, {
    ssl: 'require',
});
exports.db = (0, postgres_js_1.drizzle)(client);
const connectToDatabase = async () => {
    try {
        // Drizzle doesn't have a direct 'connect' method like some other ORMs.
        // Running a simple query is the recommended way to verify the connection.
        await exports.db.execute((0, drizzle_orm_1.sql) `SELECT 1`);
        console.log('🔌 Database connection established');
    }
    catch (error) {
        console.error('🔴 Could not connect to the database:', error);
        process.exit(1);
    }
};
exports.connectToDatabase = connectToDatabase;
