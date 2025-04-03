import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';
import path from 'path';

// Define interfaces for your proto service methods
interface User {
  id: string;
  [key: string]: any; // Add other user properties as needed
}

interface UserService {
  getUser: grpc.handleUnaryCall<{ id: string }, User>;
  createUser: grpc.handleUnaryCall<User, User>;
  updateUser: grpc.handleUnaryCall<User, User>;
  deleteUser: grpc.handleUnaryCall<{ id: string }, { success: boolean }>;
}

if (!process.env.GRPC_PORT || !process.env.GRPC_HOST) {
  throw new Error('gRPC configuration is missing in environment variables');
}

const PROTO_PATH = path.resolve(__dirname, '../protos/user.proto');

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

// Load package definition with type
const userProto = grpc.loadPackageDefinition(packageDefinition).user as any;

// Create gRPC server
export const server = new grpc.Server();

// Server configuration
export const serverConfig = {
  address: `${process.env.GRPC_HOST}:${process.env.GRPC_PORT}`,
  credentials: grpc.ServerCredentials.createInsecure()
};

// Create gRPC client with typed service
export const client = new userProto.UserService(
  serverConfig.address,
  grpc.credentials.createInsecure()
) as grpc.ServiceClient;

// Helper function to start server
export const startServer = (serviceImplementation: UserService): Promise<grpc.Server> => {
  return new Promise((resolve, reject) => {
    server.addService(userProto.UserService.service, serviceImplementation);
    server.bindAsync(
      serverConfig.address,
      serverConfig.credentials,
      (error: Error | null, port: number) => {
        if (error) {
          reject(error);
          return;
        }
        server.start();
        console.log(`gRPC Server running at ${serverConfig.address}`);
        resolve(server);
      }
    );
  });
};

// Helper function to stop server
export const stopServer = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    server.tryShutdown((error?: Error) => {
      if (error) {
        console.error('Error shutting down gRPC server:', error);
        reject(error);
      } else {
        console.log('gRPC server shut down successfully');
        resolve(true);
      }
    });
  });
};

// Error handling middleware
export const errorHandler = <T>(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<T>
) => {
  return (error: Error | null) => {
    if (error) {
      console.error('gRPC service error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  };
};

// Client wrapper for promisified calls
export const clientWrapper = {
  getUser: (id: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      client.getUser({ id }, (error: grpc.ServiceError | null, response: User) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  },

  createUser: (userData: User): Promise<User> => {
    return new Promise((resolve, reject) => {
      client.createUser(userData, (error: grpc.ServiceError | null, response: User) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  },

  updateUser: (userData: User): Promise<User> => {
    return new Promise((resolve, reject) => {
      client.updateUser(userData, (error: grpc.ServiceError | null, response: User) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  },

  deleteUser: (id: string): Promise<{ success: boolean }> => {
    return new Promise((resolve, reject) => {
      client.deleteUser({ id }, (error: grpc.ServiceError | null, response: { success: boolean }) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }
};