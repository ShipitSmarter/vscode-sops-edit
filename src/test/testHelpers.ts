import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const fixturesRootDir = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');
export const loadFixture = (fixtureFileName: string) => fs.readFile(path.join(fixturesRootDir, fixtureFileName), 'utf-8');
export const getFixtureUri = (fixtureFileName: string) : vscode.Uri => vscode.Uri.file(path.join(fixturesRootDir, fixtureFileName));

export const stripNewLines = (value: string) => value.replace(/\r?\n|\r/g, '');
export const stripWhiteSpace = (value: string) => value.replace(/\s/g, '');