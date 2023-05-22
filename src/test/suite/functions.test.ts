import { getFixtureUri, loadFixture } from '../testHelpers';
import * as assert from 'assert';
// import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as functions from '../../utilities/functions';
suite('functions', () => {
	void vscode.window.showInformationMessage('Start functions tests.');

    suite('detect file encryption', () => {
        suite('isEncryptedEnvFile', () => {
            test ('should detect encrypted', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted.env'));
                assert.strictEqual(functions.isEncryptedEnvFile(contentString), true);
            });
    
            test ('should detect unencrypted', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted.env'));
                assert.strictEqual(functions.isEncryptedEnvFile(contentString), false);
            });
    
        });
    
        suite('isEncryptedIniFile', () => {
            test ('should detect encrypted', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted.ini'));
                assert.strictEqual(functions.isEncryptedIniFile(contentString), true);
            });
    
            test ('should detect unencrypted', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted.ini'));
                assert.strictEqual(functions.isEncryptedIniFile(contentString), false);
            });
    
        });
    
        suite('isEncryptedYamlFile', () => {
            test ('should detect encrypted multi yaml', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted_multi.yaml'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
            });
    
            test ('should detect unencrypted multi yaml', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted_multi.yaml'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
            });
    
            test ('should detect encrypted single yaml', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted.yaml'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
            });
    
            test ('should detect unencrypted single yaml', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted.yaml'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
            });
    
            test ('should detect encrypted json', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted.json'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
            });
    
            test ('should detect unencrypted json', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted.json'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
            });
    
            test ('should detect encrypted binary', async () => {
                const contentString = await Promise.resolve(loadFixture('encrypted.txt'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
            });
    
            test ('should detect unencrypted binary', async () => {
                const contentString = await Promise.resolve(loadFixture('unencrypted.txt'));
                assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
            });
        });
    
        suite('isEncrypted', () => {
            test ('should detect all encrypted', () => {
                const encrypted = ['encrypted.env', 'encrypted.ini', 'encrypted_multi.yaml', 'encrypted.yaml', 'encrypted.json', 'encrypted.txt'];
                for (const file of encrypted) {
                    assert.strictEqual(functions.isEncrypted(getFixtureUri(file)), true);
                }
            });
    
            test ('should detect all unencrypted', () => {
                const unencrypted = ['unencrypted.env', 'unencrypted.ini', 'unencrypted_multi.yaml', 'unencrypted.yaml', 'unencrypted.json', 'unencrypted.txt'];
                for (const file of unencrypted) {
                    assert.strictEqual(functions.isEncrypted(getFixtureUri(file)), false);
                }
            });
    
        });
    });

    suite('other', () => {
        suite('isEncryptable', () => {
            test('should detect encryptable', async () => {
                const encryptable = ['encrypted.ini', 'unencrypted.ini', 'encrypted.yaml', 'unencrypted.yaml', 'unencrypted.txt', 'encrypted.txt'];
                for (const file of encryptable) {
                    assert.strictEqual(await functions.isEncryptable(getFixtureUri(file)), true);
                }
            });
            test('should detect unencryptable', async () => {
                const unencryptable = ['encrypted.env', 'unencrypted.env', 'encrypted.json', 'unencrypted.json'];
                for (const file of unencryptable) {
                    assert.strictEqual(await functions.isEncryptable(getFixtureUri(file)), false);
                }
            });
        });
        suite('isSopsEncrypted', () => {
            test('should determine sops encrypted', async () => {
                const sopsEncrypted = ['encrypted.yaml', 'encrypted_multi.yaml', 'encrypted.ini', 'encrypted.txt'];
                for (const file of sopsEncrypted) {
                    assert.strictEqual(await functions.isSopsEncrypted(getFixtureUri(file)), true);
                }
            });
            test('should determine not sops encrypted', async () => {
                const notSopsEncrypted = ['unencrypted.env', 'encrypted.env', 'encrypted.json', 'unencrypted.json', 'unencrypted.txt', 'unencrypted.yaml', 'unencrypted_multi.yaml', 'unencrypted.ini'];
                for (const file of notSopsEncrypted) {
                    assert.strictEqual(await functions.isSopsEncrypted(getFixtureUri(file)), false);
                }
            });
        });
        suite('getUriFileExtension', () => {
            test('should retrieve file extension', () => {
                const file = vscode.Uri.file('a/b/c.txt');
                assert.strictEqual(functions.getUriFileExtension(file), "txt");            
            });
        });

        suite('getTempUri', () => {
            test('should add .tmp pre-extension', () => {
                const file = vscode.Uri.file('a/b/c.txt');
                assert.strictEqual(functions.getTempUri(file).path, '/a/b/c.tmp.txt');            
            });
        });
    });
});
