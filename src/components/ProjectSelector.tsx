import { html } from 'htm/preact';
import { useState, useCallback } from 'preact/hooks';
import type { ProjectNode } from '../utils/tree';

interface ProjectSelectorProps {
  bucketName: string;
  projects: ProjectNode[];
  onSelectProject: (path: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (path: string) => void;
  onUploadToRoot: () => void;
  isLoading: boolean;
}

const FolderIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
`;

const ChevronRightIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
`;

const UploadToRootIcon = () => html`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
        <path d="M12 12v9"/>
        <path d="m16 16-4-4-4 4"/>
    </svg>
`;

interface ProjectNodeItemProps {
  node: ProjectNode;
  onSelectProject: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}

const ProjectNodeItem = ({ node, onSelectProject, expandedFolders, toggleFolder }: ProjectNodeItemProps) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0;

    return html`
        <li class="project-tree-item" style=${{ '--depth': node.depth }}>
            <div class="project-tree-item-content">
                <button 
                    class="project-tree-chevron" 
                    onClick=${(e: Event) => { e.stopPropagation(); toggleFolder(node.path); }}
                    aria-label=${isExpanded ? 'Réduire' : 'Déplier'}
                    style=${{ visibility: hasChildren ? 'visible' : 'hidden', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                    <${ChevronRightIcon} />
                </button>
                 <div class="project-tree-icon" onClick=${() => onSelectProject(node.path)}><${FolderIcon} /></div>
                <span class="project-tree-name" onClick=${() => onSelectProject(node.path)}>${node.name}</span>
            </div>
             <div class="project-list-chevron" onClick=${() => onSelectProject(node.path)}><${ChevronRightIcon} /></div>
        </li>
        ${isExpanded && hasChildren && html`
            <ul class="project-tree-children">
                ${node.children.map(child => html`
                    <${ProjectNodeItem}
                        key=${child.path}
                        node=${child}
                        onSelectProject=${onSelectProject}
                        expandedFolders=${expandedFolders}
                        toggleFolder=${toggleFolder}
                    />
                `)}
            </ul>
        `}
    `;
};


export const ProjectSelector = ({ projects, onSelectProject, onCreateProject, onUploadToRoot, isLoading }: ProjectSelectorProps) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set<string>());

  const toggleFolder = useCallback((path: string) => {
      setExpandedFolders(prev => {
          const newSet = new Set(prev);
          if (newSet.has(path)) {
              newSet.delete(path);
          } else {
              newSet.add(path);
          }
          return newSet;
      });
  }, []);

  const handleCreate = (e: Event) => {
    e.preventDefault();
    if (newProjectName.trim() && !isLoading) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return html`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: var(--c-text-light);">
            <div class="loader"></div>
            <p style="margin-top: 1rem;">Synchronisation avec R2...</p>
        </div>
      `;
    }

    if (projects.length > 0) {
      return html`
        <div class="project-list">
          <h3>dossiers existants</h3>
          <ul class="project-tree">
            ${projects.map(node => html`
              <${ProjectNodeItem}
                key=${node.path}
                node=${node}
                onSelectProject=${onSelectProject}
                expandedFolders=${expandedFolders}
                toggleFolder=${toggleFolder}
              />
            `)}
          </ul>
        </div>
      `;
    }

    return html`
        <div class="no-projects">
            <p>Aucun dossier dans ce bucket.</p>
            <p>Créez-en un pour commencer !</p>
        </div>
    `;
  }

  return html`
    <div class="project-selector-container">
      <p style="margin-top: 0; margin-bottom: 2rem; color: var(--c-text-light);">Choisissez une destination pour vos fichiers.</p>
      
       <div class="upload-to-root-option" onClick=${onUploadToRoot} role="button" tabindex="0">
        <div class="upload-to-root-content">
            <${UploadToRootIcon} />
            <div class="upload-to-root-text">
                <strong>Téléverser à la racine</strong>
                <span class="light-text">Glissez-déposez directement dans le bucket.</span>
            </div>
        </div>
        <div class="project-list-chevron"><${ChevronRightIcon} /></div>
      </div>
      
      <div class="project-selector-divider">OU</div>

      <form class="new-project-form" onSubmit=${handleCreate}>
        <input 
          type="text" 
          placeholder="Nom du nouveau dossier (à la racine)" 
          value=${newProjectName} 
          onInput=${(e: Event) => setNewProjectName((e.target as HTMLInputElement).value)}
          aria-label="Nom du nouveau dossier"
          disabled=${isLoading}
        />
        <button type="submit" class="btn btn-primary" disabled=${!newProjectName.trim() || isLoading}>
            Créer
        </button>
      </form>

      ${renderContent()}
    </div>
  `;
};