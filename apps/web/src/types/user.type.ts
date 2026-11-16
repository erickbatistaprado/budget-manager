import type { Role } from '@/types';

export interface User {
  id: string;
  name: string;
  salaryDay?: number | null;
  email: string;
  roles: Role[];
}
