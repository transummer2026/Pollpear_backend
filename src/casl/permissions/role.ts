import { UserRole } from 'src/generated/prisma/client';

export class AuthorizationUser {
  constructor(
    public readonly id: number,
    public readonly userRole: UserRole,
  ) {}

  isAdmin(): boolean {
    return this.userRole === UserRole.admin;
  }

  isModerator(): boolean {
    return (
      this.userRole === UserRole.moderator || this.userRole === UserRole.admin
    );
  }
}
