import * as vscode from 'vscode';
export const sopsYamlGlob = '**/*.sops.yaml';
export const tempFilePreExtension = vscode.workspace.getConfiguration().get<string>('sops-edit.tempFilePreExtension') ?? 'tmp';
export const terminalEncryptName = 'sops (encrypt)';
export const terminalDecryptName = 'sops (decrypt)';

// NOTE: direct encryption using 'sops -e a.tmp.yaml > b.yaml' cannot be used here, 
// as it is NOT a given that the file name of the TMP file will match a SOPS encryption pattern!
export const encryptionCommand = 'sops -i -e [FILE]';
export const decryptionCommand  = 'sops -d [FILE] > [TEMPFILE]';
export const fileString = '[FILE]';
export const tempFileString = '[TEMPFILE]';
export const editQuestionString = 'What would you like to do with this SOPS-encrypted file?';
export const editDirectlyString = 'Edit encrypted file directly';
export const editDecryptedCopyString = 'Edit decrypted version';