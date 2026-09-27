/**
 * Authentication Types & Interfaces
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  phone?: string;
  role?: string;
  provider?: string;
  emailVerified?: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  expiresAt: number;
  user: AuthUser;
}

export interface SignUpCredentials {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface SignInCredentials {
  email: string;
  password?: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  token?: string;
  error?: string;
}

export type OAuthProvider = 'google' | 'apple' | 'microsoft' | 'github';

export interface SignInWithOAuthOptions {
  provider: OAuthProvider;
  redirectTo?: string;
  popup?: boolean;
}

export interface PasswordResetRequestOptions {
  email: string;
}

export interface PasswordResetConfirmOptions {
  email: string;
  token?: string;
  code?: string;
  newPassword: string;
}

export interface VerifyEmailOptions {
  email: string;
  token?: string;
  code?: string;
}

export interface MagicLinkOptions {
  email: string;
  redirectTo?: string;
  appName?: string;
}

export interface AuthActionResponse {
  success: boolean;
  message: string;
  token?: string;
  magicLink?: string;
  devMode?: boolean;
  error?: string;
}

export type NietemoUser = AuthUser;
