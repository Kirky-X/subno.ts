// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Permission,
  PermissionGroups,
  PermissionHierarchy,
  permissionImplies,
  hasPermission,
  hasAllPermissions,
  isAdmin,
  isValidPermission,
  validatePermissions,
} from '../src/lib/types/permissions';

describe('Permission Constants', () => {
  describe('Permission enum', () => {
    it('should define all required permissions', () => {
      expect(Permission.READ).toBe('read');
      expect(Permission.WRITE).toBe('write');
      expect(Permission.KEY_REVOKE).toBe('key_revoke');
      expect(Permission.ADMIN).toBe('admin');
    });

    it('should have exactly 4 permissions', () => {
      const permissions = Object.values(Permission);
      expect(permissions).toHaveLength(4);
    });
  });

  describe('PermissionGroups', () => {
    it('should define READ_ONLY group', () => {
      expect(PermissionGroups.READ_ONLY).toEqual([Permission.READ]);
    });

    it('should define STANDARD group', () => {
      expect(PermissionGroups.STANDARD).toEqual([Permission.READ, Permission.WRITE]);
    });

    it('should define KEY_MANAGER group', () => {
      expect(PermissionGroups.KEY_MANAGER).toEqual([
        Permission.READ,
        Permission.WRITE,
        Permission.KEY_REVOKE,
      ]);
    });

    it('should define ADMIN group with all permissions', () => {
      expect(PermissionGroups.ADMIN).toEqual([
        Permission.READ,
        Permission.WRITE,
        Permission.KEY_REVOKE,
        Permission.ADMIN,
      ]);
    });
  });

  describe('PermissionHierarchy', () => {
    it('should define admin hierarchy correctly', () => {
      expect(PermissionHierarchy[Permission.ADMIN]).toContain(Permission.READ);
      expect(PermissionHierarchy[Permission.ADMIN]).toContain(Permission.WRITE);
      expect(PermissionHierarchy[Permission.ADMIN]).toContain(Permission.KEY_REVOKE);
      expect(PermissionHierarchy[Permission.ADMIN]).toContain(Permission.ADMIN);
    });

    it('should define key_revoke hierarchy correctly', () => {
      expect(PermissionHierarchy[Permission.KEY_REVOKE]).toContain(Permission.READ);
      expect(PermissionHierarchy[Permission.KEY_REVOKE]).toContain(Permission.KEY_REVOKE);
      expect(PermissionHierarchy[Permission.KEY_REVOKE]).not.toContain(Permission.WRITE);
    });

    it('should define write hierarchy correctly', () => {
      expect(PermissionHierarchy[Permission.WRITE]).toContain(Permission.READ);
      expect(PermissionHierarchy[Permission.WRITE]).toContain(Permission.WRITE);
      expect(PermissionHierarchy[Permission.WRITE]).not.toContain(Permission.KEY_REVOKE);
    });

    it('should define read hierarchy correctly', () => {
      expect(PermissionHierarchy[Permission.READ]).toEqual([Permission.READ]);
    });
  });
});

describe('Permission Functions', () => {
  describe('permissionImplies', () => {
    it('should return true when admin implies any permission', () => {
      expect(permissionImplies(Permission.ADMIN, Permission.READ)).toBe(true);
      expect(permissionImplies(Permission.ADMIN, Permission.WRITE)).toBe(true);
      expect(permissionImplies(Permission.ADMIN, Permission.KEY_REVOKE)).toBe(true);
      expect(permissionImplies(Permission.ADMIN, Permission.ADMIN)).toBe(true);
    });

    it('should return true when key_revoke implies read', () => {
      expect(permissionImplies(Permission.KEY_REVOKE, Permission.READ)).toBe(true);
      expect(permissionImplies(Permission.KEY_REVOKE, Permission.KEY_REVOKE)).toBe(true);
    });

    it('should return false when key_revoke does not imply write', () => {
      expect(permissionImplies(Permission.KEY_REVOKE, Permission.WRITE)).toBe(false);
    });

    it('should return true when write implies read', () => {
      expect(permissionImplies(Permission.WRITE, Permission.READ)).toBe(true);
      expect(permissionImplies(Permission.WRITE, Permission.WRITE)).toBe(true);
    });

    it('should return true when read implies read', () => {
      expect(permissionImplies(Permission.READ, Permission.READ)).toBe(true);
    });

    it('should return false when read does not imply other permissions', () => {
      expect(permissionImplies(Permission.READ, Permission.WRITE)).toBe(false);
      expect(permissionImplies(Permission.READ, Permission.KEY_REVOKE)).toBe(false);
      expect(permissionImplies(Permission.READ, Permission.ADMIN)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has admin permission', () => {
      const userPermissions = [Permission.ADMIN];
      expect(hasPermission(userPermissions, Permission.READ)).toBe(true);
      expect(hasPermission(userPermissions, Permission.WRITE)).toBe(true);
      expect(hasPermission(userPermissions, Permission.KEY_REVOKE)).toBe(true);
      expect(hasPermission(userPermissions, Permission.ADMIN)).toBe(true);
    });

    it('should return true when user has exact required permission', () => {
      const userPermissions = [Permission.READ, Permission.WRITE];
      expect(hasPermission(userPermissions, Permission.READ)).toBe(true);
      expect(hasPermission(userPermissions, Permission.WRITE)).toBe(true);
    });

    it('should return false when user lacks required permission', () => {
      const userPermissions = [Permission.READ];
      expect(hasPermission(userPermissions, Permission.WRITE)).toBe(false);
      expect(hasPermission(userPermissions, Permission.KEY_REVOKE)).toBe(false);
      expect(hasPermission(userPermissions, Permission.ADMIN)).toBe(false);
    });

    it('should return false for empty permissions', () => {
      const userPermissions: Permission[] = [];
      expect(hasPermission(userPermissions, Permission.READ)).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', () => {
      const userPermissions = [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE];
      const requiredPermissions = [Permission.READ, Permission.WRITE];
      expect(hasAllPermissions(userPermissions, requiredPermissions)).toBe(true);
    });

    it('should return true when admin has all permissions', () => {
      const userPermissions = [Permission.ADMIN];
      const requiredPermissions = [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE];
      expect(hasAllPermissions(userPermissions, requiredPermissions)).toBe(true);
    });

    it('should return false when user lacks one permission', () => {
      const userPermissions = [Permission.READ, Permission.WRITE];
      const requiredPermissions = [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE];
      expect(hasAllPermissions(userPermissions, requiredPermissions)).toBe(false);
    });

    it('should return true for empty required permissions', () => {
      const userPermissions = [Permission.READ];
      const requiredPermissions: Permission[] = [];
      expect(hasAllPermissions(userPermissions, requiredPermissions)).toBe(true);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin permission', () => {
      expect(isAdmin([Permission.ADMIN])).toBe(true);
      expect(isAdmin([Permission.READ, Permission.ADMIN])).toBe(true);
    });

    it('should return false for non-admin permissions', () => {
      expect(isAdmin([Permission.READ])).toBe(false);
      expect(isAdmin([Permission.READ, Permission.WRITE])).toBe(false);
      expect(isAdmin([Permission.KEY_REVOKE])).toBe(false);
    });

    it('should return false for empty permissions', () => {
      expect(isAdmin([])).toBe(false);
    });
  });

  describe('isValidPermission', () => {
    it('should return true for valid permissions', () => {
      expect(isValidPermission('read')).toBe(true);
      expect(isValidPermission('write')).toBe(true);
      expect(isValidPermission('key_revoke')).toBe(true);
      expect(isValidPermission('admin')).toBe(true);
    });

    it('should return false for invalid permissions', () => {
      expect(isValidPermission('invalid')).toBe(false);
      expect(isValidPermission('READ')).toBe(false);
      expect(isValidPermission('')).toBe(false);
      expect(isValidPermission('delete')).toBe(false);
    });
  });

  describe('validatePermissions', () => {
    it('should return valid for all valid permissions', () => {
      const result = validatePermissions(['read', 'write']);
      expect(result.valid).toBe(true);
      expect(result.invalid).toBeUndefined();
    });

    it('should return invalid with list of invalid permissions', () => {
      const result = validatePermissions(['read', 'invalid', 'write', 'fake']);
      expect(result.valid).toBe(false);
      expect(result.invalid).toEqual(['invalid', 'fake']);
    });

    it('should return valid for empty array', () => {
      const result = validatePermissions([]);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for all invalid permissions', () => {
      const result = validatePermissions(['invalid1', 'invalid2']);
      expect(result.valid).toBe(false);
      expect(result.invalid).toEqual(['invalid1', 'invalid2']);
    });
  });
});

describe('Permission Middleware Integration', () => {
  describe('Permission hierarchy enforcement', () => {
    it('should enforce that admin can do everything', () => {
      const adminPerms = [Permission.ADMIN];
      
      // Admin should be able to perform all operations
      expect(hasPermission(adminPerms, Permission.READ)).toBe(true);
      expect(hasPermission(adminPerms, Permission.WRITE)).toBe(true);
      expect(hasPermission(adminPerms, Permission.KEY_REVOKE)).toBe(true);
      expect(hasPermission(adminPerms, Permission.ADMIN)).toBe(true);
    });

    it('should enforce that key_revoke can read and revoke', () => {
      const revokePerms = [Permission.KEY_REVOKE];
      
      expect(hasPermission(revokePerms, Permission.READ)).toBe(true);
      expect(hasPermission(revokePerms, Permission.KEY_REVOKE)).toBe(true);
      expect(hasPermission(revokePerms, Permission.WRITE)).toBe(false);
      expect(hasPermission(revokePerms, Permission.ADMIN)).toBe(false);
    });

    it('should enforce that write can read and write', () => {
      const writePerms = [Permission.WRITE];
      
      expect(hasPermission(writePerms, Permission.READ)).toBe(true);
      expect(hasPermission(writePerms, Permission.WRITE)).toBe(true);
      expect(hasPermission(writePerms, Permission.KEY_REVOKE)).toBe(false);
      expect(hasPermission(writePerms, Permission.ADMIN)).toBe(false);
    });

    it('should enforce that read can only read', () => {
      const readPerms = [Permission.READ];
      
      expect(hasPermission(readPerms, Permission.READ)).toBe(true);
      expect(hasPermission(readPerms, Permission.WRITE)).toBe(false);
      expect(hasPermission(readPerms, Permission.KEY_REVOKE)).toBe(false);
      expect(hasPermission(readPerms, Permission.ADMIN)).toBe(false);
    });
  });

  describe('Real-world permission scenarios', () => {
    it('should allow standard user to read and write', () => {
      const userPerms = [...PermissionGroups.STANDARD];
      
      expect(hasAllPermissions(userPerms, [Permission.READ, Permission.WRITE])).toBe(true);
      expect(hasPermission(userPerms, Permission.KEY_REVOKE)).toBe(false);
      expect(isAdmin(userPerms)).toBe(false);
    });

    it('should allow key manager to manage keys', () => {
      const managerPerms = [...PermissionGroups.KEY_MANAGER];
      
      expect(hasAllPermissions(managerPerms, [Permission.READ, Permission.WRITE, Permission.KEY_REVOKE])).toBe(true);
      expect(isAdmin(managerPerms)).toBe(false);
    });

    it('should allow admin full access', () => {
      const adminPerms = [...PermissionGroups.ADMIN];
      
      expect(isAdmin(adminPerms)).toBe(true);
      expect(hasAllPermissions(adminPerms, Object.values(Permission))).toBe(true);
    });
  });
});

describe('Permission Security Tests', () => {
  describe('Privilege escalation prevention', () => {
    it('should not allow read-only user to escalate to write', () => {
      const readOnlyPerms = [...PermissionGroups.READ_ONLY];
      
      expect(hasPermission(readOnlyPerms, Permission.WRITE)).toBe(false);
      expect(hasPermission(readOnlyPerms, Permission.KEY_REVOKE)).toBe(false);
      expect(hasPermission(readOnlyPerms, Permission.ADMIN)).toBe(false);
    });

    it('should not allow standard user to escalate to key_revoke', () => {
      const standardPerms = [...PermissionGroups.STANDARD];
      
      expect(hasPermission(standardPerms, Permission.KEY_REVOKE)).toBe(false);
      expect(hasPermission(standardPerms, Permission.ADMIN)).toBe(false);
    });

    it('should not allow key manager to escalate to admin', () => {
      const managerPerms = [...PermissionGroups.KEY_MANAGER];
      
      expect(hasPermission(managerPerms, Permission.ADMIN)).toBe(false);
      expect(isAdmin(managerPerms)).toBe(false);
    });
  });

  describe('Permission validation edge cases', () => {
    it('should handle case-sensitive permission strings', () => {
      expect(isValidPermission('READ')).toBe(false);
      expect(isValidPermission('Read')).toBe(false);
      expect(isValidPermission('read')).toBe(true);
    });

    it('should handle whitespace in permission strings', () => {
      expect(isValidPermission(' read')).toBe(false);
      expect(isValidPermission('read ')).toBe(false);
      expect(isValidPermission(' read ')).toBe(false);
    });

    it('should handle null and undefined gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(isValidPermission(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidPermission(undefined)).toBe(false);
    });
  });

  describe('Multiple permission checks', () => {
    it('should correctly check multiple permissions at once', () => {
      const userPerms = [Permission.READ, Permission.KEY_REVOKE];
      
      // Has read and key_revoke
      expect(hasAllPermissions(userPerms, [Permission.READ, Permission.KEY_REVOKE])).toBe(true);
      
      // Does not have write
      expect(hasAllPermissions(userPerms, [Permission.READ, Permission.WRITE])).toBe(false);
      
      // Does not have admin
      expect(hasAllPermissions(userPerms, [Permission.ADMIN])).toBe(false);
    });

    it('should handle checking against empty required permissions', () => {
      const userPerms = [Permission.READ];
      
      expect(hasAllPermissions(userPerms, [])).toBe(true);
    });
  });
});
