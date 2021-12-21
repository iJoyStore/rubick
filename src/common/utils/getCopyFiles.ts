import commonConst from "./commonConst";
import { clipboard, remote } from "electron";
import plist from "plist";
import fs from "fs";
import path from "path";
import ofs from "original-fs";

export default function getCopyFiles(): Array<any> | null {
  let fileInfo;
  if (commonConst.macOS()) {
    if (!clipboard.has("NSFilenamesPboardType")) return null;
    const result = clipboard.read("NSFilenamesPboardType");
    if (!result) return null;
    try {
      fileInfo = plist.parse(result);
    } catch (e) {
      return null;
    }
  } else if (commonConst.windows()) {
    const filePath = clipboard.readBuffer('FileNameW').toString('ucs2').replace(RegExp(String.fromCharCode(0), 'g'), '');
    fileInfo = [filePath];
    // todo
  } else {
    if (!commonConst.linux()) return null;
    if (!clipboard.has("text/uri-list")) return null;
    const result = clipboard.read("text/uri-list").match(/^file:\/\/\/.*/gm);
    if (!result || !result.length) return null;
    fileInfo = result.map((e) =>
      decodeURIComponent(e).replace(/^file:\/\//, "")
    );
  }
  if (!Array.isArray(fileInfo)) return null;
  const target: any = fileInfo
    .map((p) => {
      if (!fs.existsSync(p)) return false;
      let info;
      try {
        info = ofs.lstatSync(p);
      } catch (e) {
        return false;
      }
      return {
        isFile: info.isFile(),
        isDirectory: info.isDirectory(),
        name: path.basename(p) || p,
        path: p,
      };
    })
    .filter(Boolean);
  return target.length ? target : null;
}
