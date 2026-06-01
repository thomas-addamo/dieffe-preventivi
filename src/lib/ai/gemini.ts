import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../env';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
export const geminiFlash = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
