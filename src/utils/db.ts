

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { logger } from './logger';

const DB_NAME = 'ouranos-db';
const DB_VERSION = 2; // Version incremented to reflect the schema change
const PROJECTS_STORE_NAME = 'projects';

interface Project {
  bucketName: string;
  name: string;
}

interface OuranosDB extends DBSchema {
  [PROJECTS_STORE_NAME]: {
    key: [string, string]; // Composite key: [bucketName, projectName]
    value: Project;
    indexes: { 'by-bucket': string }; // Index to search by bucketName
  };
}

const dbPromise: Promise<IDBPDatabase<OuranosDB>> = openDB<OuranosDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    logger.info(`Upgrading database from v${oldVersion} to v${newVersion}`);
    if (oldVersion < 2) {
        if (db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
            db.deleteObjectStore(PROJECTS_STORE_NAME);
        }
        const store = db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: ['bucketName', 'name'] });
        store.createIndex('by-bucket', 'bucketName');
    }
  },
});

export const getProjectsForBucket = async (bucketName: string): Promise<string[]> => {
  try {
    const db = await dbPromise;
    const projects = await db.getAllFromIndex(PROJECTS_STORE_NAME, 'by-bucket', bucketName);
    logger.debug(`Projects fetched from IndexedDB for bucket "${bucketName}"`, { count: projects.length });
    return projects.map(p => p.name).sort((a, b) => a.localeCompare(b));
  } catch (e: any) {
    logger.error(`Error fetching projects from IndexedDB for bucket "${bucketName}"`, { error: e.message });
    throw e;
  }
};

export const addProjectToBucket = async (projectName: string, bucketName: string): Promise<void> => {
  try {
    const db = await dbPromise;
    await db.put(PROJECTS_STORE_NAME, { name: projectName, bucketName: bucketName });
    logger.debug(`Project "${projectName}" added to IndexedDB for bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Error adding project "${projectName}" to IndexedDB`, { error: e.message });
    throw e;
  }
};

export const deleteProjectFromBucket = async (projectName: string, bucketName: string): Promise<void> => {
  try {
    const db = await dbPromise;
    await db.delete(PROJECTS_STORE_NAME, [bucketName, projectName]);
    logger.debug(`Project "${projectName}" deleted from IndexedDB for bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Error deleting project "${projectName}" from IndexedDB`, { error: e.message });
    throw e;
  }
};

export const syncProjectsToBucket = async (projectNames: string[], bucketName: string): Promise<void> => {
  if (projectNames.length === 0) return;
  try {
    const db = await dbPromise;
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    // 'put' will add new items or update existing ones, which is perfect for a sync operation.
    await Promise.all(
      projectNames.map(name => tx.store.put({ name, bucketName }))
    );
    await tx.done;
    logger.debug(`${projectNames.length} R2 projects synced to IndexedDB for bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Error syncing R2 projects with IndexedDB`, { error: e.message });
    throw e;
  }
};