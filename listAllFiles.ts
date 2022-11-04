import { FileResult } from "./types";
import fs from "fs/promises";
import path from "path";

export async function listAllFiles(
  basePath: string,
  filter?: (file: FileResult) => boolean,
  dirFilter?: (path: string) => boolean
) {
  const res: FileResult[] = [];
  await listAllFilesInner(basePath, res, filter, dirFilter);
  return res;
}

async function listAllFilesInner(
  basePath: string,
  res: FileResult[],
  filter?: (file: FileResult) => boolean,
  dirFilter?: (path: string) => boolean
) {
  const filenames = await fs.readdir(basePath);

  for (const filename of filenames) {
    const filePath = path.join(basePath, filename);
    const isDirectory = (await fs.stat(filePath)).isDirectory();
    if (isDirectory) {
      if (!dirFilter || (dirFilter && dirFilter(filePath))) {
        await listAllFilesInner(filePath, res, filter);
      }
    } else {
      const file = { filename, path: filePath };
      if (!filter || (filter && filter(file))) {
        res.push({ filename, path: filePath });
      }
    }
  }
}
