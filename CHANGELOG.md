# Change Log

All notable changes to the "File Tree Notes" extension will be documented in this file.

## [0.0.16] - 2025-08-20
### Added
- **Auto-close notes feature**: Automatically close saved notes when switching to source files
- Toggle command for auto-close feature (`file-tree-notes.toggleAutoCloseNotes`)
- Keyboard shortcut for toggling auto-close (Ctrl+Alt+C / Cmd+Alt+C)
- Configuration setting `fileTreeNotes.autoCloseNotes` (enabled by default)
- Smart detection: only closes notes that are saved (unsaved changes are preserved)

### Changed
- Improved note-to-source switching logic for better reliability
- Enhanced user experience with automatic workspace cleanup

## [0.0.15] - 2025-07-12
### Added
- Add split view to context menu.

## [0.0.14] - 2025-06-12
### Added
- Right-click context menu support in the editor: you can now Create/Open Note or Open Source File directly from the editor context menu.

## [0.0.6] 
### 
- Fixed: .notes directory is now only added to .gitignore when using workspace storage mode, not global mode.

## [0.0.5] 

### Removed
- Removed onboarding view and related functionality for simplicity

## [0.0.4] 

### Fixed
- Improved tree view selection and focus behavior when switching between source files and notes
- Added proper file highlighting in the tree view when opening notes
- Fixed tree view refresh command not found error

## [0.0.3] 

### Added
- Added onboarding view when no notes exist
- Added support for global storage mode
- Added dynamic view title based on workspace folder name

### Changed
- Changed default notes directory to `.notes`
- Improved tree view organization and navigation

## [0.0.2] 

### Added
- Added support for nested note directories
- Added automatic directory creation
- Added Git integration for notes directory

### Changed
- Improved error handling and user feedback
- Enhanced tree view performance

## [0.0.1] 

### Added
- Initial release
- Basic note creation and management
- Tree view for notes
- Toggle between source and note files