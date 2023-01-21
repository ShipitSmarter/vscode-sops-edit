# Change Log

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