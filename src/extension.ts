import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Key for storing the last used notes directory in workspace state
const LAST_NOTES_DIR_KEY = 'lastNotesDirectory';

// Function to recursively move files from old directory to new directory
async function migrateNotes(oldDir: string, newDir: string): Promise<void> {
  if (!fs.existsSync(oldDir)) {
    return;
  }

  // Additional safety check before migration
  const workspaceRoot = path.dirname(oldDir);
  const error = await validateNotesDirectory(path.relative(workspaceRoot, newDir), workspaceRoot);
  if (error) {
    throw new Error(`Cannot migrate notes: ${error}`);
  }

  const migrateFile = async (oldPath: string, newPath: string) => {
    try {
      // Ensure the target directory exists
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Check if target file already exists
      if (fs.existsSync(newPath)) {
        const oldContent = fs.readFileSync(oldPath, 'utf8');
        const newContent = fs.readFileSync(newPath, 'utf8');
        
        if (oldContent !== newContent) {
          // If contents differ, append old content to new file
          fs.appendFileSync(newPath, '\n\n---\n\nMigrated content from old location:\n\n' + oldContent);
        }
      } else {
        // Move the file
        fs.copyFileSync(oldPath, newPath);
      }
      
      // Remove the old file
      fs.unlinkSync(oldPath);
    } catch (error) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(`Failed to migrate note: ${error.message}`);
      } else {
        vscode.window.showErrorMessage('Failed to migrate note');
      }
    }
  };

  const processDirectory = async (dir: string, baseDir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const oldPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, oldPath);
      const newPath = path.join(newDir, relativePath);
      
      if (entry.isDirectory()) {
        await processDirectory(oldPath, baseDir);
        // Remove empty directory
        if (fs.existsSync(oldPath) && fs.readdirSync(oldPath).length === 0) {
          fs.rmdirSync(oldPath);
        }
      } else if (entry.isFile()) {
        await migrateFile(oldPath, newPath);
      }
    }
  };

  await processDirectory(oldDir, oldDir);
  
  // Remove the old directory if it's empty
  if (fs.existsSync(oldDir) && fs.readdirSync(oldDir).length === 0) {
    fs.rmdirSync(oldDir);
  }
}

// Function to get the notes directory path
function getNotesDirectory(workspaceRoot: string, context: vscode.ExtensionContext): string {
  const config = vscode.workspace.getConfiguration('fileTreeNotes');
  const storageMode = config.get<string>('storageMode') || 'global';
  
  if (storageMode === 'global') {
    const globalNotesPath = config.get<string>('globalNotesPath');
    if (globalNotesPath) {
      // Use user-specified global directory
      return path.join(globalNotesPath, path.basename(workspaceRoot));
    } else {
      // Use VS Code's global storage
      return path.join(context.globalStorageUri.fsPath, 'notes', path.basename(workspaceRoot));
    }
  } else {
    // Use workspace-relative directory
    const workspaceNotesPath = config.get<string>('workspaceNotesPath') || '.notes';
    return path.join(workspaceRoot, workspaceNotesPath);
  }
}

// Function to check if a note exists for the current file
function getNotePath(workspaceRoot: string, relativePath: string, context: vscode.ExtensionContext): string | null {
  const notesDir = getNotesDirectory(workspaceRoot, context);
  const noteFilePath = path.join(notesDir, relativePath + '.md');
  
  return fs.existsSync(noteFilePath) ? noteFilePath : null;
}

// Function to add notes directory to .gitignore
async function addNotesDirToGitignore(workspaceRoot: string, notesDir: string, oldNotesDir?: string): Promise<void> {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const relativeNotesDir = path.relative(workspaceRoot, notesDir);
  const relativeOldNotesDir = oldNotesDir ? path.relative(workspaceRoot, oldNotesDir) : null;

  // Create .gitignore if it doesn't exist
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '');
  }

  // Read current .gitignore content
  const content = fs.readFileSync(gitignorePath, 'utf8');
  let lines = content.split('\n');

  // Remove old notes directory entry if it exists
  if (relativeOldNotesDir) {
    const oldPattern = new RegExp(`^${relativeOldNotesDir}(/|$)`, 'm');
    lines = lines.filter(line => !oldPattern.test(line));
  }

  // Check if new notes directory is already ignored
  const notesDirPattern = new RegExp(`^${relativeNotesDir}(/|$)`, 'm');
  if (notesDirPattern.test(lines.join('\n'))) {
    return; // Already ignored
  }

  // Add new notes directory to .gitignore
  lines.push(relativeNotesDir);
  
  // Write back to .gitignore, removing empty lines
  const newContent = lines.filter(line => line.trim()).join('\n') + '\n';
  fs.writeFileSync(gitignorePath, newContent);
}

// Function to validate notes directory name
async function validateNotesDirectory(name: string, workspaceRoot: string): Promise<string | null> {
  // Check for invalid names
  if (name === '.' || name === '..' || name === '') {
    return 'Notes directory cannot be "." or ".." or empty';
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(name)) {
    return 'Notes directory name contains invalid characters';
  }

  // Check for path separators
  if (name.includes(path.sep)) {
    return 'Notes directory name cannot contain path separators';
  }

  // Check for system directories
  const systemDirs = ['node_modules', '.git', '.vscode', 'bin', 'obj', 'dist', 'build'];
  if (systemDirs.includes(name.toLowerCase())) {
    return 'Notes directory cannot be a system directory';
  }

  // Check if it's an absolute path
  if (path.isAbsolute(name)) {
    return 'Notes directory must be a relative path';
  }

  // Check if it's outside the workspace
  const fullPath = path.join(workspaceRoot, name);
  if (!fullPath.startsWith(workspaceRoot)) {
    return 'Notes directory must be inside the workspace';
  }

  // Check if it's a parent directory of the workspace
  const normalizedName = path.normalize(name);
  if (normalizedName.startsWith('..')) {
    return 'Notes directory cannot be a parent directory';
  }

  // Check if it's the workspace root
  if (path.normalize(fullPath) === path.normalize(workspaceRoot)) {
    return 'Notes directory cannot be the workspace root';
  }

  // Check path length (Windows has a 260 character limit)
  if (fullPath.length > 250) { // Using 250 to leave room for file names
    return 'Notes directory path is too long';
  }

  // Check for case sensitivity issues
  if (fs.existsSync(workspaceRoot)) {
    const entries = fs.readdirSync(workspaceRoot);
    const lowerName = name.toLowerCase();
    const existingDir = entries.find(entry => 
      entry.toLowerCase() === lowerName && 
      fs.statSync(path.join(workspaceRoot, entry)).isDirectory()
    );
    if (existingDir && existingDir !== name) {
      return `A directory with the same name (${existingDir}) already exists. This may cause issues on case-insensitive file systems.`;
    }
  }

  // Check if it's an existing directory that's not our notes directory
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const config = vscode.workspace.getConfiguration('fileTreeNotes');
    const currentNotesDir = config.get<string>('notesDirectory') || '.notes';
    if (name !== currentNotesDir) {
      return 'Notes directory cannot be an existing directory';
    }
  }

  // Check if the directory would contain any workspace files
  const config = vscode.workspace.getConfiguration('fileTreeNotes');
  const notesDirSetting = config.get<string>('notesDirectory') || '.notes';
  // Exclude the notes directory and node_modules from the search
  const excludePattern = `**/{${notesDirSetting},node_modules}/**`;
  const workspaceFiles = await vscode.workspace.findFiles('**/*', excludePattern);
  const normalizedFullPath = path.normalize(fullPath);
  for (const file of workspaceFiles) {
    const filePath = path.normalize(file.fsPath);
    if (filePath.startsWith(normalizedFullPath)) {
      return 'Notes directory cannot contain workspace files';
    }
  }

  return null;
}

// Helper to trigger migration if needed
async function triggerMigrationIfNeeded(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('fileTreeNotes');
  const currentNotesDir = config.get<string>('notesDirectory') || '.notes';
  const lastNotesDir = context.workspaceState.get<string>(LAST_NOTES_DIR_KEY);

  // Validate the new directory name
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const error = await validateNotesDirectory(currentNotesDir, workspaceFolder.uri.fsPath);
    if (error) {
      vscode.window.showErrorMessage(error);
      // Revert to the last valid directory
      await config.update('notesDirectory', lastNotesDir || '.notes', true);
      return;
    }
  }

  if (lastNotesDir && lastNotesDir !== currentNotesDir) {
    if (workspaceFolder) {
      const oldDir = path.join(workspaceFolder.uri.fsPath, lastNotesDir);
      const newDir = path.join(workspaceFolder.uri.fsPath, currentNotesDir);
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Migrating file notes...",
        cancellable: false
      }, async () => {
        try {
          await migrateNotes(oldDir, newDir);
          context.workspaceState.update(LAST_NOTES_DIR_KEY, currentNotesDir);
          
          // Update .gitignore with both old and new paths
          if (isGitRepository(workspaceFolder.uri.fsPath)) {
            await addNotesDirToGitignore(workspaceFolder.uri.fsPath, newDir, oldDir);
          }
        } catch (error) {
          if (error instanceof Error) {
            vscode.window.showErrorMessage(error.message);
          } else {
            vscode.window.showErrorMessage('Failed to migrate notes');
          }
        }
      });
    }
  } else {
    context.workspaceState.update(LAST_NOTES_DIR_KEY, currentNotesDir);
  }
}

// Function to get the source file path from a note path
function getSourceFilePath(notePath: string, workspaceRoot: string, context: vscode.ExtensionContext): string | null {
  const config = vscode.workspace.getConfiguration('fileTreeNotes');
  const storageMode = config.get<string>('storageMode') || 'global';
  const notesDir = getNotesDirectory(workspaceRoot, context);

  // Check if the note is in the notes directory
  if (!notePath.startsWith(notesDir)) {
    console.log('Note is not in notes directory:', { notePath, notesDir });
    return null;
  }

  // Remove the notes directory prefix and .md extension
  const relativePath = path.relative(notesDir, notePath);
  if (!relativePath.endsWith('.md')) {
    console.log('Note does not end with .md:', relativePath);
    return null;
  }

  // Get the project name from the path
  const projectName = path.basename(workspaceRoot);
  
  // If we're in global storage mode, we need to find the workspace that matches this note
  if (storageMode === 'global') {
    // In global storage mode, the path is already relative to the workspace
    const sourcePath = path.join(workspaceRoot, relativePath.slice(0, -3));
    console.log('Global storage path resolution:', {
      notePath,
      notesDir,
      relativePath,
      projectName,
      sourcePath,
      exists: fs.existsSync(sourcePath)
    });
    return fs.existsSync(sourcePath) ? sourcePath : null;
  } else {
    // In workspace mode, the path is already relative to the workspace
    const sourcePath = path.join(workspaceRoot, relativePath.slice(0, -3));
    console.log('Workspace storage path resolution:', {
      notePath,
      notesDir,
      relativePath,
      sourcePath,
      exists: fs.existsSync(sourcePath)
    });
    return fs.existsSync(sourcePath) ? sourcePath : null;
  }
}

// Function to check if a directory is a git repository
function isGitRepository(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.git'));
}

// TreeItem for notes
class NoteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly resourceUri: vscode.Uri,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.resourceUri = resourceUri;
    this.command = command;

    // «id» gives the element a stable identity so TreeView.reveal works.
    this.id = resourceUri.fsPath;

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.contextValue = 'noteFile';
      this.iconPath = new vscode.ThemeIcon('note');
    } else {
      this.contextValue = 'noteFolder';
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

// TreeDataProvider for notes
class NotesTreeDataProvider implements vscode.TreeDataProvider<NoteTreeItem | vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<NoteTreeItem | undefined | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<NoteTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  // Map so we can retrieve an element by its fsPath quickly
  private itemMap = new Map<string, NoteTreeItem>();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this.itemMap.clear();
    this._onDidChangeTreeData.fire();
  }

  /** Find the tree element that represents a given file path */
  getItemByUri(fsPath: string): NoteTreeItem | undefined {
    return this.itemMap.get(fsPath);
  }

  async getChildren(element?: NoteTreeItem): Promise<NoteTreeItem[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const notesDir = getNotesDirectory(workspaceFolder.uri.fsPath, this.context);
    if (!notesDir) {
      return [];
    }

    if (!element) {
      // Root level - show the notes directory
      const rootItem = new NoteTreeItem(
        path.basename(notesDir),
        vscode.Uri.file(notesDir),
        vscode.TreeItemCollapsibleState.Expanded
      );
      this.itemMap.set(notesDir, rootItem);
      return [rootItem];
    }

    const elementPath = element.resourceUri.fsPath;
    if (!elementPath.startsWith(notesDir)) {
      return [];
    }

    try {
      const entries = await fs.promises.readdir(elementPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() || entry.name.endsWith('.md'))
        .map(entry => {
          const fullPath = path.join(elementPath, entry.name);
          const uri = vscode.Uri.file(fullPath);
          const collapsibleState = entry.isDirectory() 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.None;

          let item: NoteTreeItem;
          if (entry.isDirectory()) {
            item = new NoteTreeItem(entry.name, uri, collapsibleState);
          } else {
            item = new NoteTreeItem(
              entry.name,
              uri,
              collapsibleState,
              {
                command: 'file-tree-notes.openNoteFile',
                title: 'Open Note',
                arguments: [uri]
              }
            );
          }

          // Populate the lookup map
          this.itemMap.set(fullPath, item);
          return item;
        })
        .sort((a, b) => {
          // Directories first, then files
          const aIsDir = a.collapsibleState !== vscode.TreeItemCollapsibleState.None;
          const bIsDir = b.collapsibleState !== vscode.TreeItemCollapsibleState.None;
          if (aIsDir !== bIsDir) {
            return aIsDir ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  }

  getParent(element: NoteTreeItem): NoteTreeItem | undefined {
    if (!element.resourceUri) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const notesDir = getNotesDirectory(workspaceFolder.uri.fsPath, this.context);
    if (!notesDir) {
      return undefined;
    }

    const elementPath = element.resourceUri.fsPath;
    if (!elementPath.startsWith(notesDir)) {
      return undefined;
    }

    const parentPath = path.dirname(elementPath);
    if (parentPath === notesDir) {
      return this.itemMap.get(notesDir);
    }

    return this.itemMap.get(parentPath);
  }

  getTreeItem(element: NoteTreeItem | vscode.TreeItem): vscode.TreeItem {
    return element;
  }
}


// Place this class definition before the activate function
class OnboardingWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'fileTreeNotes.onboardingView';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = { 
      enableScripts: true,
      localResourceRoots: []
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'selectLocation') {
        await vscode.commands.executeCommand('file-tree-notes.openNotesDirectorySetting');
      } else if (msg.command === 'createNote') {
        await vscode.commands.executeCommand('file-tree-notes.openNote');
      }
    });
  }

  getHtml(): string {
    return `
      <style>
        body { font-family: var(--vscode-font-family); margin: 0; padding: 24px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
        .container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
        .message { font-size: 1.1em; margin-bottom: 24px; text-align: center; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 8px 24px; font-size: 1em; cursor: pointer; margin-bottom: 12px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .shortcut { font-family: var(--vscode-editor-font-family); background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
      </style>
      <div class="container">
        <div class="message">Ready to start taking notes? Select a file and create your first note!<br>You can customize the storage location later if needed.</div>
        <div style="margin-top: 2px; font-size: 0.98em; color: var(--vscode-descriptionForeground); text-align: center; max-width: 320px;">
          To create a note, select a file, then use the status bar, command palette, or press <span class="shortcut">Cmd+Alt+N</span> (Mac) / <span class="shortcut">Ctrl+Alt+N</span> (Windows/Linux).
        </div>
        <div style="margin-top: 16px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
          <a href="#" onclick="vscode.postMessage({command: 'selectLocation'})">Customize storage location</a>
        </div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
      </script>
    `;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  context.subscriptions.push(statusBarItem);

  // Function to update status bar
  const updateStatusBar = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      statusBarItem.hide();
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      statusBarItem.hide();
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const config = vscode.workspace.getConfiguration('fileTreeNotes');
    const storageMode = config.get<string>('storageMode') || 'global';
    const notesDir = getNotesDirectory(workspaceRoot, context);
    
    // Check if current file is a note
    if (filePath.startsWith(notesDir) && filePath.endsWith('.md')) {
      // We're in a note file, show "Open Source" command
      statusBarItem.command = 'file-tree-notes.toggleNoteSource';
      statusBarItem.text = "$(file-code) Open Source";
      statusBarItem.tooltip = "Open Source File for Current Note";
      statusBarItem.show();
    } else {
      // We're in a source file, show "Open/Create Note" command
      const relativePath = path.relative(workspaceRoot, filePath);
      const notePath = getNotePath(workspaceRoot, relativePath, context);
      statusBarItem.command = 'file-tree-notes.toggleNoteSource';
      if (notePath) {
        statusBarItem.text = "$(note) Open Note";
        statusBarItem.tooltip = "Open Note for Current File";
      } else {
        statusBarItem.text = "$(note) Create Note";
        statusBarItem.tooltip = "Create Note for Current File";
      }
      statusBarItem.show();
    }
  };

  // Update status bar when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );

  // Update status bar when window state changes (e.g., when VS Code becomes active)
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        updateStatusBar();
      }
    })
  );

  // Update status bar when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      updateStatusBar();
    })
  );

  // Check for directory changes and migrate if needed (on activation)
  triggerMigrationIfNeeded(context);

  // Add notes directory to .gitignore if in a git repository
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const workspaceRoot = workspaceFolder.uri.fsPath;
    if (isGitRepository(workspaceRoot)) {
      const config = vscode.workspace.getConfiguration('fileTreeNotes');
      const notesDirSetting = config.get<string>('notesDirectory') || '.notes';
      
      // Validate the directory name
      const error = await validateNotesDirectory(notesDirSetting, workspaceRoot);
      if (error) {
        vscode.window.showErrorMessage(error);
        // Revert to default
        await config.update('notesDirectory', '.notes', true);
        return;
      }

      const notesDir = path.join(workspaceRoot, notesDirSetting);
      addNotesDirToGitignore(workspaceRoot, notesDir).catch(error => {
        vscode.window.showErrorMessage(`Failed to update .gitignore: ${error}`);
      });
    }
  }

  // Listen for config changes and trigger migration if needed
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('fileTreeNotes.notesDirectory')) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const workspaceRoot = workspaceFolder.uri.fsPath;
          const config = vscode.workspace.getConfiguration('fileTreeNotes');
          const notesDirSetting = config.get<string>('notesDirectory') || '.notes';
          
          // Validate the directory name
          const error = await validateNotesDirectory(notesDirSetting, workspaceRoot);
          if (error) {
            vscode.window.showErrorMessage(error);
            // Revert to the last valid directory
            const lastNotesDir = context.workspaceState.get<string>(LAST_NOTES_DIR_KEY);
            await config.update('notesDirectory', lastNotesDir || '.notes', true);
            return;
          }

          if (isGitRepository(workspaceRoot)) {
            const notesDir = path.join(workspaceRoot, notesDirSetting);
            const lastNotesDir = context.workspaceState.get<string>(LAST_NOTES_DIR_KEY);
            const oldNotesDir = lastNotesDir ? path.join(workspaceRoot, lastNotesDir) : undefined;
            
            addNotesDirToGitignore(workspaceRoot, notesDir, oldNotesDir).catch(error => {
              vscode.window.showErrorMessage(`Failed to update .gitignore: ${error}`);
            });
          }
        }
        triggerMigrationIfNeeded(context);
      }
    })
  );

  const disposable = vscode.commands.registerCommand('file-tree-notes.openNote', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file to attach a note to.');
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('File is not in a workspace folder.');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(workspaceRoot, filePath);

    const config = vscode.workspace.getConfiguration('fileTreeNotes');
    const openInSplitView = config.get<boolean>('openInSplitView', true);
    const notesDir = getNotesDirectory(workspaceRoot, context);
    const noteFilePath = path.join(notesDir, relativePath + '.md');

    // Ensure the folder exists
    const noteFolder = path.dirname(noteFilePath);
    if (!fs.existsSync(noteFolder)) {
      fs.mkdirSync(noteFolder, { recursive: true });
    }

    // Create the note if it doesn't exist
    let created = false;
    let noteUri: vscode.Uri | undefined;
    if (!fs.existsSync(noteFilePath)) {
      fs.writeFileSync(noteFilePath, `# Notes for ${relativePath}\n\n`);
      created = true;
      noteUri = vscode.Uri.file(noteFilePath);
      // Use fs to write and then trigger a manual refresh of the tree view
      setTimeout(() => {
        vscode.commands.executeCommand('fileTreeNotes.notesView.refresh');
        // Force a refresh of the activity bar to switch views
        updateSidebarContext();
      }, 100);
    } else {
      noteUri = vscode.Uri.file(noteFilePath);
    }

    // Check if note is already open in any visible editor
    const alreadyOpen = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === noteFilePath);
    if (alreadyOpen) {
      await vscode.window.showTextDocument(alreadyOpen.document, alreadyOpen.viewColumn, false);
    } else {
      const doc = await vscode.workspace.openTextDocument(noteUri);
      vscode.window.showTextDocument(doc, openInSplitView ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);
    }
    if (created) {
      vscode.window.showInformationMessage(`Note file created: ${path.relative(workspaceRoot, noteFilePath)}`);
    }
    // Update status bar after opening/creating note
    updateStatusBar();
  });

  context.subscriptions.push(disposable);
  
  // Register command to open source file from note
  const openSourceFileDisposable = vscode.commands.registerCommand('file-tree-notes.openSourceFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active note file.');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('Note is not in a workspace folder.');
      return;
    }

    const notePath = editor.document.uri.fsPath;
    const sourcePath = getSourceFilePath(notePath, workspaceFolder.uri.fsPath, context);
    if (!sourcePath) {
      vscode.window.showErrorMessage('Could not find the corresponding source file for this note.');
      return;
    }

    const config = vscode.workspace.getConfiguration('fileTreeNotes');
    const openInSplitView = config.get<boolean>('openInSplitView', true);

    // Check if source file is already open in any visible editor
    const alreadyOpen = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === sourcePath);
    if (alreadyOpen) {
      await vscode.window.showTextDocument(alreadyOpen.document, alreadyOpen.viewColumn, false);
    } else {
      const sourceUri = vscode.Uri.file(sourcePath);
      const doc = await vscode.workspace.openTextDocument(sourceUri);
      vscode.window.showTextDocument(doc, openInSplitView ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);
    }
  });

  context.subscriptions.push(openSourceFileDisposable);

  // Register native tree view for notes
  const notesTreeDataProvider = new NotesTreeDataProvider(context);
  const notesTreeView = vscode.window.createTreeView('fileTreeNotes.notesView', { 
    treeDataProvider: notesTreeDataProvider,
    showCollapseAll: true
  });

  /** Helper: reveal a note file in the tree (no-op if not present) */
  const revealInNotesTree = async (fsPath: string) => {
    const element = notesTreeDataProvider.getItemByUri(fsPath);
    if (element) {
      try {
        await notesTreeView.reveal(element, { select: true, focus: false, expand: true });
      } catch {
        /* element might not be visible / expanded yet – ignore */
      }
    }
  };

  // Highlight the note whenever the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!editor) { return; }
      const uri = editor.document.uri;
      if (uri.scheme !== 'file') { return; }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) { return; }
      const notesDir = getNotesDirectory(workspaceFolder.uri.fsPath, context);

      if (uri.fsPath.startsWith(notesDir) && uri.fsPath.endsWith('.md')) {
        revealInNotesTree(uri.fsPath);
      }
    })
  );

  // Register command to toggle between note and source
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.toggleNoteSource', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file.');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('File is not in a workspace folder.');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const config = vscode.workspace.getConfiguration('fileTreeNotes');
      const storageMode = config.get<string>('storageMode') || 'global';
      const notesDir = getNotesDirectory(workspaceRoot, context);
      const openInSplitView = config.get<boolean>('openInSplitView') ?? true;

      // Check if we're in a note file
      if (filePath.startsWith(notesDir) && filePath.endsWith('.md')) {
        // We're in a note file, find and open the source file
        const sourcePath = await getSourceFilePath(filePath, workspaceRoot, context);
        if (!sourcePath) {
          vscode.window.showWarningMessage('Could not find source file for this note.');
          return;
        }

        // Check if the source file is already open in any editor
        const sourceUri = vscode.Uri.file(sourcePath);
        const existingEditor = vscode.window.visibleTextEditors.find(
          e => e.document.uri.fsPath === sourcePath
        );

        let targetEditor;
        if (existingEditor) {
          // If file is already open, just focus it
          targetEditor = existingEditor;
          await vscode.window.showTextDocument(existingEditor.document, existingEditor.viewColumn);
        } else {
          // If file is not open, open it in split view if enabled
          const options: vscode.TextDocumentShowOptions = {
            preview: false,
            preserveFocus: false
          };
          if (openInSplitView) {
            options.viewColumn = vscode.ViewColumn.Beside;
          }
          targetEditor = await vscode.window.showTextDocument(sourceUri, options);
        }

        // Focus the explorer view and reveal the file, then focus back on the editor
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('revealInExplorer', sourceUri);
        await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn);
      } else {
        // We're in a source file, find or create the note
        const relativePath = path.relative(workspaceRoot, filePath);
        const notePath = getNotePath(workspaceRoot, relativePath, context);
        if (!notePath) {
          // Note doesn't exist, create it
          await vscode.commands.executeCommand('file-tree-notes.openNote');
          return;
        }
        const noteUri = vscode.Uri.file(notePath);

        // Check if the note is already open in any editor
        const existingEditor = vscode.window.visibleTextEditors.find(
          e => e.document.uri.fsPath === notePath
        );

        let targetEditor;
        if (existingEditor) {
          // If note is already open, just focus it
          targetEditor = existingEditor;
          await vscode.window.showTextDocument(existingEditor.document, existingEditor.viewColumn);
        } else {
          // If note is not open, open it in split view if enabled
          const options: vscode.TextDocumentShowOptions = {
            preview: false,
            preserveFocus: false
          };
          if (openInSplitView) {
            options.viewColumn = vscode.ViewColumn.Beside;
          }
          targetEditor = await vscode.window.showTextDocument(noteUri, options);
        }

        // Focus the File Tree Notes view
        await vscode.commands.executeCommand('fileTreeNotes.notesView.focus');
        // Wait a bit for the view to focus
        await new Promise(resolve => setTimeout(resolve, 100));
        // Refresh the tree view to ensure it's up to date
        await vscode.commands.executeCommand('fileTreeNotes.notesView.refresh');
        // Reveal the note in the tree
        await revealInNotesTree(notePath);
        // Focus back on the editor
        await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn);
      }
    })
  );

  // Register a command to allow manual refresh from code
  context.subscriptions.push(
    vscode.commands.registerCommand('fileTreeNotes.notesView.refresh', () => {
      notesTreeDataProvider.refresh();
    })
  );

  // Refresh tree when notes are saved or deleted
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.md')) {
        notesTreeDataProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles((e) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }
      const config = vscode.workspace.getConfiguration('fileTreeNotes');
      const notesDirSetting = config.get<string>('notesDirectory') || '.notes';
      const notesDir = path.join(workspaceFolder.uri.fsPath, notesDirSetting);
      let shouldRefresh = false;
      for (const file of e.files) {
        // Check if the deleted file or folder is inside the notes directory
        if (file.fsPath.startsWith(notesDir + path.sep)) {
          shouldRefresh = true;
          break;
        }
      }
      if (shouldRefresh) {
        notesTreeDataProvider.refresh();
      }
    })
  );

  // Register command to open note file from tree
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.openNoteFile', async (uri: vscode.Uri) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    })
  );

  // Context key logic to toggle between onboarding and tree view
  const updateSidebarContext = () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const config = vscode.workspace.getConfiguration('fileTreeNotes');
    const storageMode = config.get<string>('storageMode') || 'global';
    
    let hasNotes = false;
    if (workspaceFolder) {
      const notesDir = getNotesDirectory(workspaceFolder.uri.fsPath, context);
      if (fs.existsSync(notesDir)) {
        const entries = fs.readdirSync(notesDir, { withFileTypes: true });
        hasNotes = entries.some(e => e.isFile() && e.name.endsWith('.md')) || 
                   entries.some(e => e.isDirectory());
      }
    }
    
    const shouldShowOnboarding = !workspaceFolder || !hasNotes;
    
    // Set the context key and force a refresh
    vscode.commands.executeCommand('setContext', 'fileTreeNotes.showOnboarding', shouldShowOnboarding).then(() => {
      // Force a refresh of both views
      vscode.commands.executeCommand('fileTreeNotes.notesView.refresh');
      if (shouldShowOnboarding) {
        vscode.commands.executeCommand('fileTreeNotes.onboardingView.refresh');
      }
    });
  };

  // Call on activation and on relevant events
  updateSidebarContext();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(updateSidebarContext));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateSidebarContext));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(updateSidebarContext));
  context.subscriptions.push(vscode.workspace.onDidDeleteFiles(updateSidebarContext));

  // Initial status bar update
  updateStatusBar();

  // Add a command to switch storage modes
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.switchStorageMode', async () => {
      const config = vscode.workspace.getConfiguration('fileTreeNotes');
      const currentMode = config.get<string>('storageMode') || 'global';
      const newMode = currentMode === 'global' ? 'workspace' : 'global';
      
      const result = await vscode.window.showQuickPick(
        [
          {
            label: 'Switch to Global Storage',
            description: 'Store all notes in a central location',
            mode: 'global'
          },
          {
            label: 'Switch to Workspace Storage',
            description: 'Store notes in each project',
            mode: 'workspace'
          }
        ],
        {
          placeHolder: 'Select where to store your notes'
        }
      );

      if (result) {
        await config.update('storageMode', result.mode, true);
        
        if (result.mode === 'global') {
          const customPath = await vscode.window.showInputBox({
            prompt: 'Enter a custom path for global notes (leave empty to use VS Code\'s storage)',
            placeHolder: 'e.g., ~/Documents/fileTreeNotes'
          });
          
          if (customPath !== undefined) {
            await config.update('globalNotesPath', customPath, true);
          }
        }
        
        vscode.window.showInformationMessage(`Notes will now be stored ${result.mode === 'global' ? 'globally' : 'in each workspace'}`);
        updateSidebarContext();
      }
    })
  );

  // Add the command to the command palette
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.openStorageSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'fileTreeNotes.storageMode');
    })
  );

  // Register command to delete a note
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.deleteNote', async (item: NoteTreeItem) => {
      if (!item.resourceUri) {
        return;
      }

      const notePath = item.resourceUri.fsPath;
      const result = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the note "${item.label}"?`,
        { modal: true },
        'Delete'
      );

      if (result === 'Delete') {
        try {
          fs.unlinkSync(notePath);
          notesTreeDataProvider.refresh();
          updateSidebarContext();
          vscode.window.showInformationMessage(`Note "${item.label}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete note: ${error}`);
        }
      }
    })
  );

  // Register command to delete a folder
  context.subscriptions.push(
    vscode.commands.registerCommand('file-tree-notes.deleteFolder', async (item: NoteTreeItem) => {
      if (!item.resourceUri) {
        return;
      }

      const folderPath = item.resourceUri.fsPath;
      const result = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the folder "${item.label}" and all its contents?`,
        { modal: true },
        'Delete'
      );

      if (result === 'Delete') {
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          notesTreeDataProvider.refresh();
          updateSidebarContext();
          vscode.window.showInformationMessage(`Folder "${item.label}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete folder: ${error}`);
        }
      }
    })
  );

  // Set up file system watcher for notes directory
  let notesWatcher: vscode.FileSystemWatcher | undefined;
  const setupNotesWatcher = () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const notesDir = getNotesDirectory(workspaceFolder.uri.fsPath, context);
    if (!notesDir) {
      return;
    }

    // Dispose of existing watcher if any
    notesWatcher?.dispose();

    // Create new watcher
    notesWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, path.join(path.relative(workspaceFolder.uri.fsPath, notesDir), '**/*.md'))
    );

    // Update tree view when files change
    notesWatcher.onDidChange(() => notesTreeDataProvider.refresh());
    notesWatcher.onDidCreate(() => notesTreeDataProvider.refresh());
    notesWatcher.onDidDelete(() => notesTreeDataProvider.refresh());
  };

  // Set up initial watcher
  setupNotesWatcher();

  // Update watcher when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      setupNotesWatcher();
    })
  );

  // Update watcher when storage mode changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('fileTreeNotes.storageMode')) {
        setupNotesWatcher();
      }
    })
  );
}

export function deactivate() {}
