import { schemaFiles, SchemaFile } from './schema-data.js';

export class SchemaViewer {
    private fileTree: HTMLElement;
    private schemaDetails: HTMLElement;
    private searchInput: HTMLInputElement;
    private files: SchemaFile[];
    private selectedFile: string | null = null;

    constructor() {
        this.fileTree = document.getElementById('fileTree') as HTMLElement;
        this.schemaDetails = document.getElementById('schemaDetails') as HTMLElement;
        this.searchInput = document.getElementById('search') as HTMLInputElement;
        this.files = schemaFiles;

        this.initialize();
    }

    private initialize(): void {
        this.renderFileTree();
        this.setupSearch();
    }

    private renderFileTree(): void {
        this.fileTree.innerHTML = '';
        
        const filteredFiles = this.files.filter(file => {
            const searchTerm = this.searchInput.value.toLowerCase();
            return !searchTerm || 
                   file.path.toLowerCase().includes(searchTerm) ||
                   file.content.toLowerCase().includes(searchTerm);
        });

        filteredFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = `file-item ${this.selectedFile === file.path ? 'active' : ''}`;
            fileItem.textContent = file.path;
            fileItem.onclick = () => this.selectFile(file);
            this.fileTree.appendChild(fileItem);
        });
    }

    private setupSearch(): void {
        this.searchInput.addEventListener('input', () => {
            this.renderFileTree();
        });
    }

    private selectFile(file: SchemaFile): void {
        this.selectedFile = file.path;
        this.renderFileTree();
        this.renderSchemaDetails(file);
    }

    private extractJSDoc(content: string): string[] {
        const docs: string[] = [];
        const jsDocRegex = /\/\*\*([\s\S]*?)\*\//g;
        let match;

        while ((match = jsDocRegex.exec(content)) !== null) {
            const doc = match[1]
                .split('\n')
                .map(line => line.trim().replace(/^\* ?/, ''))
                .filter(line => line)
                .join('\n');
            docs.push(doc);
        }

        return docs;
    }

    private renderSchemaDetails(file: SchemaFile): void {
        const docs = this.extractJSDoc(file.content);
        
        let html = `<h2>${file.path}</h2>`;

        // Add documentation if available
        if (docs.length > 0) {
            html += `<div class="docs">
                ${docs.map(doc => `<p>${doc}</p>`).join('\n')}
            </div>`;
        }

        // Add syntax-highlighted content
        html += `<div class="type-definition">
            ${this.highlightSyntax(file.content)}
        </div>`;

        this.schemaDetails.innerHTML = html;
        this.setupExpandables();
    }

    private highlightSyntax(content: string): string {
        // Basic syntax highlighting
        return content
            .replace(/\b(interface|type|enum|const|export|import)\b/g, '<span class="type-keyword">$1</span>')
            .replace(/\b([A-Z][a-zA-Z]*)\b/g, '<span class="type-name">$1</span>')
            .replace(/'([^']*)'/g, '<span class="type-string">\'$1\'</span>')
            .replace(/"([^"]*)"/g, '<span class="type-string">"$1"</span>');
    }

    private setupExpandables(): void {
        const expandables = document.querySelectorAll('.expandable');
        expandables.forEach(elem => {
            elem.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                target.classList.toggle('expanded');
                const content = target.nextElementSibling;
                if (content) {
                    content.classList.toggle('hidden');
                }
            });
        });
    }
}

// Initialize the viewer when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new SchemaViewer();
}); 