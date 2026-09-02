import { describe, it, expect } from "vitest";
import {
  EngramUnavailable,
  ValidationError,
  NotImplemented,
} from "../../../src/utils/errors.js";

describe("EngramUnavailable", () => {
  it("is an instance of Error", () => {
    const err = new EngramUnavailable("service down");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngramUnavailable);
  });

  it("has correct name and message", () => {
    const err = new EngramUnavailable("connection refused");
    expect(err.name).toBe("EngramUnavailable");
    expect(err.message).toBe("connection refused");
  });

  it("stores optional cause", () => {
    const cause = new Error("ECONNREFUSED");
    const err = new EngramUnavailable("service down", cause);
    expect(err.cause).toBe(cause);
  });

  it("works without cause", () => {
    const err = new EngramUnavailable("service down");
    expect(err.cause).toBeUndefined();
  });

  it("accepts opts with statusCode and endpoint", () => {
    const err = new EngramUnavailable("404 Not Found", undefined, { statusCode: 404, endpoint: "/observations/999" });
    expect(err.statusCode).toBe(404);
    expect(err.endpoint).toBe("/observations/999");
  });

  it("opts defaults to undefined", () => {
    const err = new EngramUnavailable("down");
    expect(err.statusCode).toBeUndefined();
    expect(err.endpoint).toBeUndefined();
  });
});

describe("ValidationError", () => {
  it("is an instance of Error", () => {
    const err = new ValidationError("bad input");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("has correct name and message", () => {
    const err = new ValidationError("invalid schema");
    expect(err.name).toBe("ValidationError");
    expect(err.message).toBe("invalid schema");
  });

  it("stores optional details", () => {
    const details = { field: "name", issue: "required" };
    const err = new ValidationError("missing field", details);
    expect(err.details).toEqual(details);
  });
});

describe("NotImplemented", () => {
  it("is an instance of Error", () => {
    const err = new NotImplemented();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NotImplemented);
  });

  it("has default message", () => {
    const err = new NotImplemented();
    expect(err.name).toBe("NotImplemented");
    expect(err.message).toBe("Not implemented");
  });

  it("accepts custom message", () => {
    const err = new NotImplemented("cloud adapter not ready");
    expect(err.message).toBe("cloud adapter not ready");
  });
});
