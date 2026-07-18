import { parsePatch } from "diff";
import { Position } from "../..";
import { SWEEP_FILE_SEP } from "../constants";

export function recentlyViewedFilesBlock(
  recentlyViewedCodeSnippets: { filepath: string; content: string }[],
): string {
  return recentlyViewedCodeSnippets
    .map((snip) => `${SWEEP_FILE_SEP}${snip.filepath}\n${snip.content}`)
    .join("\n");
}

export interface ParsedFileDiff {
  filePath: string;
  original: string;
  updated: string;
}

export function parseUnifiedDiffToOriginalUpdated(
  diffText: string,
): ParsedFileDiff | null {
  const [parsed] = parsePatch(diffText);
  if (!parsed) {
    return null;
  }

  const rawPath = parsed.newFileName ?? parsed.oldFileName ?? "";
  const filePath = rawPath.replace(/^[ab]\//, "");

  const originalLines: string[] = [];
  const updatedLines: string[] = [];

  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      const marker = line[0];
      const content = line.slice(1);

      if (marker === " ") {
        originalLines.push(content);
        updatedLines.push(content);
      } else if (marker === "-") {
        originalLines.push(content);
      } else if (marker === "+") {
        updatedLines.push(content);
      }
    }
  }

  return {
    filePath,
    original: originalLines.join("\n"),
    updated: updatedLines.join("\n"),
  };
}

export function editHistoryBlock(editDiffHistory: string[]): string {
  return editDiffHistory
    .map((diff) => parseUnifiedDiffToOriginalUpdated(diff))
    .filter((parsed): parsed is ParsedFileDiff => parsed !== null)
    .map(
      (parsed) =>
        `${SWEEP_FILE_SEP}${parsed.filePath}.diff\noriginal:\n${parsed.original}\nupdated:\n${parsed.updated}`,
    )
    .join("\n");
}

export function currentFileWindowBlock(
  currentFileContent: string,
  editableRegionStartLine: number,
  editableRegionEndLine: number,
  _cursorPosition: Position,
): string {
  const lines = currentFileContent.split("\n");
  return lines
    .slice(editableRegionStartLine, editableRegionEndLine + 1)
    .join("\n");
}
