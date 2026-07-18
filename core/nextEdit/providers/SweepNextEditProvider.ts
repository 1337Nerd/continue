import { HelperVars } from "../../autocomplete/util/HelperVars.js";
import { NEXT_EDIT_MODELS } from "../../llm/constants.js";
import { getUriPathBasename } from "../../util/uri.js";
import { SWEEP_FILE_SEP } from "../constants.js";
import {
  currentFileWindowBlock,
  editHistoryBlock,
  recentlyViewedFilesBlock,
} from "../templating/sweepNextEdit.js";
import {
  NEXT_EDIT_MODEL_TEMPLATES,
  PromptTemplateRenderer,
} from "../templating/NextEditPromptEngine.js";
import { ModelSpecificContext, Prompt, PromptMetadata } from "../types.js";
import { BaseNextEditModelProvider } from "./BaseNextEditProvider.js";

export class SweepProvider extends BaseNextEditModelProvider {
  private templateRenderer: PromptTemplateRenderer;

  constructor() {
    super(NEXT_EDIT_MODELS.SWEEP);

    const template = NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.SWEEP];
    this.templateRenderer = new PromptTemplateRenderer(template.template);
  }

  getSystemPrompt(): string {
    return "";
  }

  getWindowSize() {
    return { topMargin: 10, bottomMargin: 10 };
  }

  shouldInjectUniqueToken(): boolean {
    return false;
  }

  getUniqueToken(): string {
    return "";
  }

  extractCompletion(message: string): string {
    const fileSepIndex = message.indexOf(SWEEP_FILE_SEP);
    const completion =
      fileSepIndex === -1 ? message : message.slice(0, fileSepIndex);
    return completion.replace(/^\n+/, "").replace(/\n+$/, "");
  }

  buildPromptContext(context: ModelSpecificContext): any {
    return {
      recentlyViewedCodeSnippets:
        context.snippetPayload.recentlyVisitedRangesSnippets.map((snip) => ({
          filepath: snip.filepath,
          content: snip.content,
        })) ?? [],
      currentFileContent: context.helper.fileContents,
      editableRegionStartLine: context.editableRegionStartLine,
      editableRegionEndLine: context.editableRegionEndLine,
      editDiffHistory: context.diffContext,
      currentFilePath: getUriPathBasename(context.helper.filepath),
    };
  }

  private buildTemplateVars(context: ModelSpecificContext) {
    const promptCtx = this.buildPromptContext(context);

    return {
      recentlyViewedCodeSnippets: recentlyViewedFilesBlock(
        promptCtx.recentlyViewedCodeSnippets,
      ),
      currentFileContent: currentFileWindowBlock(
        promptCtx.currentFileContent,
        promptCtx.editableRegionStartLine,
        promptCtx.editableRegionEndLine,
        context.helper.pos,
      ),
      editDiffHistory: editHistoryBlock(promptCtx.editDiffHistory),
      currentFilePath: promptCtx.currentFilePath,
    };
  }

  async generatePrompts(context: ModelSpecificContext): Promise<Prompt[]> {
    const templateVars = this.buildTemplateVars(context);
    const userPromptContent = this.templateRenderer.render(templateVars);

    return [
      {
        role: "system",
        content: this.getSystemPrompt(),
      },
      {
        role: "user",
        content: userPromptContent,
      },
    ];
  }

  buildPromptMetadata(context: ModelSpecificContext): PromptMetadata {
    const promptCtx = this.buildPromptContext(context);
    const templateVars = this.buildTemplateVars(context);
    const userPromptContent = this.templateRenderer.render(templateVars);

    return {
      prompt: {
        role: "user",
        content: userPromptContent,
      },
      userEdits: promptCtx.editDiffHistory.join("\n"),
      userExcerpts: templateVars.currentFileContent,
    };
  }

  calculateEditableRegion(
    helper: HelperVars,
    _usingFullFileDiff: boolean,
  ): {
    editableRegionStartLine: number;
    editableRegionEndLine: number;
  } {
    const { topMargin, bottomMargin } = this.getWindowSize();
    return {
      editableRegionStartLine: Math.max(helper.pos.line - topMargin, 0),
      editableRegionEndLine: Math.min(
        helper.pos.line + bottomMargin,
        helper.fileLines.length - 1,
      ),
    };
  }
}
