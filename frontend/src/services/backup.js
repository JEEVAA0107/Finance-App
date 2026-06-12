import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const DbBackup = registerPlugin('DbBackup');

export async function backupDatabase() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Backup only available on Android');
  }
  return await DbBackup.backup();
}

export async function restoreDatabase(path = null) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Restore only available on Android');
  }
  const result = await DbBackup.restore(path ? { path } : {});
  return result;
}

export async function listBackups() {
  if (!Capacitor.isNativePlatform()) return { backups: [] };
  return await DbBackup.listBackups();
}
