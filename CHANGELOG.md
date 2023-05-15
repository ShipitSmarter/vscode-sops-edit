# Change Log

## 0.0.10
- Fixed issue [#10](https://github.com/ShipitSmarter/vscode-sops-edit/issues/13) where extension would not work properly for Windows users

## 0.0.9
- Fixed `Decrypt` and `Encrypt` button logic for multi document files
- Force upgrade of vscode editor and dependencies

## 0.0.8
- Updated `Decrypt` and `Encrypt` button logic
  - Editor will only show `Decrypt` button if file is encrypted, and `Encrypt` when matching `.sops.yaml` regexes but not encrypted
  - Editor will not show `Decrypt` or `Encrypt` buttons when it's showing a GIT diff

## 0.0.7
- Extension will no longer close the editor tab when it's showing a GIT diff (solving [#7](https://github.com/ShipitSmarter/vscode-sops-edit/issues/7))

## 0.0.6
- Extension will try to parse files that match the `.sops.yaml` regexes as `yaml`/`json`, and only consider as encrypted if parseable *and* contains `sops` property (solving [#5](https://github.com/ShipitSmarter/vscode-sops-edit/issues/5))

## 0.0.5
- Removed right-mouse-menu `decrypt in-place`, `encrypt in-place` buttons
- Added top-right editor menu buttons `Decrypt` and `Encrypt` to all SOPS encrypted files

## 0.0.4
- Removed terminal use, instead using `child_process` package to handle shell commands
- Now shows a nice vscode-native Error message when decryption/encryption cannot happen for some reason
- Added `decrypt in-place` and `encrypt in-place` right-mouse-menu buttons
- Added setting `Only Use Buttons`

## 0.0.3
- Bugfixes
  - No longer multiple encryption/decryption terminals opening for a single file
  - When editing an encrypted file directly, closing it and then opening again 'normally', it now opens the decrypted TMP version again
- Efficiency
  - One central encryption terminal for all TMP files
  - Every eventlistener added exactly once
    - And now nicely disposed
- Backend
  - Heavy refactoring

## 0.0.2
Initial release