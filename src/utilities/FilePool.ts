import * as fs from "fs";
import * as vscode from "vscode";
import * as c from "./constants";
import * as f from "./functions";

type ExtendedTempFile = {
	filePath: string,
	terminal: vscode.Terminal,
	content: string
};

export class FilePool {
    // pool of excluded file paths, existing of:
    //   - TMP files created by this extension
    //   - SOPS-encrypted files marked for direct editing
    public excludedFilePaths: string[];
    
    // pool of open TMP file details, each item containing:
	//  - temp file path
	//  - temp file content (to track file changes)
	//  - encryption terminal
    public tempFiles: ExtendedTempFile[];

    public constructor() {
        this.excludedFilePaths = [];
        this.tempFiles = [];
    }

    public async openTextDocumentListener(textDocument:vscode.TextDocument) : Promise<void> {
        // on open document: if it is a sops encrypted file: close and open a decrypted copy instead
        let encryptedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
    
        // only apply if this is a non-excluded sops encrypted file (and not a .git copy)
        let isSopsEncrypted: boolean = await f.isSopsEncrypted(encryptedFile);
        let isExcluded: boolean = this.excludedFilePaths.includes(encryptedFile.path);
        if (!isSopsEncrypted || isExcluded ) {
            return;
        }
    
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        await this._editDecryptedTmpCopy(encryptedFile);
    }
    
    public async closeTextDocumentListener(textDocument:vscode.TextDocument) : Promise<void> {
        // on close document: 
        // 	- remove document from excluded files (if present)
        // 	- if it is a tmp version of SOPS encrypted file: remove entry, close terminal, delete
        let closedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
        this._removeExcludedPathsEntry(closedFile.path);
        this._removeTempFilesEntryAndDelete(closedFile);
    }
    
    public async saveTextDocumentListener(textDocument:vscode.TextDocument) : Promise<void> {
        // on save document: save and encrypt when it is a tmp file
        let savedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
        let content = textDocument.getText().trim();
        this._copyEncryptSaveContentsIfTempFile(savedFile, content);
    }

    public editDirectly(files:vscode.Uri[]) : void {
        // show error message if no files selected
        if (files.length === 0) {
            vscode.window.showErrorMessage('Cannot edit file directly: no file selected');
        } else {
            // add to excluded files and open
            let directEditFile = files[0];
            this.excludedFilePaths.push(directEditFile.path);
            f.openFile(directEditFile);
        }
    }

    private async _editDecryptedTmpCopy(encryptedFile: vscode.Uri) : Promise<void> {
        let tempFile = f.getTempUri(encryptedFile);
    
        let index = this._getTempFileIndex(tempFile);
        if (index !== -1) {
            return;
        }

        this._addTempFilesEntry(tempFile);
        this.excludedFilePaths.push(tempFile.path);
        await f.decryptWithProgressBar(encryptedFile, tempFile);

        // update tempFiles entry with file content
        this.tempFiles[this._getTempFileIndex(tempFile)].content = fs.readFileSync(tempFile.fsPath,'utf-8');

        await f.openFile(tempFile);
    }

    private _addTempFilesEntry(tempFile: vscode.Uri) : void {
        let index = this._getTempFileIndex(tempFile);
        if (index !== -1) {
            return;
        }

        let terminal = vscode.window.createTerminal({name: c.terminalEncryptName, cwd: f.getParentUri(tempFile).fsPath});
        this.tempFiles.push({
            terminal:terminal, 
            filePath:tempFile.path, 
            content: ''
        });
    }

    private _removeTempFilesEntryAndDelete(tempFile:vscode.Uri) : void {
        let index = this._getTempFileIndex(tempFile);
        if (index === -1) {
            return;
        }

        let terminal = this.tempFiles[index].terminal;
        f.executeInTerminal(['exit'],terminal);
        this.tempFiles.splice(index,1);
        fs.unlinkSync(tempFile.fsPath);
    }

    private _removeExcludedPathsEntry(path:string) {
        if (this.excludedFilePaths.includes(path)) {
            this.excludedFilePaths.splice(this.excludedFilePaths.indexOf(path),1);
        }
    }

    private _copyEncryptSaveContentsIfTempFile(tempFile:vscode.Uri, tempFileContent: string) : void {
        let index = this._getTempFileIndex(tempFile);
        if (index !== -1 && this.tempFiles[index].content !== tempFileContent) {
            this.tempFiles[index].content = tempFileContent;
            f.copyEncrypt(tempFile,this.tempFiles[index].terminal);
        }
    }

    private _getTempFileIndex(tempFile:vscode.Uri) : number {
        return this.tempFiles.findIndex(t => t.filePath === tempFile.path);
    }
}