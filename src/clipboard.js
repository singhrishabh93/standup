import { spawn } from "node:child_process";

const COMMANDS = {
  darwin: [["pbcopy"]],
  win32: [["clip"]],
  linux: [["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]],
};

function pipe([cmd, ...args], text) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.stdin.end(text);
  });
}

export async function copy(text) {
  for (const command of COMMANDS[process.platform] ?? []) {
    try {
      await pipe(command, text);
      return true;
    } catch {
      // try the next one
    }
  }
  return false;
}
