import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

export const adminGuard: CanActivateFn = () => {
  const adminService = inject(AdminService);
  const router = inject(Router);

  if (adminService.isAdmin()) {
    return true;
  }

  return router.parseUrl('/');
};
