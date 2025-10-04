import { useState, useCallback, useEffect, useRef, useMemo } from 'preact/hooks';
import { html } from 'htm/preact';
import { VNode } from 'preact';

import { ImageComparator } from './components/ImageComparator';
import { FileDropzone } from './components/FileDropzone';
import { BatchProcessor } from './components/BatchProcessor';
import { CompressionOptions } from './components/CompressionOptions';
import { ProjectSelector } from './components/ProjectSelector';
import { BucketSelector } from './components/BucketSelector';
import { BucketManager } from './components/BucketManager';
import { WorkerUrlSetup } from './components/WorkerUrlSetup';
import { LogViewer } from './components/LogViewer';
import { FileBrowser } from './components/FileBrowser';
import { PreviewModal } from './components/PreviewModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { slugify, formatBytes } from './utils/formatters';
import { deleteProjectFromBucket } from './utils/db';
import { uploadFileToR2, getAvailableBuckets, getFoldersForBucket, getObjectsForPrefix, R2Object, deleteObjects, listKeysForPrefixes } from './utils/r2';
import { logger } from './utils/logger';
import { buildProjectTree, ProjectNode } from './utils/tree';

type FileType = 'image' | 'video' | null;
type ViewMode = 'browse' | 'upload';

interface CompressedData {
    url: string;
    size: number;
    name: string;
    type: string;
}

export interface BatchFile {
    file: File;
    id: string; // Combination of path and name for uniqueness
}

export interface BatchFileStatus {
    status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
    message?: string;
    compressedSize?: number;
    originalSize: number;
}

const SunIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
`;

const MoonIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
`;

const TerminalIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" y1="19" x2="20" y2="19"></line>
  </svg>
`;

const ArrowLeftIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
`;

const CogIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.49 1a9.6 9.6 0 0 0-1.64-.94L14.4 2.5a.5.5 0 0 0-.5-.5h-3.8a.5.5 0 0 0-.5.5l-.34 2.88a9.6 9.6 0 0 0-1.64.94l-2.49-1a.5.5 0 0 0-.61.22l-1.92 3.32a.5.5 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.94l.34 2.88a.5.5 0 0 0 .5.5h3.8a.5.5 0 0 0 .5.5l.34-2.88c.61-.2 1.17-.54 1.69-.94l2.49 1a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;

const BucketIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11h-2.17l-1.6-4.8a2 2 0 0 0-1.94-1.2H7.71a2 2 0 0 0-1.94 1.2L4.17 11H2M3.14 11l1.86 5.57A2 2 0 0 0 6.86 18h10.28a2 2 0 0 0 1.86-1.43L20.86 11"/>
    </svg>
`;

const LogOutIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
`;

const RefreshIcon = () => html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
`;

export const App = () => {
  // Worker URL state
  const [workerUrl, setWorkerUrl] = useState<string | null>(localStorage.getItem('ouranos-worker-url'));
  
  // Bucket & Project state
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);
  const [bucketsError, setBucketsError] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isUploadingToRoot, setIsUploadingToRoot] = useState<boolean>(false);
  const [isManagingBuckets, setIsManagingBuckets] = useState(false);
  const [workerVersion, setWorkerVersion] = useState<string | null>(null);
  const [objects, setObjects] = useState<R2Object[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [objectsError, setObjectsError] = useState<string | null>(null);

  // R2 upload status
  const [r2UploadStatus, setR2UploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [r2ObjectKey, setR2ObjectKey] = useState<string | null>(null);
  const [lastUploadedKeys, setLastUploadedKeys] = useState<string[]>([]);
  const [r2PublicDomains, setR2PublicDomains] = useState<{ [key: string]: string }>(() => {
      try {
          const stored = localStorage.getItem('ouranos-r2-public-domains');
          return stored ? JSON.parse(stored) : {};
      } catch (e) {
          logger.error("Impossible de parser les domaines R2 depuis le localStorage", e);
          return {};
      }
  });
  const [copySuccess, setCopySuccess] = useState(false);


  // File state (single file mode)
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  
  // Compression state (single file mode)
  const [outputFormat, setOutputFormat] = useState<string>('');
  const [quality, setQuality] = useState<number>(0.8);
  const [compressedResult, setCompressedResult] = useState<CompressedData | null>(null);
  const compressedUrlRef = useRef<string | null>(null);
  
  // Batch processing state
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ [id: string]: BatchFileStatus }>({});
  const [batchImageOptions, setBatchImageOptions] = useState({ format: 'image/jpeg', quality: 0.8 });
  const [batchVideoOptions, setBatchVideoOptions] = useState({ format: 'video/mp4', quality: 0.8 });


  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('light');
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [selectedObject, setSelectedObject] = useState<R2Object | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyUrlSuccess, setCopyUrlSuccess] = useState(false);


  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    logger.info("Application initialisée.");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Marquee effect for long titles on render, text change, and resize
  useEffect(() => {
    const checkTitleOverflow = () => {
        const container = titleRef.current;
        if (container) {
            // Reset first to get accurate measurements
            container.classList.remove('is-overflowing');
            const text = container.firstElementChild as HTMLElement;
            if (text) {
                const overflowAmount = text.scrollWidth - container.clientWidth;
                const isOverflowing = overflowAmount > 0;

                if (isOverflowing) {
                    container.classList.add('is-overflowing');
                    // 16px matches the 1rem padding added in CSS for a smooth scroll out
                    container.style.setProperty('--marquee-translate-x', `-${overflowAmount + 16}px`);
                } else {
                    container.style.removeProperty('--marquee-translate-x');
                }
            }
        }
    };

    checkTitleOverflow();
    window.addEventListener('resize', checkTitleOverflow);
    return () => {
        window.removeEventListener('resize', checkTitleOverflow);
    };
}, [selectedBucket, selectedProject]);


  const handleToggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  // Fetch buckets logic
  const fetchBuckets = useCallback(async () => {
    if (!workerUrl) return;
    
    logger.info('Tentative de récupération des buckets...');
    setBucketsLoading(true);
    setBucketsError(null);
    setWorkerVersion(null);
    try {
      const response = await getAvailableBuckets(workerUrl);
      const { buckets: availableBuckets, version } = response;
      setBuckets(availableBuckets);
      if (version) {
        setWorkerVersion(version);
      }
      logger.info('Buckets récupérés avec succès', { availableBuckets, version });
    } catch (e: any) {
      logger.error('Erreur lors de la récupération des buckets', { error: e.message, stack: e.stack });
      setBucketsError(e.message);
      console.error(e);
    } finally {
      setBucketsLoading(false);
    }
  }, [workerUrl]);

  // Fetch projects logic
  const fetchProjects = useCallback(async () => {
    if (!selectedBucket || !workerUrl) return;

    logger.info(`Rafraîchissement de l'arborescence pour le bucket ${selectedBucket}...`);
    setProjectsLoading(true);
    setError(null);
    try {
      // Step 1: Fetch all folder paths from R2
      const r2FolderPaths = await getFoldersForBucket(workerUrl, selectedBucket);
      logger.info(`${r2FolderPaths.length} chemins de dossiers trouvés sur R2.`);
      
      // Step 2: Build the hierarchical tree from the flat path list
      const projectTree = buildProjectTree(r2FolderPaths);
      
      // Step 3: Set the tree state
      setProjects(projectTree);
      logger.info('Arborescence de dossiers construite avec succès.');

    } catch (e: any) {
      logger.error(`Impossible de rafraîchir les dossiers pour le bucket ${selectedBucket}`, e);
      setError(`Impossible de rafraîchir l'arborescence des dossiers pour le bucket ${selectedBucket}.`);
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedBucket, workerUrl]);
  
    const fetchObjects = useCallback(async (prefix: string) => {
        if (!selectedBucket || !workerUrl) return;

        logger.info(`Récupération des objets pour le préfixe: "${prefix}"`);
        setObjectsLoading(true);
        setObjectsError(null);
        try {
            const response = await getObjectsForPrefix(workerUrl, selectedBucket, prefix);
            setObjects(response.objects);
            setFolders(response.delimitedPrefixes);
            logger.info(`${response.objects.length} objets et ${response.delimitedPrefixes.length} dossiers récupérés.`);
        } catch (e: any) {
            logger.error(`Impossible de récupérer les objets pour le préfixe "${prefix}"`, e);
            setObjectsError(`Impossible de récupérer la liste des fichiers.`);
        } finally {
            setObjectsLoading(false);
        }
    }, [selectedBucket, workerUrl]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
      const currentPrefix = selectedProject || (isUploadingToRoot ? '' : null);
      if (selectedBucket && currentPrefix !== null) {
          fetchObjects(currentPrefix);
      } else if (selectedBucket && !selectedProject) {
        fetchProjects();
      } else if (!selectedBucket) {
        fetchBuckets();
      }
  }, [selectedBucket, selectedProject, isUploadingToRoot, fetchBuckets, fetchProjects, fetchObjects]);

  // Fetch buckets when workerUrl is available
  useEffect(() => {
    if (workerUrl) {
      fetchBuckets();
    }
  }, [workerUrl, fetchBuckets]);

  // Load projects from R2 when a bucket is selected
  useEffect(() => {
    if (selectedBucket) {
      fetchProjects();
    } else {
      setProjects([]);
    }
  }, [selectedBucket, fetchProjects]);
  
  // Load objects when a project is selected
  useEffect(() => {
      const currentPrefix = selectedProject || (isUploadingToRoot ? '' : null);
      if (selectedBucket && currentPrefix !== null) {
          setViewMode('browse');
          fetchObjects(currentPrefix);
      } else {
          setObjects([]);
          setFolders([]);
      }
  }, [selectedBucket, selectedProject, isUploadingToRoot, fetchObjects]);
  
  // Cleanup logic
  const resetAllFileStates = useCallback(() => {
      // Single file cleanup
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (compressedUrlRef.current) URL.revokeObjectURL(compressedUrlRef.current);
      setFile(null);
      setPreviewUrl(null);
      setFileType(null);
      setCompressedResult(null);
      compressedUrlRef.current = null;
      setQuality(0.8);
      setR2UploadStatus('idle');
      setR2ObjectKey(null);
      
      // Batch file cleanup
      setBatchFiles([]);
      setBatchProgress({});
      setIsBatchProcessing(false);
      
      // General UI cleanup
      setLastUploadedKeys([]);
      setIsLoading(false);
      setError(null);
      setViewMode('browse');
      setIsSelectionMode(false);
      setSelectedItems(new Set());
      logger.debug('Fichier et état de compression nettoyés.');
  }, [previewUrl]);

  // Navigation handlers
  const handleSelectBucket = useCallback((bucketName: string) => {
    logger.info(`Bucket sélectionné: ${bucketName}`);
    setSelectedBucket(bucketName);
    setSelectedProject(null);
    setError(null);
  }, []);

  const handleSelectProject = useCallback((projectPath: string) => {
    logger.info(`dossier sélectionné: ${projectPath}`);
    setSelectedProject(projectPath);
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setError(null);
  }, []);
  
  const handleUploadToRoot = useCallback(() => {
    logger.info(`Préparation au téléversement à la racine du bucket: ${selectedBucket}`);
    setIsUploadingToRoot(true);
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    setError(null);
  }, [selectedBucket]);
  
  const goBackToProjectSelection = useCallback(() => {
    resetAllFileStates();
    setSelectedProject(null);
    setIsUploadingToRoot(false);
    setObjects([]);
    setFolders([]);
    setObjectsError(null);
  }, [resetAllFileStates]);

  const goBackToBucketSelection = useCallback(() => {
    resetAllFileStates();
    setSelectedProject(null);
    setSelectedBucket(null);
    setIsUploadingToRoot(false);
    setObjects([]);
    setFolders([]);
    setObjectsError(null);
  }, [resetAllFileStates]);

  // Project handlers
  const handleCreateProject = useCallback(async (newProjectName: string) => {
    if (!selectedBucket) return;

    const sanitizedName = newProjectName.trim().replace(/\//g, '');
    if (!sanitizedName) {
      setError("Le nom du dossier ne peut pas être vide.");
      return;
    }
    
    // For now, we only support creating folders at the root.
    const newProjectPath = `${sanitizedName}/`;
    
    logger.info(`Préparation à la création du dossier "${newProjectPath}" dans le bucket "${selectedBucket}"`);
    
    // R2 folders are just prefixes. They are created when the first file is uploaded.
    // We just move to the file upload screen with the correct path selected.
    setSelectedProject(newProjectPath);
    setError(null);
    logger.info(`Sélection du nouveau chemin de dossier: ${newProjectPath}. Le dossier sera créé lors du premier téléversement.`);
  }, [selectedBucket]);

  const handleDeleteProject = useCallback(async (projectName: string) => {
    // This is complex. Deleting means deleting all objects with that prefix.
    // The current DB logic only removes a single entry.
    // For now, this function is disabled in the UI.
    if (!selectedBucket) return;
    logger.info(`Tentative de suppression du dossier "${projectName}" (action désactivée dans l'interface)`);
    try {
      // The old DB logic is not sufficient for recursive deletes.
      await deleteProjectFromBucket(projectName, selectedBucket); // This might be stale
      logger.info(`dossier "${projectName}" supprimé de la DB locale.`);
      await fetchProjects(); // Refresh tree from R2
    } catch (e: any) {
        logger.error(`Erreur lors de la suppression du dossier "${projectName}"`, e);
        setError("Erreur lors de la suppression du dossier.");
    }
  }, [selectedBucket, fetchProjects]);
  
  // File handlers
  const handleFilesSelect = useCallback((selectedFiles: File[]) => {
    // We no longer call resetAllFileStates here as we are already in the upload view.
    setError(null);

    const validFiles = selectedFiles.filter(f => {
      const type = f.type.split('/')[0];
      const isValid = type === 'image' || type === 'video';
      if (!isValid) {
        logger.error('Type de fichier non supporté ignoré.', { name: f.name, type: f.type });
      }
      return isValid;
    });

    if (validFiles.length === 0 && selectedFiles.length > 0) {
      setError('Aucun fichier supporté sélectionné. Veuillez choisir des images ou des vidéos.');
      return;
    }

    if (validFiles.length === 1) {
      // Single file mode
      const selectedFile = validFiles[0];
      logger.info('Fichier unique sélectionné', { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size });
      setFile(selectedFile);
      const type = selectedFile.type.split('/')[0] as FileType;
      setFileType(type);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      if (type === 'image') setOutputFormat('image/jpeg');
      else if (type === 'video') setOutputFormat('video/mp4');
    } else if (validFiles.length > 1) {
      // Batch processing mode
      logger.info(`${validFiles.length} fichiers sélectionnés pour le traitement par lots.`);
      const batch = validFiles.map(f => ({
        file: f,
        id: (f.webkitRelativePath || f.name) + f.lastModified,
      }));
      setBatchFiles(batch);
      const initialProgress = batch.reduce((acc, item) => {
          acc[item.id] = { status: 'pending', originalSize: item.file.size };
          return acc;
      }, {} as { [id: string]: BatchFileStatus });
      setBatchProgress(initialProgress);
    }
  }, []);
  
  // Image compression effect (single file)
  useEffect(() => {
    if (fileType !== 'image' || !previewUrl || !file || !selectedBucket) return;

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    
    setIsLoading(true);
    setR2UploadStatus('idle');
    setR2ObjectKey(null);
    setLastUploadedKeys([]);
    logger.debug('Déclenchement de la compression d\'image (debounced)');

    debounceTimeoutRef.current = window.setTimeout(() => {
        const image = new Image();
        image.src = previewUrl;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setError("Impossible d'obtenir le contexte du canvas.");
                setIsLoading(false);
                return;
            }
            ctx.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) {
                    setError("La compression a échoué.");
                    setIsLoading(false);
                    return;
                }
                
                if (compressedUrlRef.current) URL.revokeObjectURL(compressedUrlRef.current);

                const newUrl = URL.createObjectURL(blob);
                compressedUrlRef.current = newUrl;

                const originalExtension = file.name.split('.').pop() || '';
                const baseName = file.name.endsWith('.' + originalExtension) 
                    ? file.name.slice(0, -(originalExtension.length + 1))
                    : file.name;
                const newExtension = outputFormat.split('/')[1];
                
                const bucketSlug = slugify(selectedBucket);
                const projectSlug = selectedProject ? slugify(selectedProject.slice(0, -1)) : ''; // remove trailing slash for slug
                const fileSlug = slugify(baseName);
                
                const newName = projectSlug
                    ? `${bucketSlug}-${projectSlug}-${fileSlug}.${newExtension}`
                    : `${bucketSlug}-${fileSlug}.${newExtension}`;
                
                const result = { url: newUrl, size: blob.size, name: newName, type: blob.type };
                setCompressedResult(result);
                setIsLoading(false);
                logger.info('Image compressée avec succès', result);
            }, outputFormat, quality);
        };
        image.onerror = () => { setError("Impossible de charger l'image."); setIsLoading(false); }
    }, 250);
    
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };

  }, [file, previewUrl, fileType, quality, outputFormat, selectedProject, selectedBucket]);
  
  const compressVideoPromise = (videoFile: File, options: { format: string, quality: number }): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        if (!MediaRecorder.isTypeSupported(options.format)) {
            return reject(new Error(`Le format ${options.format} n'est pas supporté par ce navigateur.`));
        }

        const videoUrl = URL.createObjectURL(videoFile);
        const video = document.createElement('video');
        let recorder: MediaRecorder;
        let safetyTimeout: number;

        const cleanup = () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            video.onended = null;
            clearTimeout(safetyTimeout);
            URL.revokeObjectURL(videoUrl);
        };

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            if (!isFinite(duration) || duration <= 0) {
                cleanup();
                return reject(new Error("Impossible de déterminer la durée de la vidéo ou la durée est non valide."));
            }

            // @ts-ignore
            const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
            
            const hasVideo = stream.getVideoTracks().length > 0;
            if (!hasVideo) {
                cleanup();
                return reject(new Error("La vidéo source ne contient pas de piste vidéo."));
            }
            const hasAudio = stream.getAudioTracks().length > 0;
            
            const videoHeight = video.videoHeight;
            let baseBitrate; // en bps
            if (videoHeight > 1080) { // > Full HD (ex: 1440p, 4K)
                baseBitrate = 8 * 1024 * 1024; // 8 Mbps
            } else if (videoHeight > 720) { // 1080p
                baseBitrate = 4 * 1024 * 1024; // 4 Mbps
            } else if (videoHeight > 480) { // 720p
                baseBitrate = 2.5 * 1024 * 1024; // 2.5 Mbps
            } else { // SD
                baseBitrate = 1 * 1024 * 1024; // 1 Mbps
            }

            const targetVideoBitrate = baseBitrate * options.quality;
            logger.debug(`Compression vidéo : hauteur=${videoHeight}p, bitrate de base=${baseBitrate/1024/1024}Mbps, qualité=${options.quality}, bitrate cible=${targetVideoBitrate/1024/1024}Mbps`);
            
            const targetAudioBitrate = 128 * 1024; // 128kbps

            try {
                recorder = new MediaRecorder(stream, {
                    mimeType: options.format,
                    videoBitsPerSecond: targetVideoBitrate,
                    ...(hasAudio && { audioBitsPerSecond: targetAudioBitrate }),
                });
            } catch (e) {
                cleanup();
                return reject(e);
            }
            
            const chunks: Blob[] = [];
            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: options.format });
                cleanup();
                resolve(blob);
            };

            recorder.onerror = (e) => {
                 cleanup();
                 reject(e);
            };
            
            safetyTimeout = window.setTimeout(() => {
                logger.debug("Le timeout de sécurité de la compression vidéo a été atteint, arrêt de l'enregistreur.");
                if (recorder && recorder.state === 'recording') {
                    recorder.stop();
                }
            }, (duration * 1000) + 5000);

            recorder.start();
            try {
                await video.play();
            } catch (e) {
                cleanup();
                reject(new Error("La lecture automatique a échoué, impossible de compresser."));
            }
        };
        
        video.onended = () => {
            logger.debug("L'événement 'onended' de la vidéo a été déclenché.");
            if (recorder && recorder.state === 'recording') {
                recorder.stop();
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error("Impossible de charger le fichier vidéo."));
        };

        video.preload = 'metadata';
        video.src = videoUrl;
    });
  };

  const handleVideoCompress = async () => {
    if (!file || fileType !== 'video' || !selectedBucket) return;
    setIsLoading(true);
    setCompressedResult(null);
    setError(null);
    setLastUploadedKeys([]);
    logger.info('Démarrage de la compression vidéo...', { format: outputFormat, quality });

    try {
        const blob = await compressVideoPromise(file, { format: outputFormat, quality });
        
        if (blob.size > file.size) {
            setError("Attention : Le fichier compressé est plus volumineux que l'original. La source est peut-être déjà très optimisée.");
        }
        
        if (compressedUrlRef.current) URL.revokeObjectURL(compressedUrlRef.current);
        const newUrl = URL.createObjectURL(blob);
        compressedUrlRef.current = newUrl;

        const originalExtension = file.name.split('.').pop() || '';
        const baseName = file.name.endsWith('.' + originalExtension) 
            ? file.name.slice(0, -(originalExtension.length + 1))
            : file.name;
        const newExtension = outputFormat.split('/')[1];
        
        const bucketSlug = slugify(selectedBucket);
        const projectSlug = selectedProject ? slugify(selectedProject.slice(0, -1)) : ''; // remove trailing slash for slug
        const fileSlug = slugify(baseName);
        
        const newName = projectSlug
            ? `${bucketSlug}-${projectSlug}-${fileSlug}.${newExtension}`
            : `${bucketSlug}-${fileSlug}.${newExtension}`;
        
        const result = { url: newUrl, size: blob.size, name: newName, type: blob.type };
        setCompressedResult(result);
        logger.info('Vidéo compressée avec succès', result);

    } catch(e: any) {
        logger.error('Erreur lors de la compression vidéo', { error: e.message, stack: e.stack });
        setError(`Erreur de compression : ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveToR2 = async () => {
      if (!compressedResult || !selectedBucket || !workerUrl) return;
      
      logger.info('Tentative d\'enregistrement sur R2 via worker', { bucket: selectedBucket, project: selectedProject, file: compressedResult.name });
      setR2UploadStatus('uploading');
      setR2ObjectKey(null);
      setError(null);
      setLastUploadedKeys([]);

      try {
          const projectPath = selectedProject || '';
          const finalObjectKey = `${projectPath}${compressedResult.name}`;
          const fileBlob = await fetch(compressedResult.url).then(r => r.blob());

          await uploadFileToR2(workerUrl, selectedBucket, finalObjectKey, fileBlob, compressedResult.type);

          setR2UploadStatus('success');
          setR2ObjectKey(finalObjectKey);
          setLastUploadedKeys([finalObjectKey]);
          logger.info('Fichier téléversé avec succès sur R2', { key: finalObjectKey });
      } catch (e: any) {
          logger.error('Échec du téléversement vers R2', { error: e.message, stack: e.stack });
          console.error("Failed to upload to R2:", e);
          setError(`Échec du téléversement vers R2 : ${e.message}`);
          setR2UploadStatus('error');
      }
  };
  
    const compressImagePromise = (imageFile: File, options: { format: string, quality: number }): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const imageUrl = URL.createObjectURL(imageFile);
            const image = new Image();
            image.src = imageUrl;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Impossible d'obtenir le contexte du canvas."));
                
                ctx.drawImage(image, 0, 0);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(imageUrl);
                    if (!blob) return reject(new Error("La compression a échoué."));
                    resolve(blob);
                }, options.format, options.quality);
            };
            image.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                reject(new Error("Impossible de charger l'image."));
            };
        });
    };

    const handleStartBatchProcessing = async () => {
        if (!workerUrl || !selectedBucket) return;

        logger.info('Démarrage du traitement par lot.', { count: batchFiles.length });
        setIsBatchProcessing(true);
        setError(null);
        setLastUploadedKeys([]);
        const successfulKeys: string[] = [];
        let hasErrors = false;

        for (const batchItem of batchFiles) {
            const { file, id } = batchItem;
            try {
                setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'compressing' } }));
                
                const fileType = file.type.split('/')[0];
                let blobToUpload: Blob = file;
                let newExtension: string;
                
                const originalExtension = file.name.split('.').pop() || '';

                if (fileType === 'image') {
                    const compressedBlob = await compressImagePromise(file, batchImageOptions);
                    blobToUpload = compressedBlob;
                    newExtension = batchImageOptions.format.split('/')[1];
                    setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'uploading', compressedSize: compressedBlob.size } }));
                } else if (fileType === 'video') {
                    const compressedBlob = await compressVideoPromise(file, batchVideoOptions);
                    blobToUpload = compressedBlob;
                    newExtension = batchVideoOptions.format.split('/')[1];
                    setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'uploading', compressedSize: compressedBlob.size } }));
                } else {
                    newExtension = originalExtension;
                    setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'uploading', compressedSize: file.size } }));
                }

                const baseName = file.name.endsWith('.' + originalExtension) 
                        ? file.name.slice(0, -(originalExtension.length + 1))
                        : file.name;
                
                const bucketSlug = slugify(selectedBucket);
                const projectSlug = selectedProject ? slugify(selectedProject.slice(0,-1)) : ''; // remove trailing slash for slug
                const fileSlug = slugify(baseName);
                
                const finalFileName = projectSlug
                    ? `${bucketSlug}-${projectSlug}-${fileSlug}.${newExtension}`
                    : `${bucketSlug}-${fileSlug}.${newExtension}`;
                
                const projectPath = selectedProject || '';
                // @ts-ignore
                const relativePath = file.webkitRelativePath || file.name;
                const finalRelativePath = relativePath.replace(file.name, finalFileName);
                const objectKey = `${projectPath}${finalRelativePath}`;


                await uploadFileToR2(workerUrl, selectedBucket, objectKey, blobToUpload, blobToUpload.type);
                successfulKeys.push(objectKey);
                setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'success' } }));
                logger.info(`Fichier traité et téléversé avec succès: ${objectKey}`);

            } catch (e: any) {
                hasErrors = true;
                logger.error(`Erreur lors du traitement du fichier ${file.name}`, { error: e.message });
                setBatchProgress(p => ({ ...p, [id]: { ...p[id], status: 'error', message: e.message } }));
            }
        }
        setIsBatchProcessing(false);
        setLastUploadedKeys(successfulKeys);
        logger.info('Traitement par lot terminé.');

        if (hasErrors) {
            setError("Certains fichiers n'ont pas pu être traités. Vérifiez les statuts dans la liste ci-dessus.");
        } else if (successfulKeys.length > 0) {
            const fileCount = successfulKeys.length;
            const plural = fileCount > 1 ? 's' : '';
            setError(`Succès ! ${fileCount} fichier${plural} traité${plural} et téléversé${plural}.`);
        }
    };
    
    const handleAddBatchFiles = useCallback((newFiles: File[]) => {
        logger.info(`Ajout de ${newFiles.length} fichier(s) au lot.`);
        const existingFileIds = new Set(batchFiles.map(bf => bf.id));

        const filesToAdd = newFiles.map(f => ({
            file: f,
            id: (f.webkitRelativePath || f.name) + f.lastModified,
        })).filter(bf => !existingFileIds.has(bf.id));

        if (filesToAdd.length === 0) {
            logger.info("Aucun nouveau fichier à ajouter (tous sont des doublons).");
            return;
        }

        const newProgress = filesToAdd.reduce((acc, item) => {
            acc[item.id] = { status: 'pending', originalSize: item.file.size };
            return acc;
        }, {} as { [id: string]: BatchFileStatus });

        setBatchFiles(prev => [...prev, ...filesToAdd]);
        setBatchProgress(prev => ({ ...prev, ...newProgress }));

    }, [batchFiles]);

    const handleRemoveBatchFile = useCallback((idToRemove: string) => {
        setBatchFiles(prev => prev.filter(bf => bf.id !== idToRemove));
        setBatchProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[idToRemove];
            return newProgress;
        });
        logger.debug(`Fichier avec id ${idToRemove} retiré du lot.`);
    }, []);
  
  const handleUrlSaved = (url: string) => {
    logger.info(`URL du worker sauvegardée: ${url}`);
    localStorage.setItem('ouranos-worker-url', url);
    setWorkerUrl(url);
    // Reset state to force re-fetch
    setBuckets([]);
    setSelectedBucket(null);
    setSelectedProject(null);
    setBucketsError(null);
  };
  
  const handleForgetUrl = () => {
    logger.info('URL du worker oubliée.');
    localStorage.removeItem('ouranos-worker-url');
    setWorkerUrl(null);
    // Reset all state
    resetAllFileStates();
    setBuckets([]);
    setProjects([]);
    setSelectedBucket(null);
    setSelectedProject(null);
    setError(null);
    setBucketsError(null);
  };

  const handleSavePublicDomain = (bucketName: string, domain: string) => {
      const newDomains = { ...r2PublicDomains, [bucketName]: domain };
      setR2PublicDomains(newDomains);
      localStorage.setItem('ouranos-r2-public-domains', JSON.stringify(newDomains));
      logger.info(`Domaine public pour ${bucketName} sauvegardé.`);
  };
  
    // --- Selection Mode Handlers ---
    const toggleSelectionMode = useCallback(() => {
        setIsSelectionMode(prev => !prev);
        setSelectedItems(new Set()); // Always clear selection when toggling mode
    }, []);

    const handleSelectItem = useCallback((key: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedItems.size === (objects.length + folders.length)) {
            setSelectedItems(new Set());
        } else {
            const allItemKeys = [...folders, ...objects.map(o => o.key)];
            setSelectedItems(new Set(allItemKeys));
        }
    }, [objects, folders, selectedItems.size]);

    const partitionSelectedItems = useCallback(() => {
        const keys: string[] = [];
        const prefixes: string[] = [];
        selectedItems.forEach(item => {
            if (item.endsWith('/')) {
                prefixes.push(item);
            } else {
                keys.push(item);
            }
        });
        return { keys, prefixes };
    }, [selectedItems]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedItems.size > 0) {
            setShowDeleteConfirm(true);
        }
    }, [selectedItems]);

    const handleConfirmDelete = useCallback(async () => {
        if (!workerUrl || !selectedBucket || selectedItems.size === 0) return;

        const { keys, prefixes } = partitionSelectedItems();
        logger.info(`Demande de suppression pour ${keys.length} fichiers et ${prefixes.length} dossiers.`);
        
        setShowDeleteConfirm(false);
        setIsLoading(true);
        setError(null);

        try {
            await deleteObjects(workerUrl, selectedBucket, { keys, prefixes });
            const count = selectedItems.size;
            setError(`Succès : ${count} élément(s) supprimé(s).`);
            logger.info(`${count} élément(s) supprimé(s) avec succès.`);
        } catch (e: any) {
            logger.error('Erreur lors de la suppression des éléments', e);
            setError(`Erreur lors de la suppression : ${e.message}`);
        } finally {
            setIsLoading(false);
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            handleRefresh(); // Refresh the file list
        }
    }, [workerUrl, selectedBucket, selectedItems, partitionSelectedItems, handleRefresh]);
    
    const handleCopyUrlsSelected = useCallback(async () => {
        if (!workerUrl || !selectedBucket || selectedItems.size === 0) return;
        const publicDomain = r2PublicDomains[selectedBucket];
        if (!publicDomain) {
            setError("Veuillez d'abord configurer le domaine public pour ce bucket.");
            return;
        }

        const { keys, prefixes } = partitionSelectedItems();
        setIsLoading(true);
        setError(null);
        setCopyUrlSuccess(false);

        try {
            let allKeysToCopy = [...keys];
            if (prefixes.length > 0) {
                const keysFromPrefixes = await listKeysForPrefixes(workerUrl, selectedBucket, prefixes);
                allKeysToCopy.push(...keysFromPrefixes);
            }
            
            if (allKeysToCopy.length === 0) {
                setError("Aucun fichier à copier (les dossiers sélectionnés sont peut-être vides).");
                return;
            }

            const urls = allKeysToCopy.map(key => `https://${publicDomain.replace(/\/$/, '')}/${key}`).join('\n');
            await navigator.clipboard.writeText(urls);
            
            setCopyUrlSuccess(true);
            setTimeout(() => setCopyUrlSuccess(false), 2500);
            
            logger.info(`${allKeysToCopy.length} URLs copiées dans le presse-papiers.`);
        } catch (e: any) {
            logger.error("Erreur lors de la copie des URLs", e);
            setError(`Erreur lors de la copie des URLs : ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [workerUrl, selectedBucket, selectedItems, partitionSelectedItems, r2PublicDomains]);

  const renderUploadSuccess = () => {
    if (lastUploadedKeys.length === 0) return null;

    const publicDomain = selectedBucket ? r2PublicDomains[selectedBucket] : null;

    const handleCopy = () => {
        if (!publicDomain || lastUploadedKeys.length === 0) return;
        const urls = lastUploadedKeys.map(key => `https://${publicDomain.replace(/\/$/, '')}/${key}`).join('\n');
        navigator.clipboard.writeText(urls).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    return html`
        <div class="upload-success-container">
            <div class="alert alert-success">
                <strong>${lastUploadedKeys.length} fichier(s) téléversé(s) avec succès !</strong>
            </div>
            ${publicDomain ? html`
                <button class="btn btn-secondary" onClick=${handleCopy} style="margin-top: 1rem;">
                    ${copySuccess ? '✓ Copié !' : `Copier ${lastUploadedKeys.length} URL(s)`}
                </button>
            ` : html`
                <div class="alert alert-info" style="text-align: left; font-size: 0.9rem; margin-top: 1rem;">
                    <strong>Pour copier les URLs publiques</strong>, vous devez d'abord configurer le domaine public pour le bucket <strong>${selectedBucket}</strong>.
                    <br/><br/>
                    <button class="btn btn-secondary" style="width: auto; padding: 0.5rem 1rem;" onClick=${goBackToBucketSelection}>
                        Configurer le domaine
                    </button>
                </div>
            `}
        </div>
    `;
  };


  const renderContent = () => {
    if (!selectedBucket) {
      return html`<${BucketSelector} 
        buckets=${buckets}
        isLoading=${bucketsLoading}
        error=${bucketsError}
        onSelectBucket=${handleSelectBucket}
        r2PublicDomains=${r2PublicDomains}
        onSavePublicDomain=${handleSavePublicDomain}
      />`;
    }

    if (!selectedProject && !isUploadingToRoot) {
      return html`<${ProjectSelector} 
        bucketName=${selectedBucket}
        projects=${projects} 
        onSelectProject=${handleSelectProject} 
        onCreateProject=${handleCreateProject}
        onDeleteProject=${handleDeleteProject}
        onUploadToRoot=${handleUploadToRoot}
        isLoading=${projectsLoading}
      />`;
    }
    
    // File Browser View
    if (viewMode === 'browse') {
        return html`
            <${FileBrowser}
                objects=${objects}
                folders=${folders}
                isLoading=${objectsLoading}
                error=${objectsError}
                publicDomain=${r2PublicDomains[selectedBucket] || null}
                onUploadClick=${() => setViewMode('upload')}
                onObjectClick=${(obj: R2Object) => setSelectedObject(obj)}
                onFolderClick=${handleSelectProject}
                isSelectionMode=${isSelectionMode}
                toggleSelectionMode=${toggleSelectionMode}
                selectedItems=${selectedItems}
                onSelectItem=${handleSelectItem}
                onSelectAll=${handleSelectAll}
                onDeleteSelected=${handleDeleteSelected}
                onCopyUrlsSelected=${handleCopyUrlsSelected}
                copyUrlSuccess=${copyUrlSuccess}
            />
        `;
    }
    
    // Upload View
    if (batchFiles.length > 0) {
        return html`
          <${BatchProcessor} 
            files=${batchFiles}
            progress=${batchProgress}
            imageOptions=${batchImageOptions}
            setImageOptions=${setBatchImageOptions}
            videoOptions=${batchVideoOptions}
            setVideoOptions=${setBatchVideoOptions}
            onStartProcess=${handleStartBatchProcessing}
            isProcessing=${isBatchProcessing}
            onClear=${resetAllFileStates}
            onAddFiles=${handleAddBatchFiles}
            onRemoveFile=${handleRemoveBatchFile}
          />
          ${!isBatchProcessing && renderUploadSuccess()}
        `;
    }
    
    if (!file) {
      return html`<${FileDropzone} onFilesSelect=${handleFilesSelect} />`;
    }

    if (fileType === 'image') {
      const isDownloadDisabled = isLoading || !compressedResult;
      const isR2ButtonDisabled = isDownloadDisabled || r2UploadStatus === 'uploading' || r2UploadStatus === 'success';
      
      let r2ButtonText: VNode | string = 'Enregistrer sur R2';
      if (r2UploadStatus === 'uploading') r2ButtonText = html`<div class="loader"></div> Envoi...`;
      if (r2UploadStatus === 'success') r2ButtonText = '✓ Succès';
      if (r2UploadStatus === 'error') r2ButtonText = 'Réessayer';

      return html`
        <${ImageComparator}
            originalUrl=${previewUrl}
            compressedUrl=${compressedResult?.url}
            originalFile=${file}
            compressedSize=${compressedResult?.size}
            isLoading=${isLoading}
        />
        <${CompressionOptions} 
            fileType=${fileType}
            outputFormat=${outputFormat}
            setOutputFormat=${setOutputFormat}
            quality=${quality}
            setQuality=${setQuality}
        />
        <div class="actions">
            <button class="btn btn-secondary" onClick=${() => { setFile(null); setPreviewUrl(null); setCompressedResult(null); setError(null); }}>Changer de fichier</button>
            <a 
                href=${isDownloadDisabled ? '#' : compressedResult.url} 
                download=${isDownloadDisabled ? '' : compressedResult.name} 
                class="btn btn-primary ${isDownloadDisabled ? 'disabled' : ''}"
                onClick=${(e: Event) => isDownloadDisabled && e.preventDefault()}
                aria-disabled=${isDownloadDisabled}
            >
                ${isLoading && !compressedResult ? html`<div class="loader"></div> Préparation...` : 'Télécharger'}
            </a>
            <button 
              class="btn ${r2UploadStatus === 'success' ? 'btn-success' : 'btn-secondary'}" 
              onClick=${handleSaveToR2}
              disabled=${isR2ButtonDisabled}
            >
              ${r2ButtonText}
            </button>
        </div>
        ${renderUploadSuccess()}
      `;
    }

    if (fileType === 'video') {
      const isDownloadDisabled = isLoading || !compressedResult;
      const isR2ButtonDisabled = isDownloadDisabled || r2UploadStatus === 'uploading' || r2UploadStatus === 'success';
      
      let r2ButtonText: VNode | string = 'Enregistrer sur R2';
      if (r2UploadStatus === 'uploading') r2ButtonText = html`<div class="loader"></div> Envoi...`;
      if (r2UploadStatus === 'success') r2ButtonText = '✓ Succès';
      if (r2UploadStatus === 'error') r2ButtonText = 'Réessayer';

      return html`
        <div class="comparator-wrapper">
            <div class="file-details">
                <p><strong>Fichier :</strong> ${file.name}</p>
                <div class="comparator-stats">
                    <span><strong>Original :</strong> ${formatBytes(file.size)}</span>
                    ${compressedResult && html`
                        <span><strong>Compressé :</strong> ${formatBytes(compressedResult.size)}</span>
                        <span class="size-reduction"><strong>Réduction :</strong> ${Math.round(100 - (compressedResult.size / file.size) * 100)}%</span>
                    `}
                </div>
            </div>

            <div class="preview" style="position: relative;">
                <video src=${compressedResult ? compressedResult.url : previewUrl} controls key=${compressedResult ? compressedResult.url : previewUrl} style="width: 100%; border-radius: 8px; border: 1px solid var(--c-border);" />
                 ${isLoading && html`
                    <div class="comparator-loading-overlay">
                        <div class="loader"></div>
                        <p>Compression en cours... <br/>(cela peut prendre un certain temps)</p>
                    </div>
                `}
            </div>
        </div>
        <${CompressionOptions} 
            fileType=${fileType}
            outputFormat=${outputFormat}
            setOutputFormat=${setOutputFormat}
            quality=${quality}
            setQuality=${setQuality}
            disabled=${isLoading}
        />
        <div class="actions">
            <button class="btn btn-secondary" onClick=${() => { setFile(null); setPreviewUrl(null); setCompressedResult(null); setError(null); }}>Changer de fichier</button>
            ${!compressedResult ? html`
                <button class="btn btn-primary" onClick=${handleVideoCompress} disabled=${isLoading}>
                    ${isLoading ? html`<div class="loader"></div> Compression...` : 'Compresser'}
                </button>
            ` : html`
                <button class="btn btn-secondary" onClick=${handleVideoCompress} disabled=${isLoading}>
                    ${isLoading ? html`<div class="loader"></div> Re-compresser...` : 'Re-compresser'}
                </button>
                <a 
                    href=${isDownloadDisabled ? '#' : compressedResult.url} 
                    download=${isDownloadDisabled ? '' : compressedResult.name} 
                    class="btn btn-primary ${isDownloadDisabled ? 'disabled' : ''}"
                    onClick=${(e: Event) => isDownloadDisabled && e.preventDefault()}
                    aria-disabled=${isDownloadDisabled}
                >
                    Télécharger
                </a>
                <button 
                  class="btn ${r2UploadStatus === 'success' ? 'btn-success' : 'btn-secondary'}" 
                  onClick=${handleSaveToR2}
                  disabled=${isR2ButtonDisabled}
                >
                  ${r2ButtonText}
                </button>
            `}
        </div>
        ${renderUploadSuccess()}
      `;
    }
    
    return null;
  };
  
  const renderHeader = () => {
    let backButton: VNode | null = null;
    let title = "Ouranos";

    const goBack = () => {
        if (selectedObject) {
            setSelectedObject(null);
            return;
        }
        if (file || batchFiles.length > 0) {
            resetAllFileStates();
        } else if (viewMode === 'upload') {
            setViewMode('browse');
        } else if (selectedProject || isUploadingToRoot) {
            goBackToProjectSelection();
        } else if (selectedBucket) {
            goBackToBucketSelection();
        }
    };
    
    if (selectedBucket) {
        backButton = html`<button class="header-back-btn" onClick=${goBack} title="Retour"><${ArrowLeftIcon} /> Retour</button>`;
        title = selectedProject ? `${selectedBucket}/${selectedProject}` : `${selectedBucket}`;
    }

    return html`
      <header>
          <div class="header-left">
             ${backButton}
          </div>
          <h1 ref=${titleRef}>
            <span>${title}</span>
          </h1>
          <div class="header-actions">
               <button class="header-btn" onClick=${handleRefresh} aria-label="Rafraîchir" title="Rafraîchir" disabled=${!!(selectedProject && viewMode === 'upload') || (isUploadingToRoot && viewMode === 'upload')}>
                  <${RefreshIcon} />
               </button>
               <button class="header-btn" onClick=${() => setIsLogViewerOpen(true)} aria-label="Afficher les logs">
                  <${TerminalIcon} />
              </button>
              <button class="header-btn" onClick=${handleToggleTheme} aria-label="Changer le thème">
                  ${theme === 'light' ? html`<${MoonIcon} />` : html`<${SunIcon} />`}
              </button>
              ${workerUrl && html`
                <div class="settings-menu-container" ref=${settingsRef}>
                    <button class="header-btn" onClick=${() => setIsSettingsOpen(prev => !prev)} aria-label="Paramètres">
                        <${CogIcon} />
                    </button>
                    ${isSettingsOpen && html`
                        <div class="settings-dropdown">
                            <button onClick=${() => { setIsManagingBuckets(true); setIsSettingsOpen(false); }}>
                                <${BucketIcon} />
                                <span>Gérer les buckets</span>
                            </button>
                            <button onClick=${() => { handleForgetUrl(); setIsSettingsOpen(false); }}>
                                <${LogOutIcon} />
                                <span>Changer de Worker</span>
                            </button>
                        </div>
                    `}
                </div>
              `}
          </div>
      </header>
    `;
  }

  if (!workerUrl) {
    return html`
    <div class="container">
      <${WorkerUrlSetup} onUrlSaved=${handleUrlSaved} />
      <div class="app-footer">
        <span>By SKAIII</span>
      </div>
    </div>
    `;
  }
  
  const publicDomain = selectedBucket ? r2PublicDomains[selectedBucket] : null;
  const publicUrl = selectedObject && publicDomain 
        ? `https://${publicDomain.replace(/\/$/, '')}/${selectedObject.key}` 
        : null;

  return html`
    <div class="container">
      ${renderHeader()}
      ${error && html`<div class="alert ${
          error.toLowerCase().includes("succès") ? 'alert-success' :
          (error.toLowerCase().includes("erreur") || error.toLowerCase().includes("échec") || error.toLowerCase().includes("problème") || error.toLowerCase().includes("certains")) ? 'alert-danger' :
          'alert-info'
      }" role="alert" onClick=${() => setError(null)} title="Cliquez pour fermer">${error}</div>`}
      <main>
        ${renderContent()}
      </main>
      <div class="app-footer">
        <span>By SKAIII</span>
      </div>
    </div>
    ${isManagingBuckets && workerUrl && html`
        <${BucketManager}
            workerUrl=${workerUrl}
            activeBuckets=${buckets}
            onClose=${() => setIsManagingBuckets(false)}
        />
    `}
     ${isLogViewerOpen && html`
        <${LogViewer} onClose=${() => setIsLogViewerOpen(false)} />
    `}
    ${selectedObject && publicUrl && html`
        <${PreviewModal} 
            object=${selectedObject}
            publicUrl=${publicUrl}
            onClose=${() => setSelectedObject(null)}
        />
    `}
    <${ConfirmationModal}
        isOpen=${showDeleteConfirm}
        onClose=${() => setShowDeleteConfirm(false)}
        onConfirm=${handleConfirmDelete}
        title="Confirmer la suppression"
    >
        <p>Êtes-vous sûr de vouloir supprimer définitivement <strong>${selectedItems.size}</strong> élément(s) ?</p>
        <p>Cette action est irréversible.</p>
    </${ConfirmationModal}>
  `;
};