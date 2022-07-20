// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { worker } from 'cluster';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

const clientId = 'daggerlsp';
const outputChannel = vscode.window.createOutputChannel('logs', 'cue'); // output channel for debug
let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Restart language server on command palette
  let restartCmd = vscode.commands.registerCommand(`${clientId}.restart`, async () => {
    outputChannel.appendLine('Restart command triggered');
    await stopClient();
    startClient(context);
  });

  // Show logs on command palette
  let showLogsCmd = vscode.commands.registerCommand(`${clientId}.showLogs`, () => {
    outputChannel.appendLine('Show logs triggered');
    if (!client) {
      return;
    }
    client.outputChannel.show(true);
  });

  //// Debug purposes atm, remove it when cue files get properly loaded ////
  let start = vscode.commands.registerCommand(`${clientId}.start`, () => {
    outputChannel.appendLine('Manual activation of extention');
  });

  context.subscriptions.push(restartCmd, showLogsCmd, start);

  outputChannel.show();

  startClient(context);
}

// this method is called when your extension is deactivated
export async function deactivate() {
  await stopClient();
}

export async function startClient(context: vscode.ExtensionContext) {
  let serverOptions: ServerOptions = {
    run: { command: 'dagger', args: ['lsp'] }, // debug for small repro
    debug: { command: 'dagger', args: ['lsp'] }, // not working yet
  };

  // Corresponding docs: https://code.visualstudio.com/api/references/document-selector
  let clientOptions: LanguageClientOptions = {
    // Register the server for cue documents
    documentSelector: [
      { scheme: 'file', language: 'cue' },
      { scheme: 'untitled', language: 'cue' },
    ],
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    clientId,
    `${clientId} language server`,
    serverOptions,
    clientOptions
  );

  // Follows 8.0.0 breaking changes convention
  // https://github.com/microsoft/vscode-languageserver-node/blob/f97bb73dbfb920af4bc8c13ecdcdc16359cdeda6/client-node-tests/src/integration.test.ts
  // https://github.com/microsoft/vscode-languageserver-node/blame/f97bb73dbfb920af4bc8c13ecdcdc16359cdeda6/README.md#L41-L43
  // fixes race condition
  client.registerProposedFeatures();

  try {
    await client.start();
  } catch (e: any) {
    outputChannel.clear();
    outputChannel.appendLine(
      'Could not start Dagger LSP.\nPlease make sure you have install Dagger CLI or go to https://docs.dagger.io/install to install it.'
    );
  }
}

async function stopClient() {
  if (!client) {
    return;
  }
  client.traceOutputChannel.dispose();
  client.outputChannel.dispose();
  await client.stop();
}
