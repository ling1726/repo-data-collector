import * as babel from "@babel/core";
import fs from "fs/promises";
import path from "path";
import { listAllFiles } from "./listAllFiles";
import { FileResult, ImportStat } from "./types";

export async function findNorthstarInFile(file: FileResult) {
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

  const imports: string[] = [];

  babel.traverse(ast, {
    ImportDeclaration(path) {
      const source = path.get("source");
      if (
        source.node.value !==
          "@microsoft/modernworkplace-ui-core/src/components/northstar" &&
        source.node.value !== "@fluentui/react-northstar"
      ) {
        return;
      }
      path.get("specifiers").forEach((specifier) => {
        if (
          specifier.isImportSpecifier() &&
          specifier.get("imported").isIdentifier()
        ) {
          const identifier = specifier.get("imported");
          if (identifier.isIdentifier()) {
            imports.push(identifier.node.name);
          }
        }
      });
    },
  });

  return imports;
}

export async function findNorthstar(basePath: string) {
  const files = await listAllFiles(
    basePath,
    (file) => {
      if (
        (file.filename.endsWith(".ts") || file.filename.endsWith(".tsx")) &&
        !file.filename.includes(".spec.ts") &&
        !file.filename.endsWith(".d.ts")
      ) {
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

  const imports: Record<string, ImportStat> = {};
  console.log("processing", files.length, "files");
  for (const file of files) {
    try {
      const fileImports = await findNorthstarInFile(file);
      if (fileImports.length > 0) {
        console.log("found northstar imports in", file.path);
      }

      fileImports.forEach((fileImport) => {
        if (imports[fileImport]) {
          imports[fileImport].count += 1;
          imports[fileImport].usages.push(file.path);
        } else {
          imports[fileImport] = { count: 1, usages: [file.path] };
        }
      });
    } catch (err) {
      console.error("failed to process", file.filename);
      console.error(err);
    }
  }

  const results = Object.entries(imports).map(([importName, stats]) => ({
    ...stats,
    name: importName,
  }));

  results.sort((a, b) => a.count - b.count);

  const resultPath = path.join(__dirname, "northstar-imports.json");
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2));
}
