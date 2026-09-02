import { z } from "zod";

const SQLITE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

export const engramTimestampSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const sqliteTimestamp = SQLITE_TIMESTAMP.exec(value);
  return sqliteTimestamp
    ? `${sqliteTimestamp[1]}T${sqliteTimestamp[2]}Z`
    : value;
}, z.string().datetime());
