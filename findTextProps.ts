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

  const props: Set<string> = new Set<string>();

  babel.traverse(ast, {
    JSXElement(path) {
      const openingElement = path.get("openingElement");
      const elementName = openingElement.get("name");

      if (elementName.isJSXIdentifier() && elementName.node.name === "Text") {
        const attributes = openingElement.get("attributes");
        for (const attribute of attributes) {
          if (attribute.isJSXAttribute()) {
            const attributeName = attribute.get("name");
            if (attributeName.isJSXIdentifier()) {
              props.add(attributeName.node.name);
            }
          }
        }
      }
    },
  });

  return props;
}

export async function findTextProps(basePath: string) {
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
      if (fileImports.size > 0) {
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

  const resultPath = path.join(__dirname, "text-props.json");
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2));
}
