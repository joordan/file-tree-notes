# Change Log

All notable changes to the "File Tree Notes" extension will be documented in this file.

## [0.0.14] - 2024-06-09
### Added
- Right-click context menu support in the editor: you can now Create/Open Note or Open Source File directly from the editor context menu.

## [0.0.6] - 2025-06-12
### 
- Fixed: .notes directory is now only added to .gitignore when using workspace storage mode, not global mode.

## [0.0.5] - 2024-03-19

### Removed
- Removed onboarding view and related functionality for simplicity

## [0.0.4] - 2024-03-19

### Fixed
- Improved tree view selection and focus behavior when switching between source files and notes
- Added proper file highlighting in the tree view when opening notes
- Fixed tree view refresh command not found error

## [0.0.3] - 2024-03-19

### Added
- Added onboarding view when no notes exist
- Added support for global storage mode
- Added dynamic view title based on workspace folder name

### Changed
- Changed default notes directory to `.notes`
- Improved tree view organization and navigation

## [0.0.2] - 2024-03-19

### Added
- Added support for nested note directories
- Added automatic directory creation
- Added Git integration for notes directory

### Changed
- Improved error handling and user feedback
- Enhanced tree view performance

## [0.0.1] - 2024-03-19

### Added
- Initial release
- Basic note creation and management
- Tree view for notes
- Toggle between source and note files