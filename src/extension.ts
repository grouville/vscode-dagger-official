// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { worker } from "cluster";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

const clientId = "dlsp";
const outputChannel = vscode.window.createOutputChannel("logs", "cue"); // output channel for debug
let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("Activation of the extension");

  // Restart language server on command palette
  let restartCmd = vscode.commands.registerCommand(
    `${clientId}.restart`,
    async () => {
      outputChannel.appendLine("Restart command triggered");
      await stopClient();
      startClient(context);
    }
  );

  // Show logs on command palette
  let showLogsCmd = vscode.commands.registerCommand(
    `${clientId}.showLogs`,
    () => {
      outputChannel.appendLine("Show logs triggered");
      if (!client) {
        return;
      }
      client.outputChannel.show(true);
    }
  );

  //// Debug purposes atm, remove it when cue files get properly loaded ////
  let start = vscode.commands.registerCommand(`${clientId}.start`, () => {
    outputChannel.appendLine("Manual activation of extention");
  });

  context.subscriptions.push(restartCmd, showLogsCmd, start);

  vscode.window.showInformationMessage("Extension activated");
  outputChannel.show();

  startClient(context);
}

// this method is called when your extension is deactivated
export async function deactivate() {
  outputChannel.appendLine("Extension deactivated");
  await stopClient();
}

export async function startClient(context: vscode.ExtensionContext) {
  let serverOptions: ServerOptions = {
    run: { command: "daggerlsp" }, // debug for small repro
    debug: { command: "daggerlsp" }, // not working yet
  };

  // Corresponding docs: https://code.visualstudio.com/api/references/document-selector
  let clientOptions: LanguageClientOptions = {
    // Register the server for cue documents
    documentSelector: [
      { scheme: "file", language: "cue" },
      { scheme: "untitled", language: "cue" },
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
  console.log("start client");
  await client.start();
  console.log("client started");

  const res = await exploreWorkspace("/private/tmp/test");

  res.map(([fileName, type]) => {
    console.log(fileName);
  });
}

async function exploreWorkspace(path: string) {
  console.log(path);
  const res = (
    await vscode.workspace.fs.readDirectory(vscode.Uri.file(path))
  ).map(([name, type]) => [`${path}/${name}`, type]);

  let items = res;
  await Promise.all(
    res.map(async ([name, type]) => {
      // If folder
      if (type === 2) {
        const newItems = await exploreWorkspace(name as string);
        items.push(...newItems);
      }
    })
  );

  return items;
}

async function stopClient() {
  if (!client) {
    return;
  }
  client.traceOutputChannel.dispose();
  client.outputChannel.dispose();
  await client.stop();
}
