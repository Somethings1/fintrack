export interface User {
  id: string;
  username: string;
  name: string;
  password?: string; // Omit when fetching user info
  token?: string; // For auth
}

