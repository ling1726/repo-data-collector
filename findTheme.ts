import * as babel from "@babel/core";
import fs from "fs/promises";
import path from "path";
import { listAllFiles } from "./listAllFiles";
import { FileResult, ImportStat } from "./types";

export async function findThemeInFile(file: FileResult) {
  const buf = await fs.readFile(file.path);
  const code = buf.toString();
  const ast = await babel.parseAsync(code, {
    filename: file.filename,
    babelrc: false,
    presets: [
      "@babel/preset-env",
      "@babel/preset-typescript",
      "@babel/preset-react",
    ],
  });

  const results = {
    path: file.path,
    usages: [] as string[],
  };

  babel.traverse(ast, {
    ExportNamedDeclaration(path) {
      const declaration = path.get("declaration");
      let hasMergeStyles = false;
      path.traverse({
        CallExpression(path) {
          const callee = path.get("callee");
          if (callee.isIdentifier() && callee.node.name === "mergeStyleSets") {
            hasMergeStyles = true;
          }
        },
      });

      if (!hasMergeStyles) {
        return;
      }

      if (declaration.isVariableDeclaration()) {
        const declarations = declaration.get("declarations");
        const identifier = declarations[0].get("id");

        const init = declarations[0].get("init");
        if (init.isArrowFunctionExpression()) {
          const params = init.get("params");
          if (params.length == 0) {
            return;
          }

          if (params.length > 1) {
            for (const param of params) {
              if (param.isIdentifier() && param.node.name !== "theme") {
                results.usages.push(param.node.name);
              }
            }
          } else {
            const param = params[0];
            if (param.isIdentifier() && param.node.name !== "theme") {
              results.usages.push(param.node.name);
            }
          }
        }
      }
    },
  });

  return results.usages.length ? results : null;
}

export async function findTheme(basePath: string) {
  const files = await listAllFiles(
    basePath,
    (file) => {
      if (file.filename.endsWith(".styles.ts")) {
        return true;
      }

      return false;
    },
    (path) => {
      if (
        path.includes("node_modules") ||
        path.includes(".git") ||
        path.includes("/bin/")
      ) {
        return false;
      }

      return true;
    }
  );

  const results: ({ path: string; usages: string[] } | null)[] = [];
  console.log("processing", files.length, "files");
  for (const file of files) {
    console.log("processing", file.filename);
    const res = await findThemeInFile(file);
    results.push(res);
  }

  const filtered = results.filter(Boolean);

  console.log(JSON.stringify(filtered, null, 2));
  console.log(filtered.length);
}
