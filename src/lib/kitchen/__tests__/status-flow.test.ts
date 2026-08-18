import { canTransition, isValidStatus } from "../status-flow";

describe("canTransition", () => {
  it("allows PENDING → IN_PROGRESS", () => {
    expect(canTransition("PENDING", "IN_PROGRESS")).toBe(true);
  });
  it("allows IN_PROGRESS → READY", () => {
    expect(canTransition("IN_PROGRESS", "READY")).toBe(true);
  });
  it("allows READY → SERVED", () => {
    expect(canTransition("READY", "SERVED")).toBe(true);
  });
  it("rejects backwards transitions", () => {
    expect(canTransition("IN_PROGRESS", "PENDING")).toBe(false);
    expect(canTransition("READY", "IN_PROGRESS")).toBe(false);
    expect(canTransition("SERVED", "READY")).toBe(false);
  });
  it("rejects skipping steps", () => {
    expect(canTransition("PENDING", "READY")).toBe(false);
    expect(canTransition("PENDING", "SERVED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "SERVED")).toBe(false);
  });
  it("rejects invalid statuses", () => {
    expect(canTransition("INVALID", "READY")).toBe(false);
    expect(canTransition("PENDING", "INVALID")).toBe(false);
  });
});

describe("isValidStatus", () => {
  it("accepts all valid statuses", () => {
    expect(isValidStatus("PENDING")).toBe(true);
    expect(isValidStatus("IN_PROGRESS")).toBe(true);
    expect(isValidStatus("READY")).toBe(true);
    expect(isValidStatus("SERVED")).toBe(true);
  });
  it("rejects invalid statuses", () => {
    expect(isValidStatus("CANCELLED")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("UNKNOWN")).toBe(false);
  });
});
