import * as vscode from "vscode";
import * as fs from "fs";
import * as f from "./functions";

type ExtendedTempFile = {
	tempFile: vscode.Uri,
    originalFile: vscode.Uri,
	content: string
};

export class FilePool {
    // pool of excluded file paths, existing of:
    //   - TMP files created by this extension
    //   - SOPS-encrypted files marked for direct editing
    private _excludedFilePaths: string[];
    
    // pool of open TMP file details, each item containing:
    //  - original file path
	//  - temp file path
	//  - temp file content (to track file changes)
    private _tempFiles: ExtendedTempFile[];

    public constructor() {
        this._excludedFilePaths = [];
        this._tempFiles = [];
    }

    public async openTextDocumentListener(textDocument:vscode.TextDocument) : Promise<void> {
        // on open document: if it is a sops encrypted file: close and open a decrypted copy instead
        const encryptedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
    
        // only apply if this is a non-excluded sops encrypted file
        const isSopsEncrypted: boolean = await f.isSopsEncrypted(encryptedFile);
        const isExcluded: boolean = this._excludedFilePaths.includes(encryptedFile.path);
        if (!isSopsEncrypted || isExcluded ) {
            return;
        }

        await f.closeFileIfOpen(encryptedFile);
        await this._editDecryptedTmpCopy(encryptedFile);
    }
    
    public closeTextDocumentListener(textDocument:vscode.TextDocument) : void {
        // 	- remove document from excluded files (if present)
        // 	- if it is a tmp version of SOPS encrypted file: remove tempFiles entry, delete
        const closedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
        this._removeExcludedPathsEntry(closedFile.path);
        this._removeTempFilesEntryAndDelete(closedFile);
    }
    
    public saveTextDocumentListener(textDocument:vscode.TextDocument) : void {
        // save and encrypt when it is a tmp file
        const savedFile = vscode.Uri.file(f.gitFix(textDocument.fileName));
        const content = textDocument.getText().trim();
        void this._copyEncryptSaveContentsIfTempFile(savedFile, content);
    }

    public editDirectly(files:vscode.Uri[]) : void {
        if (files.length === 0) {
            f.noFileSelectedErrormessage();
            return;
        } 
        
        const directEditFile = files[0];
        this._excludedFilePaths.push(directEditFile.path);
        void f.openFile(directEditFile);
    }

    private async _editDecryptedTmpCopy(encryptedFile: vscode.Uri) : Promise<void> {
        const tempFile = f.getTempUri(encryptedFile);
    
        const index = this._getTempFileIndex(tempFile);
        if (index !== -1) {
            return;
        }

        this._addTempFilesEntry(tempFile, encryptedFile);
        this._excludedFilePaths.push(tempFile.path);

        //await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        const out = await f.decryptToTmpFile(encryptedFile, tempFile);

        if (out.stderr) {
            // on error: cancel
            this._removeTempFilesEntryAndDelete(tempFile);
            this._removeExcludedPathsEntry(tempFile.path);
            return;
        }

        // update tempFiles entry with file content
        this._tempFiles[this._getTempFileIndex(tempFile)].content = fs.readFileSync(tempFile.fsPath, 'utf-8');

        await f.openFile(tempFile);
    }

    private _addTempFilesEntry(tempFile: vscode.Uri, encryptedFile:vscode.Uri) : void {
        const index = this._getTempFileIndex(tempFile);
        if (index !== -1) {
            return;
        }

        this._tempFiles.push({
            tempFile:tempFile, 
            originalFile: encryptedFile,
            content: ''
        });
    }

    private _removeTempFilesEntryAndDelete(tempFile:vscode.Uri) : void {
        const index = this._getTempFileIndex(tempFile);
        if (index === -1) {
            return;
        }

        this._tempFiles.splice(index, 1);
        fs.unlinkSync(tempFile.fsPath);
    }

    private _removeExcludedPathsEntry(path:string) {
        if (this._excludedFilePaths.includes(path)) {
            this._excludedFilePaths.splice(this._excludedFilePaths.indexOf(path), 1);
        }
    }

    private _copyEncryptSaveContentsIfTempFile(tempFile:vscode.Uri, tempFileContent: string) : void {
        const index = this._getTempFileIndex(tempFile);
        if (index !== -1 && this._tempFiles[index].content !== tempFileContent) {
            this._tempFiles[index].content = tempFileContent;
            const out = f.copyEncrypt(this._tempFiles[index]);
            if (out.stderr) {
                void vscode.window.showErrorMessage(`Error encrypting ${f.dissectUri(this._tempFiles[index].originalFile).fileName}: ${out.stderr}`);
            }
        }
    }

    private _getTempFileIndex(tempFile:vscode.Uri) : number {
        return this._tempFiles.findIndex(t => t.tempFile.path === tempFile.path);
    }
}