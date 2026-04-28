import { describe, it, expect } from "vitest";
import {
  fileStoreReducer,
  initialFileStoreState,
  type FileStoreState,
  type FileStoreAction,
} from "./fileStoreReducer";
import type { FileEntry, NormalizedPage } from "../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────

function makeFileEntry(id: string, name = `${id}.pdf`): FileEntry {
  return {
    id,
    file: new File([""], name),
    name,
    size: 100,
    type: "pdf",
    thumbnailUrl: "",
    pageCount: 1,
  };
}

function makePage(
  id: string,
  sourceFileId: string,
  index = 0
): NormalizedPage {
  return {
    id,
    sourceFileId,
    sourcePageIndex: index,
    type: "image",
    width: 100,
    height: 100,
    rotation: 0,
  };
}

function stateWithFiles(files: FileEntry[]): FileStoreState {
  return { ...initialFileStoreState, files };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("fileStoreReducer", () => {
  describe("ADD_FILES", () => {
    it("appends files to an empty list", () => {
      const files = [makeFileEntry("a"), makeFileEntry("b")];
      const result = fileStoreReducer(initialFileStoreState, {
        type: "ADD_FILES",
        payload: files,
      });
      expect(result.files).toHaveLength(2);
      expect(result.files[0].id).toBe("a");
      expect(result.files[1].id).toBe("b");
      expect(result.error).toBeNull();
    });

    it("appends files to end of existing list", () => {
      const state = stateWithFiles([makeFileEntry("a")]);
      const result = fileStoreReducer(state, {
        type: "ADD_FILES",
        payload: [makeFileEntry("b"), makeFileEntry("c")],
      });
      expect(result.files.map((f) => f.id)).toEqual(["a", "b", "c"]);
    });

    it("enforces 5-file limit by truncating excess", () => {
      const state = stateWithFiles([
        makeFileEntry("1"),
        makeFileEntry("2"),
        makeFileEntry("3"),
      ]);
      const result = fileStoreReducer(state, {
        type: "ADD_FILES",
        payload: [
          makeFileEntry("4"),
          makeFileEntry("5"),
          makeFileEntry("6"),
        ],
      });
      expect(result.files).toHaveLength(5);
      expect(result.files.map((f) => f.id)).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
      ]);
      expect(result.error).toContain("Free tier");
      expect(result.error).toContain("1 file(s) were not added");
    });

    it("rejects all files when already at limit", () => {
      const state = stateWithFiles(
        Array.from({ length: 5 }, (_, i) => makeFileEntry(`${i}`))
      );
      const result = fileStoreReducer(state, {
        type: "ADD_FILES",
        payload: [makeFileEntry("extra")],
      });
      expect(result.files).toHaveLength(5);
      expect(result.error).toContain("Free tier");
    });

    it("clears error when adding within limit", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        error: "previous error",
      };
      const result = fileStoreReducer(state, {
        type: "ADD_FILES",
        payload: [makeFileEntry("a")],
      });
      expect(result.error).toBeNull();
    });
  });

  describe("REMOVE_FILE", () => {
    it("removes a file by ID", () => {
      const state = stateWithFiles([
        makeFileEntry("a"),
        makeFileEntry("b"),
        makeFileEntry("c"),
      ]);
      const result = fileStoreReducer(state, {
        type: "REMOVE_FILE",
        payload: "b",
      });
      expect(result.files.map((f) => f.id)).toEqual(["a", "c"]);
    });

    it("preserves relative order of remaining files", () => {
      const state = stateWithFiles([
        makeFileEntry("x"),
        makeFileEntry("y"),
        makeFileEntry("z"),
      ]);
      const result = fileStoreReducer(state, {
        type: "REMOVE_FILE",
        payload: "x",
      });
      expect(result.files.map((f) => f.id)).toEqual(["y", "z"]);
    });

    it("removes associated pages", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        files: [makeFileEntry("a"), makeFileEntry("b")],
        pages: [
          makePage("p1", "a"),
          makePage("p2", "b"),
          makePage("p3", "a", 1),
        ],
      };
      const result = fileStoreReducer(state, {
        type: "REMOVE_FILE",
        payload: "a",
      });
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].sourceFileId).toBe("b");
    });

    it("is a no-op for non-existent ID", () => {
      const state = stateWithFiles([makeFileEntry("a")]);
      const result = fileStoreReducer(state, {
        type: "REMOVE_FILE",
        payload: "nonexistent",
      });
      expect(result.files).toHaveLength(1);
    });
  });

  describe("REORDER", () => {
    it("moves active item to over item position", () => {
      const state = stateWithFiles([
        makeFileEntry("a"),
        makeFileEntry("b"),
        makeFileEntry("c"),
      ]);
      // Move "a" to where "c" is
      const result = fileStoreReducer(state, {
        type: "REORDER",
        payload: { activeId: "a", overId: "c" },
      });
      expect(result.files.map((f) => f.id)).toEqual(["b", "a", "c"]);
    });

    it("moves item backward", () => {
      const state = stateWithFiles([
        makeFileEntry("a"),
        makeFileEntry("b"),
        makeFileEntry("c"),
      ]);
      // Move "c" to where "a" is
      const result = fileStoreReducer(state, {
        type: "REORDER",
        payload: { activeId: "c", overId: "a" },
      });
      expect(result.files.map((f) => f.id)).toEqual(["c", "a", "b"]);
    });

    it("is a no-op when activeId equals overId", () => {
      const state = stateWithFiles([makeFileEntry("a"), makeFileEntry("b")]);
      const result = fileStoreReducer(state, {
        type: "REORDER",
        payload: { activeId: "a", overId: "a" },
      });
      expect(result.files.map((f) => f.id)).toEqual(["a", "b"]);
    });

    it("is a no-op when IDs are not found", () => {
      const state = stateWithFiles([makeFileEntry("a"), makeFileEntry("b")]);
      const result = fileStoreReducer(state, {
        type: "REORDER",
        payload: { activeId: "x", overId: "a" },
      });
      expect(result.files.map((f) => f.id)).toEqual(["a", "b"]);
    });

    it("preserves all elements (same length, same set)", () => {
      const state = stateWithFiles([
        makeFileEntry("a"),
        makeFileEntry("b"),
        makeFileEntry("c"),
        makeFileEntry("d"),
      ]);
      const result = fileStoreReducer(state, {
        type: "REORDER",
        payload: { activeId: "b", overId: "d" },
      });
      expect(result.files).toHaveLength(4);
      expect(result.files.map((f) => f.id).sort()).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("SET_PAGES", () => {
    it("adds pages for a file", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        files: [makeFileEntry("a")],
      };
      const pages = [makePage("p1", "a"), makePage("p2", "a", 1)];
      const result = fileStoreReducer(state, {
        type: "SET_PAGES",
        payload: { fileId: "a", pages },
      });
      expect(result.pages).toHaveLength(2);
    });

    it("replaces existing pages for the same file", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        files: [makeFileEntry("a")],
        pages: [makePage("old1", "a"), makePage("old2", "a", 1)],
      };
      const newPages = [makePage("new1", "a")];
      const result = fileStoreReducer(state, {
        type: "SET_PAGES",
        payload: { fileId: "a", pages: newPages },
      });
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].id).toBe("new1");
    });

    it("preserves pages from other files", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        files: [makeFileEntry("a"), makeFileEntry("b")],
        pages: [makePage("pa", "a"), makePage("pb", "b")],
      };
      const result = fileStoreReducer(state, {
        type: "SET_PAGES",
        payload: { fileId: "a", pages: [makePage("pa-new", "a")] },
      });
      expect(result.pages).toHaveLength(2);
      expect(result.pages.find((p) => p.sourceFileId === "b")).toBeDefined();
    });
  });

  describe("SET_PROCESSING", () => {
    it("sets isProcessing to true", () => {
      const result = fileStoreReducer(initialFileStoreState, {
        type: "SET_PROCESSING",
        payload: true,
      });
      expect(result.isProcessing).toBe(true);
    });

    it("sets isProcessing to false", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        isProcessing: true,
      };
      const result = fileStoreReducer(state, {
        type: "SET_PROCESSING",
        payload: false,
      });
      expect(result.isProcessing).toBe(false);
    });
  });

  describe("SET_ERROR", () => {
    it("sets an error message", () => {
      const result = fileStoreReducer(initialFileStoreState, {
        type: "SET_ERROR",
        payload: "Something went wrong",
      });
      expect(result.error).toBe("Something went wrong");
    });

    it("clears the error", () => {
      const state: FileStoreState = {
        ...initialFileStoreState,
        error: "old error",
      };
      const result = fileStoreReducer(state, {
        type: "SET_ERROR",
        payload: null,
      });
      expect(result.error).toBeNull();
    });
  });

  describe("UPDATE_FILE", () => {
    it("updates thumbnailUrl for a specific file", () => {
      const state = stateWithFiles([makeFileEntry("a"), makeFileEntry("b")]);
      const result = fileStoreReducer(state, {
        type: "UPDATE_FILE",
        payload: { id: "a", updates: { thumbnailUrl: "blob:thumb-a" } },
      });
      expect(result.files[0].thumbnailUrl).toBe("blob:thumb-a");
      expect(result.files[1].thumbnailUrl).toBe(""); // unchanged
    });

    it("updates pageCount for a specific file", () => {
      const state = stateWithFiles([makeFileEntry("a")]);
      const result = fileStoreReducer(state, {
        type: "UPDATE_FILE",
        payload: { id: "a", updates: { pageCount: 5 } },
      });
      expect(result.files[0].pageCount).toBe(5);
    });

    it("does not affect other files", () => {
      const state = stateWithFiles([makeFileEntry("a"), makeFileEntry("b")]);
      const result = fileStoreReducer(state, {
        type: "UPDATE_FILE",
        payload: { id: "b", updates: { thumbnailUrl: "blob:thumb-b", pageCount: 3 } },
      });
      expect(result.files[0].thumbnailUrl).toBe("");
      expect(result.files[0].pageCount).toBe(1);
      expect(result.files[1].thumbnailUrl).toBe("blob:thumb-b");
      expect(result.files[1].pageCount).toBe(3);
    });

    it("is a no-op for non-existent ID", () => {
      const state = stateWithFiles([makeFileEntry("a")]);
      const result = fileStoreReducer(state, {
        type: "UPDATE_FILE",
        payload: { id: "nonexistent", updates: { thumbnailUrl: "blob:x" } },
      });
      expect(result.files[0].thumbnailUrl).toBe("");
    });
  });
});
