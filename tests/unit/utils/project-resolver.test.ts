import { describe, expect, it } from "vitest";
import {
  normalizeProjectName,
  resolveProject,
  resolveProjectName,
} from "../../../src/utils/project-resolver.js";
import type { EngramAdapter, Project } from "../../../src/adapters/types.js";

function project(name: string): Project {
  return {
    name,
    observationCount: 1,
    lastActiveAt: "2026-08-31T00:00:00.000Z",
    scopes: ["project"],
  };
}

function projectAdapter(names: string[]): Pick<EngramAdapter, "listProjects"> {
  return { listProjects: async () => names.map(project) };
}

describe("resolveProjectName", () => {
  it("Given every candidate, when resolving, then the explicit override wins", () => {
    expect(
      resolveProjectName("/work/gamma", {
        explicitProject: " alpha ",
        envProject: "beta",
      }),
    ).toBe("alpha");
  });

  it("Given a blank explicit override, when resolving, then ENGRAM_PROJECT wins", () => {
    expect(
      resolveProjectName("/work/gamma", {
        explicitProject: "   ",
        envProject: " beta ",
      }),
    ).toBe("beta");
  });

  it("Given no override, when resolving a cwd, then its basename is normalized", () => {
    expect(resolveProjectName("/work/MCP Flema Engram", { envProject: "" })).toBe(
      "mcp-flema-engram",
    );
    expect(
      resolveProjectName("D:\\general\\MCP Flema Engram\\", { envProject: "" }),
    ).toBe("mcp-flema-engram");
  });

  it("Given no usable candidate, when resolving, then the result is undefined", () => {
    expect(resolveProjectName("/", { envProject: " " })).toBeUndefined();
    expect(resolveProjectName("D:\\", { envProject: " " })).toBeUndefined();
    expect(resolveProjectName("   ", { envProject: " " })).toBeUndefined();
  });
});

describe("normalizeProjectName", () => {
  it("Given mixed whitespace and case, when normalized, then a stable slug is returned", () => {
    expect(normalizeProjectName("  MY   Cool Project  ")).toBe("my-cool-project");
  });

  it("Given an unusable name, when normalized, then it is undefined", () => {
    expect(normalizeProjectName("  ")).toBeUndefined();
    expect(normalizeProjectName("...")).toBeUndefined();
  });
});

describe("resolveProject", () => {
  it("validates an exact match before case-insensitive alternatives", async () => {
    const result = await resolveProject(
      projectAdapter(["Alpha", "alpha"]),
      "/work/ignored",
      { explicitProject: "Alpha", envProject: "beta" },
    );

    expect(result).toEqual({
      projectName: "Alpha",
      candidate: "Alpha",
      source: "explicit",
      validation: "exact",
    });
  });

  it("uses the canonical spelling for one case-insensitive match", async () => {
    const result = await resolveProject(
      projectAdapter(["MCP-Flema-Engram"]),
      "/work/ignored",
      { explicitProject: "mcp-flema-engram" },
    );

    expect(result.projectName).toBe("MCP-Flema-Engram");
    expect(result.validation).toBe("case-insensitive");
  });

  it("rejects ambiguous and absent candidates without selecting a project", async () => {
    const ambiguous = await resolveProject(
      projectAdapter(["Alpha", "ALPHA"]),
      "/work/ignored",
      { explicitProject: "alpha" },
    );
    expect(ambiguous.validation).toBe("ambiguous");
    expect(ambiguous).not.toHaveProperty("projectName");

    const absent = await resolveProject(
      projectAdapter(["beta"]),
      "/work/ignored",
      { explicitProject: "alpha" },
    );
    expect(absent.validation).toBe("no-match");
    expect(absent).not.toHaveProperty("projectName");
  });

  it("applies explicit then environment then workspace basename precedence", async () => {
    const known = projectAdapter(["explicit", "environment", "workspace"]);

    await expect(resolveProject(known, "/work/workspace", {
      explicitProject: "explicit",
      envProject: "environment",
    })).resolves.toMatchObject({ projectName: "explicit", source: "explicit" });
    await expect(resolveProject(known, "/work/workspace", {
      explicitProject: " ",
      envProject: "environment",
    })).resolves.toMatchObject({ projectName: "environment", source: "environment" });
    await expect(resolveProject(known, "/work/Workspace", {
      explicitProject: " ",
      envProject: " ",
    })).resolves.toMatchObject({ projectName: "workspace", source: "cwd" });
  });

  it("tries the normalized absolute cwd after the automatic basename has no match", async () => {
    const result = await resolveProject(
      projectAdapter(["d:\\ig\\back"]),
      "D:\\ig\\back",
      { envProject: " " },
    );

    expect(result).toEqual({
      projectName: "d:\\ig\\back",
      candidate: "D:\\ig\\back",
      source: "cwd",
      validation: "case-insensitive",
    });
  });

  it("normalizes Windows separators but still requires one unique path match", async () => {
    const resolved = await resolveProject(
      projectAdapter(["d:/ig/back"]),
      "D:\\ig\\back\\",
      { envProject: " " },
    );
    const ambiguous = await resolveProject(
      projectAdapter(["d:/ig/back", "D:\\IG\\BACK"]),
      "D:\\ig\\back",
      { envProject: " " },
    );

    expect(resolved.projectName).toBe("d:/ig/back");
    expect(resolved.validation).toBe("case-insensitive");
    expect(ambiguous.projectName).toBeUndefined();
    expect(ambiguous.validation).toBe("ambiguous");
  });

  it("does not invent a friendly alias or fall back from explicit and environment candidates", async () => {
    const known = projectAdapter(["d:\\ig\\back"]);

    await expect(resolveProject(known, "D:\\ig\\back", {
      explicitProject: "ig backend",
      envProject: "d:\\ig\\back",
    })).resolves.toMatchObject({ candidate: "ig backend", validation: "no-match" });
    await expect(resolveProject(known, "D:\\ig\\back", {
      envProject: "ig backend",
    })).resolves.toMatchObject({ candidate: "ig backend", validation: "no-match" });
  });

  it("preserves only explicit or environment candidates when Engram is offline", async () => {
    const offline = {
      listProjects: async () => {
        throw new Error("connection refused");
      },
    };

    await expect(resolveProject(offline, "/work/workspace", {
      explicitProject: "alpha",
    })).resolves.toEqual({
      candidate: "alpha",
      source: "explicit",
      validation: "offline",
    });
    await expect(resolveProject(offline, "/work/workspace", {
      envProject: "beta",
    })).resolves.toEqual({
      candidate: "beta",
      source: "environment",
      validation: "offline",
    });
    await expect(resolveProject(offline, "/work/workspace", {
      envProject: " ",
    })).resolves.toEqual({
      candidate: undefined,
      source: "cwd",
      validation: "offline",
    });
  });
});
