# SOPS easy edit

[![](https://vsmarketplacebadge.apphb.com/version-short/shipitsmarter.sops-edit.svg)](https://marketplace.visualstudio.com/items?itemName=shipitsmarter.sops-edit)
[![](https://vsmarketplacebadge.apphb.com/installs-short/shipitsmarter.sops-edit.svg)](https://marketplace.visualstudio.com/items?itemName=shipitsmarter.sops-edit)
[![](https://vsmarketplacebadge.apphb.com/rating-short/shipitsmarter.sops-edit.svg)](https://marketplace.visualstudio.com/items?itemName=shipitsmarter.sops-edit)

![SOPS edit use gif](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/sops_edit_use_gif.gif)

Once you have [SOPS](https://github.com/mozilla/sops) setup for your [GIT](https://git-scm.com/) project, it can be a pain in the behind trying to not forget decrypting SOPS encrypted files before editing, and encrypting them again before committing.

This extension makes sure you don't have to think about that anymore. It will allow you to only see and edit decrypted files, but only save and commit the encrypted versions.

## But How?

This extension is built to facilitate the following:
- Easy update of [SOPS](https://github.com/mozilla/sops) encrypted files, without the need to manually decrypt/encrypt
- Ensuring no decrypted files accidentally are either _committed_ OR _left on disk_

It does so by doing the following:
- Whenever you try to open a SOPS encrypted file `*`, it immediately closes it, creates a decrypted `tmp` file, and opens that instead
- Updating the `tmp` file will result in an updated, original SOPS encrypted file
- Closing the `tmp` file will automatically delete the `tmp` file as well, making sure decrypted data never stays on disk and is never accidentally committed
- It is still possible to edit the SOPS encrypted file directly, if desired, by right-mouse-clicking the encrypted file in the left explorer bar, and selecting `SOPS: edit directly`

`*` I.e., any file that satisfies any of the combinations of `.sops.yaml` file paths and their `path_regex` conditions.

## Requirements
- You need [SOPS](https://github.com/mozilla/sops) installed
  - You also need to take care of setting up the authentication etc yourself

## Contributions

### Right-mouse-button `SOPS: edit directly`

![SOPS edit directly](https://raw.githubusercontent.com/shipitsmarter/vscode-sops-edit/main/img/sops_edit_directly.png)

This extension adds right-mouse-menu button `SOPS: edit directly` to any `yaml`/`json`/`env`/`ini`/`txt` file (even when not SOPS encrypted).

It allows you to see and edit the SOPS encrypted file directly, without the extension closing it immediately (which is the new 'normal' behaviour).

## Limitations
This extension has the following limitations:
- Only SOPS config files named `.sops.yaml` are taken into account
- The `SOPS: edit directly` button is only available to `yaml`/`json`/`env`/`ini`/`txt` files. Other SOPS encrypted files are rendered impossible to be edited directly by installing this extension.

## Dependencies
This extension happily makes use of the following outstanding `npm` packages:
- [NodeJs](https://nodejs.org/en/)'s [File System API](https://nodejs.org/api/fs.html)
- [eemeli](https://www.npmjs.com/~eemeli)'s excellent [YAML](https://www.npmjs.com/package/yaml) package
- [Path](https://www.npmjs.com/package/path)