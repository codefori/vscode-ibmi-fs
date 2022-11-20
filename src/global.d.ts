interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface HandleActionResult {
  dirty?: boolean;
  rerender?: boolean;
}