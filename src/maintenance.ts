#!/usr/bin/env node
import { runMaintenanceCli } from "./maintenance/cli.js";

process.exitCode = await runMaintenanceCli(process.argv.slice(2));
