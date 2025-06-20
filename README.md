# File Tree Notes

A VS Code extension that allows you to create and manage notes for your files. Each note is stored as a Markdown file and can be easily accessed from the source file.

## Features

- Create and manage notes for any file in your workspace
- Notes are stored as Markdown files for easy editing and version control
- Quick access to notes through the status bar
- Toggle between source files and their notes with a single click or keyboard shortcut
- Support for both global and workspace-local note storage
- Automatic .gitignore integration for notes directory
- Tree view for browsing and managing notes

## Usage

### Switching Between Notes and Source Files

There are several ways to switch between a file and its corresponding note:

1. **Status Bar**: Click the "Create Note" or "Open Note" button in the status bar
2. **Command Palette**: Use the "File Tree Notes: Toggle between Note and Source" command
3. **Keyboard Shortcut**: 
   - Windows/Linux: `Ctrl+Alt+N`
   - Mac: `Cmd+Alt+N`
   
The extension will automatically focus the appropriate view when opening a note. You can configure whether notes open in the full editor view (default) or in a split view by changing the `fileNotes.openInSplitView` setting.

### Using with GitHub Copilot

File Tree Notes works great with GitHub Copilot! Here's a tip for maximizing your productivity:

1. Open both your source file and its corresponding note file
2. Ask Copilot to analyze your code and generate notes based on what your source file is doing
3. Try prompts like:
   - "Generate documentation for this code"
   - "Explain the key functions in this file"
   - "Create notes about the architecture of this module"
   - "Document the API endpoints in this file"

Copilot can see both files in your context and can help create meaningful notes without you having to write everything from scratch.

### Storage Options

The extension supports two storage modes for notes:

1. **Global Storage** (default):
   - Notes are stored in a central location
   - All workspaces can access their notes from one place
   - You can specify a custom global storage path

2. **Workspace Storage**:
   - Notes are stored in a `.notes` directory within each workspace
   - Each workspace has its own isolated notes
   - Notes are automatically added to .gitignore

To switch storage modes:
1. Open the Command Palette
2. Use "File Tree Notes: Switch Notes Storage Mode"
3. Choose between global and workspace storage

### Configuration

The extension can be configured through VS Code settings:

- `fileNotes.storageMode`: Choose between 'global' and 'workspace' storage
- `fileNotes.globalNotesPath`: Custom path for global storage
- `fileNotes.workspaceNotesPath`: Custom path for workspace storage (default: '.notes')
- `fileNotes.openInSplitView`: Open notes in a split view (default: false)