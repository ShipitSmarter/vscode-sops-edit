export const sopsYamlGlob = '**/*.sops.yaml';
export const terminalEncryptName = 'sops (encrypt)';
export const terminalDecryptName = 'sops (decrypt)';

// NOTE: direct encryption using 'sops -e a.tmp.yaml > b.yaml' cannot be used here, 
// as it is NOT a given that the file name of the TMP file will match a SOPS encryption pattern!
export const encryptCommand = 'sops --in-place --encrypt [FILE]';
export const decryptToTmpCommand  = 'sops --decrypt [FILE] > [TEMPFILE]';
export const decryptInPlaceCommand  = 'sops --in-place --decrypt [FILE]';
export const fileString = '[FILE]';
export const tempFileString = '[TEMPFILE]';
export const decryptionString = 'Decrypting [FILE] ...';
export const editQuestionString = 'What would you like to do with this SOPS-encrypted file?';
export const editDirectlyString = 'Edit encrypted file directly';
export const editDecryptedCopyString = 'Edit decrypted version';

// unavoidable regexes
export const gitExtensionRegExp = /\.git$/;
export const getFileExtensionRegExp = /\.[^.]*$/;