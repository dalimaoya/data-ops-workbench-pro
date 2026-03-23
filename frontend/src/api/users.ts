import { api } from './request';

export interface UserItem {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string | null;
}

export interface CreateUserRequest {
  username: string;
  display_name?: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  display_name?: string;
  role?: string;
}

// 用户管理 (管理员)
export const listUsers = () => api.get<UserItem[]>('/users');

export const createUser = (data: CreateUserRequest) =>
  api.post<UserItem>('/users', data);

export const updateUser = (id: number, data: UpdateUserRequest) =>
  api.put<UserItem>(`/users/${id}`, data);

export const updateUserStatus = (id: number, status: string) =>
  api.put(`/users/${id}/status`, { status });

export const resetUserPassword = (id: number, new_password: string) =>
  api.put(`/users/${id}/reset-password`, { new_password });

// 个人设置
export const changeMyPassword = (old_password: string, new_password: string) =>
  api.put('/me/password', { old_password, new_password });

export const updateMyProfile = (display_name: string) =>
  api.put('/me/profile', { display_name });
