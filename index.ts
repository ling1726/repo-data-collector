import { findNorthstar } from "./findNorthstar";
import { findTextProps } from "./findTextProps";
import { findTheme } from "./findTheme";

async function main() {
  await findTextProps(process.cwd());
}

main();
