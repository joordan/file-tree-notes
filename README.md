# File Tree Notes

A VS Code extension that allows you to create and manage notes for your files. Each note is stored as a Markdown file and can be easily accessed from the source file.

## Features

- Create and manage notes for any file in your workspace
- Notes are stored as Markdown files for easy editing and version control
- Quick access to notes through the status bar
- Toggle between source files and their notes with a single click or keyboard shortcut
- Support for both workspace-local and global note storage
- Automatic .gitignore integration for notes directory
- Tree view for browsing and managing notes
- Onboarding experience for first-time users

## Usage

### Creating and Opening Notes

There are several ways to create or open a note for a file:

1. **Status Bar**: Click the "Create Note" or "Open Note" button in the status bar
2. **Command Palette**: Use the "File Tree Notes: Toggle between Note and Source" command
3. **Keyboard Shortcut**: 
   - Windows/Linux: `Ctrl+Alt+N`
   - Mac: `Cmd+Alt+N`

### Switching Between Notes and Source Files

You can easily switch between a file and its corresponding note:

1. **Status Bar**: Click the "Open Source" button when in a note, or "Open Note" when in a source file
2. **Command Palette**: Use the "File Tree Notes: Toggle between Note and Source" command
3. **Keyboard Shortcut**: 
   - Windows/Linux: `Ctrl+Alt+N`
   - Mac: `Cmd+Alt+N`

The extension will automatically focus the appropriate view:
- When opening a note, it focuses the File Tree Notes view
- When opening a source file, it focuses the Explorer view and reveals the file

### Storage Options

The extension supports two storage modes for notes:

1. **Workspace Storage** (default):
   - Notes are stored in a `.notes` directory within each workspace
   - Each workspace has its own isolated notes
   - Notes are automatically added to .gitignore

2. **Global Storage**:
   - Notes are stored in a central location
   - All workspaces can access their notes from one place
   - You can specify a custom global storage path

To switch storage modes:
1. Open the Command Palette
2. Use "File Tree Notes: Switch Notes Storage Mode"
3. Choose between global and workspace storage

### Views

1. **Onboarding View**:
   - Shown when no notes exist
   - Provides quick access to storage settings
   - Guides new users through the setup process

2. **Tree View**: 
   - Access through the File Tree Notes view in the activity bar
   - Browse all notes in the current workspace
   - Open notes directly from the tree



### Configuration

The extension can be configured through VS Code settings:

- `fileNotes.storageMode`: Choose between 'global' and 'workspace' storage
- `fileNotes.globalNotesPath`: Custom path for global storage
- `fileNotes.workspaceNotesPath`: Custom path for workspace storage (default: '.notes')
- `fileNotes.openInSplitView`: Open notes in a split view (default: false)

## Release Notes

### 0.0.1

Initial release of File Tree Notes:
- Basic note creation and management
- Workspace-local storage
- Status bar integration
- Tree view for browsing notes

### 0.0.2

Added features:
- Global storage support
- Storage mode switching
- Improved view focusing
- Keyboard shortcuts
- Onboarding experience
- Automatic .gitignore integration