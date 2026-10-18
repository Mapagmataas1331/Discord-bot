import type { Command } from "../types.js";
import avatar from "./avatar.js";
import getrole from "./getrole.js";
import djrole from "./djrole.js";
import help from "./help.js";
import innerrole from "./innerrole.js";
import modlog from "./modlog.js";
import { musicCommands } from "./music.js";
import ping from "./ping.js";
import poll from "./poll.js";
import purge from "./purge.js";
import remind from "./remind.js";
import rolemenu from "./rolemenu.js";
import rules from "./rules.js";
import serverinfo from "./serverinfo.js";
import setadminroles from "./setadminroles.js";
import setcmdchannel from "./setcmdchannel.js";
import settings from "./settings.js";
import timeout from "./timeout.js";
import userinfo from "./userinfo.js";
import warn from "./warn.js";
import warnings from "./warnings.js";
import watch from "./watch.js";
import welcome from "./welcome.js";

/** Every slash command the bot knows. Add new commands here. */
export const commands: readonly Command[] = [
  // general
  help,
  ping,
  rules,
  // music
  ...musicCommands,
  // utility
  userinfo,
  serverinfo,
  avatar,
  poll,
  remind,
  watch,
  // moderation
  timeout,
  purge,
  warn,
  warnings,
  // admin
  settings,
  setadminroles,
  setcmdchannel,
  modlog,
  djrole,
  innerrole,
  welcome,
  getrole,
  rolemenu,
];

export const commandMap: ReadonlyMap<string, Command> = new Map(
  commands.map((command) => [command.data.name, command]),
);
