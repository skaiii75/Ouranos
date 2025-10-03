

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { logger } from './logger';

const DB_NAME = 'ouranos-db';
const DB_VERSION = 2; // Version incrémentée pour refléter le changement de schéma
const PROJECTS_STORE_NAME = 'projects';

interface Project {
  bucketName: string;
  name: string;
}

interface OuranosDB extends DBSchema {
  [PROJECTS_STORE_NAME]: {
    key: [string, string]; // Clé composite : [bucketName, projectName]
    value: Project;
    indexes: { 'by-bucket': string }; // Index pour rechercher par bucketName
  };
}

const dbPromise: Promise<IDBPDatabase<OuranosDB>> = openDB<OuranosDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    logger.info(`Mise à niveau de la base de données de la v${oldVersion} à la v${newVersion}`);
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
    logger.debug(`Projets récupérés depuis IndexedDB pour le bucket "${bucketName}"`, { count: projects.length });
    return projects.map(p => p.name).sort((a, b) => a.localeCompare(b));
  } catch (e: any) {
    logger.error(`Erreur lors de la récupération des projets depuis IndexedDB pour le bucket "${bucketName}"`, { error: e.message });
    throw e;
  }
};

export const addProjectToBucket = async (projectName: string, bucketName: string): Promise<void> => {
  try {
    const db = await dbPromise;
    await db.put(PROJECTS_STORE_NAME, { name: projectName, bucketName: bucketName });
    logger.debug(`Projet "${projectName}" ajouté à IndexedDB pour le bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Erreur lors de l'ajout du projet "${projectName}" à IndexedDB`, { error: e.message });
    throw e;
  }
};

export const deleteProjectFromBucket = async (projectName: string, bucketName: string): Promise<void> => {
  try {
    const db = await dbPromise;
    await db.delete(PROJECTS_STORE_NAME, [bucketName, projectName]);
    logger.debug(`Projet "${projectName}" supprimé de IndexedDB pour le bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Erreur lors de la suppression du projet "${projectName}" de IndexedDB`, { error: e.message });
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
    logger.debug(`${projectNames.length} projets R2 synchronisés avec IndexedDB pour le bucket "${bucketName}"`);
  } catch (e: any) {
    logger.error(`Erreur lors de la synchronisation des projets R2 avec IndexedDB`, { error: e.message });
    throw e;
  }
};
