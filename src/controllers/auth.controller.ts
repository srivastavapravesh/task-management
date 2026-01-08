import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name
        }
      });

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          todoistConnected: !!user.todoistToken
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async connectTodoist(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { todoistToken } = req.body;

      if (!todoistToken) {
        res.status(400).json({ error: 'Todoist token required' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { todoistToken }
      });

      res.json({
        message: 'Todoist connected successfully',
        user: {
          id: user.id,
          email: user.email,
          todoistConnected: true
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          todoistToken: true,
          createdAt: true
        }
      });

      res.json({
        user: {
          ...user,
          todoistConnected: !!user?.todoistToken,
          todoistToken: undefined
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}