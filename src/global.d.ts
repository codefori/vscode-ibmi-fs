interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

type DB2Row = Record<string, string | number | null>;

interface HandleActionResult {
  dirty?: boolean;
  rerender?: boolean;
}