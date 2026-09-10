export type UserRole = 'admin' | 'reporter';
export type UserStatus = 'active' | 'inactive';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login?: string;
}

export interface AuthSession {
  user: SystemUser;
  token: string;
  expires_at: number;
}
