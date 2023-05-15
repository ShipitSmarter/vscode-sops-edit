# SOPS easy edit

![SOPS edit use gif](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/sops_edit_use_gif.gif)

![Decrypt Encrypt use gif](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/decrypt_encrypt_use_gif.gif)

Once you have [SOPS](https://github.com/mozilla/sops) setup for your [GIT](https://git-scm.com/) project, it can be a pain in the behind trying to not forget decrypting SOPS encrypted files before editing, and encrypting them again before committing.

This extension makes sure you don't have to think about that anymore. It will allow you to only see and edit decrypted files, but only save and commit the encrypted versions.

## But How?

This extension is built to facilitate the following:
- Easy update of [SOPS](https://github.com/mozilla/sops) encrypted files, without the need to manually decrypt/encrypt
- Ensuring no decrypted files accidentally are either _committed_ OR _left on disk_

It does so by doing the following:
- Whenever you try to open a SOPS encrypted file `*`, the extension does the following:
  - The encrypted file is immediately closed
  - The file is decrypted to a `[filename].tmp.[extension]` copy, which is opened instead
- Updating the `tmp` file will result in an updated, original SOPS encrypted file
- Closing the `tmp` file will automatically delete the `tmp` file as well, making sure decrypted data never stays on disk and is never accidentally committed

`*` I.e., any file that satisfies any of the combinations of `.sops.yaml` file paths and their `path_regex` conditions.

**NOTE**: It is still possible to edit the SOPS encrypted file directly, if desired, by right-mouse-clicking the encrypted file in the left explorer bar, and selecting `SOPS: edit directly`.

## Requirements
- You need [SOPS](https://github.com/mozilla/sops) installed and configured, including:
  - setting up the authentication with desired encryption services
  - configuration of `.sops.yaml` files

## Recommendations
- It is highly recommended to add the pattern for the `tmp` files (`**/*.tmp.[extension]`) to your `.gitignore` file, to ensure a decrypted file is *never ever* committed.

## Contributions

### Event listeners
This extension adds the following event listeners:
- Checks for every opened text document if it is a SOPS encrypted file, and if so, applies logic as explained in [But How?](#but-how).
- Checks for every saved document if it is a decrypted TMP file, and if so, saves and encrypts changes to original SOPS encrypted file.
- Checks for every closed document if it is a decrypted TMP file, and if so, deletes it.
- Check if the currently active text editor is a SOPS encrypted file, and if so, adds `Decrypt` and `Encrypt` buttons to its top-right editor menu.

### Editor menu buttons

![Decrypt encrypt](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/editor_decrypt_encrypt.png)

This extension adds the following buttons to the top-right editor menu of every SOPS encrypted or *encryptable* file `*`:
- `Decrypt`
  - Decrypts the file in-place
  - Only shown when file is SOPS encrypted
- `Encrypt`
  - Encrypts the file in-place
  - Only shown when file is *encryptable* but not actually encrypted


`*` I.e., any file that satisfies any of the combinations of `.sops.yaml` file paths and their `path_regex` conditions.
### Right-mouse buttons

![Right-mouse-menu](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/sops_edit_directly.png)

This extension adds the following right-mouse-menu button to any `yaml`/`yml`/`json`/`env`/`ini`/`txt` file:

-  `SOPS: edit directly`
   - Allows you to see and edit the SOPS encrypted file directly, without the extension closing it immediately (which is the new 'normal' behaviour).

### Settings 

![Settings](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/settings.png)

This extension adds the following settings:

- `Temp File Pre Extension`
  - Allows you to change the default `tmp` pre-extension to something different
- `Only Use Buttons`
  - Allows you to not get the auto-decrypt and encrypt behaviour, but only use the decrypt/encrypt buttons instead

## Limitations
This extension has the following limitations:
- Only SOPS config files named `.sops.yaml` are taken into account
- The `SOPS: edit directly` button is only available to `yaml`/`yml`/`json`/`env`/`ini`/`txt` files. Other SOPS encrypted files are rendered impossible to be edited directly by installing this extension.
- SOPS encryption is only checked for files smaller than **1MB**

This extension does NOT do or help with any of the following:
- Installation of SOPS
- Login or authentication with encryption services
- Configuration of `.sops.yaml` files

## Dependencies
This extension happily makes use of the following outstanding `npm` packages:
- [NodeJs](https://nodejs.org/en/)'s:
  - [File System API](https://nodejs.org/api/fs.html)
  - [Child process](https://nodejs.org/api/child_process.html)
- [eemeli](https://www.npmjs.com/~eemeli)'s excellent [yaml](https://www.npmjs.com/package/yaml) package