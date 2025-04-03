import { Redis } from '@upstash/redis';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { NatsConnection, StringCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { NewUser, User, users } from '../models/schema';

export class UserService {
  private sc = StringCodec();

  constructor(
    private readonly redis: Redis,
    private readonly nats: NatsConnection
  ) {}

  async createUser(userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>) {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = {
      ...userData,
      id: userId,
      password: hashedPassword,
    };

    const [user] = await db.insert(users).values(newUser).returning();

    // Publish user created event
    await this.nats.publish('user.created', this.sc.encode(JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
    })));

    // Cache user data
    await this.redis.set(`user:${user.id}`, JSON.stringify(user));

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(userId: string) {
    // Try to get from cache first
    const cachedUser = await this.redis.get<User>(`user:${userId}`);
    if (cachedUser) {
      const { password, ...userWithoutPassword } = cachedUser;
      return userWithoutPassword;
    }

    // If not in cache, get from database
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Cache the user data
    await this.redis.set(`user:${user.id}`, JSON.stringify(user));

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(userId: string, updateData: Partial<Omit<NewUser, 'id' | 'email'>>) {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    // Publish user updated event
    await this.nats.publish('user.updated', this.sc.encode(JSON.stringify({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    })));

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async deleteUser(userId: string) {
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    if (!deletedUser) {
      throw new Error('User not found');
    }

    // Invalidate cache
    await this.redis.del(`user:${userId}`);

    // Publish user deleted event
    await this.nats.publish('user.deleted', this.sc.encode(JSON.stringify({
      userId: deletedUser.id,
      email: deletedUser.email,
    })));

    return { message: 'User deleted successfully' };
  }

  async authenticateUser(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}