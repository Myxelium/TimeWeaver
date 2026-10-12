import { execFile } from 'child_process';
import { statSync } from 'fs';
import { win32 } from 'path';

// Azure DevOps resource id from Microsoft’s “Issue Entra tokens with Azure CLI” guide.
const AZURE_DEVOPS_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const AZURE_CLI_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const COMMAND_TIMEOUT_MS = 30000;
const MAX_OUTPUT_BYTES = 262144;

export const WINDOWS_COMMAND_NOT_FOUND = 9009;
const AZURE_CLI_MISSING = 'Azure CLI was not found. Install it, run az login in a terminal, then sync again.';

export const COMMAND_NOT_FOUND = 127;

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function readAzureCliToken(stdout: string): string | null {
  const lines = stdout.split(/\r?\n/).map(line => line.trim())
    .filter(line => line.length > 0);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (AZURE_CLI_TOKEN.test(lines[index]))
      return lines[index];
  }

  return null;
}

export function azureCliFailureMessage(stderr: string, exitCode: number): string {
  const detail = stderr.toLowerCase();

  if (detail.includes('az login') || detail.includes('please run'))
    return 'Azure CLI is not signed in. Run az login in a terminal, then sync again.';

  if (isMissingAzureCli(detail, exitCode))
    return AZURE_CLI_MISSING;

  return 'Azure CLI could not provide a token. Run az login in a terminal, then sync again.';
}

export async function azureCliAccessToken(): Promise<string> {
  const azureCli = await azureCliExecutable();
  const result = await runCommand(azureCli, [
    'account',
    'get-access-token',
    '--resource',
    AZURE_DEVOPS_RESOURCE,
    '--query',
    'accessToken',
    '--output',
    'tsv'
  ]);
  const accessToken = readAzureCliToken(result.stdout);

  if (!accessToken || result.exitCode !== 0)
    throw new Error(azureCliFailureMessage(result.stderr, result.exitCode));

  return accessToken;
}

export function windowsAzureCliCandidates(env: Readonly<Record<string, string | undefined>>): string[] {
  const programFiles = env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programFilesCli = win32.join(programFiles, 'Microsoft SDKs', 'Azure', 'CLI2', 'wbin', 'az.cmd');
  const programFilesX86Cli = win32.join(programFilesX86, 'Microsoft SDKs', 'Azure', 'CLI2', 'wbin', 'az.cmd');
  const known = [programFilesCli, programFilesX86Cli];

  if (env.LOCALAPPDATA)
    known.push(win32.join(env.LOCALAPPDATA, 'Programs', 'Azure CLI', 'wbin', 'az.cmd'));

  const fromPath = windowsPathEntries(env.PATH, env).flatMap(directory => {
    const batchFile = win32.join(directory, 'az.cmd');
    const executable = win32.join(directory, 'az.exe');

    return [batchFile, executable];
  });

  return uniquePaths([...known, ...fromPath]);
}

export function parseRegistryValue(output: string): string {
  const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.*)$/m);

  return match ? match[1].trim() : '';
}

export function windowsCommandLine(file: string, args: string[]): string {
  return [file, ...args].map(quoteWindowsArgument).join(' ');
}

async function azureCliExecutable(): Promise<string> {
  if (process.platform === 'win32')
    return findWindowsAzureCli();

  const found = await runCommand('bash', ['-lc', 'command -v az']);
  const executable = found.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.endsWith('/az'));

  return executable || 'az';
}

async function findWindowsAzureCli(): Promise<string> {
  const pathValue = await windowsSearchPath();
  const env = { ...process.env, PATH: pathValue };
  const found = windowsAzureCliCandidates(env).find(isUsableExecutable);

  if (!found)
    throw new Error(AZURE_CLI_MISSING);

  return found;
}

async function windowsSearchPath(): Promise<string> {
  const userPath = await readRegistryValue('HKCU\\Environment', 'Path');
  const machinePath = await readRegistryValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
    'Path'
  );

  return [
    userPath,
    machinePath,
    process.env.PATH
  ].filter(value => !!value).join(';');
}

function readRegistryValue(key: string, name: string): Promise<string> {
  return new Promise(resolve => {
    execFile('reg.exe', [
      'query',
      key,
      '/v',
      name
    ], { timeout: COMMAND_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      const value = error ? '' : parseRegistryValue(String(stdout ?? ''));

      resolve(value);
    });
  });
}

function windowsPathEntries(pathValue: string | undefined, env: Readonly<Record<string, string | undefined>>): string[] {
  return (pathValue || '')
    .split(';')
    .map(entry => expandWindowsVariables(entry.trim(), env))
    .filter(entry => entry.length > 0);
}

function expandWindowsVariables(value: string, env: Readonly<Record<string, string | undefined>>): string {
  return value.replace(/%([^%]+)%/g, (_match, name: string) => {
    const key = Object.keys(env).find(candidate => candidate.toLowerCase() === name.toLowerCase());

    return key ? env[key] || '' : '';
  });
}

function uniquePaths(files: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const file of files) {
    const key = file.toLowerCase();

    if (seen.has(key))
      continue;

    seen.add(key);
    unique.push(file);
  }

  return unique;
}

function isUsableExecutable(file: string): boolean {
  try {
    const stat = statSync(file);

    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function mentionsMissingCommand(detail: string): boolean {
  return detail.includes('not found')
    || detail.includes('no such file')
    || detail.includes('not recognized');
}

function isMissingAzureCli(detail: string, exitCode: number): boolean {
  const missingExit = exitCode === COMMAND_NOT_FOUND || exitCode === WINDOWS_COMMAND_NOT_FOUND;

  return missingExit || mentionsMissingCommand(detail);
}

function quoteWindowsArgument(value: string): string {
  if (!/[\s"]/u.test(value))
    return value;

  return `"${value.replace(/"/g, '""')}"`;
}

function runCommand(file: string, args: string[]): Promise<CommandResult> {
  const windowsBatch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(file);
  const command = windowsBatch ? process.env.ComSpec || 'cmd.exe' : file;
  const commandArgs = windowsBatch
    ? [
      '/d',
      '/s',
      '/c',
      `"${windowsCommandLine(file, args)}"`
    ]
    : args;

  return new Promise(resolve => {
    execFile(command, commandArgs, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true,
      windowsVerbatimArguments: windowsBatch
    }, (error, stdout, stderr) => {
      const missing = !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
      const numericCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'number'
        ? error.code
        : 0;
      const exitCode = missing ? COMMAND_NOT_FOUND : numericCode || (error ? 1 : 0);

      resolve({
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        exitCode
      });
    });
  });
}
