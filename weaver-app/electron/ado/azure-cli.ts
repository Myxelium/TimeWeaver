import { execFile } from 'child_process';

// Azure DevOps resource id from Microsoft’s “Issue Entra tokens with Azure CLI” guide.
const AZURE_DEVOPS_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const AZURE_CLI_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const COMMAND_TIMEOUT_MS = 30000;
const MAX_OUTPUT_BYTES = 262144;

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

  if (exitCode === COMMAND_NOT_FOUND || detail.includes('not found') || detail.includes('no such file'))
    return 'Azure CLI was not found. Install it, run az login in a terminal, then sync again.';

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

async function azureCliExecutable(): Promise<string> {
  if (process.platform === 'win32')
    return 'az';

  const found = await runCommand('bash', ['-lc', 'command -v az']);
  const executable = found.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.endsWith('/az'));

  return executable || 'az';
}

function runCommand(file: string, args: string[]): Promise<CommandResult> {
  return new Promise(resolve => {
    execFile(file, args, { timeout: COMMAND_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true }, (error, stdout, stderr) => {
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
