import type { Command } from "../types.js";
import getrole from "./getrole.js";
import ping from "./ping.js";
import rules from "./rules.js";
import setadminroles from "./setadminroles.js";
import setcmdchannel from "./setcmdchannel.js";

/** Every slash command the bot knows. Add new commands here. */
export const commands: readonly Command[] = [ping, rules, getrole, setadminroles, setcmdchannel];

export const commandMap: ReadonlyMap<string, Command> = new Map(
  commands.map((command) => [command.data.name, command]),
);
